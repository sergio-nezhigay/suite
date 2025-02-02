// sendSms.js

export async function smsClient(recipientNumber: string, messageText: string) {
  const apiKey = process.env.SMS_API_KEY;
  const apiUrl = 'https://sms-sms.com.ua/api/v2/api.php';

  const recipientFormat = /^\d{12}$/;
  if (!recipientFormat.test(recipientNumber)) {
    throw new Error(
      'Invalid recipient number format. Must be 12 digits without + sign.'
    );
  }

  const requestBody = {
    auth: {
      key: apiKey,
    },
    action: 'SENDMESSAGE',
    data: {
      recipient: recipientNumber,
      channels: ['sms'],
      sms: {
        source: 'Informatica',
        ttl: 60,
        text: messageText,
      },
    },
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    const responseBody = await response.json();

    if (!response.ok || responseBody.success === 0) {
      const errorCode = responseBody.error?.code || 'Unknown error';
      const errorDescription =
        responseBody.error?.description || 'No description provided';
      throw new Error(`API Error: ${errorCode} - ${errorDescription}`);
    }

    return responseBody.data;
  } catch (error) {
    throw error;
  }
}
