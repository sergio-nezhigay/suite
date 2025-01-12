export const sendRequestNP = async (payload: object) => {
  try {
    console.log('🚀 ~ payload:', payload);
    const res = await fetch('https://api.novaposhta.ua/v2.0/json/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...payload, apiKey: process.env.NP_API_KEY }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.errors || 'Network error2');
    }
    if (!data.success) {
      const errors =
        Array.isArray(data.errors) && data.errors.length > 0
          ? `Errors: ${JSON.stringify(data.errors)}`
          : '';
      const warnings =
        Array.isArray(data.warnings) && data.warnings.length > 0
          ? `Warnings: ${JSON.stringify(data.warnings)}`
          : '';

      const errorMessage =
        [errors, warnings].filter(Boolean).join(' ') || 'Unknown error';
      throw new Error(errorMessage);
    }
    return data;
  } catch (error: any) {
    console.log('🚀 ~ error:', error);
    throw new Error(`sendRequestNP Error: ${error.message}`);
  }
};
