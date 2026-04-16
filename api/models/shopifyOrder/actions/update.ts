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

export const run = async ({ params, record, logger }: any) => {
  const start = performance.now();
  try {
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
  } finally {
    const duration_ms = Math.round(performance.now() - start);
    logger?.info({ stage: 'shopify_order_update', duration_ms, orderId: record.id }, 'shopify_order_update completed');
  }
};

export const options: ActionOptions = { actionType: 'update' };
