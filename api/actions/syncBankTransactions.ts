import { ActionOptions } from 'gadget-server';
import { fetchPrivatBankTransactions, PrivatBankTransaction } from '../utilities/bank/fetchPrivatBankTransactions';
import { deriveExternalId } from '../utilities/bank/transactionIdentity';
import { timeIt } from 'api/utilities/timeIt';

export const run = async ({
  params,
  logger,
  api,
  connections,
  config,
}: any) => {
  // Only run in production environment.
  if (config.NODE_ENV !== 'production') {
    logger.info(
      'syncBankTransactions skipped - only runs in production environment',
      {
        currentEnvironment: config.NODE_ENV,
      }
    );

    return {
      success: true,
      message: 'Action skipped - only runs in production environment',
      summary: {
        processed: 0,
        created: 0,
        duplicates: 0,
        skipped: 0,
        errors: 0,
        warnings: 0,
        environment: config.NODE_ENV,
        skipped_reason: 'non_production_environment',
      },
    };
  }

  const syncStartTime = new Date();


  let totalProcessed = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalDuplicates = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Get the number of days to sync (default 10 days for comprehensive coverage)
    const daysBack = params?.daysBack || 3;

    logger.info(`Syncing bank transactions for the last ${daysBack} days`);

    // Debug: Log current date and sync range
    const today = new Date();
    const syncStartDate = new Date();
    syncStartDate.setDate(syncStartDate.getDate() - daysBack);
    // Debug: Log sync action details
    // Call the shared utility function instead of a separate action
    const fetchResult = await timeIt(
      'fetch_bank_transactions',
      () => fetchPrivatBankTransactions({ config, daysBack }),
      logger,
      { days_back: daysBack }
    );

    if (!fetchResult.success) {
      const errorMsg = `Failed to fetch transactions: ${fetchResult.message}`;
      logger.error(errorMsg);
      return {
        success: false,
        error: errorMsg,
        summary: {
          processed: 0,
          created: 0,
          duplicates: 0,
          skipped: 0,
          errors: 1,
        },
      };
    }

    const transactions = fetchResult.transactions || [];
    logger.info(`Fetched ${transactions.length} transactions from PrivatBank`);

    // Load ALL existing externalIds using a wider window (daysBack + 7)
    // to catch transactions PrivatBank returns that fall slightly outside the sync window
    const existingIdsLookbackDate = new Date();
    existingIdsLookbackDate.setDate(existingIdsLookbackDate.getDate() - (daysBack + 7));

    // Map every existing row in the window under BOTH its stored externalId and
    // its REF-based key, so a transaction PrivatBank re-sends with a renumbered
    // ID resolves to the row we already have (and gets updated, not duplicated).
    const existingByKey = new Map<
      string,
      { id: string; externalId: string; amount: number | null }
    >();
    const existingRows: any[] = [];
    let existingPage: any = await api.bankTransaction.findMany({
      filter: {
        transactionDateTime: { greaterThanOrEqual: existingIdsLookbackDate.toISOString() },
      },
      select: { id: true, externalId: true, reference: true, amount: true },
      first: 250,
    });
    existingRows.push(...existingPage);
    while (existingPage.hasNextPage) {
      existingPage = await existingPage.nextPage();
      existingRows.push(...existingPage);
    }
    for (const r of existingRows) {
      const row = { id: r.id, externalId: r.externalId, amount: r.amount ?? null };
      if (r.externalId) existingByKey.set(r.externalId, row);
      const refKey = deriveExternalId({ reference: r.reference, id: r.externalId });
      if (refKey) existingByKey.set(refKey, row);
    }
    logger.info(`Indexed ${existingByKey.size} existing transaction keys from DB`);

    // Debug: Show transaction date distribution
    if (transactions.length > 0) {
      const transactionsByDate = transactions.reduce(
        (acc: Record<string, number>, tx: PrivatBankTransaction) => {
          if (tx.date) {
            acc[tx.date] = (acc[tx.date] || 0) + 1;
          }
          return acc;
        },
        {} as Record<string, number>
      );

      logger.info(
        'DEBUG - Transaction distribution by date:',
        transactionsByDate
      );

      // Show most recent transactions
      const recentTransactions = transactions
        .filter((t: PrivatBankTransaction) => t.date)
        .sort((a: PrivatBankTransaction, b: PrivatBankTransaction) =>
          (b.date! + (b.time || '')).localeCompare(a.date! + (a.time || ''))
        )
        .slice(0, 5);

      logger.info('DEBUG - 5 most recent transactions from API:');
      recentTransactions.forEach((tx: PrivatBankTransaction, i: number) => {
        logger.info(
          `  ${i + 1}. ${tx.date} ${tx.time || ''} - ${tx.amount} ${
            tx.currency
          } (${tx.type}) - ID: ${tx.id || tx.reference}`
        );
      });
    }

    // Validate transaction data structure
    const validTransactions: PrivatBankTransaction[] = [];

    for (const transaction of transactions) {
      totalProcessed++;

      // Validate basic structure
      if (typeof transaction !== 'object' || transaction === null) {
        const errorMsg = `Invalid transaction structure at index ${
          totalProcessed - 1
        }`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
        totalErrors++;
        continue;
      }

      validTransactions.push(transaction as PrivatBankTransaction);
    }

    logger.info(
      `${validTransactions.length} transactions passed structure validation`
    );

    // Verify the API create method exists once before processing
    if (
      !api.bankTransaction ||
      typeof api.bankTransaction.create !== 'function'
    ) {
      throw new Error(
        'bankTransaction.create method not available in API'
      );
    }

    // Process each valid transaction
    let totalDbWriteMs = 0;
    const loopStart = performance.now();
    await timeIt('process_transactions_loop', async () => {
    for (const transaction of validTransactions) {
      try {
        // 1. Stable identity (REF-based; falls back to ID, then a composite).
        const externalId = deriveExternalId(transaction);
        if (externalId.startsWith('privatbank_')) {
          const warningMsg = `No REF/ID on transaction, using composite externalId: ${externalId}`;
          logger.warn(warningMsg);
          warnings.push(warningMsg);
        }

        // 2. Is this a transaction we already have (same REF or same stored id)?
        let existing = existingByKey.get(externalId);

        // 3. Validate and parse date/time
        let transactionDateTime: Date;

        if (transaction.date) {
          try {
            // Handle both DD.MM.YYYY and DD-MM-YYYY formats from PrivatBank
            const dotPattern = /^(\d{2})\.(\d{2})\.(\d{4})$/;
            const dashPattern = /^(\d{2})-(\d{2})-(\d{4})$/;

            const dotMatch = transaction.date.match(dotPattern);
            const dashMatch = transaction.date.match(dashPattern);
            const dateMatch = dotMatch || dashMatch;

            if (!dateMatch) {
              throw new Error(`Invalid date format: ${transaction.date}`);
            }

            const [, day, month, year] = dateMatch;
            const dateStr = `${year}-${month}-${day}`;

            // Validate date components
            const dayNum = parseInt(day, 10);
            const monthNum = parseInt(month, 10);
            const yearNum = parseInt(year, 10);

            if (
              dayNum < 1 ||
              dayNum > 31 ||
              monthNum < 1 ||
              monthNum > 12 ||
              yearNum < 1900
            ) {
              throw new Error(`Invalid date values: ${transaction.date}`);
            }

            if (transaction.time) {
              // Validate time format HH:MM
              const timePattern = /^(\d{2}):(\d{2})$/;
              const timeMatch = transaction.time.match(timePattern);

              if (!timeMatch) {
                logger.warn(
                  `Invalid time format for transaction ${externalId}: ${transaction.time}, using 00:00`
                );
                transactionDateTime = new Date(`${dateStr}T00:00:00.000Z`);
              } else {
                const [, hours, minutes] = timeMatch;
                const hoursNum = parseInt(hours, 10);
                const minutesNum = parseInt(minutes, 10);

                if (
                  hoursNum < 0 ||
                  hoursNum > 23 ||
                  minutesNum < 0 ||
                  minutesNum > 59
                ) {
                  logger.warn(
                    `Invalid time values for transaction ${externalId}: ${transaction.time}, using 00:00`
                  );
                  transactionDateTime = new Date(`${dateStr}T00:00:00.000Z`);
                } else {
                  transactionDateTime = new Date(
                    `${dateStr}T${transaction.time}:00.000Z`
                  );
                }
              }
            } else {
              transactionDateTime = new Date(`${dateStr}T00:00:00.000Z`);
            }

            // Validate the final date
            if (isNaN(transactionDateTime.getTime())) {
              throw new Error(
                `Invalid date object created from: ${transaction.date} ${transaction.time}`
              );
            }
          } catch (dateError) {
            const errorMessage =
              dateError instanceof Error
                ? dateError.message
                : String(dateError);
            const errorMsg = `Failed to parse date/time for transaction ${externalId}: ${transaction.date} ${transaction.time}. Error: ${errorMessage}`;
            logger.error(errorMsg);
            errors.push(errorMsg);
            totalErrors++;
            continue;
          }
        } else {
          // No date provided - this is a critical error since transactionDateTime is required
          const errorMsg = `Missing date for transaction ${externalId}`;
          logger.error(errorMsg);
          errors.push(errorMsg);
          totalErrors++;
          continue;
        }

        // 4. Validate amount (fetchPrivatBankTransactions already returns Math.abs values >= 0)
        const amount =
          typeof transaction.amount === 'number' ? transaction.amount : 0;

        // Database allows min:0, so accept 0 amounts but log a warning
        if (amount === 0) {
          const warningMsg = `Zero amount for transaction ${externalId}`;
          logger.warn(warningMsg);
          warnings.push(warningMsg);
        }

        // Check database maximum constraint
        if (amount > 1000000) {
          const errorMsg = `Amount exceeds database maximum (1,000,000) for transaction ${externalId}: ${amount}`;
          logger.error(errorMsg);
          errors.push(errorMsg);
          totalErrors++;
          continue;
        }

        // 5. Validate transaction type
        if (
          !transaction.type ||
          !['income', 'expense'].includes(transaction.type)
        ) {
          const errorMsg = `Invalid transaction type for ${externalId}: ${transaction.type}`;
          logger.error(errorMsg);
          errors.push(errorMsg);
          totalErrors++;
          continue;
        }

        // 6. Sanitize and validate other fields
        const currency = (transaction.currency || 'UAH').toUpperCase().trim();
        const description = (transaction.description || '').substring(0, 1000); // Prevent overly long descriptions
        const reference = transaction.reference
          ? transaction.reference.substring(0, 100)
          : ''; // Limit reference length
        const counterpartyAccount = transaction.counterpartyAccount
          ? transaction.counterpartyAccount.trim().substring(0, 100)
          : '';
        const counterpartyName = transaction.counterpartyName
          ? transaction.counterpartyName.trim().substring(0, 255)
          : '';

        // A different amount under the same key means this is NOT the same
        // transaction (e.g. a second leg sharing one REF). Never merge those —
        // fall through to create, and make the collision visible.
        if (
          existing &&
          existing.amount != null &&
          Math.abs(existing.amount - amount) > 0.01
        ) {
          const warningMsg = `Key ${externalId} already on a row with amount ${existing.amount}, incoming amount ${amount} — creating a separate row`;
          logger.warn(warningMsg);
          warnings.push(warningMsg);
          existing = undefined;
        }

        // 7. Write the record: update the row we already have, else create it.
        //    On update we only refresh descriptive fields + syncedAt — never
        //    amount, account, matchedOrderId or any check/skip state.
        const rawData = (transaction as any).raw ?? transaction;
        try {
          const dbWriteStart = performance.now();
          if (existing) {
            await timeIt('db_write_transaction', () => api.bankTransaction.update(existing.id, {
              externalId: externalId.trim(),
              transactionDateTime: transactionDateTime,
              description: description,
              reference: reference,
              counterpartyName: counterpartyName,
              rawData: rawData,
              syncedAt: syncStartTime,
            }), logger, { externalId });
            totalUpdated++;
          } else {
            await timeIt('db_write_transaction', () => api.bankTransaction.create({
              externalId: externalId.trim(),
              transactionDateTime: transactionDateTime,
              amount: amount,
              currency: currency,
              type: transaction.type,
              description: description,
              reference: reference,
              counterpartyAccount: counterpartyAccount,
              counterpartyName: counterpartyName,
              rawData: rawData,
              status: 'processed',
              syncedAt: syncStartTime,
            }), logger, { externalId });
            totalCreated++;
          }
          totalDbWriteMs += Math.round(performance.now() - dbWriteStart);
        } catch (createError) {
          const createErrorMessage = createError instanceof Error
            ? createError.message
            : String(createError);

          // Lost a race with a concurrent sync — the row now exists; update it.
          if (
            createErrorMessage.toLowerCase().includes('unique') ||
            createErrorMessage.toLowerCase().includes('duplicate') ||
            createErrorMessage.toLowerCase().includes('already exists')
          ) {
            try {
              const row = await api.bankTransaction.findFirst({
                filter: { externalId: { equals: externalId.trim() } },
                select: { id: true },
              });
              if (row) {
                await api.bankTransaction.update(row.id, {
                  transactionDateTime,
                  description,
                  reference,
                  counterpartyName,
                  rawData,
                  syncedAt: syncStartTime,
                });
                totalUpdated++;
              } else {
                totalDuplicates++;
              }
            } catch (retryError) {
              logger.warn(
                `Duplicate on create for ${externalId}, and update retry failed: ${
                  retryError instanceof Error ? retryError.message : String(retryError)
                }`
              );
              totalDuplicates++;
            }
            continue;
          }

          const errorMsg = `Failed to create transaction record for ${externalId}: ${createErrorMessage}`;
          logger.error(errorMsg, {
            externalId,
            transactionData: {
              externalId: externalId.trim(),
              transactionDateTime: transactionDateTime.toISOString(),
              amount,
              currency,
              type: transaction.type,
              description: description.substring(0, 100), // Truncate for logging
              reference,
            },
            apiAvailable: !!api.bankTransaction,
            createAvailable: !!(
              api.bankTransaction &&
              typeof api.bankTransaction.create === 'function'
            ),
          });
          errors.push(errorMsg);
          totalErrors++;
          continue; // Continue processing other transactions
        }
      } catch (transactionError) {
        const errorMsg = `Error processing transaction ${
          transaction.id || transaction.reference || 'unknown'
        }: ${
          transactionError instanceof Error
            ? transactionError.message
            : String(transactionError)
        }`;
        logger.error(errorMsg, {
          transactionData: transaction,
          stack:
            transactionError instanceof Error
              ? transactionError.stack
              : undefined,
        });
        errors.push(errorMsg);
        totalErrors++;
      }
    }
    }, logger, { total_fetched: validTransactions.length });
    const loop_duration_ms = Math.round(performance.now() - loopStart);

    const syncEndTime = new Date();
    const syncDuration = syncEndTime.getTime() - syncStartTime.getTime();

    const summary = {
      processed: totalProcessed,
      created: totalCreated,
      updated: totalUpdated,
      duplicates: totalDuplicates,
      skipped: totalSkipped,
      errors: totalErrors,
      warnings: warnings.length,
      duration: `${syncDuration}ms`,
      period: fetchResult.period,
    };

    logger.info({
      stage: 'sync_summary',
      total_processed: totalProcessed,
      total_created: totalCreated,
      total_updated: totalUpdated,
      total_duplicates: totalDuplicates,
      loop_duration_ms,
      avg_db_write_ms:
        totalCreated + totalUpdated > 0
          ? Math.round(totalDbWriteMs / (totalCreated + totalUpdated))
          : 0,
    }, 'Sync summary');

    logger.info('Bank transaction sync completed', summary);

    return {
      success: true,
      message: `Sync completed: ${totalCreated} created, ${totalUpdated} updated, ${totalDuplicates} duplicates skipped, ${totalErrors} errors, ${warnings.length} warnings`,
      summary,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error('Fatal error during bank transaction sync', {
      error: errorMessage,
      stack: errorStack,
    });

    return {
      success: false,
      error: errorMessage,
      summary: {
        processed: totalProcessed,
        created: totalCreated,
        duplicates: totalDuplicates,
        skipped: totalSkipped,
        errors: totalErrors + 1,
        warnings: warnings.length,
      },
    };
  }
};

// Parameters for the action
export const params = {
  daysBack: {
    type: 'number',
    default: 3,
    description: 'Number of days back to sync transactions (default: 3 days)',
  },
};

export const options = {
  triggers: {
    api: true,
  },
};
