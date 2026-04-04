import { AppConnections } from 'gadget-server';
import { orderUpdateMutation, orderMarkAsPaidMutation } from './queries';

interface OrderUpdateOptions {
  addTags?: string[];
  note?: string;
  markAsPaid?: boolean;
}

export async function updateOrderPaymentStatus(
  connections: AppConnections,
  orderId: string,
  shopId: string,
  options: OrderUpdateOptions
) {
  try {
    const shopify = await connections.shopify.forShopId(shopId);
    if (!shopify) {
      throw new Error(`No Shopify connection available for shop ${shopId}`);
    }

    const shopifyOrderId = `gid://shopify/Order/${orderId}`;
    // Update tags and note
    if (options.addTags || options.note) {
      // Get current order data to preserve existing tags
      const currentOrderQuery = `
        query getOrder($id: ID!) {
          order(id: $id) {
            id
            tags
            note
          }
        }
      `;
      const currentOrderResponse = await shopify.graphql(currentOrderQuery, {
        id: shopifyOrderId,
      });
      if (currentOrderResponse.order) {
        const currentTags = currentOrderResponse.order.tags || [];
        const newTags = options.addTags || [];
        const combinedTags = currentTags.concat(newTags);
        const allTags = Array.from(new Set(combinedTags)); // Remove duplicates

        const currentNote = currentOrderResponse.order.note || '';
        const newNote = options.note
          ? currentNote
            ? `${currentNote}\n\n${options.note}`
            : options.note
          : currentNote;
        const updateResponse = await shopify.graphql(orderUpdateMutation, {
          input: {
            id: shopifyOrderId,
            tags: allTags,
            note: newNote,
          },
        });
        if (updateResponse.orderUpdate?.userErrors?.length > 0) {
          console.error(
            '❌ Order update errors:',
            updateResponse.orderUpdate.userErrors
          );
          throw new Error(
            `Failed to update order: ${updateResponse.orderUpdate.userErrors[0].message}`
          );
        }
      } else {
        console.error('❌ No order found in response');
        throw new Error('Order not found');
      }
    }

    // Mark order as paid if requested
    if (options.markAsPaid) {
      const markAsPaidResponse = await shopify.graphql(orderMarkAsPaidMutation, {
        input: {
          id: shopifyOrderId
        }
      });
      if (markAsPaidResponse.orderMarkAsPaid?.userErrors?.length > 0) {
        console.error('❌ Mark as paid errors:', markAsPaidResponse.orderMarkAsPaid.userErrors);
        // Don't throw - order update was successful, just marking as paid failed
      } else {
      }
    }
    return true;
  } catch (error) {
    console.error(`Failed to update Shopify order ${orderId}:`, error);
    throw error;
  }
}
