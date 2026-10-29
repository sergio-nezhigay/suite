import { ActionOptions } from 'gadget-server';
import { CheckboxService, friendlyCheckboxError } from '../utilities/fiscal/checkboxService';
import { OrderToReceiptTransformer } from '../utilities/fiscal/orderToReceiptTransformer';
import { getCheckSkipReason } from '../utilities/fiscal/paymentConstants';
import { refreshBankDataSinceLastSync } from '../utilities/bank/refreshBankData';
import { timeIt } from 'api/utilities/timeIt';

// One press = find the bank payment for each order, then issue its fiscal check
// or record why none is needed. Everything is stored on the bankTransaction row,
// so pressing again only reports what is already done.

const DAY_MS = 24 * 60 * 60 * 1000;

const TX_SELECT = {
  id: true,
  amount: true,
  transactionDateTime: true,
  description: true,
  counterpartyAccount: true,
  matchedOrderId: true,
  checkReceiptId: true,
  checkIssuedAt: true,
  checkSkipReason: true,
} as const;

type OrderInput = {
  id: string;
  name: string;
  createdAt: string;
  totalAmount: number;
  lineItems: { id: string; title: string; quantity: number; price: string }[];
};

type CheckStatus = 'no_payment' | 'issued' | 'skipped' | 'failed';

const toNumericId = (id: string) => id.split('/').pop() as string;

export const run = async ({ params, api, logger }: any) => {
  const actionStart = performance.now();
  const orders: OrderInput[] = params.orderData;
  if (!Array.isArray(orders) || orders.length === 0) {
    throw new Error('orderData parameter is required');
  }
  const orderIds = orders.map((o) => toNumericId(o.id));

  try {
    await timeIt('refresh_bank_data', () => refreshBankDataSinceLastSync(api), logger);
  } catch (refreshError) {
    logger.warn({ err: refreshError }, 'Bank data refresh failed');
  }

  const [alreadyMatched, unmatched] = await Promise.all([
    api.bankTransaction.findMany({
      filter: { matchedOrderId: { in: orderIds } },
      select: TX_SELECT,
    }),
    api.bankTransaction.findMany({
      filter: {
        transactionDateTime: { greaterThan: new Date(Date.now() - 10 * DAY_MS) },
        type: { equals: 'income' },
        matchedOrderId: { equals: null },
      },
      sort: { transactionDateTime: 'Descending' },
      first: 250,
      select: TX_SELECT,
    }),
  ]);
  const freeTxs: any[] = [...unmatched];

  // Signed in lazily: only when at least one order actually needs a check
  let checkbox: CheckboxService | null = null;
  const getCheckbox = async () => {
    if (!checkbox) {
      const service = new CheckboxService(logger);
      await timeIt('checkbox_signin', () => service.signIn(), logger);
      await timeIt('checkbox_ensure_shift', () => service.ensureShiftOpen(), logger);
      checkbox = service;
    }
    return checkbox;
  };

  const results: { status: CheckStatus; [key: string]: unknown }[] = [];
  for (const order of orders) {
    const orderId = toNumericId(order.id);
    let tx = alreadyMatched.find((t: any) => t.matchedOrderId === orderId);

    if (!tx) {
      const orderTime = new Date(order.createdAt).getTime();
      const index = freeTxs.findIndex(
        (t) =>
          Math.abs((t.amount || 0) - order.totalAmount) < 0.01 &&
          Math.abs(new Date(t.transactionDateTime).getTime() - orderTime) < 7 * DAY_MS
      );
      if (index >= 0) {
        // Taken out of the pool so two orders with the same amount never share a payment
        [tx] = freeTxs.splice(index, 1);
        await api.bankTransaction.update(tx.id, { matchedOrderId: orderId });
      }
    }

    let status: CheckStatus = 'no_payment';
    let reason: string | null = null;
    let receiptId: string | null = tx?.checkReceiptId ?? null;

    if (!tx) {
      status = 'no_payment';
    } else if (tx.checkReceiptId || tx.checkIssuedAt) {
      status = 'issued';
    } else if (tx.checkSkipReason) {
      status = 'skipped';
      reason = tx.checkSkipReason;
    } else if ((reason = getCheckSkipReason(tx.counterpartyAccount))) {
      status = 'skipped';
      await api.bankTransaction.update(tx.id, { checkSkipReason: reason });
    } else {
      let receipt: { id: string } | null = null;
      try {
        const service = await getCheckbox();
        receipt = await timeIt(
          'checkbox_create_receipt',
          () =>
            service.createSellReceipt(
              OrderToReceiptTransformer.transformOrderFromDataForSell(order, order)
            ),
          logger,
          { orderId }
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ orderName: order.name, err: error }, 'Check creation failed');
        status = 'failed';
        reason = friendlyCheckboxError(message);
      }

      if (receipt) {
        receiptId = receipt.id;
        // Saved right after Checkbox answers (one retry), so a later press can never issue it twice
        const save = () =>
          api.bankTransaction.update(tx.id, {
            checkReceiptId: receipt!.id,
            checkIssuedAt: new Date(),
          });
        try {
          await save().catch(save);
          status = 'issued';
        } catch (error) {
          logger.error(
            { orderName: order.name, receiptId: receipt.id, err: error },
            'Check created but receipt id not saved'
          );
          status = 'failed';
          reason = 'Check created but not saved. Do not press again; tell the developer the Receipt ID.';
        }
      }
    }

    results.push({
      orderId,
      orderName: order.name,
      orderAmount: order.totalAmount,
      status,
      reason,
      receiptId,
      payment: tx
        ? {
            amount: tx.amount || 0,
            date: tx.transactionDateTime ?? null,
            description: tx.description || '',
          }
        : null,
    });
  }

  const count = (s: CheckStatus) => results.filter((r) => r.status === s).length;
  logger.info(
    {
      stage: 'verify_summary',
      orders_checked: orders.length,
      no_payment: count('no_payment'),
      issued: count('issued'),
      skipped: count('skipped'),
      failed: count('failed'),
      total_duration_ms: Math.round(performance.now() - actionStart),
    },
    'Verify summary'
  );

  return { success: true, results, transactionsScanned: unmatched.length };
};

export const params = {
  orderData: {
    type: 'array',
    required: true,
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        createdAt: { type: 'string' },
        totalAmount: { type: 'number' },
        lineItems: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              quantity: { type: 'number' },
              price: { type: 'string' },
            },
          },
        },
      },
    },
  },
};

export const options: ActionOptions = {
  actionType: 'custom',
};
