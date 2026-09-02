import { logger } from 'gadget-server';

// Skip a fresh sync if one ran this recently. Collapses the React.StrictMode
// double-invoke on /payments and back-to-back reloads / re-clicks into one sync.
const RECENT_SYNC_MS = 3 * 60 * 1000;

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

    if (
      lastSyncedTransaction?.syncedAt &&
      now.getTime() - lastSyncTime.getTime() < RECENT_SYNC_MS
    ) {
      logger.info(
        { lastSyncTime: lastSyncTime.toISOString() },
        'Bank refresh skipped - a sync ran within the last 3 minutes'
      );
      return { success: true, skipped: true, reason: 'recent-sync' };
    }

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
