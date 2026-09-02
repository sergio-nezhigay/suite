/**
 * Payment code constants and parsing for the Ukrainian banking system.
 *
 * The "payment code" is the 4-digit balance-sheet account ("балансовий рахунок",
 * e.g. 2600, 2620, 2902) that prefixes the counterparty's account number.
 * See extractPaymentCodeFromAccount below for how it is read out of an IBAN.
 */

/**
 * Payment codes that don't require fiscal check issuance
 * These codes are excluded from automatic check creation
 */
export const EXCLUDED_PAYMENT_CODES: readonly string[] = ['2600', '2902', '2909', '2920'];

/**
 * Nova Poshta account that doesn't require check issuance
 */
export const NOVA_POSHTA_ACCOUNT: string = 'UA813005280000026548000000014';

/**
 * Extract the 4-digit balance-sheet account ("балансовий рахунок", e.g. 2600, 2620, 2902)
 * from a counterparty account string.
 *
 * A Ukrainian IBAN is "UA" + 2 check digits + 6-digit NBU bank code + a 19-digit account
 * number that is LEFT zero-padded (its real length is 5-14). The balance-sheet account is
 * the first 4 digits of the *un-padded* account number, so a fixed-offset slice is wrong —
 * it only happened to work when the counterparty account was exactly 14 digits.
 *
 *   UA813005290000026004025023737  -> "2600"
 *   UA853348510000000026002218526  -> "2600"   (a fixed substring(15,19) mis-read this as "0002")
 *   UA293052990000029023866100110  -> "2902"
 */
export function extractPaymentCodeFromAccount(
  account: string | null | undefined
): string | null {
  if (!account) return null;
  const raw = account.replace(/\s+/g, '').toUpperCase();

  let digits: string;
  if (/^UA\d{27}$/.test(raw)) {
    digits = raw.slice(10); // 19-digit account portion after "UA" + check digits + bank code
  } else if (/^\d{5,19}$/.test(raw)) {
    digits = raw; // bare / legacy domestic account number
  } else {
    return null; // foreign / malformed -> caller treats it as "needs check"
  }

  const unpadded = digits.replace(/^0+/, '');
  return unpadded.length >= 4 ? unpadded.slice(0, 4) : null;
}
