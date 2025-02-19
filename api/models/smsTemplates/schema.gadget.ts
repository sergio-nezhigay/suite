import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "smsTemplates" model, go to https://admin-action-block.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "YZ8pntlicuS5",
  fields: {
    smsText: {
      type: "string",
      validations: { required: true },
      storageKey: "MNe8f_InXGFy",
    },
    title: {
      type: "string",
      validations: { required: true },
      storageKey: "vQz2i0tpn1jm",
    },
  },
};
