import { logger } from 'gadget-server';

export async function refreshBankDataSinceLastSync(api: any) {
  try {
    // Get most recent sync timestamp
    const lastSyncedTransaction = await api.bankTransaction.findFirst({
      sort: { syncedAt: 'Descending' },
      select: { syncedAt: true },
    });

    const lastSyncTime =
      lastSyncedTransaction?.syncedAt ||
      new Date(Date.now() - 24 * 60 * 60 * 1000);
    const now = new Date();
    const daysSinceSync = Math.ceil(
      (now.getTime() - lastSyncTime.getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysToFetch = Math.max(1, Math.min(daysSinceSync, 10));
    // Trigger sync for the gap period
    const syncResult = await api.syncBankTransactions({
      daysBack: daysToFetch,
    });

    if (syncResult.success) {
    } else {
      logger.warn({ error: syncResult.error }, 'Bank refresh failed');
    }

    return syncResult;
  } catch (error) {
    logger.error({ err: error }, 'Error in refreshBankDataSinceLastSync');
    throw error;
  }
}
