/**
 * Nova Poshta Extension Constants
 */

/**
 * Default package details constants
 * These values are used for all declarations
 */
export const DEFAULT_PACKAGE_DETAILS = {
  /** Default weight in kg */
  WEIGHT: '1',

  /** Default declared cost in UAH */
  COST: '100',

  /** Default number of packages/seats */
  SEATS_AMOUNT: '1',

  /** Default package description */
  DESCRIPTION: 'Інтернет-замовлення',

  /** Default cargo type (0 = Cargo) */
  CARGO_TYPE: 'Cargo',

  /** Default payment method - Cash (recipient pays) */
  PAYMENT_METHOD: 'Cash',

  /** Default service type - Warehouse to Warehouse */
  SERVICE_TYPE: 'WarehouseWarehouse',
} as const;
