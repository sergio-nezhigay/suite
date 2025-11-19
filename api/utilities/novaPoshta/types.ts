/**
 * TypeScript type definitions for Nova Poshta API
 */

// ============================================
// Nova Poshta API Request Types
// ============================================

export interface NovaPoshtaApiRequest {
  modelName: string;
  calledMethod: string;
  methodProperties: Record<string, any>;
}

export interface CreateCounterpartyRequest {
  modelName: 'CounterpartyGeneral';
  calledMethod: 'save';
  methodProperties: {
    FirstName: string;
    LastName: string;
    Phone: string;
    Email?: string;
    CounterpartyType: 'PrivatePerson' | 'Organization';
    CounterpartyProperty: 'Recipient' | 'Sender';
  };
}

export interface CreateInternetDocumentRequest {
  modelName: 'InternetDocument';
  calledMethod: 'save';
  methodProperties: InternetDocumentProperties;
}

export interface InternetDocumentProperties {
  // Sender information
  Sender: string;                    // Sender counterparty ref
  SenderAddress: string;             // Sender warehouse ref
  ContactSender: string;             // Sender contact person ref
  SendersPhone?: string;             // Sender phone

  // Recipient information
  Recipient: string;                 // Recipient counterparty ref
  RecipientAddress: string;          // Recipient warehouse ref
  ContactRecipient: string;          // Recipient contact person ref
  RecipientsPhone?: string;          // Recipient phone

  // Shipment details
  DateTime: string;                  // Date in format DD.MM.YYYY
  ServiceType: string;               // WarehouseWarehouse, WarehouseDoors, etc.
  PaymentMethod: string;             // Cash, NonCash
  PayerType?: string;                // Sender, Recipient, ThirdPerson
  Cost: string;                      // Declared value in UAH

  // Cargo details
  CargoType: string;                 // Cargo, Documents, Parcel, etc.
  Weight: string;                    // Weight in kg
  SeatsAmount: string;               // Number of seats/packages
  Description: string;               // Cargo description

  // Optional fields
  VolumeGeneral?: string;            // Volume in cubic meters
  OptionsSeat?: Array<{              // Detailed seat information
    volumetricVolume: string;
    volumetricWidth: string;
    volumetricLength: string;
    volumetricHeight: string;
    weight: string;
  }>;
  BackwardDeliveryData?: Array<{     // Backward delivery (cash on delivery)
    PayerType: string;
    CargoType: string;
    RedeliveryString: string;        // Amount to collect
  }>;
  AfterpaymentOnGoodsCost?: string;  // Cash on delivery amount
  InfoRegClientBarcodes?: string;    // Client barcode
}

// ============================================
// Nova Poshta API Response Types
// ============================================

export interface NovaPoshtaApiResponse<T = any> {
  success: boolean;
  data: T;
  errors?: string[];
  warnings?: string[];
  info?: string[];
  messageCodes?: string[];
  errorCodes?: string[];
  warningCodes?: string[];
  infoCodes?: string[];
}

export interface CounterpartyResponse {
  Ref: string;
  Description: string;
  FirstName: string;
  MiddleName: string;
  LastName: string;
  Counterparty: string;
  OwnershipForm: string;
  OwnershipFormDescription: string;
  EDRPOU: string;
  CounterpartyType: string;
  ContactPerson: {
    success: boolean;
    data: Array<{
      Ref: string;
      Description: string;
      FirstName: string;
      LastName: string;
      MiddleName: string;
      Phones: string;
      Email: string;
    }>;
  };
}

export interface InternetDocumentResponse {
  Ref: string;                       // Declaration reference (UUID)
  CostOnSite: string;               // Cost calculated by Nova Poshta
  EstimatedDeliveryDate: string;    // Estimated delivery date
  IntDocNumber: string;             // Declaration number (e.g., "20450012345678")
  TypeDocument: string;             // Document type
  PrintedForm?: string;             // URL to printed form (label)
  ErrorCode?: string;               // Error code if any
  ValidationErrors?: Array<{
    Field: string;
    Error: string;
  }>;
}

export interface CitySearchResponse {
  Description: string;              // City name
  DescriptionRu: string;           // City name in Russian
  Ref: string;                     // City reference (UUID)
  Delivery1: string;               // Delivery available
  Delivery2: string;               // Delivery available
  Delivery3: string;               // Delivery available
  Delivery4: string;               // Delivery available
  Delivery5: string;               // Delivery available
  Delivery6: string;               // Delivery available
  Delivery7: string;               // Delivery available
  Area: string;                    // Region name
  SettlementType: string;          // Settlement type
  IsBranch: string;                // Has branch
  PreventEntryNewStreetsUser: string;
  Conglomerates: string | null;
  CityID: string;                  // City ID (numeric)
  SettlementTypeDescription: string;
  SettlementTypeDescriptionRu: string;
}

export interface WarehouseResponse {
  Ref: string;                     // Warehouse reference (UUID)
  Description: string;             // Warehouse name/address
  DescriptionRu: string;           // Warehouse name in Russian
  Number: string;                  // Warehouse number
  CityRef: string;                 // City reference
  CityDescription: string;         // City name
  SettlementRef: string;           // Settlement reference
  SettlementDescription: string;   // Settlement name
  SettlementAreaDescription: string; // Settlement region
  SettlementRegionsDescription: string;
  SettlementTypeDescription: string;
  Longitude: string;               // GPS longitude
  Latitude: string;                // GPS latitude
  PostFinance: string;             // Has financial services
  BicycleParking: string;          // Has bicycle parking
  PaymentAccess: string;           // Payment available
  POSTerminal: string;             // Has POS terminal
  InternationalShipping: string;   // International shipping
  SelfServiceWorkplacesCount: string;
  TotalMaxWeightAllowed: string;   // Max weight allowed
  PlaceMaxWeightAllowed: string;   // Max weight per place
  Reception: {
    Monday: string;
    Tuesday: string;
    Wednesday: string;
    Thursday: string;
    Friday: string;
    Saturday: string;
    Sunday: string;
  };
  Delivery: {
    Monday: string;
    Tuesday: string;
    Wednesday: string;
    Thursday: string;
    Friday: string;
    Saturday: string;
    Sunday: string;
  };
  Schedule: {
    Monday: string;
    Tuesday: string;
    Wednesday: string;
    Thursday: string;
    Friday: string;
    Saturday: string;
    Sunday: string;
  };
  DistrictCode: string;
  WarehouseStatus: string;
  WarehouseStatusDate: string;
  CategoryOfWarehouse: string;
  Direct: string;
  RegionCity: string;
  WarehouseForAgent: string;
  MaxDeclaredCost: string;
  WorkInMobileAwis: string;
  DenyToSelect: string;
  CanGetMoneyTransfer: string;
  HasMirror: string;
  HasFittingRoom: string;
  OnlyReceivingParcel: string;
  PostMachineType: string;
  PostalCodeUA: string;
  WarehouseIndex: string;
  BeaconCode: string;
  ShortAddress: string;
  WarehouseIllusha: string;
}

// ============================================
// Route Request/Response Types
// ============================================

export interface CreateDeclarationRequestBody {
  // Recipient information (from order)
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;

  // Delivery destination
  recipientWarehouseRef: string;    // Selected warehouse UUID
  recipientCityRef: string;         // Selected city UUID

  // Package details (optional - will use defaults if not provided)
  weight?: string;                  // In kg (default: 1)
  cost?: string;                    // Declared value in UAH (default: 100)
  seatsAmount?: string;             // Number of packages (default: 1)
  description?: string;             // Package description (default: "Інтернет-замовлення")
  cargoType?: string;               // Cargo type (default: "Cargo")
  paymentMethod?: string;           // Payment method (default: "Cash")
  serviceType?: string;             // Service type (default: "WarehouseWarehouse")
}

export interface CreateDeclarationResponse {
  success: boolean;
  data?: {
    declarationRef: string;         // UUID reference
    declarationNumber: string;      // Tracking number
    estimatedDeliveryDate: string;
    cost: string;
    printedFormUrl?: string;        // Label URL
  };
  error?: string;
  novaPoshtaResponse?: NovaPoshtaApiResponse<InternetDocumentResponse[]>;
}
