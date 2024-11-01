import validateAndFormatPhoneNumber from './validateAndFormatPhoneNumber';

type SmsResponse = {
  status: string;
  messageId: string;
  error?: string;
};

/**
 * Sends an SMS message to the specified receiver.
 * @param {string} receiverNumber - The phone number of the receiver.
 * @param {string} messageText - The SMS text to send.
 * @returns {Promise<SmsResponse>} - The response from the server with details about the sent message.
 */
export const sendSmsMessage = async (
  receiverNumber: string,
  messageText: string
): Promise<SmsResponse> => {
  try {
    const formattedNumber = validateAndFormatPhoneNumber(receiverNumber);
    const res = await fetch('https://admin-action-block.gadget.app/send-sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: formattedNumber,
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

    const json: SmsResponse = await res.json();
    return json;
  } catch (err: any) {
    console.error('Error sending SMS:', err.message);
    throw new Error(`Failed to send SMS: ${err.message}`);
  }
};
