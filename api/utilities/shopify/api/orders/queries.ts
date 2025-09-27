export const customerCreateMutation = `
mutation customerCreate($input: CustomerInput!) {
  customerCreate(input: $input) {
    customer {
      id
      firstName
      lastName
      email
      phone
    }
    userErrors {
      field
      message
    }
  }
}
`;

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

export const customerSearchQuery = `
query searchCustomers($query: String!) {
  customers(first: 1, query: $query) {
    edges {
      node {
        id
        firstName
        lastName
        email
        phone
      }
    }
  }
}
`;

export const orderUpdateMutation = `
mutation orderUpdate($input: OrderInput!) {
  orderUpdate(input: $input) {
    order {
      id
      name
      tags
      note
    }
    userErrors {
      field
      message
    }
  }
}
`;

export const orderMarkAsPaidMutation = `
mutation orderMarkAsPaid($input: OrderMarkAsPaidInput!) {
  orderMarkAsPaid(input: $input) {
    order {
      id
      name
      displayFinancialStatus
      fullyPaid
    }
    userErrors {
      field
      message
    }
  }
}
`;
