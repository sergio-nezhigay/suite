import type { RouteContext } from 'gadget-server';
import { rozetkaTokenManager } from '../utilities/rozetka/tokenManager';

export default async function route({ request, reply, logger }: RouteContext) {
  try {
    logger.info('Rozetka auth test triggered from Shopify Flow');

    const token = await rozetkaTokenManager.getValidToken();

    // Log a preview (never log a full token in production)
    logger.info('Rozetka auth success', {
      tokenPreview: token ? `${token.substring(0, 20)}...` : 'none',
      tokenLength: token?.length,
    });

    return reply.send({
      success: true,
      message: 'Rozetka token obtained successfully',
      tokenPreview: token ? `${token.substring(0, 20)}...` : null,
    });
  } catch (error: any) {
    logger.error('Rozetka auth test failed', {
      error: error.message,
      stack: error.stack,
    });

    return reply.status(500).send({
      success: false,
      error: error.message,
    });
  }
}
