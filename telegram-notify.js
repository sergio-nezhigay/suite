const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const MESSAGE = 'Hello from your daily script!';

const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

async function main() {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text: MESSAGE }),
  });

  const data = await res.json();

  if (data.ok) {
    console.log('Message sent!');
  } else {
    console.error('Failed:', data.description);
  }
}

main();

