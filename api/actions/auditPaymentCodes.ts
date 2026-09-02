import { ActionOptions } from 'gadget-server';
import {
  EXCLUDED_PAYMENT_CODES,
  NOVA_POSHTA_ACCOUNT,
  extractPaymentCodeFromAccount,
} from '../utilities/fiscal/paymentConstants';

/**
 * TEMPORARY one-off diagnostic — safe to delete after review.
 *
 * Compares the OLD fixed-offset payment-code extraction (`account.substring(15, 19)`)
 * against the corrected `extractPaymentCodeFromAccount` and reports the impact on
 * incoming payments. Read-only: it never writes to any record.
 *
 * Run it from the Gadget action console: `await api.auditPaymentCodes({ daysBack: 90 })`
 */

const OLD_extract = (account: string): string | null => {
  if (!account) return null;
  if (account.length >= 19) return account.substring(15, 19);
  return null;
};

type Verdict =
  | 'check_issued'
  | 'nova_poshta'
  | 'excluded_code'
  | 'skipped'
  | 'matched_order'
  | 'needs_check';

// Mirrors determinePaymentStatus() priority order in getAllPayments.ts
const verdictFor = (t: any, code: string | null): Verdict => {
  if (t.checkReceiptId || t.checkIssuedAt) return 'check_issued';
  if ((t.counterpartyAccount || '') === NOVA_POSHTA_ACCOUNT) return 'nova_poshta';
  if (code && EXCLUDED_PAYMENT_CODES.includes(code)) return 'excluded_code';
  if (t.checkSkipReason) return 'skipped';
  if (t.matchedOrderId) return 'matched_order';
  return 'needs_check';
};

export const run: ActionRun = async ({ params, api, logger }) => {
  const daysBack = Number((params as any)?.daysBack) || 90;
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  const rows: any[] = [];
  let records = await api.bankTransaction.findMany({
    filter: {
      transactionDateTime: { greaterThan: since },
      type: { equals: 'income' },
    },
    select: {
      id: true,
      amount: true,
      counterpartyAccount: true,
      counterpartyName: true,
      transactionDateTime: true,
      matchedOrderId: true,
      checkIssuedAt: true,
      checkReceiptId: true,
      checkSkipReason: true,
    },
    sort: { transactionDateTime: 'Descending' },
    first: 250,
  });
  rows.push(...records);
  while (records.hasNextPage) {
    records = await records.nextPage();
    rows.push(...records);
  }

  const changed: any[] = [];
  const statusFlipped: any[] = [];
  const wronglyIssued: any[] = [];

  for (const t of rows) {
    const account = t.counterpartyAccount || '';
    const oldCode = OLD_extract(account);
    const newCode = extractPaymentCodeFromAccount(account);

    const summary = {
      id: t.id,
      date: t.transactionDateTime
        ? new Date(t.transactionDateTime).toISOString().split('T')[0]
        : null,
      amount: t.amount,
      counterpartyName: t.counterpartyName || 'Unknown',
      counterpartyAccount: account,
      oldCode,
      newCode,
    };

    if (oldCode === newCode) continue;
    changed.push(summary);

    const oldVerdict = verdictFor(t, oldCode);
    const newVerdict = verdictFor(t, newCode);
    if (oldVerdict !== newVerdict) {
      statusFlipped.push({ ...summary, oldVerdict, newVerdict });
    }

    if (
      (t.checkReceiptId || t.checkIssuedAt) &&
      newCode &&
      EXCLUDED_PAYMENT_CODES.includes(newCode)
    ) {
      wronglyIssued.push({
        ...summary,
        checkReceiptId: t.checkReceiptId || null,
        checkIssuedAt: t.checkIssuedAt || null,
      });
    }
  }

  const result = {
    daysBack,
    since: since.toISOString(),
    scanned: rows.length,
    changedCount: changed.length,
    statusFlippedCount: statusFlipped.length,
    wronglyIssuedCount: wronglyIssued.length,
    changed,
    statusFlipped,
    wronglyIssued,
  };

  logger.info(
    {
      scanned: result.scanned,
      changedCount: result.changedCount,
      statusFlippedCount: result.statusFlippedCount,
      wronglyIssuedCount: result.wronglyIssuedCount,
    },
    '[auditPaymentCodes] done'
  );

  return result;
};

export const params = {
  daysBack: { type: 'number' },
};

export const options: ActionOptions = {
  actionType: 'custom',
};
