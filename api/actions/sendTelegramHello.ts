import { ActionOptions } from "gadget-server";

export const run: ActionRun = async ({ logger, config }) => {
  const BOT_TOKEN = config.BOT_TOKEN;
  const CHAT_ID = config.CHAT_ID;
  const MESSAGE = "Hello from your daily script!";

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, text: MESSAGE }),
  });

  const data = await res.json();

  if (data.ok) {
    logger.info("Message sent!");
  } else {
    throw new Error(`Failed to send Telegram message: ${data.description}`);
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
