import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "shopifyOrderLineItem" model, go to https://admin-action-block.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "DataModel-Shopify-OrderLineItem",
  fields: {
    originLocation: {
      type: "belongsTo",
      parent: { model: "shopifyLocation" },
      storageKey:
        "ModelField-Shopify-OrderLineItem-Location::FieldStorageEpoch-DataModel-Shopify-OrderLineItem-origin_location-initial",
    },
    shopifyCreatedAt: {
      type: "dateTime",
      includeTime: true,
      storageKey:
        "ModelField-DataModel-Shopify-OrderLineItem-created_at::FieldStorageEpoch-DataModel-Shopify-OrderLineItem-created_at-initial",
    },
    shopifyUpdatedAt: {
      type: "dateTime",
      includeTime: true,
      storageKey:
        "ModelField-DataModel-Shopify-OrderLineItem-updated_at::FieldStorageEpoch-DataModel-Shopify-OrderLineItem-updated_at-initial",
    },
  },
  shopify: {
    fields: [
      "attributedStaffs",
      "currentQuantity",
      "discountAllocations",
      "discountedTotalSet",
      "discountedUnitPriceAfterAllDiscountsSet",
      "discountedUnitPriceSet",
      "fulfillableQuantity",
      "fulfillmentLineItems",
      "fulfillmentOrderLineItems",
      "fulfillmentService",
      "fulfillmentStatus",
      "giftCard",
      "grams",
      "merchantEditable",
      "name",
      "nonFulfillableQuantity",
      "order",
      "originalTotalSet",
      "price",
      "priceSet",
      "product",
      "productExists",
      "properties",
      "quantity",
      "refundableQuantity",
      "requiresShipping",
      "restockable",
      "shop",
      "sku",
      "taxLines",
      "taxable",
      "title",
      "totalDiscount",
      "totalDiscountSet",
      "unfulfilledDiscountedTotalSet",
      "unfulfilledOriginalTotalSet",
      "unfulfilledQuantity",
      "variant",
      "variantInventoryManagement",
      "variantTitle",
      "vendor",
    ],
  },
};
