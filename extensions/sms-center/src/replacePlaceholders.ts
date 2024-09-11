/**
 * Replaces placeholders in a template string with actual values from the data object.
 * @param {string} template - The template string containing placeholders (e.g., "Order number: {{orderNumber}}").
 * @param {object} data - An object containing key-value pairs for replacements (e.g., { orderNumber: "12345" }).
 * @returns {string} - The processed string with placeholders replaced.
 */
export const replacePlaceholders = (template, data) => {
  let result = template;

  for (const key in data) {
    const placeholder = `{{${key}}}`;
    result = result.replace(new RegExp(placeholder, 'g'), data[key]);
  }
  return result;
};
