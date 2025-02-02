export const stripText = (text: string, termsToRemove: string[]): string =>
  termsToRemove.reduce(
    (str, term) => str.replace(new RegExp(term.toLowerCase(), 'g'), ''),
    text.toLowerCase()
  );
