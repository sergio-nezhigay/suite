import type { GadgetPermissions } from "gadget-server";

/**
 * This metadata describes the access control configuration available in your application.
 * Grants that are not defined here are set to false by default.
 *
 * View and edit your roles and permissions in the Gadget editor at https://admin-action-block.gadget.app/edit/settings/permissions
 */
export const permissions: GadgetPermissions = {
  type: "gadget/permissions/v1",
  roles: {
    "shopify-app-users": {
      storageKey: "Role-Shopify-App",
      models: {
        allowedTag: {
          read: true,
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        brainCategories: {
          read: true,
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        shopifyBulkOperation: {
          read: {
            filter:
              "accessControl/filters/shopify/shopifyBulkOperation.gelly",
          },
          actions: {
            cancel: true,
            complete: true,
            create: true,
            expire: true,
            fail: true,
            update: true,
          },
        },
        shopifyCompany: {
          read: true,
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        shopifyCompanyAddress: {
          read: true,
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        shopifyCompanyContact: {
          read: true,
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        shopifyCompanyContactRole: {
          read: true,
          actions: {
            delete: true,
            update: true,
          },
        },
        shopifyCompanyContactRoleAssignment: {
          read: true,
          actions: {
            create: true,
          },
        },
        shopifyCompanyLocation: {
          read: true,
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        shopifyCustomer: {
          read: true,
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        shopifyCustomerAddress: {
          read: true,
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        shopifyFile: {
          read: {
            filter: "accessControl/filters/shopify/shopifyFile.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        shopifyFulfillment: {
          read: {
            filter:
              "accessControl/filters/shopify/shopifyFulfillment.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        shopifyFulfillmentEvent: {
          read: {
            filter:
              "accessControl/filters/shopify/shopifyFulfillmentEvent.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        shopifyFulfillmentLineItem: {
          read: {
            filter:
              "accessControl/filters/shopify/shopifyFulfillmentLineItem.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        shopifyFulfillmentOrder: {
          read: {
            filter:
              "accessControl/filters/shopify/shopifyFulfillmentOrder.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        shopifyFulfillmentOrderLineItem: {
          read: {
            filter:
              "accessControl/filters/shopify/shopifyFulfillmentOrderLineItem.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        shopifyGdprRequest: {
          read: {
            filter:
              "accessControl/filters/shopify/shopifyGdprRequest.gelly",
          },
          actions: {
            create: true,
            update: true,
          },
        },
        shopifyLocation: {
          read: {
            filter:
              "accessControl/filters/shopify/shopifyLocation.gelly",
          },
        },
        shopifyOrder: {
          read: {
            filter:
              "accessControl/filters/shopify/shopifyOrder.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        shopifyOrderLineItem: {
          read: {
            filter:
              "accessControl/filters/shopify/shopifyOrderLineItem.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        shopifyOrderTransaction: {
          read: {
            filter:
              "accessControl/filters/shopify/shopifyOrderTransaction.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        shopifyProduct: {
          read: {
            filter:
              "accessControl/filters/shopify/shopifyProduct.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        shopifyProductImage: {
          read: {
            filter:
              "accessControl/filters/shopify/shopifyProductImage.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        shopifyProductMedia: {
          read: {
            filter:
              "accessControl/filters/shopify/shopifyProductMedia.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        shopifyProductOption: {
          read: {
            filter:
              "accessControl/filters/shopify/shopifyProductOption.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        shopifyProductVariant: {
          read: {
            filter:
              "accessControl/filters/shopify/shopifyProductVariant.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        shopifyProductVariantMedia: {
          read: {
            filter:
              "accessControl/filters/shopify/shopifyProductVariantMedia.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        shopifyShop: {
          read: {
            filter: "accessControl/filters/shopify/shopifyShop.gelly",
          },
          actions: {
            install: true,
            reinstall: true,
            uninstall: true,
            update: true,
          },
        },
        shopifySync: {
          read: {
            filter: "accessControl/filters/shopify/shopifySync.gelly",
          },
          actions: {
            abort: true,
            complete: true,
            error: true,
            run: true,
          },
        },
        smsTemplates: {
          read: true,
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
      },
      actions: {
        getUncoveredPayments: true,
        issueCheckForPayment: true,
        previewCheckForPayment: true,
      },
    },
    "shopify-storefront-customers": {
      storageKey: "Role-Shopify-Customer",
      models: {
        shopifyCustomerAddress: {
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
      },
    },
    unauthenticated: {
      storageKey: "unauthenticated",
      models: {
        shopifyFile: {
          read: {
            filter: "accessControl/filters/shopify/shopifyFile.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        smsTemplates: {
          read: true,
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
      },
    },
  },
};
