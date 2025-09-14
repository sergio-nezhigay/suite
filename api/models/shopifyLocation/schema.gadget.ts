import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "shopifyLocation" model, go to https://admin-action-block.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "DataModel-Shopify-Location",
  fields: {
    localizedCountryName: {
      type: "string",
      storageKey:
        "ModelField-DataModel-Shopify-Location-localized_country_name::FieldStorageEpoch-DataModel-Shopify-Location-localized_country_name-initial",
    },
    localizedProvinceName: {
      type: "string",
      storageKey:
        "ModelField-DataModel-Shopify-Location-localized_province_name::FieldStorageEpoch-DataModel-Shopify-Location-localized_province_name-initial",
    },
    orderLineItems: {
      type: "hasMany",
      children: {
        model: "shopifyOrderLineItem",
        belongsToField: "originLocation",
      },
      storageKey:
        "ModelField-Shopify-Location-OrderLineItems::FieldStorageEpoch-DataModel-Shopify-Location-ModelField-Shopify-Location-OrderLineItems-initial",
    },
  },
  shopify: {
    fields: [
      "activatable",
      "active",
      "address1",
      "address2",
      "addressVerified",
      "city",
      "country",
      "countryCode",
      "deactivatable",
      "deactivatedAt",
      "deletable",
      "fulfillmentOrders",
      "fulfillments",
      "fulfillsOnlineOrders",
      "hasActiveInventory",
      "hasUnfulfilledOrders",
      "legacy",
      "legacyResourceId",
      "localPickupSettingsV2",
      "name",
      "orderTransactions",
      "orders",
      "phone",
      "province",
      "provinceCode",
      "retailOrders",
      "shipsInventory",
      "shop",
      "shopifyCreatedAt",
      "shopifyUpdatedAt",
      "suggestedAddresses",
      "zipCode",
    ],
  },
};
