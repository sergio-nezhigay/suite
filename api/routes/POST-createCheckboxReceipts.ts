import { RouteContext } from 'gadget-server';
import { CheckboxService } from '../utilities/fiscal/checkboxService';
import { OrderToReceiptTransformer } from '../utilities/fiscal/orderToReceiptTransformer';
import { updateOrderPaymentStatus } from '../utilities/shopify/api/orders/updateOrderPaymentStatus';

export default async function route({
  request,
  reply,
  api,
  connections,
}: RouteContext) {
  console.log('Checkbox receipts creation request received');

  try {
    const body = request.body as any;
    const { orders } = body;

    if (!orders?.length) {
      return reply.code(400).send({ error: 'Orders data required' });
    }

    console.log(`Processing ${orders.length} orders:`, orders.map((o: any) => o.orderId));

    const checkboxService = new CheckboxService();

    // Step 1: Authenticate
    await checkboxService.signIn();

    // Step 2: Ensure shift is open
    await checkboxService.ensureShiftOpen();

    const results = [];

    // Step 3: Process each order with delay to avoid rate limiting
    for (let i = 0; i < orders.length; i++) {
      const orderData = orders[i];

      // Add delay between requests (except for the first one)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 800)); // 800ms delay
        console.log(`Waiting 800ms before processing next order...`);
      }
      try {
        const { orderId, trackingNumber, customer, lineItems } = orderData;
        console.log(`Processing order: ${orderId}`);

        // Extract numeric ID from Shopify Global ID if needed
        const numericOrderId = orderId.includes('gid://shopify/Order/')
          ? orderId.split('/').pop()
          : orderId;

        // Use tracking number from frontend
        if (!trackingNumber) {
          results.push({ orderId: orderData.orderId, error: 'No ETTN/tracking number found' });
          continue;
        }

        // Fetch basic order details for shop ID
        const order = await api.shopifyOrder.findFirst({
          filter: { id: { equals: numericOrderId } },
        });

        if (!order) {
          results.push({ orderId: orderData.orderId, error: 'Order not found' });
          continue;
        }

        console.log(
          `Found ETTN: ${trackingNumber} for order ${(order as any).name}`
        );

        // Transform order to Checkbox format using frontend data
        const receiptBody = OrderToReceiptTransformer.transformOrderFromData(
          orderData,
          order,
          trackingNumber
        );

        // Create receipt
        const receipt = await checkboxService.createETTNReceipt(receiptBody);

        // Store receipt info in order notes
        const receiptNote = `📧 Checkbox Receipt Created
Receipt ID: ${receipt.id}
Fiscal Code: ${receipt.fiscal_code || 'N/A'}
ETTN: ${trackingNumber}
Created: ${new Date().toISOString()}`;

        await updateOrderPaymentStatus(
          connections,
          numericOrderId,
          (order as any).shopId,
          {
            note: receiptNote,
          }
        );

        console.log(
          `Receipt ${receipt.id} created and saved to notes for order ${orderData.orderId}`
        );

        results.push({
          orderId: orderData.orderId,
          orderName: (order as any).name,
          success: true,
          receiptId: receipt.id,
          fiscalCode: receipt.fiscal_code,
          ettnNumber: trackingNumber,
        });

        console.log(
          `Successfully created receipt for order ${(order as any).name}`
        );
      } catch (error) {
        console.error(`Error processing order ${orderData.orderId}:`, error);
        results.push({
          orderId: orderData.orderId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log('Checkbox receipts processing completed:', results);
    return reply.send({ results });
  } catch (error) {
    console.error('Checkbox service error:', error);
    return reply.code(500).send({
      error: error instanceof Error ? error.message : 'Service unavailable',
    });
  }
}

function extractETTNFromOrder(order: any): string | null {
  console.log('DEBUG: Order structure for ETTN extraction:', {
    orderId: order.id,
    orderName: order.name,
    fulfillments: order.fulfillments,
    fulfillmentCount: order.fulfillments?.length || 0
  });

  // Extract from fulfillment tracking info
  const trackingNumber = order.fulfillments?.[0]?.trackingInfo?.[0]?.number;

  if (trackingNumber) {
    console.log('Found tracking number in trackingInfo:', trackingNumber);
    return trackingNumber;
  }

  // Fallback: check if trackingInfo is stored differently
  const fulfillment = order.fulfillments?.[0];
  if (fulfillment?.trackingNumber) {
    console.log('Found tracking number in trackingNumber field:', fulfillment.trackingNumber);
    return fulfillment.trackingNumber;
  }

  // Additional checks for different tracking number locations
  if (fulfillment?.tracking_number) {
    console.log('Found tracking number in tracking_number field:', fulfillment.tracking_number);
    return fulfillment.tracking_number;
  }

  // Check if tracking info is stored as an array of objects
  if (fulfillment?.trackingInfo?.length > 0) {
    const firstTracking = fulfillment.trackingInfo[0];
    console.log('Tracking info structure:', firstTracking);
    if (firstTracking?.number) {
      return firstTracking.number;
    }
    if (firstTracking?.trackingNumber) {
      return firstTracking.trackingNumber;
    }
  }

  console.log('No ETTN found in order fulfillments. Full fulfillment data:', JSON.stringify(order.fulfillments, null, 2));
  return null;
}
