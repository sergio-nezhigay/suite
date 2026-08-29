export async function sendTelegramMessage(opts: {
  botToken: string;
  chatId: string;
  text: string;
}): Promise<void> {
  const res = await fetch(
    `https://api.telegram.org/bot${opts.botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: opts.chatId, text: opts.text }),
    }
  );
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Failed to send Telegram message: ${data.description}`);
  }
}
