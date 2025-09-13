import { RouteHandler } from "gadget-server";

interface ShopifyOrderFulfilledWebhook {
  id: number;

  fulfillment_status: string;
  // наприклад, інші поля замовлення
}

const route: RouteHandler<{ Body: ShopifyOrderFulfilledWebhook }> = async ({ request, reply }) => {
  console.log("Received Shopify order fulfilled webhook");

  // request.body тут автоматично вже розпарсений JSON з webhook-а
  const data = request.body;

  console.log("Webhook payload", data);

  // Твоя бізнес-логіка тут, наприклад:
  if (data.fulfillment_status === "fulfilled") {
    // обробити замовлення
    console.log(`Order ${data.id} fulfilled `);
  }

  await reply.code(200).send({
    success: true,
    message: "Order fulfilled webhook received",
  });
};

export default route;
