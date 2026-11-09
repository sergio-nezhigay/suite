// Ukrainian numbers arrive as 0XXXXXXXXX, 380XXXXXXXXX, +380…, 80XXXXXXXXX
// or bare XXXXXXXXX (customer skipped the leading 0). All map to 380 + last 9 digits.
export default function validateAndFormatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (/^(380|80|0)?\d{9}$/.test(digits)) return `380${digits.slice(-9)}`;
  throw new Error(
    `Invalid phone number: ${phone}. Must be in the format 380XXXXXXXXX.`
  );
}
