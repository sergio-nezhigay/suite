import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "shopifyProductImage" model, go to https://admin-action-block.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "DataModel-Shopify-ProductImage",
  fields: {
    alt: {
      type: "string",
      storageKey:
        "ModelField-DataModel-Shopify-ProductImage-alt::FieldStorageEpoch-DataModel-Shopify-ProductImage-alt-initial",
    },
    height: {
      type: "number",
      storageKey:
        "ModelField-DataModel-Shopify-ProductImage-height::FieldStorageEpoch-DataModel-Shopify-ProductImage-height-initial",
    },
    position: {
      type: "number",
      storageKey:
        "ModelField-DataModel-Shopify-ProductImage-position::FieldStorageEpoch-DataModel-Shopify-ProductImage-position-initial",
    },
    product: {
      type: "belongsTo",
      parent: { model: "shopifyProduct" },
      storageKey:
        "ModelField-Shopify-ProductImage-Product::FieldStorageEpoch-DataModel-Shopify-ProductImage-product_id-initial",
    },
    shop: {
      type: "belongsTo",
      parent: { model: "shopifyShop" },
      storageKey:
        "ModelField-Shopify-ProductImage-Shop::FieldStorageEpoch-DataModel-Shopify-ProductImage-shop_id-initial",
    },
    shopifyCreatedAt: {
      type: "dateTime",
      includeTime: true,
      storageKey:
        "ModelField-DataModel-Shopify-ProductImage-created_at::FieldStorageEpoch-DataModel-Shopify-ProductImage-created_at-initial",
    },
    shopifyUpdatedAt: {
      type: "dateTime",
      includeTime: true,
      storageKey:
        "ModelField-DataModel-Shopify-ProductImage-updated_at::FieldStorageEpoch-DataModel-Shopify-ProductImage-updated_at-initial",
    },
    source: {
      type: "url",
      storageKey:
        "ModelField-DataModel-Shopify-ProductImage-src::FieldStorageEpoch-DataModel-Shopify-ProductImage-src-initial",
    },
    variants: {
      type: "hasMany",
      children: {
        model: "shopifyProductVariant",
        belongsToField: "productImage",
      },
      storageKey:
        "ModelField-DataModel-Shopify-ProductImage-il6QLIfcUKpO::FieldStorageEpoch-DataModel-Shopify-ProductImage-KKmsJeg35FUQ-initial",
    },
    width: {
      type: "number",
      storageKey:
        "ModelField-DataModel-Shopify-ProductImage-width::FieldStorageEpoch-DataModel-Shopify-ProductImage-width-initial",
    },
  },
};
