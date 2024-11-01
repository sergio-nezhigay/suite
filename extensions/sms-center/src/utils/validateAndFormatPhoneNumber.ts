export default function validateAndFormatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.length === 10 && cleaned.startsWith('0')) {
    return `380${cleaned.slice(1)}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith('380')) {
    return cleaned;
  }

  throw new Error(
    `Invalid phone number: ${phone}. Must be in the format 380XXXXXXXXX.`
  );
}
