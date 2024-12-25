import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "shopifyProduct" model, go to https://admin-action-block.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "DataModel-Shopify-Product",
  fields: {
    chatRecommendations: {
      type: "hasManyThrough",
      sibling: {
        model: "chatLog",
        relatedField: "recommendedProducts",
      },
      join: {
        model: "recommendedProduct",
        belongsToSelfField: "product",
        belongsToSiblingField: "chatLog",
      },
      storageKey: "ErcS7AQ68IU3",
    },
    descriptionEmbedding: {
      type: "vector",
      storageKey: "yg3yaf_ICtKa",
    },
  },
  shopify: {
    fields: [
      "body",
      "category",
      "compareAtPriceRange",
      "handle",
      "images",
      "media",
      "options",
      "productCategory",
      "productType",
      "publishedAt",
      "shop",
      "shopifyCreatedAt",
      "shopifyUpdatedAt",
      "status",
      "tags",
      "templateSuffix",
      "title",
      "variants",
      "vendor",
    ],
  },
};
