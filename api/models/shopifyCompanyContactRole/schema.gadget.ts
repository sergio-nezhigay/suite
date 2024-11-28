import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "shopifyCompanyContactRole" model, go to https://admin-action-block.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "DataModel-Shopify-CompanyContactRole",
  fields: {
    shopifyCompany: {
      type: "hasOne",
      child: {
        model: "shopifyCompany",
        belongsToField: "defaultRole",
      },
      storageKey: "kJtXeVqaVpSr",
    },
  },
  shopify: { fields: ["company", "shop"] },
};
