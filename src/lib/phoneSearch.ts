/**
 * Normalize an Algerian phone number to a comparable digits-only form.
 * Strips non-digits, the +213 / 213 country code, and any leading 0.
 *
 * Examples (all normalize to "663819127"):
 *   "0663819127", "+213663819127", "213663819127", "00213 663 81 91 27"
 */
export function normalizePhone(input: string | null | undefined): string {
  const digits = (input || '').replace(/\D/g, '');
  if (digits.startsWith('00213')) return digits.slice(5);
  if (digits.startsWith('213')) return digits.slice(3);
  if (digits.startsWith('0')) return digits.slice(1);
  return digits;
}

/**
 * Returns true if the search query (when it contains digits) matches the
 * given phone number after normalization. Useful for searching orders/customers
 * by phone regardless of stored format.
 */
export function phoneMatchesQuery(phone: string | null | undefined, query: string): boolean {
  if (!query) return false;
  if (!/\d/.test(query)) return false;
  const normalizedQuery = normalizePhone(query);
  if (!normalizedQuery) return false;
  const normalizedPhone = normalizePhone(phone);
  return normalizedPhone.includes(normalizedQuery);
}
