import { createOrder } from 'utilities/createOrder';
import { getShopifyConnection } from 'utilities/getShopifyConnection';
import { ActionRun } from './createWarehouses';

const getOrderVariables = () => {
  return {
    order: {
      name: '#123',
      email: '0675855557@gmail.com',
      shippingAddress: {
        address1: 'відд 338',
        firstName: 'Сергій',
        lastName: 'Петриченко',
        city: 'Київ',
        zip: '12345',
        countryCode: 'UA',
        phone: '0675855557',
      },
      //  shippingLines: [
      //    {
      //      priceSet: {
      //        shopMoney: {
      //          amount: '0',
      //          currencyCode: 'UAH',
      //        },
      //      },
      //      title: 'Наложений платіж',
      //    },
      //  ],
      transactions: [
        {
          gateway: 'Накладений платіж',
          amountSet: {
            shopMoney: {
              currencyCode: 'UAH',
              amount: '100',
            },
          },
          kind: 'SALE',
          status: 'SUCCESS',
        },
      ],
      lineItems: [
        {
          title: 'Custom product5',
          quantity: 1,
          priceSet: {
            shopMoney: {
              amount: '5',
              currencyCode: 'UAH',
            },
          },
        },
      ],
    },
  };
};

export const run: ActionRun = async ({ connections }) => {
  const shopify = await getShopifyConnection(connections);
  if (!shopify) {
    return;
  }

  const variables = getOrderVariables();

  createOrder({ shopify, variables })
    .then((order) => {
      console.log('Order created successfully:', order);
    })
    .catch((error) => {
      console.error('Error creating order:', error.message);
    });
};

export const options = {
  triggers: {
    scheduler: [{ every: 'hour', at: '20 mins' }],
  },
};
