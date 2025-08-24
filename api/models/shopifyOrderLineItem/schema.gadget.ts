import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "shopifyOrderLineItem" model, go to https://admin-action-block.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "DataModel-Shopify-OrderLineItem",
  fields: {},
  shopify: {
    fields: [
      "attributedStaffs",
      "currentQuantity",
      "discountAllocations",
      "fulfillableQuantity",
      "fulfillmentLineItems",
      "fulfillmentService",
      "fulfillmentStatus",
      "giftCard",
      "grams",
      "name",
      "order",
      "originLocation",
      "price",
      "priceSet",
      "product",
      "productExists",
      "properties",
      "quantity",
      "requiresShipping",
      "shop",
      "shopifyCreatedAt",
      "shopifyUpdatedAt",
      "sku",
      "taxLines",
      "taxable",
      "title",
      "totalDiscount",
      "totalDiscountSet",
      "variant",
      "variantInventoryManagement",
      "variantTitle",
      "vendor",
    ],
  },
};
