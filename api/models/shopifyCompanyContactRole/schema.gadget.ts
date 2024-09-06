import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "shopifyCompanyContactRole" model, go to https://admin-action-block.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "DataModel-Shopify-CompanyContactRole",
  fields: {
    defaultRoleForCompany: {
      type: "hasOne",
      child: {
        model: "shopifyCompany",
        belongsToField: "defaultRole",
      },
      storageKey:
        "ModelField-DataModel-Shopify-CompanyContactRole-wd8nVuhxS0e8::FieldStorageEpoch-DataModel-Shopify-CompanyContactRole-Q1C2FkZJ7LD_-initial",
    },
    roleAssignment: {
      type: "hasOne",
      child: {
        model: "shopifyCompanyContactRoleAssignment",
        belongsToField: "role",
      },
      storageKey:
        "ModelField-DataModel-Shopify-CompanyContactRole-8k8eaVn0bGpD::FieldStorageEpoch-DataModel-Shopify-CompanyContactRole-7dxzrg2OOTME-initial",
    },
  },
  shopify: { fields: ["company", "name", "note", "shop"] },
};
