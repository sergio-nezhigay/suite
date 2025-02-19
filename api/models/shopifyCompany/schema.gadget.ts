import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "shopifyCompany" model, go to https://admin-action-block.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "DataModel-Shopify-Company",
  fields: {
    contactRoleAssignments: {
      type: "hasMany",
      children: {
        model: "shopifyCompanyContactRoleAssignment",
        belongsToField: "company",
      },
      storageKey: "iHrNIa339euL",
    },
    defaultRole: {
      type: "belongsTo",
      parent: { model: "shopifyCompanyContactRole" },
      storageKey: "BL5L5-a_Jj5L",
    },
    shopifyCompany: {
      type: "belongsTo",
      parent: { model: "shopifyCompanyContact" },
      storageKey: "Dq9zRuOMN-WD",
    },
  },
  shopify: {
    fields: [
      "contactCount",
      "contactsCount",
      "customerSince",
      "externalId",
      "lifetimeDuration",
      "locationsCount",
      "name",
      "note",
      "orders",
      "ordersCount",
      "shop",
      "shopifyCreatedAt",
      "shopifyUpdatedAt",
      "totalSpent",
    ],
  },
};
