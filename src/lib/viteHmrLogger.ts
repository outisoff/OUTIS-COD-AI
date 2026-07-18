/**
 * Logs Vite HMR (Hot Module Replacement) events to help diagnose
 * unexpected page refreshes during development.
 *
 * In production builds, `import.meta.hot` is undefined and this is a no-op.
 */

export function installViteHmrLogger() {
  if (typeof window === 'undefined') return;
  const hot = (import.meta as any).hot;
  if (!hot) {
    console.info('[ViteHMR] Production build — HMR disabled');
    return;
  }
  if ((window as any).__viteHmrLoggerInstalled) return;
  (window as any).__viteHmrLoggerInstalled = true;

  const log = (event: string, payload?: unknown) => {
    console.warn(`[ViteHMR] ${event}`, {
      timestamp: new Date().toISOString(),
      payload,
    });
  };

  hot.on('vite:beforeUpdate', (payload: unknown) => log('beforeUpdate (hot reload incoming)', payload));
  hot.on('vite:afterUpdate', (payload: unknown) => log('afterUpdate (hot reload applied)', payload));
  hot.on('vite:beforeFullReload', (payload: unknown) => {
    log('⚠️ beforeFullReload (FULL PAGE RELOAD incoming!)', payload);
    console.trace('[ViteHMR] Full reload stack trace');
  });
  hot.on('vite:beforePrune', (payload: unknown) => log('beforePrune', payload));
  hot.on('vite:invalidate', (payload: unknown) => log('⚠️ invalidate (module invalidated, may trigger reload)', payload));
  hot.on('vite:error', (payload: unknown) => log('❌ error', payload));
  hot.on('vite:ws:disconnect', (payload: unknown) => log('ws:disconnect (dev server lost)', payload));
  hot.on('vite:ws:connect', (payload: unknown) => log('ws:connect (dev server reconnected)', payload));

  // Detect manual window.location.reload() calls (best-effort — location is read-only in modern browsers)
  try {
    const origReload = window.location.reload.bind(window.location);
    Object.defineProperty(window.location, 'reload', {
      configurable: true,
      writable: true,
      value: (...args: unknown[]) => {
        console.warn('[ViteHMR] 🔄 window.location.reload() called', {
          timestamp: new Date().toISOString(),
          stack: new Error().stack,
        });
        return origReload(...(args as []));
      },
    });
  } catch {
    console.info('[ViteHMR] Cannot intercept window.location.reload (read-only)');
  }

  // Detect beforeunload (page about to navigate away or reload)
  window.addEventListener('beforeunload', () => {
    console.warn('[ViteHMR] 👋 beforeunload fired — page is unloading', {
      timestamp: new Date().toISOString(),
    });
  });

  console.info('[ViteHMR] Logger installed — watching for hot updates and reloads');
}
