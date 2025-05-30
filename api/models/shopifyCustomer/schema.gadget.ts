import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "shopifyCustomer" model, go to https://admin-action-block.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "DataModel-Shopify-Customer",
  fields: {},
  shopify: {
    fields: [
      "acceptsMarketing",
      "acceptsMarketingUpdatedAt",
      "addresses",
      "companyContacts",
      "currency",
      "dataSaleOptOut",
      "defaultAddress",
      "email",
      "emailMarketingConsent",
      "firstName",
      "lastName",
      "lastOrder",
      "lastOrderName",
      "locale",
      "marketingOptInLevel",
      "mergeable",
      "metafield",
      "multipassIdentifier",
      "note",
      "orders",
      "ordersCount",
      "phone",
      "shop",
      "shopifyCreatedAt",
      "shopifyState",
      "shopifyUpdatedAt",
      "smsMarketingConsent",
      "statistics",
      "tags",
      "taxExempt",
      "taxExemptions",
      "totalSpent",
      "verifiedEmail",
    ],
  },
};
