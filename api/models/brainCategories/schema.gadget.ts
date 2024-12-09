import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "brainCategories" model, go to https://admin-action-block.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "QWGlTrbXrOvV",
  fields: {
    categoryID: { type: "number", storageKey: "4Yi_rvMWzXYy" },
    name: { type: "string", storageKey: "bGkIzZe4eGp8" },
    parentID: { type: "number", storageKey: "9Kat07U66HHl" },
    realcat: { type: "number", storageKey: "Elc3pBXeZeou" },
  },
};
