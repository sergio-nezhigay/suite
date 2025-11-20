/**
 * Nova Poshta Sender Configuration
 *
 * This file contains your company's Nova Poshta credentials and default settings
 * for creating shipping declarations.
 *
 * IMPORTANT: Replace the placeholder values below with your actual Nova Poshta references.
 * You can find these in your Nova Poshta account or by calling the API to fetch your counterparty data.
 */

export const SENDER_CONFIG = {
  // ============================================
  // SENDER CREDENTIALS (REQUIRED)
  // ============================================

  /**
   * Your company's counterparty reference (UUID)
   * Find this in Nova Poshta cabinet or via API: Counterparty.getCounterparties
   */
  SENDER_REF: '6a11bc85-464d-11e8-8b24-005056881c6b',

  /**
   * Your city reference (UUID)
   * Буча - м. Буча, Бучанський р-н, Київська обл.
   */
  SENDER_CITY_REF: 'db5c88d9-391c-11dd-90d9-001a92567626',

  /**
   * Your warehouse/address reference (UUID)
   * Буча - Відділення №6: вул. Інститутська, 28А
   */
  SENDER_WAREHOUSE_REF: '84a24ee3-4d6e-11ee-9eb1-d4f5ef0df2b8',

  /**
   * Your contact person reference (UUID)
   * Contact person registered in Nova Poshta system
   */
  SENDER_CONTACT_REF: '72040cf9-0919-11e9-8b24-005056881c6b',

  /**
   * Your phone number for Nova Poshta (format: 380XXXXXXXXX)
   */
  SENDER_PHONE: '380980059236',

  // ============================================
  // DEFAULT DECLARATION PARAMETERS
  // ============================================

  /**
   * Default cargo type for shipments
   * Options: "Cargo" | "Documents" | "Parcel" | "TiresWheels" | "Pallet"
   */
  DEFAULT_CARGO_TYPE: 'Cargo' as const,

  /**
   * Default payment method
   * Options: "Cash" (recipient pays) | "NonCash" (sender pays)
   */
  DEFAULT_PAYMENT_METHOD: 'Cash' as const,

  /**
   * Default service type
   * Options:
   * - "WarehouseWarehouse" - Warehouse to warehouse
   * - "WarehouseDoors" - Warehouse to address
   * - "DoorsWarehouse" - Address to warehouse
   * - "DoorsDoors" - Address to address
   */
  DEFAULT_SERVICE_TYPE: 'WarehouseWarehouse' as const,

  /**
   * Default payer type
   * Options: "Sender" | "Recipient" | "ThirdPerson"
   */
  DEFAULT_PAYER_TYPE: 'Recipient' as const,

  /**
   * Default cost of shipment payment
   * Who pays for the shipment service
   * Options: "Sender" | "Recipient" | "ThirdPerson"
   */
  DEFAULT_COST_PAYER: 'Recipient' as const,

  /**
   * Default backward delivery payer
   * Options: "Sender" | "Recipient"
   */
  DEFAULT_BACKWARD_DELIVERY_PAYER: 'Recipient' as const,

  /**
   * Default seats amount (number of packages)
   */
  DEFAULT_SEATS_AMOUNT: '1',

  /**
   * Default description for packages
   */
  DEFAULT_DESCRIPTION: 'Інтернет-замовлення',

  /**
   * Default weight in kg (minimum 0.1)
   */
  DEFAULT_WEIGHT: '1',

  /**
   * Default declared cost in UAH
   */
  DEFAULT_COST: '100',

} as const;

/**
 * Validate that all required sender credentials are configured
 * Call this before making declaration creation requests
 */
export function validateSenderConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (SENDER_CONFIG.SENDER_REF.includes('YOUR_SENDER')) {
    errors.push('SENDER_REF is not configured. Please update senderConfig.ts with your actual sender reference.');
  }

  if (SENDER_CONFIG.SENDER_CITY_REF.includes('YOUR_SENDER')) {
    errors.push('SENDER_CITY_REF is not configured. Please update senderConfig.ts with your actual city reference.');
  }

  if (SENDER_CONFIG.SENDER_WAREHOUSE_REF.includes('YOUR_SENDER')) {
    errors.push('SENDER_WAREHOUSE_REF is not configured. Please update senderConfig.ts with your actual warehouse reference.');
  }

  if (SENDER_CONFIG.SENDER_CONTACT_REF.includes('YOUR_SENDER')) {
    errors.push('SENDER_CONTACT_REF is not configured. Please update senderConfig.ts with your actual contact reference.');
  }

  if (!SENDER_CONFIG.SENDER_PHONE || SENDER_CONFIG.SENDER_PHONE.includes('YOUR_SENDER')) {
    errors.push('SENDER_PHONE is not configured. Please update senderConfig.ts with your actual phone number.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Type definitions for strongly-typed access
 */
export type CargoType = typeof SENDER_CONFIG.DEFAULT_CARGO_TYPE;
export type PaymentMethod = typeof SENDER_CONFIG.DEFAULT_PAYMENT_METHOD;
export type ServiceType = typeof SENDER_CONFIG.DEFAULT_SERVICE_TYPE;
export type PayerType = typeof SENDER_CONFIG.DEFAULT_PAYER_TYPE;
