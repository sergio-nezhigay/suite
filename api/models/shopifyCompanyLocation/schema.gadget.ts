import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "shopifyCompanyLocation" model, go to https://admin-action-block.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "DataModel-Shopify-CompanyLocation",
  fields: {
    billingAddress: {
      type: "hasOne",
      child: {
        model: "shopifyCompanyAddress",
        belongsToField: "companyBillingLocation",
      },
      storageKey: "AD3ywgAoHIAJ",
    },
  },
  shopify: {
    fields: [
      "buyerExperienceConfiguration",
      "company",
      "currency",
      "externalId",
      "locale",
      "name",
      "note",
      "orders",
      "ordersCount",
      "phone",
      "shop",
      "shopifyCreatedAt",
      "shopifyUpdatedAt",
      "taxExemptions",
      "taxRegistrationId",
      "timelineComment",
      "totalSpent",
    ],
  },
};
