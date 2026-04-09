import {
  applyParams,
  save,
  ActionOptions,
} from 'gadget-server';
import { preventCrossShopDataAccess } from 'gadget-server/shopify';

// Fields that are relevant to your app's business logic.
// Any webhook update that doesn't touch at least one of these fields
// will be skipped — no DB write, no CPU cost.
const RELEVANT_FIELDS = [
  // 'financialStatus',
  // 'fulfillmentStatus',
  'tags',
  // 'note',
  // 'cancelledAt',
  // 'cancelReason',
  // 'closedAt',
  // 'totalPrice',
  // 'paymentGatewayNames',
];

export const run = async ({ params, record }: any) => {
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);

  // Skip the DB write if none of the relevant fields changed
  const hasRelevantChange = RELEVANT_FIELDS.some((field) =>
    record.changed(field)
  );

  if (!hasRelevantChange) {
    return;
  }

  await save(record);
};

export const options: ActionOptions = { actionType: 'update' };
