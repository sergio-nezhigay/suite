import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "brainSession" model, go to https://admin-action-block.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "qESOk2KIIHNd",
  fields: {
    lastRequestTime: {
      type: "dateTime",
      includeTime: true,
      storageKey: "83Rq6_DaHBJX",
    },
    sid: { type: "string", storageKey: "lWBZA4IX7I0r" },
  },
};
