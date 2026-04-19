import { RouteHandler } from "gadget-server";

const route: RouteHandler<{ Params: { name: string } }> = async ({ request, reply }) => {
  const { name } = request.params;

  const feeds: Record<string, string> = {
    // https://admin-action-block.gadget.app/feed-files/merchantfeed1.csv
    "merchantfeed1.csv": "https://cdn.shopify.com/s/files/1/0868/0462/7772/files/merchantfeed1.csv",
    // https://admin-action-block.gadget.app/feed-files/remarketing.csv
    "remarketing.csv":   "https://cdn.shopify.com/s/files/1/0868/0462/7772/files/remarketing.csv",
    // https://admin-action-block.gadget.app/feed-files/rozetkaFeed.xml
    "rozetkaFeed.xml":   "https://cdn.shopify.com/s/files/1/0868/0462/7772/files/rozetkaFeed.xml",
  };

  const shopifyUrl = feeds[name];
  if (!shopifyUrl) {
    return reply.code(404).send("Feed not found");
  }

  const upstream = await fetch(`${shopifyUrl}?v=${Date.now()}`, {
    headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" }
  });

  if (!upstream.ok) {
    return reply.code(502).send("Failed to fetch feed from Shopify");
  }

  const body = await upstream.text();
  const contentType = upstream.headers.get("content-type") ?? "text/plain";

  return reply
    .code(200)
    .headers({
      "Content-Type": contentType,
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    })
    .send(body);
};

route.options = {
  cors: { origin: true }
};

export default route;
