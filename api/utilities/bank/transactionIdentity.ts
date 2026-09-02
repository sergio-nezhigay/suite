import * as crypto from 'crypto';

/**
 * Stable, deterministic identity for a PrivatBank transaction.
 *
 * PrivatBank's `ID` is NOT stable: the same transaction is first returned with a
 * provisional composite id (e.g. `HS42Q0901K138KP01092026140700C`) on the
 * same-day statement, then with a permanent numeric id (e.g. `5236629350`) on a
 * later sync. Its `REF` (document reference) does not change and is unique per
 * transaction, so we key on that. `ID` and the old composite remain as
 * last-resort fallbacks for the rare record with no `REF`.
 *
 * Accepts any of the shapes we hold a transaction in:
 *   - raw PrivatBank object            (`REF`, `ID`, `DAT_OD`, `TIM_P`, `OSND`, `AUT_CNTR_ACC`)
 *   - mapped `PrivatBankTransaction`   (`reference`, `id`, `date`, `time`, `description`, `counterpartyAccount`)
 *   - a stored `bankTransaction` row / its `rawData`
 */
export function deriveExternalId(t: any): string {
  const ref = firstNonEmpty(t?.REF, t?.reference);
  if (ref) return ref;

  const id = firstNonEmpty(t?.ID, t?.id);
  if (id) return id;

  // Legacy composite fallback — mirrors the previous inline logic.
  const date = firstNonEmpty(t?.DAT_OD, t?.date) || 'nodate';
  const time = firstNonEmpty(t?.TIM_P, t?.time) || 'notime';
  const amount = String(t?.amount ?? t?.SUM ?? '0');
  const account = (
    firstNonEmpty(t?.AUT_CNTR_ACC, t?.counterpartyAccount) || 'noacct'
  ).replace(/\s/g, '');
  const descHash = crypto
    .createHash('md5')
    .update(firstNonEmpty(t?.OSND, t?.description) || '')
    .digest('hex')
    .substring(0, 8);
  return `privatbank_${date}_${time}_${amount}_${account}_${descHash}`;
}

function firstNonEmpty(...vals: any[]): string | null {
  for (const v of vals) {
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      return String(v).trim();
    }
  }
  return null;
}
