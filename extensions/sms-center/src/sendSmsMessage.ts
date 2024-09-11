export const sendSmsMessage = async (receiverNumber, messageText) => {
  try {
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
      const errorDetails = await res.json();
      console.error('Server error:', errorDetails);
      throw new Error(
        `Server error: ${errorDetails.details || 'Unknown error'}`
      );
    }

    const json = await res.json();
    return json;
  } catch (err) {
    console.error('Error sending SMS:', err.message);
    throw new Error(`Failed to send SMS: ${err.message}`);
  }
};
