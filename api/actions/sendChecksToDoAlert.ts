import { ActionOptions } from "gadget-server";
import { sendTelegramMessage } from "api/utilities/http/telegramClient";

const CHECKS_TODO_TAG = "Зробити чеки";

// Live Admin API read: `tag:` does exact whole-tag matching, unlike the Gadget
// mirror's `tags: { matches }` full-text operator, and avoids sync staleness.
const ORDERS_BY_TAG_QUERY = `
  query OrdersByTag($query: String!) {
    orders(first: 250, query: $query) {
      edges { node { name } }
    }
  }
`;

export const run: ActionRun = async ({ api, connections, logger, config }) => {
  // Scheduler only meaningful in the deployed env; match processDeclarationOrders.
  if (process.env.NODE_ENV !== "production") return;

  const searchQuery = `tag:'${CHECKS_TODO_TAG}'`;
  const shops = await api.shopifyShop.findMany({
    select: { id: true, myshopifyDomain: true },
  });

  const allNames: string[] = [];
  for (const shop of shops) {
    const shopLabel = shop.myshopifyDomain || shop.id;
    let shopify: any;
    try {
      shopify = await connections.shopify.forShopId(shop.id);
    } catch (err) {
      logger.warn({ shop: shopLabel, err }, "sendChecksToDoAlert: no connection for shop, skipping");
      continue;
    }

    const res: any = await shopify.graphql(ORDERS_BY_TAG_QUERY, { query: searchQuery });
    allNames.push(...res.orders.edges.map((e: any) => e.node.name));
  }

  if (allNames.length === 0) return;

  const text = `🧾 ${CHECKS_TODO_TAG}: ${allNames.length} замовлень\n\n${allNames.join(", ")}`;
  await sendTelegramMessage({ botToken: config.BOT_TOKEN!, chatId: config.CHAT_ID!, text });
  logger.info({ count: allNames.length }, "Checks-to-do alert sent");
};

export const options: ActionOptions = {
  triggers: {
    // UTC. 18-21 Kyiv during summer (EEST, UTC+3); shifts to 17-20 Kyiv in winter.
    scheduler: [{ cron: "0 15,16,17,18 * * *" }],
  },
};
