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
  console.log(
    `🔄 Starting Shopify order update for ${orderId} with options:`,
    JSON.stringify(options, null, 2)
  );

  try {
    const shopify = await connections.shopify.forShopId(shopId);
    if (!shopify) {
      throw new Error(`No Shopify connection available for shop ${shopId}`);
    }

    const shopifyOrderId = `gid://shopify/Order/${orderId}`;
    console.log(
      `📡 Got Shopify client for shop ${shopId}, constructed order ID: ${shopifyOrderId}`
    );

    // Update tags and note
    if (options.addTags || options.note) {
      console.log('🏷️ Updating order tags and note...');

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

      console.log(`📋 Fetching current order data for ${shopifyOrderId}...`);
      const currentOrderResponse = await shopify.graphql(currentOrderQuery, {
        id: shopifyOrderId,
      });

      console.log(
        '📄 Current order response:',
        JSON.stringify(currentOrderResponse, null, 2)
      );

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

        console.log(
          `🏷️ Updating order with tags: ${JSON.stringify(
            allTags
          )} and note length: ${newNote.length}`
        );

        const updateResponse = await shopify.graphql(orderUpdateMutation, {
          input: {
            id: shopifyOrderId,
            tags: allTags,
            note: newNote,
          },
        });

        console.log(
          '📝 Update response:',
          JSON.stringify(updateResponse, null, 2)
        );

        if (updateResponse.orderUpdate?.userErrors?.length > 0) {
          console.error(
            '❌ Order update errors:',
            updateResponse.orderUpdate.userErrors
          );
          throw new Error(
            `Failed to update order: ${updateResponse.orderUpdate.userErrors[0].message}`
          );
        }

        console.log('✅ Order tags and note updated successfully');
      } else {
        console.error('❌ No order found in response');
        throw new Error('Order not found');
      }
    }

    // Mark order as paid if requested
    if (options.markAsPaid) {
      console.log('💰 Marking order as paid...');

      const markAsPaidResponse = await shopify.graphql(orderMarkAsPaidMutation, {
        input: {
          id: shopifyOrderId
        }
      });

      console.log('💳 Mark as paid response:', JSON.stringify(markAsPaidResponse, null, 2));

      if (markAsPaidResponse.orderMarkAsPaid?.userErrors?.length > 0) {
        console.error('❌ Mark as paid errors:', markAsPaidResponse.orderMarkAsPaid.userErrors);
        // Don't throw - order update was successful, just marking as paid failed
        console.log('⚠️ Failed to mark order as paid, but note update was successful');
      } else {
        console.log('✅ Order marked as paid successfully');
        console.log(`💳 New financial status: ${markAsPaidResponse.orderMarkAsPaid?.order?.displayFinancialStatus}`);
      }
    }

    console.log(`Successfully updated Shopify order ${orderId}`);
    return true;
  } catch (error) {
    console.error(`Failed to update Shopify order ${orderId}:`, error);
    throw error;
  }
}
