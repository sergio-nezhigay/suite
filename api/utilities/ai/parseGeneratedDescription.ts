export function parseGeneratedDescription(jsonResponse: string) {
  try {
    if (jsonResponse.startsWith('```json')) {
      jsonResponse = jsonResponse
        .replace(/^```json/, '')
        .replace(/```$/, '')
        .trim();
    }

    const parsed = JSON.parse(jsonResponse);

    if (!parsed.html || !parsed.title || !parsed.vendor) {
      throw new Error(
        'JSON is missing required fields: `html` or `title` or `vendor`'
      );
    }

    return parsed;
  } catch (error) {
    console.error('Error parsing JSON response:', error);
    throw new Error('Failed to parse the product description JSON.');
  }
}
