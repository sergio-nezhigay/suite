import { ActionOptions } from 'gadget-server';

/**
 * One-time cleanup action to remove duplicate bankTransaction records
 * created by the now-fixed random-externalId fallback bug.
 *
 * Grouping key: same date (YYYY-MM-DD) + amount + counterpartyAccount
 * Keep: the record with checkReceiptId set, or the oldest record if none have a receipt
 * Delete: all other records in the group
 */
export const run = async ({ api, logger }: any) => {
  logger.info('Starting bankTransaction deduplication...');

  let totalFetched = 0;
  let totalGroups = 0;
  let totalDuplicatesRemoved = 0;
  const removedIds: string[] = [];

  // Paginate through all bankTransaction records
  let after: string | undefined = undefined;
  let hasMore = true;
  const allRecords: any[] = [];

  while (hasMore) {
    const page = await api.bankTransaction.findMany({
      select: {
        id: true,
        externalId: true,
        transactionDateTime: true,
        amount: true,
        counterpartyAccount: true,
        checkReceiptId: true,
        checkIssuedAt: true,
        createdAt: true,
      },
      sort: { createdAt: 'Ascending' },
      first: 250,
      after,
    });

    allRecords.push(...page);
    totalFetched += page.length;

    if (page.hasNextPage) {
      after = page.endCursor;
    } else {
      hasMore = false;
    }
  }

  logger.info(`Fetched ${totalFetched} total bankTransaction records`);

  // Group records by (date, amount, counterpartyAccount)
  const groups = new Map<string, any[]>();

  for (const record of allRecords) {
    const date = record.transactionDateTime
      ? new Date(record.transactionDateTime).toISOString().split('T')[0]
      : 'nodate';
    const amount = record.amount?.toString() || '0';
    const account = (record.counterpartyAccount || '').trim();
    const key = `${date}__${amount}__${account}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(record);
  }

  // Process each group — delete duplicates, keep one canonical record
  for (const [key, records] of groups.entries()) {
    if (records.length <= 1) continue;

    totalGroups++;

    // Prefer the record with a checkReceiptId; otherwise keep the oldest (first by createdAt)
    const withReceipt = records.filter((r) => r.checkReceiptId);
    const canonical = withReceipt.length > 0 ? withReceipt[0] : records[0];

    const toDelete = records.filter((r) => r.id !== canonical.id);

    logger.info(
      `Group "${key}": ${records.length} records — keeping ${canonical.id}, deleting ${toDelete.length}`,
      { keepId: canonical.id, deleteIds: toDelete.map((r: any) => r.id) }
    );

    for (const dup of toDelete) {
      try {
        await api.bankTransaction.delete(dup.id);
        removedIds.push(dup.id);
        totalDuplicatesRemoved++;
      } catch (err) {
        logger.error(`Failed to delete duplicate record ${dup.id}: ${err}`);
      }
    }
  }

  logger.info('Deduplication complete', {
    totalFetched,
    duplicateGroups: totalGroups,
    totalDuplicatesRemoved,
  });

  return {
    success: true,
    totalFetched,
    duplicateGroups: totalGroups,
    totalDuplicatesRemoved,
    removedIds,
  };
};

export const options: ActionOptions = {
  actionType: 'custom',
};
