import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "shopifyOrderTransaction" model, go to https://admin-action-block.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "DataModel-Shopify-OrderTransaction",
  fields: {
    errorCodeBackup: {
      type: "string",
      storageKey:
        "ModelField-DataModel-Shopify-OrderTransaction-error_code::FieldStorageEpoch-DataModel-Shopify-OrderTransaction-error_code-initial",
    },
    extendedAuthorizationAttributes: {
      type: "json",
      storageKey:
        "ModelField-DataModel-Shopify-OrderTransaction-extended_authorization_attributes::FieldStorageEpoch-DataModel-Shopify-OrderTransaction-extended_authorization_attributes-initial",
    },
    kindBackup: {
      type: "string",
      storageKey:
        "ModelField-DataModel-Shopify-OrderTransaction-kind::FieldStorageEpoch-DataModel-Shopify-OrderTransaction-kind-initial",
    },
    paymentsRefundAttributes: {
      type: "json",
      storageKey:
        "ModelField-DataModel-Shopify-OrderTransaction-payments_refund_attributes::FieldStorageEpoch-DataModel-Shopify-OrderTransaction-payments_refund_attributes-initial",
    },
    statusBackup: {
      type: "string",
      storageKey:
        "ModelField-DataModel-Shopify-OrderTransaction-status::FieldStorageEpoch-DataModel-Shopify-OrderTransaction-status-initial",
    },
  },
  shopify: {
    fields: [
      "accountNumber",
      "amount",
      "amountRoundingSet",
      "amountSet",
      "authorization",
      "authorizationExpiresAt",
      "children",
      "currency",
      "errorCode",
      "formattedGateway",
      "gateway",
      "kind",
      "location",
      "manualPaymentGateway",
      "manuallyCapturable",
      "maximumRefundableV2",
      "message",
      "multicapturable",
      "order",
      "parent",
      "paymentDetails",
      "paymentId",
      "processedAt",
      "receipt",
      "settlementCurrency",
      "settlementCurrencyRate",
      "shop",
      "shopifyCreatedAt",
      "shopifyPaymentsSet",
      "sourceName",
      "status",
      "test",
      "totalUnsettledSet",
    ],
  },
};
