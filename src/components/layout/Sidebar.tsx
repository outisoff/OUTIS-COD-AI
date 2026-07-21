import { useState, useMemo, useCallback, memo } from 'react';
import logoImg from '@/assets/logo.png';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveStores } from '@/hooks/useStores';
import { useStoreFilter } from '@/contexts/StoreFilterContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useLowStockProducts } from '@/hooks/useProducts';
import { useCurrentUserRole } from '@/hooks/useUserRoles';
import { useProfileName } from '@/hooks/useProfilesAndRoles';
import { prefetchRoute } from '@/lib/prefetchRoutes';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Truck,
  BarChart3,
  Gauge,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronDown,
  Phone,
  Send,
  MapPin,
  RefreshCw,
  AlertTriangle,
  Warehouse,
  Bot,
  DollarSign,
  Landmark,
  BotMessageSquare,
  Ban,
  Bell,
  Store,
  Receipt,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { usePendingOrdersCount } from '@/hooks/useOrders';
import { useDashboardOrdersSource } from '@/hooks/useDashboardData';

const PENDING_ORDER_STATUSES = new Set(['new', 'failed_1', 'failed_2', 'callback', 'to_reconfirm']);

const commandesSubItems = [
  { name: 'Toutes les commandes', href: '/orders', icon: ShoppingCart },
  { name: 'Confirmation', href: '/confirmation', icon: Phone },
  { name: 'Expédition', href: '/expedition', icon: Send },
  { name: 'Tracking', href: '/tracking', icon: MapPin },
  { name: 'Échange & Swap', href: '/echange-swap', icon: RefreshCw },
  { name: 'Payé & Retour', href: '/paye-retour', icon: DollarSign },
];

const clientsSubItems = [
  { name: 'Clients', href: '/customers', icon: Users },
  { name: 'Clients à risque', href: '/customers/risk', icon: AlertTriangle },
  { name: 'Liste noire', href: '/customers/blacklist', icon: Ban },
];

const automatisationSubItems = [
  { name: 'Confirmation IA', href: '/automatisation/confirmation-ia', icon: Bot },
  { name: 'Suivi Auto', href: '/automatisation/tracking-notif', icon: Bell },
];

const automatisationRoutes = ['/automatisation/confirmation-ia', '/automatisation/tracking-notif'];

const allNavigation = [
  { name: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'stock_manager', 'confirmateur'] },
  { name: 'Performance (KPI)', href: '/reports', icon: Gauge, roles: ['admin'] },
  { name: 'Clients', href: '/customers', icon: Users, roles: ['admin', 'confirmateur'], hasClientSubItems: true },
  { name: 'Commandes', href: '/orders', icon: ShoppingCart, showBadge: true, roles: ['admin'], hasSubItems: true },
  { name: 'Automatisation', href: '/automatisation', icon: Bot, roles: ['admin'], hasAutomationSubItems: true },
  { name: 'Confirmation', href: '/confirmation', icon: Phone, roles: ['confirmateur'] },
  { name: 'Tracking', href: '/tracking', icon: MapPin, roles: ['confirmateur'] },
  { name: 'Expédition', href: '/expedition', icon: Send, roles: ['stock_manager'] },
  
  { name: 'Stock', href: '/stock', icon: Warehouse, roles: ['admin', 'stock_manager'] },
  { name: 'Produits', href: '/products', icon: Package, roles: ['admin', 'stock_manager'] },
  { name: 'Livraison', href: '/delivery', icon: Truck, roles: ['admin'] },
  { name: 'Finance', href: '/finance', icon: Landmark, roles: ['admin'] },
  { name: 'Charges', href: '/charges', icon: Receipt, roles: ['admin'] },
  { name: 'Outis AI', href: '/chatbot', icon: BotMessageSquare, roles: ['admin'] },
  { name: 'Stores', href: '/stores', icon: Store, roles: ['admin'] },
  { name: 'Paramètres', href: '/settings', icon: Settings, roles: ['admin', 'confirmateur'] },
];

const commandesRoutes = ['/orders', '/confirmation', '/expedition', '/tracking', '/echange-swap', '/paye-retour'];
const clientsRoutes = ['/customers', '/customers/risk', '/customers/blacklist'];

// Role-specific ordering (stable reference)
const roleOrder: Record<string, string[]> = {
  confirmateur: ['Tableau de bord', 'Confirmation', 'Tracking', 'Clients', 'Paramètres'],
  stock_manager: ['Tableau de bord', 'Expédition', 'Stock', 'Produits'],
};

export const Sidebar = memo(function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const { data: lowStockProducts } = useLowStockProducts();
  const { data: userRole } = useCurrentUserRole();
  const { data: stores } = useActiveStores();
  const { selectedStoreId, setSelectedStoreId } = useStoreFilter();
  const isDashboard = location.pathname === '/dashboard';
  const { data: dashboardOrders = [] } = useDashboardOrdersSource(isDashboard);
  const { data: queriedPendingOrders = 0 } = usePendingOrdersCount(selectedStoreId, !isDashboard);
  const pendingOrders = isDashboard
    ? dashboardOrders.filter(order =>
        PENDING_ORDER_STATUSES.has(order.status) && (!selectedStoreId || order.store_id === selectedStoreId)
      ).length
    : queriedPendingOrders;

  const isCommandesActive = commandesRoutes.includes(location.pathname);
  const [commandesOpen, setCommandesOpen] = useState(isCommandesActive);
  const isClientsActive = clientsRoutes.includes(location.pathname);
  const [clientsOpen, setClientsOpen] = useState(isClientsActive);
  const isAutomatisationActive = automatisationRoutes.some(r => location.pathname.startsWith(r));
  const [automatisationOpen, setAutomatisationOpen] = useState(isAutomatisationActive);

  const lowStockCount = lowStockProducts?.length || 0;

  const { data: profile } = useProfileName(user?.id);

  const userName = profile?.full_name
    || user?.user_metadata?.full_name
    || user?.email?.split('@')[0]
    || 'Utilisateur';

  // Filter and sort navigation based on user role
  const navigation = useMemo(() => 
    allNavigation
      .filter(item => userRole && item.roles.includes(userRole))
      .sort((a, b) => {
        if (!userRole) return 0;
        const order = roleOrder[userRole];
        if (!order) return 0;
        const aIndex = order.indexOf(a.name);
        const bIndex = order.indexOf(b.name);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      })
  , [userRole]);

  const handlePrefetch = useCallback((href: string) => {
    prefetchRoute(href);
  }, []);

  return (
    <aside
      className={cn(
        'flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo + Store Selector */}
      <div className={cn(
        "flex h-16 items-center border-b border-sidebar-border",
        collapsed ? "justify-center gap-1 px-1" : "justify-between px-4"
      )}>
        {!collapsed && (
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer min-w-0 overflow-hidden">
                <img src={logoImg} alt="OUTIS COD" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                <span 
                  key={selectedStoreId || 'all'} 
                  className="font-semibold text-lg truncate animate-fade-in"
                >
                  {selectedStoreId 
                    ? (stores?.find(s => s.id === selectedStoreId)?.name || 'Store')
                    : 'OUTIS COD'
                  }
                </span>
                {stores && stores.length > 0 && (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
              </button>
            </PopoverTrigger>
            {stores && stores.length > 0 && (
              <PopoverContent className="w-56 p-1" align="start" side="bottom">
                <div className="text-xs font-medium text-muted-foreground px-2 py-1.5">Sélectionner un store</div>
                <button
                  onClick={() => setSelectedStoreId(null)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-2 text-sm rounded-md transition-colors',
                    !selectedStoreId ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
                  )}
                >
                  <Store className="h-4 w-4" />
                  Tous les stores
                </button>
                {stores.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStoreId(s.id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-2 text-sm rounded-md transition-colors',
                      selectedStoreId === s.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
                    )}
                  >
                    <Store className="h-4 w-4" />
                    {s.name}
                  </button>
                ))}
              </PopoverContent>
            )}
          </Popover>
        )}
        {collapsed && (
          <div className="flex items-center w-full relative">
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              aria-label="Ouvrir le menu"
              className="mx-auto ml-1"
            >
              <img src={logoImg} alt="OUTIS COD" className="w-8 h-8 rounded-lg object-cover" />
            </button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(false)}
              className="h-6 w-6 text-sidebar-foreground hover:bg-sidebar-accent absolute right-0"
              aria-label="Ouvrir le menu"
            >
              <ChevronLeft className="h-4 w-4 rotate-180" />
            </Button>
          </div>
        )}
        {!collapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(true)}
            className="h-10 w-10 text-sidebar-foreground hover:bg-sidebar-accent"
            aria-label="Réduire le menu"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 py-4 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <nav className="px-2 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;

            // Collapsible Commandes item
            if (item.hasSubItems && !collapsed) {
              return (
                <div key={item.name}>
                  <button
                    onClick={() => setCommandesOpen(prev => !prev)}
                    className={cn(
                      'nav-item w-full',
                      isCommandesActive && 'nav-item-active'
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className="flex-1 text-left">{item.name}</span>
                    <ChevronDown className={cn('h-4 w-4 transition-transform', commandesOpen && 'rotate-180')} />
                  </button>
                  {commandesOpen && (
                    <div className="ml-4 mt-1 space-y-0.5 border-l border-sidebar-border pl-3">
                      {commandesSubItems.map((sub) => {
                        const isSubActive = location.pathname === sub.href;
                        return (
                          <NavLink
                            key={sub.href}
                            to={sub.href}
                            onMouseEnter={() => handlePrefetch(sub.href)}
                            className={cn(
                              'nav-item text-sm py-1.5',
                              isSubActive && 'nav-item-active'
                            )}
                          >
                            <sub.icon className="h-4 w-4 shrink-0" />
                            <span className="flex-1">{sub.name}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // Collapsed: just show icon for Commandes (link to /orders)
            if (item.hasSubItems && collapsed) {
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onMouseEnter={() => handlePrefetch(item.href)}
                  className={cn(
                    'nav-item',
                    isCommandesActive && 'nav-item-active'
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                </NavLink>
              );
            }

            // Collapsible Clients item
            if (item.hasClientSubItems && !collapsed) {
              return (
                <div key={item.name}>
                  <button
                    onClick={() => setClientsOpen(prev => !prev)}
                    className={cn(
                      'nav-item w-full',
                      isClientsActive && 'nav-item-active'
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className="flex-1 text-left">{item.name}</span>
                    <ChevronDown className={cn('h-4 w-4 transition-transform', clientsOpen && 'rotate-180')} />
                  </button>
                  {clientsOpen && (
                    <div className="ml-4 mt-1 space-y-0.5 border-l border-sidebar-border pl-3">
                      {clientsSubItems.map((sub) => {
                        const isSubActive = location.pathname === sub.href;
                        return (
                          <NavLink
                            key={sub.href}
                            to={sub.href}
                            onMouseEnter={() => handlePrefetch(sub.href)}
                            className={cn(
                              'nav-item text-sm py-1.5',
                              isSubActive && 'nav-item-active'
                            )}
                          >
                            <sub.icon className="h-4 w-4 shrink-0" />
                            <span className="flex-1">{sub.name}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            if (item.hasClientSubItems && collapsed) {
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onMouseEnter={() => handlePrefetch(item.href)}
                  className={cn(
                    'nav-item',
                    isClientsActive && 'nav-item-active'
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                </NavLink>
              );
            }

            // Collapsible Automatisation item
            if (item.hasAutomationSubItems && !collapsed) {
              return (
                <div key={item.name}>
                  <button
                    onClick={() => setAutomatisationOpen(prev => !prev)}
                    className={cn(
                      'nav-item w-full',
                      isAutomatisationActive && 'nav-item-active'
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className="flex-1 text-left">{item.name}</span>
                    <ChevronDown className={cn('h-4 w-4 transition-transform', automatisationOpen && 'rotate-180')} />
                  </button>
                  {automatisationOpen && (
                    <div className="ml-4 mt-1 space-y-0.5 border-l border-sidebar-border pl-3">
                      {automatisationSubItems.map((sub) => {
                        const isSubActive = location.pathname === sub.href;
                        return (
                          <NavLink
                            key={sub.href}
                            to={sub.href}
                            onMouseEnter={() => handlePrefetch(sub.href)}
                            className={cn(
                              'nav-item text-sm py-1.5',
                              isSubActive && 'nav-item-active'
                            )}
                          >
                            <sub.icon className="h-4 w-4 shrink-0" />
                            <span className="flex-1">{sub.name}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            if (item.hasAutomationSubItems && collapsed) {
              return (
                <NavLink
                  key={item.name}
                  to="/automatisation/confirmation-ia"
                  onMouseEnter={() => handlePrefetch(item.href)}
                  className={cn(
                    'nav-item',
                    isAutomatisationActive && 'nav-item-active'
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                </NavLink>
              );
            }

            return (
              <NavLink
                key={item.name}
                to={item.href}
                onMouseEnter={() => handlePrefetch(item.href)}
                className={cn(
                  'nav-item',
                  isActive && 'nav-item-active'
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.name}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Low Stock Alert */}
        {!collapsed && lowStockCount > 0 && (
          <div className="mx-3 mt-6 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <div className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Stock Faible</span>
            </div>
            <p className="text-xs text-sidebar-muted mt-1">
              {lowStockCount} produit(s) en dessous du seuil
            </p>
          </div>
        )}
      </div>

      <Separator className="bg-sidebar-border" />

      {/* User Section */}
      <div className="p-4">
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center">
              <span className="text-sm font-medium">{userName.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{userName}</p>
              <p className="text-xs text-sidebar-muted truncate">
                {user?.email}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logout()}
              className="text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => logout()}
            className="w-full text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </div>
    </aside>
  );
});
