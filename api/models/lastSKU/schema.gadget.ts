import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "lastSKU" model, go to https://admin-action-block.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "01kWzZbFGj1-",
  fields: {
    value: {
      type: "number",
      validations: { numberRange: { min: 1000, max: 9999 } },
      storageKey: "GM6lTxGmb1DU",
    },
  },
};
