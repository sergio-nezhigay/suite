import { ActionOptions } from 'gadget-server';
import { fetchPrivatBankTransactions } from '../utilities/bank/fetchPrivatBankTransactions';

/**
 * TEMPORARY read-only diagnostic for the "payments shown twice" investigation.
 * Safe to delete once the duplicate-import fix has shipped. It never writes.
 *
 * Run from the Gadget action console:
 *   await api.diagnoseDuplicatePayments({ daysBack: 14, apiDaysBack: 3 })
 *
 * Part 1 — DB side: groups bankTransaction rows by the same natural key the
 * cleanup action uses (`YYYY-MM-DD__amount__account`) and prints every group
 * with more than one row, so we can see WHICH field drifted between the two
 * rows of a duplicate pair (externalId / reference / description / time).
 *
 * Part 2 — PrivatBank side: fetches a fresh statement and dumps the raw
 * transaction objects (ID / REF / REFN / NUM_DOC / DAT_OD / TIM_P / OSND /
 * FL_REAL / PR_PR ...) so we can decide:
 *   - is REF a stable, one-per-transaction id, identical on pending & posted?
 *   - what values do FL_REAL / PR_PR take, and are they always present?
 */

const naturalKey = (r: any): string => {
  const date = r.transactionDateTime
    ? new Date(r.transactionDateTime).toISOString().split('T')[0]
    : 'nodate';
  const amount = r.amount?.toString() || '0';
  const account = (r.counterpartyAccount || '').trim();
  return `${date}__${amount}__${account}`;
};

export const run = async ({ params, api, logger, config }: any) => {
  const daysBack = Number((params as any)?.daysBack) || 14;
  const apiDaysBack = Number((params as any)?.apiDaysBack) || 3;
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  // ---- Part 1: DB-side duplicate grouping -----------------------------------
  const rows: any[] = [];
  let records = await api.bankTransaction.findMany({
    filter: {
      transactionDateTime: { greaterThan: since },
      type: { equals: 'income' },
    },
    select: {
      id: true,
      externalId: true,
      reference: true,
      description: true,
      amount: true,
      counterpartyAccount: true,
      counterpartyName: true,
      transactionDateTime: true,
      matchedOrderId: true,
      checkReceiptId: true,
      checkIssuedAt: true,
      checkSkipReason: true,
      status: true,
      syncedAt: true,
      createdAt: true,
      rawData: true,
    },
    sort: { transactionDateTime: 'Descending' },
    first: 250,
  });
  rows.push(...records);
  while (records.hasNextPage) {
    records = await records.nextPage();
    rows.push(...records);
  }

  const groups = new Map<string, any[]>();
  for (const r of rows) {
    const key = naturalKey(r);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const duplicateGroups: any[] = [];
  for (const [key, group] of groups.entries()) {
    if (group.length <= 1) continue;
    duplicateGroups.push({
      key,
      count: group.length,
      rows: group.map((r) => ({
        id: r.id,
        externalId: r.externalId,
        reference: r.reference,
        description: r.description,
        transactionDateTime: r.transactionDateTime,
        amount: r.amount,
        counterpartyAccount: r.counterpartyAccount,
        counterpartyName: r.counterpartyName,
        matchedOrderId: r.matchedOrderId,
        checkReceiptId: r.checkReceiptId,
        checkIssuedAt: r.checkIssuedAt,
        checkSkipReason: r.checkSkipReason,
        status: r.status,
        syncedAt: r.syncedAt,
        createdAt: r.createdAt,
        rawData: r.rawData,
      })),
      // quick per-field drift flags to make the log skimmable
      drift: {
        externalId: new Set(group.map((r) => r.externalId)).size > 1,
        reference: new Set(group.map((r) => r.reference)).size > 1,
        description: new Set(group.map((r) => r.description)).size > 1,
        transactionDateTime:
          new Set(
            group.map((r) =>
              r.transactionDateTime
                ? new Date(r.transactionDateTime).toISOString()
                : null
            )
          ).size > 1,
      },
    });
  }

  // ---- Part 2: raw PrivatBank statement ------------------------------------
  let privatBank: any;
  try {
    const fetchResult: any = await fetchPrivatBankTransactions({
      config,
      daysBack: apiDaysBack,
    });
    privatBank = {
      success: fetchResult?.success ?? false,
      error: fetchResult?.error,
      message: fetchResult?.message,
      period: fetchResult?.period,
      count: Array.isArray(fetchResult?.transactions)
        ? fetchResult.transactions.length
        : 0,
      // whatever the util currently exposes per transaction; `raw` appears once
      // Step 1 of the plan attaches the untouched PrivatBank object
      sample: Array.isArray(fetchResult?.transactions)
        ? fetchResult.transactions.slice(0, 15)
        : [],
    };
  } catch (err) {
    privatBank = {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const result = {
    daysBack,
    since: since.toISOString(),
    scannedRows: rows.length,
    duplicateGroupCount: duplicateGroups.length,
    duplicateRowCount: duplicateGroups.reduce(
      (n, g) => n + (g.count - 1),
      0
    ),
    duplicateGroups,
    privatBank,
  };

  logger.info(
    {
      scannedRows: result.scannedRows,
      duplicateGroupCount: result.duplicateGroupCount,
      duplicateRowCount: result.duplicateRowCount,
      privatBankCount: privatBank?.count,
      privatBankSuccess: privatBank?.success,
    },
    '[diagnoseDuplicatePayments] done'
  );

  return result;
};

export const params = {
  daysBack: { type: 'number' },
  apiDaysBack: { type: 'number' },
};

export const options: ActionOptions = {
  actionType: 'custom',
};
