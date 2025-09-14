import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "shopifyFulfillment" model, go to https://admin-action-block.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "DataModel-Shopify-Fulfillment",
  fields: {
    notifyCustomer: {
      type: "boolean",
      storageKey:
        "ModelField-DataModel-Shopify-Fulfillment-notify_customer::FieldStorageEpoch-DataModel-Shopify-Fulfillment-notify_customer-initial",
    },
    statusBackup: {
      type: "string",
      storageKey:
        "ModelField-DataModel-Shopify-Fulfillment-status::FieldStorageEpoch-DataModel-Shopify-Fulfillment-status-initial",
    },
    variantInventoryManagement: {
      type: "string",
      storageKey:
        "ModelField-DataModel-Shopify-Fulfillment-variant_inventory_management::FieldStorageEpoch-DataModel-Shopify-Fulfillment-variant_inventory_management-initial",
    },
  },
  shopify: {
    fields: [
      "deliveredAt",
      "displayStatus",
      "estimatedDeliveryAt",
      "fulfillmentEvents",
      "fulfillmentLineItems",
      "inTransitAt",
      "location",
      "name",
      "order",
      "originAddress",
      "receipt",
      "requiresShipping",
      "service",
      "shipmentStatus",
      "shop",
      "shopifyCreatedAt",
      "shopifyUpdatedAt",
      "status",
      "totalQuantity",
      "trackingCompany",
      "trackingInfo",
      "trackingNumber",
      "trackingNumbers",
      "trackingUrl",
      "trackingUrls",
    ],
  },
};
