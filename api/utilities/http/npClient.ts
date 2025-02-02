export const npClient = async (payload: object) => {
  try {
    const res = await fetch('https://api.novaposhta.ua/v2.0/json/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...payload, apiKey: process.env.NP_API_KEY }),
    });

    const data = await res.json();

    if (!data.success) {
      console.log('🚀 ~ Nova Poshta API Response:', data);

      const errors =
        Object.values(data.errors || {}).join('; ') || 'Unknown error';
      const errorCodes = Object.values(data.errorCodes || {}).join(', ');

      throw new Error(
        `Nova Poshta API Error: ${errors} (Codes: ${errorCodes})`
      );
    }
    return data;
  } catch (error: any) {
    console.log('🚀 ~ error:', error);
    throw new Error(`sendRequestNP Error: ${error.message}`);
  }
};
