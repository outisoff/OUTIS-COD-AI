/**
 * Strips the "LF:" prefix (and any LightFunnel ID) from order numbers for display.
 * E.g. "LF:order_euRG7Z8X9eMkcK82FXiAp" → the cleaned order_number or fallback.
 */
export function formatOrderNumber(orderNumber: string): string {
  if (!orderNumber) return '';
  // Remove LF: prefix and everything after it if it's a LightFunnel ID
  if (orderNumber.startsWith('LF:')) {
    return orderNumber.replace(/^LF:/, '');
  }
  return orderNumber;
}
