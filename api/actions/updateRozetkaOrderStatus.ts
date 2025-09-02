import { changeRozetkaOrderStatus } from 'api/utilities/rozetka/changeRozetkaOrderStatus';
import { rozetkaTokenManager } from 'api/utilities/rozetka/tokenManager';

export const run: ActionRun = async ({ params, logger }) => {
  const { orderNumber, status } = params;

  if (typeof orderNumber !== 'number' || typeof status !== 'number') {
    throw new Error('orderNumber and status are required and must be numbers');
  }

  const accessToken = await rozetkaTokenManager.getValidToken();

  const result = await changeRozetkaOrderStatus(
    orderNumber,
    status,
    accessToken
  );
  return { success: true, result };
};

export const params = {
  orderNumber: {
    type: 'number',
  },
  status: {
    type: 'number',
  },
};
