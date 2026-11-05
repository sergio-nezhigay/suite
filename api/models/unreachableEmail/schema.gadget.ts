import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "unreachableEmail" model, go to https://admin-action-block.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "hTv7RkYuMQae",
  fields: {
    error: { type: "string", storageKey: "Cexo6sGxY7hG" },
    messageId: { type: "string", storageKey: "e1CCU6l4-Xe2" },
    orderKey: {
      type: "string",
      validations: { required: true, unique: true },
      storageKey: "l0ftKLJhkUgE",
    },
    orderName: { type: "string", storageKey: "PBTm3Ud5zSC_" },
    status: { type: "string", storageKey: "_7kqZrbvRj58" },
  },
};
