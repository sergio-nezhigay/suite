import type { RouteHandler } from 'gadget-server';
import {
  npClient,
  SENDER_CONFIG,
  validateSenderConfig,
  type CreateDeclarationRequestBody,
  type CreateDeclarationResponse,
  type CounterpartyResponse,
  type InternetDocumentResponse,
  type NovaPoshtaApiResponse,
} from 'utilities';

/**
 * POST /nova-poshta/create-document
 *
 * Creates a Nova Poshta shipping declaration (InternetDocument)
 * with automatic counterparty creation for the recipient.
 *
 * Flow:
 * 1. Validate sender configuration
 * 2. Create recipient counterparty (if needed)
 * 3. Create InternetDocument with sender + recipient data
 * 4. Return declaration details
 */
const route: RouteHandler<{
  Body: CreateDeclarationRequestBody;
}> = async ({ request, reply }) => {
  const body = request.body as CreateDeclarationRequestBody;
  const {
    firstName,
    lastName,
    phone,
    email,
    recipientWarehouseRef,
    recipientCityRef,
    weight,
    cost,
    seatsAmount,
    description,
    cargoType,
    paymentMethod,
    serviceType,
  } = body;

  // ============================================
  // 1. Validate Required Fields
  // ============================================

  if (!firstName || !lastName || !phone) {
    return await reply.status(400).send({
      success: false,
      error: 'Missing required recipient fields: firstName, lastName, phone',
    } as CreateDeclarationResponse);
  }

  if (!recipientWarehouseRef || !recipientCityRef) {
    return await reply.status(400).send({
      success: false,
      error:
        'Missing required delivery destination: recipientWarehouseRef, recipientCityRef',
    } as CreateDeclarationResponse);
  }

  // ============================================
  // 2. Validate Sender Configuration
  // ============================================

  const configValidation = validateSenderConfig();
  if (!configValidation.valid) {
    console.log(
      '❌ Sender configuration validation failed:',
      configValidation.errors
    );
    return await reply.status(500).send({
      success: false,
      error:
        'Sender configuration not set up properly. Please check senderConfig.ts file.',
      details: configValidation.errors,
    } as CreateDeclarationResponse);
  }

  try {
    // ============================================
    // 3. Create Recipient Counterparty
    // ============================================

    console.log('📦 Creating recipient counterparty:', {
      firstName,
      lastName,
      phone,
      email,
    });

    const createCounterpartyPayload = {
      modelName: 'CounterpartyGeneral',
      calledMethod: 'save',
      methodProperties: {
        FirstName: firstName,
        LastName: lastName,
        Phone: phone,
        Email: email || '',
        CounterpartyType: 'PrivatePerson',
        CounterpartyProperty: 'Recipient',
      },
    };

    const counterpartyResponse = (await npClient(
      createCounterpartyPayload
    )) as NovaPoshtaApiResponse<CounterpartyResponse[]>;

    if (!counterpartyResponse.success || !counterpartyResponse.data?.[0]) {
      console.log('❌ Failed to create counterparty:', counterpartyResponse);
      return await reply.status(500).send({
        success: false,
        error: 'Failed to create recipient counterparty',
        novaPoshtaResponse: counterpartyResponse,
      } as CreateDeclarationResponse);
    }

    const recipientRef = counterpartyResponse.data[0].Ref;
    const recipientContactRef =
      counterpartyResponse.data[0].ContactPerson.data[0].Ref;

    console.log('✅ Recipient counterparty created:', {
      recipientRef,
      recipientContactRef,
    });

    // ============================================
    // 4. Create InternetDocument (Declaration)
    // ============================================

    // Use provided values or fall back to defaults from config
    const documentWeight = weight || SENDER_CONFIG.DEFAULT_WEIGHT;
    const documentCost = cost || SENDER_CONFIG.DEFAULT_COST;
    const documentSeats = seatsAmount || SENDER_CONFIG.DEFAULT_SEATS_AMOUNT;
    const documentDescription =
      description || SENDER_CONFIG.DEFAULT_DESCRIPTION;
    const documentCargoType = cargoType || SENDER_CONFIG.DEFAULT_CARGO_TYPE;
    const documentPaymentMethod =
      paymentMethod || SENDER_CONFIG.DEFAULT_PAYMENT_METHOD;
    const documentServiceType =
      serviceType || SENDER_CONFIG.DEFAULT_SERVICE_TYPE;

    // ============================================
    // Determine if COD (Cash on Delivery) should be enabled
    // ============================================
    // Enable COD by default, UNLESS payment method contains "Передплата безготівка"
    const isPrepaid = paymentMethod?.toLowerCase().includes('передплата безготівка');
    const enableCOD = !isPrepaid;

    // ============================================
    // Calculate OptionsSeat (required by Nova Poshta API)
    // ============================================
    const packageWidth = SENDER_CONFIG.DEFAULT_PACKAGE_WIDTH;
    const packageHeight = SENDER_CONFIG.DEFAULT_PACKAGE_HEIGHT;
    const packageLength = SENDER_CONFIG.DEFAULT_PACKAGE_LENGTH;

    // Calculate volumetric volume: (width * height * length) / 4000
    const volumetricVolume = (
      parseFloat(packageWidth) *
      parseFloat(packageHeight) *
      parseFloat(packageLength) /
      4000
    ).toString();

    // Create array of seats (one for each package)
    const seatsCount = parseInt(documentSeats);
    const optionsSeat = Array.from({ length: seatsCount }, () => ({
      volumetricVolume,
      volumetricWidth: packageWidth,
      volumetricLength: packageLength,
      volumetricHeight: packageHeight,
      weight: documentWeight,
    }));

    console.log('📋 Creating InternetDocument with params:', {
      sender: SENDER_CONFIG.SENDER_REF,
      senderWarehouse: SENDER_CONFIG.SENDER_WAREHOUSE_REF,
      recipient: recipientRef,
      recipientWarehouse: recipientWarehouseRef,
      weight: documentWeight,
      cost: documentCost,
      seatsAmount: documentSeats,
    });

    const createDocumentPayload = {
      modelName: 'InternetDocument',
      calledMethod: 'save',
      methodProperties: {
        // Sender information (from config)
        Sender: SENDER_CONFIG.SENDER_REF,
        CitySender: SENDER_CONFIG.SENDER_CITY_REF,
        SenderAddress: SENDER_CONFIG.SENDER_WAREHOUSE_REF,
        ContactSender: SENDER_CONFIG.SENDER_CONTACT_REF,
        SendersPhone: SENDER_CONFIG.SENDER_PHONE,

        // Recipient information (from request + created counterparty)
        Recipient: recipientRef,
        CityRecipient: recipientCityRef,
        RecipientAddress: recipientWarehouseRef,
        ContactRecipient: recipientContactRef,
        RecipientsPhone: phone,

        // Shipment details
        DateTime: new Date().toLocaleDateString('uk-UA'), // Format: DD.MM.YYYY
        ServiceType: documentServiceType,
        PaymentMethod: documentPaymentMethod,
        PayerType: SENDER_CONFIG.DEFAULT_PAYER_TYPE,
        Cost: documentCost,

        // Cargo details
        CargoType: documentCargoType,
        Weight: documentWeight,
        SeatsAmount: documentSeats,
        Description: documentDescription,

        // Package dimensions (REQUIRED by Nova Poshta API)
        OptionsSeat: optionsSeat,

        // Cash on Delivery (COD) - Накладений платіж
        // Use AfterpaymentOnGoodsCost for business clients (Control of payment)
        ...(enableCOD && {
          AfterpaymentOnGoodsCost: documentCost,
        }),
      },
    };

    const documentResponse = (await npClient(
      createDocumentPayload
    )) as NovaPoshtaApiResponse<InternetDocumentResponse[]>;

    if (!documentResponse.success || !documentResponse.data?.[0]) {
      console.log('❌ Failed to create InternetDocument:', documentResponse);
      return await reply.status(500).send({
        success: false,
        error: 'Failed to create declaration',
        novaPoshtaResponse: documentResponse,
      } as CreateDeclarationResponse);
    }

    const declaration = documentResponse.data[0];

    console.log('✅ Declaration created successfully:', {
      ref: declaration.Ref,
      number: declaration.IntDocNumber,
      estimatedDelivery: declaration.EstimatedDeliveryDate,
    });

    // ============================================
    // 5. Return Success Response
    // ============================================

    const response: CreateDeclarationResponse = {
      success: true,
      data: {
        declarationRef: declaration.Ref,
        declarationNumber: declaration.IntDocNumber,
        estimatedDeliveryDate: declaration.EstimatedDeliveryDate,
        cost: declaration.CostOnSite,
        printedFormUrl: declaration.PrintedForm,
      },
      novaPoshtaResponse: documentResponse,
    };

    return await reply.status(200).send(response);
  } catch (error: any) {
    console.log('❌ Error creating declaration:', error);
    return await reply.status(500).send({
      success: false,
      error: error.message || 'Internal server error',
    } as CreateDeclarationResponse);
  }
};

export default route;
