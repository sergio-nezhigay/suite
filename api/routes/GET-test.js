import { RouteContext } from "gadget-server";

/**
 * Route handler for GET test
 *
 * @param { RouteContext } route context - see: https://docs.gadget.dev/guides/http-routes/route-configuration#route-context
 *
 */
export default async function route({ request, reply, api, logger, connections }) {
  // Log a simple message to indicate the route was hit
  logger.info("Test route hit successfully");

  // Send a fixed "ok" response
  await reply.send({ status: "ok1" });
}
