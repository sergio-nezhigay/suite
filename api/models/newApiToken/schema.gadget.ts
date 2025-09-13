import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "newApiToken" model, go to https://admin-action-block.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "Zm2v-p_ASnbj",
  fields: {
    expiresAt: {
      type: "dateTime",
      includeTime: true,
      storageKey: "u7Z_Cof7Ph0q",
    },
    metadata: { type: "json", storageKey: "qRMOfhnLb2Jh" },
    provider: {
      type: "string",
      validations: { required: true },
      storageKey: "lsX6OobU5Ptr",
    },
    refreshBuffer: {
      type: "number",
      default: 300,
      storageKey: "9vyz3J_c1Lwn",
    },
    token: {
      type: "encryptedString",
      validations: { required: true },
      storageKey: "sdW0d8cJgteS::String-sdW0d8cJgteS",
    },
  },
};
