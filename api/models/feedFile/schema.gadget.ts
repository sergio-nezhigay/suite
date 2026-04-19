import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "feedFile" model, go to https://admin-action-block.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "9dTG7DgsVLFJ",
  fields: {
    file: {
      type: "file",
      allowPublicAccess: true,
      storageKey: "-VuYlEeZ_yCC",
    },
  },
};
