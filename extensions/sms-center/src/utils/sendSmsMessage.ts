import { SHOPIFY_APP_URL } from '../../../shared/data';
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
 * @param {string} orderName - Optional order name for Rozetka integration.
 * @returns {Promise<SmsResponse>} - The response from the server with details about the sent message.
 */
export const sendSmsMessage = async (
  receiverNumber: string,
  messageText: string,
  orderName?: string
): Promise<SmsResponse> => {
  try {
    const formattedNumber = validateAndFormatPhoneNumber(receiverNumber);
    console.log('Formatted number:', formattedNumber);

    const response = await fetch(`${SHOPIFY_APP_URL}/send-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: formattedNumber,
        message: messageText,
        orderName,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error response from server:', errorData);

      return {
        status: 'error',
        messageId: '',
        error: errorData.error || 'Failed to send SMS',
      };
    }

    const data = await response.json();
    console.log('Success response data:', data);

    return {
      status: data.status || 'success',
      messageId: data.messageId || '',
      error: data.error,
    };
  } catch (error: any) {
    console.error('Exception caught while sending SMS:', error);

    return {
      status: 'error',
      messageId: '',
      error:
        'An unexpected error occurred: ' + (error.message || 'Unknown error'),
    };
  }
};
