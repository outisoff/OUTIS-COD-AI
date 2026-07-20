import { useState, useMemo, useCallback, memo } from 'react';
import { formatOrderNumber } from '@/lib/formatOrderNumber';
import { Bell, Search, Package, User, ShoppingCart, AlertTriangle, PackageX, UserX, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useCustomers } from '@/hooks/useCustomers';
import { useProducts } from '@/hooks/useProducts';
import { useSmartAlerts, SmartAlert } from '@/hooks/useSmartAlerts';
import { useDashboardOrdersSource } from '@/hooks/useDashboardData';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { phoneMatchesQuery } from '@/lib/phoneSearch';

const getAlertIcon = (alert: SmartAlert) => {
  switch (alert.type) {
    case 'customer_risk': return <UserX className="h-4 w-4 text-destructive" />;
    case 'out_of_stock': return <PackageX className="h-4 w-4 text-destructive" />;
    case 'low_stock': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case 'system': return <Info className="h-4 w-4 text-primary" />;
    default: return <Bell className="h-4 w-4" />;
  }
};

const getSeverityDot = (severity: SmartAlert['severity']) => {
  switch (severity) {
    case 'critical': return 'bg-destructive';
    case 'warning': return 'bg-amber-500';
    default: return 'bg-primary';
  }
};

const formatTimeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Il y a ${days}j`;
};

export const Header = memo(function Header() {
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const shouldLoadSearchOrders = searchOpen || searchQuery.trim().length > 0;
  
  const { data: orders } = useDashboardOrdersSource();
  const { data: customers } = useCustomers(shouldLoadSearchOrders);
  const { data: products } = useProducts();
  const { alerts: smartAlerts, criticalCount, totalCount } = useSmartAlerts();

  // Search results — only compute when query is non-empty
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return { orders: [], customers: [], products: [] };
    
    const query = searchQuery.toLowerCase();
    
    const filteredOrders = (orders || [])
      .filter(o => 
        o.order_number.toLowerCase().includes(query) ||
        o.customer_name.toLowerCase().includes(query) ||
        phoneMatchesQuery(o.customer_phone, query)
      )
      .slice(0, 5);
    
    const filteredCustomers = (customers || [])
      .filter(c => 
        c.name.toLowerCase().includes(query) ||
        phoneMatchesQuery(c.phone, query) ||
        c.wilaya.toLowerCase().includes(query)
      )
      .slice(0, 5);
    
    const filteredProducts = (products || [])
      .filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query)
      )
      .slice(0, 5);
    
    return {
      orders: filteredOrders,
      customers: filteredCustomers,
      products: filteredProducts,
    };
  }, [searchQuery, orders, customers, products]);

  const hasResults = searchResults.orders.length > 0 || 
                     searchResults.customers.length > 0 || 
                     searchResults.products.length > 0;

  const handleSelectOrder = useCallback((orderId: string) => {
    setSearchOpen(false);
    setSearchQuery('');
    navigate('/orders');
  }, [navigate]);

  const handleSelectCustomer = useCallback((customerId: string) => {
    setSearchOpen(false);
    setSearchQuery('');
    navigate('/customers');
  }, [navigate]);

  const handleSelectProduct = useCallback((productId: string) => {
    setSearchOpen(false);
    setSearchQuery('');
    navigate('/products');
  }, [navigate]);

  return (
    <header className="h-16 bg-card border-b border-border px-6 flex items-center justify-between">
      {/* Search */}
      <Popover open={searchOpen} onOpenChange={setSearchOpen}>
        <PopoverTrigger asChild>
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher commandes, clients, produits..."
              className="pl-10 bg-muted/50 border-0 focus-visible:ring-1"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value.trim()) {
                  setSearchOpen(true);
                }
              }}
              onFocus={() => {
                if (searchQuery.trim()) {
                  setSearchOpen(true);
                }
              }}
            />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0" align="start">
          <Command>
            <CommandList>
              {!searchQuery.trim() ? (
                <CommandEmpty>Tapez pour rechercher...</CommandEmpty>
              ) : !hasResults ? (
                <CommandEmpty>Aucun résultat trouvé.</CommandEmpty>
              ) : (
                <>
                  {searchResults.orders.length > 0 && (
                    <CommandGroup heading="Commandes">
                      {searchResults.orders.map((order) => (
                        <CommandItem
                          key={order.id}
                          onSelect={() => handleSelectOrder(order.id)}
                          className="cursor-pointer"
                        >
                          <ShoppingCart className="mr-2 h-4 w-4 text-primary" />
                          <div className="flex flex-col">
                            <span className="font-medium">{formatOrderNumber(order.order_number)}</span>
                            <span className="text-xs text-muted-foreground">
                              {order.customer_name} - {order.customer_phone}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                  
                  {searchResults.customers.length > 0 && (
                    <CommandGroup heading="Clients">
                      {searchResults.customers.map((customer) => (
                        <CommandItem
                          key={customer.id}
                          onSelect={() => handleSelectCustomer(customer.id)}
                          className="cursor-pointer"
                        >
                          <User className="mr-2 h-4 w-4 text-blue-500" />
                          <div className="flex flex-col">
                            <span className="font-medium">{customer.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {customer.phone} - {customer.wilaya}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                  
                  {searchResults.products.length > 0 && (
                    <CommandGroup heading="Produits">
                      {searchResults.products.map((product) => (
                        <CommandItem
                          key={product.id}
                          onSelect={() => handleSelectProduct(product.id)}
                          className="cursor-pointer"
                        >
                          <Package className="mr-2 h-4 w-4 text-green-500" />
                          <div className="flex flex-col">
                            <span className="font-medium">{product.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {product.sku} - Stock: {product.current_stock}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Actions */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {totalCount > 0 && (
                <Badge className={`absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs ${criticalCount > 0 ? 'bg-destructive text-destructive-foreground' : 'bg-amber-500 text-white'}`}>
                  {totalCount > 9 ? '9+' : totalCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-96 bg-popover p-0">
            <DropdownMenuLabel className="flex items-center justify-between px-4 py-3">
              <span className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Alertes intelligentes
              </span>
              {totalCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {totalCount} alerte{totalCount > 1 ? 's' : ''}
                </Badge>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="m-0" />
            <ScrollArea className="max-h-80">
              {smartAlerts.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  ✅ Aucune alerte — tout va bien !
                </div>
              ) : (
                smartAlerts.slice(0, 15).map((alert) => (
                  <DropdownMenuItem
                    key={alert.id}
                    className="flex items-start gap-3 px-4 py-3 cursor-pointer focus:bg-muted/50"
                    onClick={() => alert.link && navigate(alert.link)}
                  >
                    <div className="mt-0.5 shrink-0">{getAlertIcon(alert)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${getSeverityDot(alert.severity)}`} />
                        <span className="text-sm font-medium truncate">{alert.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{alert.message}</p>
                      <span className="text-[10px] text-muted-foreground/70 mt-1 block">
                        {formatTimeAgo(alert.createdAt)}
                      </span>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </ScrollArea>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
});
