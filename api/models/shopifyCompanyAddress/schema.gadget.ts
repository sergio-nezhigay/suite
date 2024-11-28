import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "shopifyCompanyAddress" model, go to https://admin-action-block.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "DataModel-Shopify-CompanyAddress",
  fields: {
    companyBillingLocation: {
      type: "belongsTo",
      parent: { model: "shopifyCompanyLocation" },
      storageKey: "kjsCpL1qUuTi",
    },
    companyShippingLocation: {
      type: "belongsTo",
      parent: { model: "shopifyCompanyLocation" },
      storageKey: "yeAJolimz0n_",
    },
  },
  shopify: {
    fields: [
      "address1",
      "address2",
      "city",
      "companyName",
      "country",
      "countryCode",
      "formattedAddress",
      "formattedArea",
      "phone",
      "province",
      "recipient",
      "shop",
      "zipCode",
      "zoneCode",
    ],
  },
};
