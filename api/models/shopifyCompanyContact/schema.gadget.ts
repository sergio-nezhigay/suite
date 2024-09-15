import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "shopifyCompanyContact" model, go to https://admin-action-block.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "DataModel-Shopify-CompanyContact",
  fields: {
    mainContactForCompany: {
      type: "hasOne",
      child: {
        model: "shopifyCompany",
        belongsToField: "mainContact",
      },
      storageKey:
        "ModelField-DataModel-Shopify-CompanyContact-22s0DBiO7Csn::FieldStorageEpoch-DataModel-Shopify-CompanyContact-XkOEJwvDzfa6-initial",
    },
  },
  shopify: {
    fields: [
      "company",
      "customer",
      "isMainContact",
      "lifetimeDuration",
      "locale",
      "orders",
      "roleAssignments",
      "shop",
      "shopifyCreatedAt",
      "shopifyUpdatedAt",
      "title",
    ],
  },
};
