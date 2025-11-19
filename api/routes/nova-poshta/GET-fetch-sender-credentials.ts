import type { RouteHandler } from 'gadget-server';
import { fetchSenderCredentials } from 'utilities';

/**
 * GET /nova-poshta/fetch-sender-credentials
 *
 * Helper route to fetch your actual Nova Poshta sender credentials.
 * This will help you find the correct refs for:
 * - Sender counterparty
 * - Contact person
 * - City (Буча)
 * - Warehouse (№6 in Bucha)
 *
 * Usage: Open this URL in your browser while logged into Shopify admin
 */
const route: RouteHandler = async ({ reply }) => {
  const result = await fetchSenderCredentials();

  if (result.success) {
    return await reply.status(200).send({
      success: true,
      message: 'Check the Gadget logs for detailed information',
      data: result.data,
    });
  } else {
    return await reply.status(500).send({
      success: false,
      error: result.error,
    });
  }
};

export default route;
