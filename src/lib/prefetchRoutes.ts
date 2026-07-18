// Map route paths to their lazy-import factories for prefetching on hover
const routeImports: Record<string, () => Promise<any>> = {
  '/dashboard': () => import('@/pages/Dashboard'),
  '/orders': () => import('@/pages/Orders'),
  '/products': () => import('@/pages/Products'),
  '/customers': () => import('@/pages/Customers'),
  '/customers/risk': () => import('@/pages/CustomersRisk'),
  '/customers/blacklist': () => import('@/pages/CustomersBlacklist'),
  '/confirmation': () => import('@/pages/Confirmation'),
  '/expedition': () => import('@/pages/Expedition'),
  '/tracking': () => import('@/pages/Tracking'),
  '/delivery': () => import('@/pages/Delivery'),
  '/stock': () => import('@/pages/Stock'),
  '/settings': () => import('@/pages/Settings'),
  '/automatisation': () => import('@/pages/Automatisation'),
  '/finance': () => import('@/pages/Finance'),
  '/reports': () => import('@/pages/Reports'),
  '/chatbot': () => import('@/pages/Chatbot'),
  '/echange-swap': () => import('@/pages/EchangeSwap'),
  '/paye-retour': () => import('@/pages/PayeRetour'),
  '/stores': () => import('@/pages/Stores'),
};

const prefetched = new Set<string>();

export function prefetchRoute(path: string) {
  if (prefetched.has(path)) return;
  const loader = routeImports[path];
  if (loader) {
    prefetched.add(path);
    loader(); // fire-and-forget: browser caches the chunk
  }
}
