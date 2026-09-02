import type { GadgetSettings } from "gadget-server";

export const settings: GadgetSettings = {
  type: "gadget/settings/v1",
  frameworkVersion: "v1.4.0",
  plugins: {
    connections: {
      shopify: {
        apiVersion: "2026-04",
        enabledModels: [],
        type: "partner",
        scopes: [
          "write_orders",
          "write_products",
          "read_orders",
          "read_products",
          "read_assigned_fulfillment_orders",
          "read_customers",
          "read_files",
          "read_fulfillments",
          "read_locations",
          "read_merchant_managed_fulfillment_orders",
          "read_payment_customizations",
          "read_third_party_fulfillment_orders",
          "unauthenticated_write_customers",
          "unauthenticated_read_customers",
          "write_customers",
          "write_assigned_fulfillment_orders",
          "write_files",
          "write_fulfillments",
          "write_merchant_managed_fulfillment_orders",
          "write_payment_customizations",
          "write_third_party_fulfillment_orders",
          "write_order_edits",
          "read_order_edits",
        ],
        customerAuthenticationEnabled: false,
      },
      openai: true,
    },
  },
};
