import { RouteHandler } from "gadget-server";

interface ShopifyOrderFulfilledWebhook {
  id: number;

  fulfillment_status: string;
  // наприклад, інші поля замовлення
}

const route: RouteHandler<{ Body: ShopifyOrderFulfilledWebhook }> = async ({ request, reply }) => {
  // request.body тут автоматично вже розпарсений JSON з webhook-а
  const data = request.body;
  // Твоя бізнес-логіка тут, наприклад:
  if (data.fulfillment_status === "fulfilled") {
    // обробити замовлення
  }

  await reply.code(200).send({
    success: true,
    message: "Order fulfilled webhook received",
  });
};

export default route;
