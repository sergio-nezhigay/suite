import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "orderPaymentMatch" model, go to https://admin-action-block.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "qXSk5fc5Q7vy",
  fields: {
    amountDifference: { type: "number", storageKey: "J47G4Ggj82HX" },
    bankTransactionId: {
      type: "string",
      validations: { required: true },
      storageKey: "bCdzVDxcyA0a",
    },
    checkFiscalCode: {
      type: "string",
      storageKey: "checkFiscalCode-001",
    },
    checkIssued: {
      type: "boolean",
      default: false,
      storageKey: "checkIssued-001",
    },
    checkIssuedAt: {
      type: "dateTime",
      includeTime: true,
      storageKey: "checkIssuedAt-001",
    },
    checkReceiptId: {
      type: "string",
      storageKey: "checkReceiptId-001",
    },
    checkReceiptUrl: {
      type: "string",
      storageKey: "checkReceiptUrl-001",
    },
    checkSkipReason: {
      type: "string",
      storageKey: "checkSkipReason-001",
    },
    checkSkipped: {
      type: "boolean",
      default: false,
      storageKey: "checkSkipped-001",
    },
    daysDifference: {
      type: "number",
      validations: { numberRange: { min: 0, max: null } },
      storageKey: "MHKvY0PIeOTU",
    },
    matchConfidence: {
      type: "number",
      default: 100,
      validations: { numberRange: { min: 0, max: 100 } },
      storageKey: "jSrQJfGHhrRZ",
    },
    matchedBy: {
      type: "enum",
      default: "manual",
      acceptMultipleSelections: false,
      acceptUnlistedOptions: false,
      options: ["auto", "manual"],
      storageKey: "6mC7GKChwjwH",
    },
    notes: { type: "string", storageKey: "GyWxjJK0JO8b" },
    orderAmount: {
      type: "number",
      validations: { numberRange: { min: 0, max: null } },
      storageKey: "qgdKZVdiMWb5",
    },
    orderId: {
      type: "string",
      validations: { required: true },
      storageKey: "9oaEMLphmLBG",
    },
    transactionAmount: {
      type: "number",
      validations: { numberRange: { min: 0, max: null } },
      storageKey: "Lqdllwky1Gha",
    },
    verifiedAt: {
      type: "dateTime",
      includeTime: true,
      validations: { required: true },
      storageKey: "xIEp2z26IRJH",
    },
  },
};
