import { ActionOptions } from 'gadget-server';
import { rozetkaTokenManager } from '../utilities/rozetka/tokenManager';

export const run: ActionRun = async ({ logger }) => {
  logger.info('Starting Rozetka authentication check...');

  try {
    const token = await rozetkaTokenManager.getValidToken();

    if (token) {
      logger.info('Successfully verified Rozetka authentication', {
        tokenPreview: `${token.substring(0, 15)}...`,
        timestamp: new Date().toISOString()
      });
      return { success: true, message: 'Rozetka auth confirmed.' };
    } else {
      throw new Error('Received null token from manager');
    }
  } catch (error: any) {
    logger.error('Rozetka authentication check failed', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

export const options: ActionOptions = {
  triggers: {
    scheduler: [],
  },
};
