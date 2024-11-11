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
    },
    unauthenticated: {
      storageKey: "unauthenticated",
      models: {
        shopifyFile: {
          read: true,
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
