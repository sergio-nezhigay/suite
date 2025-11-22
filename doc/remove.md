# Remove an Item from a Shopify Order Using GraphQL API

To remove an item from an order using the Shopify Admin GraphQL API, you need to use the order editing flow. This involves starting an order edit session, removing the item (or reducing its quantity to zero), and then committing the edit.

## Step 1: Start an Order Edit Session

Use the `orderEditBegin` mutation to begin editing the order.

```graphql
mutation {
  orderEditBegin(id: "gid://shopify/Order/ORDER_ID") {
    calculatedOrder {
      id
    }
    userErrors {
      field
      message
    }
  }
}
```

**Note:** Replace `ORDER_ID` with your order's ID.

## Step 2: Remove the Item

To remove a line item, set its quantity to zero using the `orderEditSetQuantity` mutation. You need the calculated order ID from the previous step and the line item ID you want to remove.

```graphql
mutation {
  orderEditSetQuantity(
    id: "gid://shopify/CalculatedOrder/CALCULATED_ORDER_ID"
    lineItemId: "gid://shopify/CalculatedLineItem/LINE_ITEM_ID"
    quantity: 0
    restock: true
  ) {
    calculatedLineItem {
      id
      quantity
    }
    calculatedOrder {
      id
    }
    userErrors {
      field
      message
    }
  }
}
```

**Parameters:**

- `CALCULATED_ORDER_ID`: From the `orderEditBegin` response
- `LINE_ITEM_ID`: The ID of the line item to remove
- `restock`: Set to `true` if you want to restock the removed quantity

## Step 3: Commit the Edit

Once you've made all your changes, use the `orderEditCommit` mutation to apply them:

```graphql
mutation {
  orderEditCommit(id: "gid://shopify/CalculatedOrder/CALCULATED_ORDER_ID") {
    order {
      id
      name
    }
    userErrors {
      field
      message
    }
  }
}
```

## Summary

1. Start with `orderEditBegin`
2. Use `orderEditSetQuantity` to set the item's quantity to zero (removing it)
3. Finalize with `orderEditCommit`

This is the recommended way to remove an item from an order using the Shopify Admin GraphQL API. If you need to fetch line item IDs, you can query the order's line items first.

## Related Resources

To learn more about the resources in the generated operation, refer to these related reference pages:

- [orderEditBegin](https://shopify.dev/docs/api/admin-graphql/latest/mutations/orderEditBegin)
- [orderEditSetQuantity](https://shopify.dev/docs/api/admin-graphql/latest/mutations/orderEditSetQuantity)
- [orderEditCommit](https://shopify.dev/docs/api/admin-graphql/latest/mutations/orderEditCommit)

## Additional Notes

If you need to fetch line item IDs before removing them, you can query the order first:

```graphql
query {
  order(id: "gid://shopify/Order/ORDER_ID") {
    id
    name
    lineItems(first: 50) {
      edges {
        node {
          id
          name
          quantity
        }
      }
    }
  }
}
```
