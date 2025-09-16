import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "bankTransaction" model, go to https://admin-action-block.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "z7Tb8slHup--",
  fields: {
    amount: {
      type: "number",
      validations: { numberRange: { min: 0, max: 1000000 } },
      storageKey: "N-3nvM-qGU_R",
    },
    counterpartyAccount: {
      type: "string",
      storageKey: "zKicsG4beJ7o",
    },
    counterpartyName: { type: "string", storageKey: "qk8SCUJ-8zMu" },
    currency: {
      type: "string",
      default: "UAH",
      validations: { required: true },
      storageKey: "ET53M1sn6PLF",
    },
    description: { type: "string", storageKey: "8uDXJJMjVSG2" },
    externalId: {
      type: "string",
      validations: {
        required: true,
        unique: { caseSensitive: true },
      },
      storageKey: "yst3hxSgaVsZ",
    },
    rawData: { type: "json", storageKey: "Swc_qri8D-Lo" },
    reference: { type: "string", storageKey: "Q6sIYCHuc6lg" },
    status: {
      type: "enum",
      default: "processed",
      acceptMultipleSelections: false,
      acceptUnlistedOptions: false,
      options: ["processed", "pending", "failed"],
      storageKey: "bDSoIb1-3S5N",
    },
    syncedAt: {
      type: "dateTime",
      includeTime: true,
      storageKey: "UrJdqJqQM1j3",
    },
    transactionDateTime: {
      type: "dateTime",
      includeTime: true,
      validations: { required: true },
      storageKey: "uk3-My-7XYvW",
    },
    type: {
      type: "enum",
      acceptMultipleSelections: false,
      acceptUnlistedOptions: false,
      options: ["income", "expense"],
      validations: { required: true },
      storageKey: "geQg5SfMfAv7",
    },
  },
};
