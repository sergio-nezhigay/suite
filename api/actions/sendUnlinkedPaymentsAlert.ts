import { ActionOptions } from "gadget-server";
import { sendTelegramMessage } from "api/utilities/http/telegramClient";

export const run: ActionRun = async ({ api, logger, config }) => {
  const BOT_TOKEN = config.BOT_TOKEN;
  const CHAT_ID = config.CHAT_ID;

  const cutoff = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);

  const recentIncome = await api.bankTransaction.findMany({
    filter: {
      transactionDateTime: { greaterThan: cutoff },
      type: { equals: "income" },
    },
    select: {
      id: true,
      amount: true,
      currency: true,
      transactionDateTime: true,
      counterpartyName: true,
      matchedOrderId: true,
    },
    first: 250,
    sort: { transactionDateTime: "Descending" },
  });

  const unlinked = recentIncome.filter(
    (t) => !t.matchedOrderId && !t.counterpartyName?.includes("НоваПей")
  );

  if (unlinked.length > 0) {
    const lines = unlinked.map((t) => {
      const date = new Date(t.transactionDateTime!).toISOString().split("T")[0];
      return `📌 ${date} | ${t.amount} ${t.currency} | ${t.counterpartyName || "Unknown"}`;
    });
    const alertText = `⚠️ Непов'язані платежі (4 дні): ${unlinked.length}\n\n${lines.join("\n")}`;
    await sendTelegramMessage({ botToken: BOT_TOKEN!, chatId: CHAT_ID!, text: alertText });
    logger.info({ count: unlinked.length }, "Unlinked payments alert sent");
  }
};

export const options: ActionOptions = {
  triggers: {
    scheduler: [
      {
        cron: "0 9 * * *", 
      },
    ],
  },
};
