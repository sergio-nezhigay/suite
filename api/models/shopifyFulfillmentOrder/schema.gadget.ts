import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "shopifyFulfillmentOrder" model, go to https://admin-action-block.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "DataModel-Shopify-FulfillmentOrder",
  fields: {
    deliveryMethod: {
      type: "json",
      storageKey:
        "ModelField-DataModel-Shopify-FulfillmentOrder-delivery_method::FieldStorageEpoch-DataModel-Shopify-FulfillmentOrder-delivery_method-initial",
    },
    destination: {
      type: "json",
      storageKey:
        "ModelField-DataModel-Shopify-FulfillmentOrder-destination::FieldStorageEpoch-DataModel-Shopify-FulfillmentOrder-destination-initial",
    },
    fulfillmentHolds: {
      type: "json",
      storageKey:
        "ModelField-DataModel-Shopify-FulfillmentOrder-fulfillment_holds::FieldStorageEpoch-DataModel-Shopify-FulfillmentOrder-fulfillment_holds-initial",
    },
    merchantRequests: {
      type: "json",
      storageKey:
        "ModelField-DataModel-Shopify-FulfillmentOrder-merchant_requests::FieldStorageEpoch-DataModel-Shopify-FulfillmentOrder-merchant_requests-initial",
    },
    requestStatusBackup: {
      type: "string",
      storageKey:
        "ModelField-DataModel-Shopify-FulfillmentOrder-request_status::FieldStorageEpoch-DataModel-Shopify-FulfillmentOrder-request_status-initial",
    },
    statusBackup: {
      type: "string",
      storageKey:
        "ModelField-DataModel-Shopify-FulfillmentOrder-status::FieldStorageEpoch-DataModel-Shopify-FulfillmentOrder-status-initial",
    },
  },
  shopify: {
    fields: [
      "assignedLocation",
      "fulfillAt",
      "fulfillBy",
      "fulfillmentOrderLineItems",
      "internationalDuties",
      "location",
      "order",
      "orderName",
      "orderProcessedAt",
      "requestStatus",
      "shop",
      "shopifyCreatedAt",
      "shopifyUpdatedAt",
      "status",
      "supportedActions",
    ],
  },
};
