export type PaymentPayerRole =
  | 'direct_payer'
  | 'transit_with_payer'
  | 'settlement_intermediary'
  | 'internal_transfer'
  | 'unknown';

export type PaymentPayerEvidence = 'counterparty' | 'description' | 'none';

export interface ResolvedPaymentPayer {
  displayName: string;
  role: PaymentPayerRole;
  evidenceSource: PaymentPayerEvidence;
  confidence: 'high' | 'medium' | 'low';
  explanation: string;
  identifier: string | null;
}

const TRANSIT_COUNTERPARTY_PATTERN = /транз\.?\s*рахунок|тр\.?\s*рахунок/i;
const SETTLEMENT_COUNTERPARTY_PATTERN = /новапей|novapay|розрахунки за картами|mastercard|visa|compass/i;
const INTERNAL_TRANSFER_PATTERN = /переказ власних коштів|власн(?:их|і) кошт/i;
const PERSON_NAME_PATTERN =
  /([А-ЯІЇЄҐ][а-яіїєґ'’\-]+\s+[А-ЯІЇЄҐ][а-яіїєґ'’\-]+(?:\s+[А-ЯІЇЄҐ][а-яіїєґ'’\-]+)?)/u;

function findIdentifier(description: string): string | null {
  const patterns = [
    /(?:ID платежу|платежу)\s*:?\s*([A-Z0-9]+)/i,
    /(?:рах(?:унком|\.)|рах)\s*№?\s*([0-9]+)/i,
    /(?:реєстр(?:у|а)?|реестр(?:у|а)?)\s*(?:N|№)?\s*([0-9]+)/i,
  ];

  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

export function resolvePaymentPayer(
  counterpartyName: string | null | undefined,
  description: string | null | undefined,
): ResolvedPaymentPayer {
  const counterparty = counterpartyName?.trim() || '';
  const paymentDescription = description?.trim() || '';
  const identifier = findIdentifier(paymentDescription);

  if (INTERNAL_TRANSFER_PATTERN.test(paymentDescription)) {
    return {
      displayName: 'Internal transfer',
      role: 'internal_transfer',
      evidenceSource: 'description',
      confidence: 'high',
      explanation: 'The bank description identifies this as a transfer of own funds.',
      identifier,
    };
  }

  if (TRANSIT_COUNTERPARTY_PATTERN.test(counterparty)) {
    const payerMatch = paymentDescription.match(PERSON_NAME_PATTERN);
    if (payerMatch?.[1]) {
      return {
        displayName: payerMatch[1],
        role: 'transit_with_payer',
        evidenceSource: 'description',
        confidence: 'medium',
        explanation: 'The payer name was found in the description; the bank counterparty is a transit account.',
        identifier,
      };
    }

    return {
      displayName: 'Transit account',
      role: 'settlement_intermediary',
      evidenceSource: 'counterparty',
      confidence: 'high',
      explanation: 'The bank supplied a transit account instead of an individual payer.',
      identifier,
    };
  }

  if (SETTLEMENT_COUNTERPARTY_PATTERN.test(counterparty)) {
    return {
      displayName: counterparty || 'Payment settlement',
      role: 'settlement_intermediary',
      evidenceSource: 'counterparty',
      confidence: 'high',
      explanation: identifier
        ? `The bank supplied a payment intermediary. Reference ${identifier} can help trace the settlement.`
        : 'The bank supplied a payment intermediary and no individual payer name.',
      identifier,
    };
  }

  if (counterparty) {
    return {
      displayName: counterparty,
      role: 'direct_payer',
      evidenceSource: 'counterparty',
      confidence: 'high',
      explanation: 'The bank counterparty is shown as the payer.',
      identifier,
    };
  }

  return {
    displayName: 'Payer unavailable',
    role: 'unknown',
    evidenceSource: 'none',
    confidence: 'low',
    explanation: 'The bank feed did not provide a counterparty name or usable payer evidence.',
    identifier,
  };
}