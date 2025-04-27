import type { RouteHandler } from 'fastify';
import { createWarrantyPdf, sendWarrantyEmail } from 'utilities';

interface ShopifyCustomer {
  firstName: string;
  lastName: string;
}

interface ShopifyProduct {
  warrantyMetafield?: {
    value: string;
  };
}

interface ShopifyLineItem {
  title: string;
  unfulfilledQuantity: number;
  product?: ShopifyProduct;
}

interface ShopifyLineItems {
  nodes: ShopifyLineItem[];
}

interface ShopifyOrder {
  name: string;
  customer: ShopifyCustomer;
  createdAt: string;
  lineItems: ShopifyLineItems;
}

interface WarrantyOrderItem {
  name: string;
  quantity: number;
  warranty: string;
}

interface WarrantyOrder {
  id: string;
  customer: string;
  date: string;
  items: WarrantyOrderItem[];
}

interface RequestBody {
  ordersContent?: ShopifyOrder[];
}

const route: RouteHandler<{ Body: RequestBody }> = async (context) => {
  const { request, reply } = context;
  try {
    const { ordersContent }: RequestBody = request.body as RequestBody;

    const orders = formatOrders(ordersContent);

    const pdfBuffer = await createWarrantyPdf(orders);

    await sendWarrantyEmail(context, pdfBuffer, orders.length);

    await reply
      .code(200)
      .send({ message: 'Гарантійні талони успішно надіслано!' });
  } catch (error) {
    console.error('Помилка:', error);
    await reply
      .code(500)
      .send({ error: 'Не вдалося надіслати гарантійні талони.' });
  }
};

function formatOrders(ordersContent: ShopifyOrder[] = []): WarrantyOrder[] {
  return ordersContent.map((order) => ({
    id: order.name,
    customer: `${order.customer.firstName} ${order.customer.lastName}`,
    date: new Intl.DateTimeFormat('uk-UA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(order.createdAt)),
    items: order.lineItems.nodes.map((item) => ({
      name: item.title,
      quantity: item.unfulfilledQuantity,
      warranty:
        item.product?.warrantyMetafield?.value ||
        (item.title.toLowerCase().includes('dimm') ? '36' : '12'),
    })),
  }));
}

export default route;
