import { ActionOptions } from 'gadget-server';
import * as crypto from 'crypto';

// Define the interface to match what fetchPrivatBankTransactions returns
interface PrivatBankTransaction {
  id: string | undefined;
  date: string | undefined;
  time: string | undefined;
  amount: number;
  currency: string;
  type: 'income' | 'expense';
  description: string;
  reference: string | undefined;
}

export const run = async ({ params, logger, api, connections, config }: any) => {
  // Only run in production environment
  if (config.NODE_ENV !== 'production') {
    logger.info('syncBankTransactions skipped - only runs in production environment', {
      currentEnvironment: config.NODE_ENV
    });
    
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
        skipped_reason: 'non_production_environment'
      }
    };
  }

  const syncStartTime = new Date();
  logger.info('Starting bank transaction sync process');
  
  // Diagnostic logging for API availability
  logger.info('API diagnostic info', {
    apiAvailable: !!api,
    bankTransactionAvailable: !!api?.bankTransaction,
    bankTransactionMethods: api?.bankTransaction ? Object.keys(api.bankTransaction) : [],
    apiKeys: api ? Object.keys(api).filter(key => key.includes('bank')) : []
  });

  let totalProcessed = 0;
  let totalCreated = 0;
  let totalDuplicates = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Get the number of days to sync (default 7 days for comprehensive coverage)
    const daysBack = params?.daysBack || 7;
    
    logger.info(`Syncing bank transactions for the last ${daysBack} days`);

    // Call the existing fetchPrivatBankTransactions action
    const fetchResult = await api.fetchPrivatBankTransactions({ daysBack });

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
          errors: 1
        }
      };
    }

    const transactions = fetchResult.transactions || [];
    logger.info(`Fetched ${transactions.length} transactions from PrivatBank`);

    // Validate transaction data structure
    const validTransactions: PrivatBankTransaction[] = [];
    
    for (const transaction of transactions) {
      totalProcessed++;
      
      // Validate basic structure
      if (typeof transaction !== 'object' || transaction === null) {
        const errorMsg = `Invalid transaction structure at index ${totalProcessed - 1}`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
        totalErrors++;
        continue;
      }
      
      validTransactions.push(transaction as PrivatBankTransaction);
    }

    logger.info(`${validTransactions.length} transactions passed structure validation`);

    // Process each valid transaction
    for (const transaction of validTransactions) {
      try {
        // 1. Create robust external ID
        let externalId: string;
        
        if (transaction.id) {
          externalId = transaction.id;
        } else if (transaction.reference) {
          externalId = transaction.reference;
        } else {
          // Create unique fallback ID with timestamp, random component, and counter
          const timestamp = Date.now();
          const randomHash = crypto.randomBytes(4).toString('hex');
          externalId = `privatbank_${timestamp}_${randomHash}_${totalProcessed}`;
          
          const warningMsg = `Generated fallback externalId for transaction: ${externalId}`;
          logger.warn(warningMsg);
          warnings.push(warningMsg);
        }

        // Validate externalId
        if (!externalId || externalId.trim() === '') {
          const errorMsg = `Empty externalId for transaction at position ${totalProcessed}`;
          logger.error(errorMsg);
          errors.push(errorMsg);
          totalErrors++;
          continue;
        }

        // 2. Check for duplicates with proper handling of "no data" response
        let existingTransaction = null;
        let shouldSkipTransaction = false;

        try {
          // Verify the API method exists before calling
          if (!api.bankTransaction || typeof api.bankTransaction.findFirst !== 'function') {
            throw new Error('bankTransaction.findFirst method not available in API');
          }

          existingTransaction = await api.bankTransaction.findFirst({
            filter: { externalId: { equals: externalId.trim() } }
          });

          logger.debug(`Duplicate check completed for externalId: ${externalId} - found: ${!!existingTransaction}`);

        } catch (duplicateCheckError) {
          const errorMessage = duplicateCheckError instanceof Error ? duplicateCheckError.message : String(duplicateCheckError);

          // Handle the specific "no data" case - this means no duplicates found, which is good!
          if (errorMessage.includes('Gadget API returned no data') ||
              errorMessage.includes('Record Not Found Error')) {
            logger.debug(`No existing transaction found for externalId: ${externalId} - proceeding with creation`);
            existingTransaction = null; // Explicitly set to null to proceed
          } else {
            // This is a real error that we should handle
            const errorMsg = `Failed to check for duplicate transaction ${externalId}: ${errorMessage}`;
            logger.error(errorMsg, {
              externalId,
              apiAvailable: !!api.bankTransaction,
              findFirstAvailable: !!(api.bankTransaction && typeof api.bankTransaction.findFirst === 'function')
            });
            errors.push(errorMsg);
            totalErrors++;
            shouldSkipTransaction = true;
          }
        }

        if (shouldSkipTransaction) {
          continue; // Skip this transaction due to real error
        }

        if (existingTransaction) {
          logger.debug(`Skipping duplicate transaction: ${externalId}`);
          totalDuplicates++;
          continue;
        }

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
            
            if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12 || yearNum < 1900) {
              throw new Error(`Invalid date values: ${transaction.date}`);
            }
            
            if (transaction.time) {
              // Validate time format HH:MM
              const timePattern = /^(\d{2}):(\d{2})$/;
              const timeMatch = transaction.time.match(timePattern);
              
              if (!timeMatch) {
                logger.warn(`Invalid time format for transaction ${externalId}: ${transaction.time}, using 00:00`);
                transactionDateTime = new Date(`${dateStr}T00:00:00.000Z`);
              } else {
                const [, hours, minutes] = timeMatch;
                const hoursNum = parseInt(hours, 10);
                const minutesNum = parseInt(minutes, 10);
                
                if (hoursNum < 0 || hoursNum > 23 || minutesNum < 0 || minutesNum > 59) {
                  logger.warn(`Invalid time values for transaction ${externalId}: ${transaction.time}, using 00:00`);
                  transactionDateTime = new Date(`${dateStr}T00:00:00.000Z`);
                } else {
                  transactionDateTime = new Date(`${dateStr}T${transaction.time}:00.000Z`);
                }
              }
            } else {
              transactionDateTime = new Date(`${dateStr}T00:00:00.000Z`);
            }
            
            // Validate the final date
            if (isNaN(transactionDateTime.getTime())) {
              throw new Error(`Invalid date object created from: ${transaction.date} ${transaction.time}`);
            }
            
          } catch (dateError) {
            const errorMessage = dateError instanceof Error ? dateError.message : String(dateError);
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
        const amount = typeof transaction.amount === 'number' ? transaction.amount : 0;
        
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
        if (!transaction.type || !['income', 'expense'].includes(transaction.type)) {
          const errorMsg = `Invalid transaction type for ${externalId}: ${transaction.type}`;
          logger.error(errorMsg);
          errors.push(errorMsg);
          totalErrors++;
          continue;
        }

        // 6. Sanitize and validate other fields
        const currency = (transaction.currency || 'UAH').toUpperCase().trim();
        const description = (transaction.description || '').substring(0, 1000); // Prevent overly long descriptions
        const reference = transaction.reference ? transaction.reference.substring(0, 100) : ''; // Limit reference length

        // 7. Create the bank transaction record with proper error handling
        try {
          // Verify the API create method exists
          if (!api.bankTransaction || typeof api.bankTransaction.create !== 'function') {
            throw new Error('bankTransaction.create method not available in API');
          }

          const newTransaction = await api.bankTransaction.create({
            externalId: externalId.trim(),
            transactionDateTime: transactionDateTime,
            amount: amount,
            currency: currency,
            type: transaction.type,
            description: description,
            reference: reference,
            rawData: transaction, // Store the complete original transaction data
            status: 'processed',
            syncedAt: syncStartTime
          });

          logger.debug(`Created transaction record: ${newTransaction.id} (${externalId})`);
          totalCreated++;

        } catch (createError) {
          const errorMsg = `Failed to create transaction record for ${externalId}: ${createError instanceof Error ? createError.message : String(createError)}`;
          logger.error(errorMsg, {
            externalId,
            transactionData: {
              externalId: externalId.trim(),
              transactionDateTime: transactionDateTime.toISOString(),
              amount,
              currency,
              type: transaction.type,
              description: description.substring(0, 100), // Truncate for logging
              reference
            },
            apiAvailable: !!api.bankTransaction,
            createAvailable: !!(api.bankTransaction && typeof api.bankTransaction.create === 'function')
          });
          errors.push(errorMsg);
          totalErrors++;
          continue; // Continue processing other transactions
        }

      } catch (transactionError) {
        const errorMsg = `Error processing transaction ${transaction.id || transaction.reference || 'unknown'}: ${transactionError instanceof Error ? transactionError.message : String(transactionError)}`;
        logger.error(errorMsg, { 
          transactionData: transaction,
          stack: transactionError instanceof Error ? transactionError.stack : undefined 
        });
        errors.push(errorMsg);
        totalErrors++;
      }
    }

    const syncEndTime = new Date();
    const syncDuration = syncEndTime.getTime() - syncStartTime.getTime();

    const summary = {
      processed: totalProcessed,
      created: totalCreated,
      duplicates: totalDuplicates,
      skipped: totalSkipped,
      errors: totalErrors,
      warnings: warnings.length,
      duration: `${syncDuration}ms`,
      period: fetchResult.period
    };

    logger.info('Bank transaction sync completed', summary);

    return {
      success: true,
      message: `Sync completed: ${totalCreated} new transactions created, ${totalDuplicates} duplicates skipped, ${totalErrors} errors, ${warnings.length} warnings`,
      summary,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('Fatal error during bank transaction sync', { 
      error: errorMessage, 
      stack: errorStack 
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
        warnings: warnings.length
      }
    };
  }
};

// Parameters for the action
export const params = {
  daysBack: { 
    type: 'number', 
    default: 3,
    description: 'Number of days back to sync transactions (default: 3 days)' 
  }
};

export const options = {
  triggers: {
    scheduler: [{ cron: '0 9 * * *' }],
  },
};