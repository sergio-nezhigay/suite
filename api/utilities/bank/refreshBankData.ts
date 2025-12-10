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

    console.log(
      `Refreshing bank data: last sync ${lastSyncTime.toISOString()}, fetching ${daysToFetch} days`
    );

    // Trigger sync for the gap period
    const syncResult = await api.syncBankTransactions({
      daysBack: daysToFetch,
    });

    if (syncResult.success) {
      console.log(
        `Bank refresh completed: ${syncResult.summary.created} new, ${syncResult.summary.duplicates} duplicates`
      );
    } else {
      console.warn(`Bank refresh failed: ${syncResult.error}`);
    }

    return syncResult;
  } catch (error) {
    console.error('Error in refreshBankDataSinceLastSync:', error);
    throw error;
  }
}
