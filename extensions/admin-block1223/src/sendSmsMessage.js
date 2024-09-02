export const sendSmsMessage = async (receiverNumber, messageText) => {
  const res = await fetch('https://admin-action-block.gadget.app/send-sms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: receiverNumber,
      message: messageText,
    }),
  });

  if (!res.ok) {
    console.error('Network error');
    throw new Error('Network error');
  }

  const json = await res.json();
  return json;
};
