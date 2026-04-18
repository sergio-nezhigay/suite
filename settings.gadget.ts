import type { GadgetSettings } from "gadget-server";

export const settings: GadgetSettings = {
  type: "gadget/settings/v1",
  frameworkVersion: "v1.4.0",
  plugins: {
    connections: {
      shopify: {
        apiVersion: "2025-07",
        enabledModels: [
          "shopifyOrder",
          "shopifyOrderLineItem",
          "shopifyProduct",
          "shopifyProductOption",
          "shopifyProductVariant",
        ],
        type: "partner",
        scopes: [
          "write_assigned_fulfillment_orders",
          "write_files",
          "write_orders",
          "write_products",
          "read_assigned_fulfillment_orders",
          "read_files",
          "read_fulfillments",
          "read_orders",
          "read_products",
          "read_order_edits",
          "write_order_edits",
        ],
        customerAuthenticationEnabled: false,
      },
      openai: true,
    },
  },
};
