/**
 * Suppresses noisy console messages from external SDKs (TikTok Pixel, etc.)
 * that we cannot control but pollute the developer console.
 *
 * Patterns are matched against the first stringified argument of console.error/warn.
 * Keep this list narrow — only silence messages that are confirmed third-party noise.
 */

const SUPPRESS_PATTERNS: RegExp[] = [
  // TikTok Pixel / RS SDK invalid event names
  /RS SDK.*TikTok Ads.*Event name.*is not valid/i,
  /Event name \(chat\.latencymeasuredv1\)/i,
  /Event name \(chat_suggestions_shown\)/i,
  // Lovable editor postMessage noise
  /Unknown message type:\s*RESET_BLANK_CHECK/i,
];

function shouldSuppress(args: unknown[]): boolean {
  if (args.length === 0) return false;
  const first = args[0];
  const text = typeof first === 'string' ? first : (() => {
    try { return String(first); } catch { return ''; }
  })();
  return SUPPRESS_PATTERNS.some((re) => re.test(text));
}

export function installConsoleNoiseFilter() {
  if (typeof window === 'undefined') return;
  if ((window as any).__consoleNoiseFilterInstalled) return;
  (window as any).__consoleNoiseFilterInstalled = true;

  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);
  const origLog = console.log.bind(console);

  console.error = (...args: unknown[]) => {
    if (shouldSuppress(args)) return;
    origError(...args);
  };
  console.warn = (...args: unknown[]) => {
    if (shouldSuppress(args)) return;
    origWarn(...args);
  };
  console.log = (...args: unknown[]) => {
    if (shouldSuppress(args)) return;
    origLog(...args);
  };
}
