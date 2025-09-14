import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "shopifyCustomer" model, go to https://admin-action-block.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "DataModel-Shopify-Customer",
  fields: {
    metafield: {
      type: "json",
      storageKey:
        "ModelField-DataModel-Shopify-Customer-metafield::FieldStorageEpoch-DataModel-Shopify-Customer-metafield-initial",
    },
    ordersCount: {
      type: "number",
      storageKey:
        "ModelField-DataModel-Shopify-Customer-orders_count::FieldStorageEpoch-DataModel-Shopify-Customer-orders_count-initial",
    },
    taxExemptionsBackup: {
      type: "json",
      storageKey:
        "ModelField-DataModel-Shopify-Customer-tax_exemptions::FieldStorageEpoch-DataModel-Shopify-Customer-tax_exemptions-initial",
    },
    totalSpent: {
      type: "string",
      storageKey:
        "ModelField-DataModel-Shopify-Customer-total_spent::FieldStorageEpoch-DataModel-Shopify-Customer-total_spent-initial",
    },
  },
  shopify: {
    fields: [
      "acceptsMarketing",
      "acceptsMarketingUpdatedAt",
      "addresses",
      "amountSpent",
      "canDelete",
      "companyContacts",
      "currency",
      "dataSaleOptOut",
      "defaultAddress",
      "displayName",
      "email",
      "emailMarketingConsent",
      "firstName",
      "hasTimelineComment",
      "lastName",
      "lastOrder",
      "lastOrderName",
      "legacyResourceId",
      "lifetimeDuration",
      "locale",
      "marketingOptInLevel",
      "mergeable",
      "multipassIdentifier",
      "note",
      "numberOfOrders",
      "orders",
      "phone",
      "productSubscriberStatus",
      "shop",
      "shopifyCreatedAt",
      "shopifyState",
      "shopifyUpdatedAt",
      "smsMarketingConsent",
      "statistics",
      "tags",
      "taxExempt",
      "taxExemptions",
      "unsubscribeUrl",
      "validEmailAddress",
      "verifiedEmail",
    ],
  },
};
