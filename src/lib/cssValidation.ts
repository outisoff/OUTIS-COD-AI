/**
 * CSS validation utilities to prevent CSS injection attacks
 * Used for validating color values before using in dangerouslySetInnerHTML
 */

// Regex patterns for valid CSS color formats
const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
const RGB_REGEX = /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/;
const RGBA_REGEX = /^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(0|1|0?\.\d+)\s*\)$/;
const HSL_REGEX = /^hsl\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*\)$/;
const HSLA_REGEX = /^hsla\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*,\s*(0|1|0?\.\d+)\s*\)$/;
// Modern CSS color formats
const HSL_MODERN_REGEX = /^hsl\(\s*\d{1,3}(?:deg)?\s+\d{1,3}%\s+\d{1,3}%(?:\s*\/\s*(0|1|0?\.\d+|\d{1,3}%))?\s*\)$/;

// Named CSS colors (subset of most common)
const NAMED_COLORS = new Set([
  'transparent', 'currentcolor', 'inherit',
  'black', 'white', 'red', 'green', 'blue', 'yellow', 'cyan', 'magenta',
  'gray', 'grey', 'silver', 'maroon', 'olive', 'lime', 'aqua', 'teal', 'navy',
  'fuchsia', 'purple', 'orange', 'pink', 'brown', 'gold', 'coral', 'crimson',
  'darkblue', 'darkgreen', 'darkred', 'lightblue', 'lightgreen', 'lightgray',
]);

/**
 * Validates if a string is a safe CSS color value
 * Prevents CSS injection by only allowing known color formats
 * 
 * @param color - The color value to validate
 * @returns true if the color is valid and safe, false otherwise
 */
export function isValidCSSColor(color: string): boolean {
  if (!color || typeof color !== 'string') {
    return false;
  }
  
  const trimmedColor = color.trim().toLowerCase();
  
  // Check named colors
  if (NAMED_COLORS.has(trimmedColor)) {
    return true;
  }
  
  // Check hex colors
  if (HEX_COLOR_REGEX.test(color.trim())) {
    return true;
  }
  
  // Check rgb/rgba
  if (RGB_REGEX.test(trimmedColor) || RGBA_REGEX.test(trimmedColor)) {
    return true;
  }
  
  // Check hsl/hsla (both legacy and modern syntax)
  if (HSL_REGEX.test(trimmedColor) || HSLA_REGEX.test(trimmedColor) || HSL_MODERN_REGEX.test(trimmedColor)) {
    return true;
  }
  
  // Check CSS variable references (common in design systems)
  if (/^var\(--[\w-]+(?:,\s*[^)]+)?\)$/.test(trimmedColor)) {
    return true;
  }
  
  return false;
}

/**
 * Sanitizes a color value, returning null if invalid
 * 
 * @param color - The color value to sanitize
 * @returns The sanitized color or null if invalid
 */
export function sanitizeCSSColor(color: string | undefined | null): string | null {
  if (!color) {
    return null;
  }
  
  if (isValidCSSColor(color)) {
    return color.trim();
  }
  
  console.warn('Invalid CSS color value rejected:', color);
  return null;
}
