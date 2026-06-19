import { RouteHandler } from "gadget-server";

const route: RouteHandler<{ Params: { name: string } }> = async ({ request, reply, logger }) => {
  const rawName = request.params.name;
  let decodedName: string;
  try {
    decodedName = decodeURIComponent(rawName);
  } catch {
    decodedName = rawName;
  }
  const normalizedName = decodedName.trim();

  const feeds: Record<string, string> = {
    // https://admin-action-block.gadget.app/feed-files/merchantfeed1.csv
    "merchantfeed1.csv": "https://cdn.shopify.com/s/files/1/0868/0462/7772/files/merchantfeed1.csv",
    // https://admin-action-block.gadget.app/feed-files/remarketing.csv
    "remarketing.csv":   "https://cdn.shopify.com/s/files/1/0868/0462/7772/files/remarketing.csv",
    // https://admin-action-block.gadget.app/feed-files/rozetkaFeed.xml
    "rozetkaFeed.xml":   "https://cdn.shopify.com/s/files/1/0868/0462/7772/files/rozetkaFeed.xml",
  };

  logger.info({
    rawName,
    decodedName,
    normalizedName,
    method: request.method,
    url: request.url,
    userAgent: request.headers["user-agent"],
    referer: request.headers["referer"],
  }, "feed proxy request");

  const shopifyUrl = feeds[normalizedName];
  if (!shopifyUrl) {
    logger.warn({
      rawName,
      decodedName,
      normalizedName,
      url: request.url,
      knownFeeds: Object.keys(feeds),
    }, "feed not found");
    return reply.code(404).send("Feed not found");
  }

  const cacheBustedUrl = `${shopifyUrl}?v=${Date.now()}`;
  logger.info({ normalizedName, shopifyUrl, cacheBustedUrl }, "fetching upstream feed");

  try {
    const upstream = await fetch(cacheBustedUrl, {
      headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" }
    });

    if (!upstream.ok) {
      logger.warn({
        normalizedName,
        shopifyUrl,
        status: upstream.status,
        statusText: upstream.statusText,
        contentType: upstream.headers.get("content-type"),
      }, "upstream feed response not ok");
      return reply.code(502).send("Failed to fetch feed from Shopify");
    }

    const body = await upstream.text();
    const contentType = upstream.headers.get("content-type") ?? "text/plain";

    logger.info({
      normalizedName,
      shopifyUrl,
      upstreamStatus: upstream.status,
      contentType,
      bodyLength: body.length,
    }, "feed proxy success");

    return reply
      .code(200)
      .headers({
        "Content-Type": contentType,
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      })
      .send(body);
  } catch (error) {
    logger.error({ normalizedName, url: request.url, shopifyUrl, err: error }, "unexpected feed proxy error");
    return reply.code(500).send("Unexpected feed proxy error");
  }
};

route.options = {
  cors: { origin: true }
};

export default route;
