import { ActionOptions } from 'gadget-server';
import crypto from 'crypto';

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

export const run: ActionRun = async ({ params, logger, api, connections }) => {
  const syncStartTime = new Date();
  logger.info('Starting bank transaction sync process');

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

        // 2. Check for duplicates
        const existingTransaction = await api.bankTransaction.findFirst({
          filter: { externalId: { equals: externalId.trim() } }
        });

        if (existingTransaction) {
          logger.debug(`Skipping duplicate transaction: ${externalId}`);
          totalDuplicates++;
          continue;
        }

        // 3. Validate and parse date/time
        let transactionDateTime: Date;
        
        if (transaction.date) {
          try {
            // Handle DD-MM-YYYY format from PrivatBank
            const datePattern = /^(\d{2})-(\d{2})-(\d{4})$/;
            const dateMatch = transaction.date.match(datePattern);
            
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
            const errorMsg = `Failed to parse date/time for transaction ${externalId}: ${transaction.date} ${transaction.time}. Error: ${dateError.message}`;
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

        // 7. Create the bank transaction record
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
    default: 7,
    description: 'Number of days back to sync transactions (default: 7 days)' 
  }
};

export const options = {
  triggers: {
    scheduler: [{ cron: '0 9 * * *' }],
  },
};