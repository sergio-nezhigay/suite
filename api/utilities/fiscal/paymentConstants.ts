/**
 * Payment code constants for Ukrainian banking system
 *
 * Payment codes are extracted from positions 15-19 of the counterparty account number
 * Example: UA293052990000029023866100110 -> substring(15, 19) -> "2902"
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
