import { AppConnections } from 'gadget-server';
import { orderUpdateMutation, orderTransactionCreateMutation } from './queries';

interface OrderUpdateOptions {
  addTags?: string[];
  note?: string;
  markAsPaid?: boolean;
  paidAmount?: number;
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

    // Create payment transaction if requested
    if (options.markAsPaid && options.paidAmount) {
      console.log(`💰 Creating payment transaction for $${options.paidAmount}...`);

      const transactionResponse = await shopify.graphql(orderTransactionCreateMutation, {
        orderId: shopifyOrderId,
        transaction: {
          kind: 'SALE',
          status: 'SUCCESS',
          amount: options.paidAmount.toString(),
          gateway: 'manual',
          message: 'Payment verified via bank transaction matching'
        }
      });

      console.log('💳 Transaction response:', JSON.stringify(transactionResponse, null, 2));

      if (transactionResponse.orderTransactionCreate?.userErrors?.length > 0) {
        console.error('❌ Transaction creation errors:', transactionResponse.orderTransactionCreate.userErrors);
        // Don't throw - order update was successful, just transaction failed
        console.log('⚠️ Transaction creation failed, but order update was successful');
      } else {
        console.log('✅ Payment transaction created successfully');
      }
    }

    console.log(`Successfully updated Shopify order ${orderId}`);
    return true;
  } catch (error) {
    console.error(`Failed to update Shopify order ${orderId}:`, error);
    throw error;
  }
}
