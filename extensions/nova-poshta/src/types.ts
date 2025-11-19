/**
 * TypeScript type definitions for Nova Poshta extension components
 */

// ============================================
// Nova Poshta API Response Types
// ============================================

export interface NovaPoshtaCity {
  Ref: string;                       // City UUID reference
  Description: string;               // City name in Ukrainian
  DescriptionRu?: string;            // City name in Russian
  AreaDescription?: string;          // Region/Oblast name
  SettlementType?: string;           // Type of settlement
  CityID?: string;                   // Numeric city ID
}

export interface NovaPoshtaWarehouse {
  Ref: string;                       // Warehouse UUID reference
  Description: string;               // Warehouse full description
  Number?: string;                   // Warehouse number (e.g., "1", "12")
  CityRef?: string;                  // City reference
  CityDescription?: string;          // City name
  SettlementAreaDescription?: string; // Region name
  ShortAddress?: string;             // Short address
  Longitude?: string;                // GPS coordinates
  Latitude?: string;                 // GPS coordinates
  WarehouseStatus?: string;          // Warehouse status
  CategoryOfWarehouse?: string;      // Warehouse category
}

export interface NovaPoshtaApiResponse<T = any> {
  success: boolean;
  data: T[];
  errors?: string[];
  warnings?: string[];
  info?: string[];
}

// ============================================
// Component Props Types
// ============================================

export interface CityAutocompleteProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onCitySelect: (cityRef: string, cityDescription: string) => void;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
}

export interface WarehouseAutocompleteProps {
  label: string;
  cityRef: string | null;
  selectedWarehouseRef: string | null;
  onWarehouseSelect: (warehouseRef: string, warehouseDescription: string) => void;
  error?: string;
  disabled?: boolean;
}

export interface PackageDetails {
  weight: string;
  cost: string;
  seatsAmount: string;
  description: string;
  cargoType: string;
  paymentMethod: string;
  serviceType: string;
}

export interface Declaration {
  declarationRef: string;
  declarationNumber: string;
  estimatedDeliveryDate: string;
  cost: string;
  printedFormUrl?: string;
  recipientName?: string;
  warehouseDescription?: string;
  cityDescription?: string;
  createdAt?: string;
}

export interface DeclarationCardProps {
  declaration: Declaration;
  onViewLabel?: (declarationRef: string) => void;
  onDownloadLabel?: (declarationRef: string) => void;
}

// ============================================
// Order Data Types (from shopifyOperations)
// ============================================

export interface OrderDetails {
  id: string;
  orderNumber: string;
  firstName: string;
  lastName: string;
  shippingPhone: string | null;
  email: string | null;
  city: string | null;
  address: string | null;
  total: string;
}

export interface SavedWarehouse {
  cityDescription?: string;
  cityRef?: string;
  warehouseDescription?: string;
  warehouseRef?: string;
  settlementAreaDescription?: string;
  matchProbability?: number;
}

// ============================================
// Hook Return Types
// ============================================

export interface UseCitySearchResult {
  cities: NovaPoshtaCity[];
  isLoading: boolean;
  error: string | null;
}

export interface UseWarehouseSearchResult {
  warehouses: NovaPoshtaWarehouse[];
  isLoading: boolean;
  error: string | null;
}

export interface UseCreateDeclarationResult {
  createDeclaration: (params: CreateDeclarationParams) => Promise<Declaration | null>;
  isLoading: boolean;
  error: string | null;
}

export interface CreateDeclarationParams {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  recipientWarehouseRef: string;
  recipientCityRef: string;
  weight?: string;
  cost?: string;
  seatsAmount?: string;
  description?: string;
  cargoType?: string;
  paymentMethod?: string;
  serviceType?: string;
}

// ============================================
// Validation Types
// ============================================

export interface ValidationError {
  field: string;
  message: string;
}

export interface FormValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}
