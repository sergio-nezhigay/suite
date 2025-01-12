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
 * @returns {Promise<SmsResponse>} - The response from the server with details about the sent message.
 */
export const sendSmsMessage = async (
  receiverNumber: string,
  messageText: string
): Promise<SmsResponse> => {
  try {
    console.log('Starting to process SMS send request...');
    console.log('Receiver number before formatting:', receiverNumber);

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
      }),
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error response from server:', errorData);

      return {
        status: 'error',
        messageId: '',
        error: errorData.message || 'Failed to send SMS',
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
