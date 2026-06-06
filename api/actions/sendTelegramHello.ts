import { ActionOptions } from "gadget-server";

async function sendTelegram(url: string, chatId: string, text: string): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Failed to send Telegram message: ${data.description}`);
  }
}

export const run: ActionRun = async ({ api, logger, config }) => {
  const BOT_TOKEN = config.BOT_TOKEN;
  const CHAT_ID = config.CHAT_ID;
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  await sendTelegram(url, CHAT_ID, "Hello from your daily script!");
  logger.info("Message sent!");

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
    await sendTelegram(url, CHAT_ID, alertText);
    logger.info({ count: unlinked.length }, "Unlinked payments alert sent");
  }
};

export const options: ActionOptions = {
  triggers: {
    scheduler: [
      {
        cron: "0 8 * * *", // ~10:00 Kyiv time
      },
    ],
  },
};
