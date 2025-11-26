/**
 * Normalizes phone numbers to E.164 format.
 * If the number already starts with +, returns as-is.
 * Otherwise, assumes US number and adds +1 prefix.
 *
 * @param phone - Phone number in any format
 * @returns Phone number in E.164 format (e.g., +15551234567)
 */
export function normalizePhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, ''); // Remove all non-digits

  if (phone.startsWith('+')) {
    return phone;
  }

  // If it's 10 digits, assume US and add +1
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }

  // If it's 11 digits and starts with 1, add +
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }

  // Otherwise, return with + prefix
  return `+${cleaned}`;
}

