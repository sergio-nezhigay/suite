export function prepareProductDescription(htmlDescription) {
  if (!htmlDescription) return '';
  const allowedTags = ['p', 'br', 'ul', 'li', 'strong', 'em'];

  const cleanHTML = (input) => {
    return input.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tag) => {
      return allowedTags.includes(tag.toLowerCase()) ? match : '';
    });
  };

  const escapeHTML = (str) => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const removeTabsAndNewlines = (str) => {
    return str.replace(/\t/g, ' ').replace(/\n/g, ' ').replace(/\r/g, '');
  };

  const cleanedDescription = cleanHTML(htmlDescription);
  const escapedDescription = escapeHTML(cleanedDescription);
  return removeTabsAndNewlines(escapedDescription);
}
