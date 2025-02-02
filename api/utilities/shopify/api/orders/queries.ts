export const orderCreateMutation = `
mutation OrderCreate($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
  orderCreate(order: $order, options: $options) {
    userErrors {
      field
      message
    }
    order {
      id
      name
      customer {
        firstName
        lastName
        email
        addresses {
          address1
          city
        }
      }
      lineItems(first: 5) {
        nodes {
          id
          title
          quantity
        }
      }
      shippingAddress {
        address1
        city
        phone
      }
        transactions {
            gateway
        }
    }
  }
}
`;
