import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "chatLog" model, go to https://admin-action-block.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "etXEGfWT3Az9",
  fields: {
    recommendedProducts: {
      type: "hasManyThrough",
      sibling: {
        model: "shopifyProduct",
        relatedField: "chatRecommendations",
      },
      join: {
        model: "recommendedProduct",
        belongsToSelfField: "chatLog",
        belongsToSiblingField: "product",
      },
      storageKey: "9RlZowWfHSMs",
    },
    response: { type: "string", storageKey: "6U87kufARC83" },
  },
};
