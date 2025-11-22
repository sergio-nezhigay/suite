export const GET_ORDER_QUERY = `query Order($id: ID!) {
  order(id: $id) {
    currencyCode
    lineItems(first: 50) {
      edges {
        node {
          id
          title
          quantity
          originalUnitPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
        }
      }
    }
  }
}`;

export const ORDER_EDIT_BEGIN_MUTATION = `mutation orderEditBegin($id: ID!) {
  orderEditBegin(id: $id) {
    calculatedOrder {
      id
      lineItems(first: 50) {
        edges {
          node {
            id
            title
            quantity
            discountedUnitPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
    userErrors {
      field
      message
    }
  }
}`;

export const ORDER_EDIT_ADD_CUSTOM_ITEM_MUTATION = `mutation orderEditAddCustomItem($id: ID!, $title: String!, $price: MoneyInput!, $quantity: Int!) {
  orderEditAddCustomItem(id: $id, title: $title, price: $price, quantity: $quantity) {
    calculatedOrder {
      id
      lineItems(first: 10) {
        edges {
          node {
            id
            title
          }
        }
      }
      addedLineItems(first: 5) {
        edges {
          node {
            id
            title
          }
        }
      }
    }
    userErrors {
      field
      message
    }
  }
}`;

export const ORDER_EDIT_COMMIT_MUTATION = `mutation orderEditCommit($id: ID!) {
  orderEditCommit(id: $id) {
    order {
      id
      lineItems(first: 10) {
        edges {
          node {
            id
            title
          }
        }
      }
    }
    userErrors {
      field
      message
    }
  }
}`;

export const ORDER_EDIT_SET_QUANTITY_MUTATION = `mutation orderEditSetQuantity($id: ID!, $lineItemId: ID!, $quantity: Int!, $restock: Boolean) {
  orderEditSetQuantity(id: $id, lineItemId: $lineItemId, quantity: $quantity, restock: $restock) {
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
}`;

export async function makeGraphQLQuery(query: string, variables: any) {
  const res = await fetch('shopify:admin/api/graphql.json', {
    method: 'POST',
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error('Network error');
  return await res.json();
}
