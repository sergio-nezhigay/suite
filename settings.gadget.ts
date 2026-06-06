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
        scopes: ["write_orders", "write_products"],
        customerAuthenticationEnabled: false,
      },
      openai: true,
    },
  },
};
