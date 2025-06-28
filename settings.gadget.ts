import type { GadgetSettings } from "gadget-server";

export const settings: GadgetSettings = {
  type: "gadget/settings/v1",
  frameworkVersion: "v1.4.0",
  plugins: {
    connections: {
      shopify: {
        apiVersion: "2024-10",
        enabledModels: [
          "shopifyBulkOperation",
          "shopifyCustomer",
          "shopifyCustomerAddress",
          "shopifyFile",
          "shopifyLocation",
          "shopifyOrder",
          "shopifyProduct",
          "shopifyProductImage",
          "shopifyProductMedia",
          "shopifyProductOption",
          "shopifyProductVariant",
          "shopifyProductVariantMedia",
        ],
        type: "partner",
        scopes: [
          "read_orders",
          "read_products",
          "read_customers",
          "write_pixels",
          "read_payment_customizations",
          "write_payment_customizations",
          "write_products",
          "read_files",
          "write_files",
          "write_orders",
          "unauthenticated_read_customers",
          "unauthenticated_write_customers",
          "read_locations",
          "write_customers",
        ],
        customerAuthenticationEnabled: false,
      },
      openai: true,
    },
  },
};
