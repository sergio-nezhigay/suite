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
  SENDER_REF: 'ad3dbd0e-ae6c-11ec-92e7-48df37b921da',

  /**
   * Your warehouse/address reference (UUID)
   * Миньківці - Пункт приймання-видачі (до 30 кг): вул. Квітнева, 15А
   */
  SENDER_WAREHOUSE_REF: 'f220c0ef-fd3c-11ed-9eb1-d4f5ef0df2b8',

  /**
   * Your contact person reference (UUID)
   * ⚠️ IMPORTANT: You need to create a contact person!
   * TEMPORARY: Using SENDER_REF as workaround - this may cause issues
   * Please create a contact person in Nova Poshta cabinet or use the helper below
   */
  SENDER_CONTACT_REF: 'ad3dbd0e-ae6c-11ec-92e7-48df37b921da',

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

  if (SENDER_CONFIG.SENDER_WAREHOUSE_REF.includes('YOUR_SENDER')) {
    errors.push('SENDER_WAREHOUSE_REF is not configured. Please update senderConfig.ts with your actual warehouse reference.');
  }

  if (SENDER_CONFIG.SENDER_CONTACT_REF.includes('YOUR_SENDER')) {
    errors.push('SENDER_CONTACT_REF is not configured. Please update senderConfig.ts with your actual contact reference.');
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
