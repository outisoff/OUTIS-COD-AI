import { useState } from 'react';
import { CalendarDays, SlidersHorizontal } from 'lucide-react';
import { useDateRange } from '@/contexts/DateRangeContext';
import { useStoreFilter } from '@/contexts/StoreFilterContext';
import { DashboardStatsCards } from '@/components/dashboard/DashboardStatsCards';
import { OrderStatusChart } from '@/components/dashboard/OrderStatusChart';
import { OrdersChart } from '@/components/dashboard/OrdersChart';
import { TopProductsTable } from '@/components/dashboard/TopProductsTable';
import { AgentPerformanceTable } from '@/components/dashboard/AgentPerformanceTable';
import { DeliveryPerformanceTable } from '@/components/dashboard/DeliveryPerformanceTable';

import { AlgeriaOrdersMap } from '@/components/dashboard/AlgeriaOrdersMap';
import { ConfirmationRateChart } from '@/components/dashboard/ConfirmationRateChart';
import { DeliveryRateChart } from '@/components/dashboard/DeliveryRateChart';
import { DashboardFilters, type DashboardFiltersState } from '@/components/dashboard/DashboardFilters';
import { useAuth } from '@/contexts/AuthContext';
import { useProfilesAndRoles } from '@/hooks/useProfilesAndRoles';
import { useOrders, useOrderStats, useDailyOrders, useTopProducts, useAgentPerformance } from '@/hooks/useOrders';
import { useOrdersByWilaya, type MapFilterStatus } from '@/hooks/useOrdersByWilaya';
import { useProducts } from '@/hooks/useProducts';


import { useFilteredOrderIds } from '@/hooks/useFilteredOrderIds';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { subDays, startOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

const EMPTY_FILTERS: DashboardFiltersState = {
  productIds: [], categories: [], wilayas: [], agents: [], deliveryCompanies: [], sources: [],
};

export default function Dashboard() {
  const { user } = useAuth();
  const today = new Date();
  const { dateRange, setDateRange } = useDateRange();
  const { selectedStoreId } = useStoreFilter();
  const [mapFilter, setMapFilter] = useState<MapFilterStatus>('total');
  const [filters, setFilters] = useState<DashboardFiltersState>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [dateField, setDateField] = useState<'created_at' | 'updated_at'>('created_at');
  
  // Products list is only needed by the filters panel; load lazily.
  const { data: allProducts } = useProducts(showFilters);
  // Lazy-load full orders list — only when filter panel is opened.
  // Dashboard stats use lighter aggregated queries that don't depend on this.
  const { data: allOrders } = useOrders(showFilters);
  const { data: filteredOrderIds } = useFilteredOrderIds(filters);
  
  const hasAnyFilter = Object.values(filters).some(arr => arr.length > 0);
  const productFilter = !hasAnyFilter ? undefined : (filteredOrderIds ?? []);
  
  const { data: orderStats, isLoading: statsLoading } = useOrderStats(dateRange.from, dateRange.to, productFilter, selectedStoreId, dateField);
  const { data: dailyOrders, isLoading: ordersChartLoading } = useDailyOrders(dateRange.from, dateRange.to, productFilter, selectedStoreId, dateField);
  const { data: topProducts, isLoading: productsLoading } = useTopProducts();
  const { data: agentPerformance, isLoading: agentsLoading } = useAgentPerformance(selectedStoreId);
  const { data: wilayaCounts } = useOrdersByWilaya(dateRange.from, dateRange.to, mapFilter, productFilter, selectedStoreId, dateField);


  const activeFilterCount = Object.values(filters).filter(arr => arr.length > 0).length;

  const isToday = dateRange.from?.toDateString() === today.toDateString() && 
    (!dateRange.to || dateRange.to.toDateString() === today.toDateString());

  const formatDateLabel = () => {
    if (!dateRange.from) return "Sélectionner";
    const fromStr = format(dateRange.from, 'd-MMM', { locale: fr }).replace('.', '');
    const toStr = dateRange.to ? format(dateRange.to, 'd-MMM', { locale: fr }).replace('.', '') : fromStr;
    const year = dateRange.to ? format(dateRange.to, 'yyyy') : format(dateRange.from, 'yyyy');
    if (fromStr === toStr) return `${fromStr} ( ${year} )`;
    return `${fromStr} / ${toStr} ( ${year} )`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-DZ').format(value) + ' DA';
  };



  const { profileMap } = useProfilesAndRoles();
  const userName = (user?.id && profileMap[user.id])
    || user?.user_metadata?.full_name
    || user?.email?.split('@')[0]
    || 'Utilisateur';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Tableau de bord</h1>
          <p className="page-description">
            Bienvenue, {userName}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CalendarDays className="h-4 w-4" />
                {formatDateLabel()}
                <span className="ml-1 text-xs text-muted-foreground border-l pl-2">
                  {dateField === 'created_at' ? 'Créée' : 'Modifiée'}
                </span>
              </Button>
            </PopoverTrigger>

            <PopoverContent className="w-auto p-0" align="end">
              <div className="border-b p-3 flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-muted-foreground">Filtrer par date de :</span>
                <div className="flex items-center rounded-md border bg-background p-0.5">
                  <Button
                    variant={dateField === 'created_at' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    onClick={() => setDateField('created_at')}
                  >
                    Création
                  </Button>
                  <Button
                    variant={dateField === 'updated_at' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    onClick={() => setDateField('updated_at')}
                  >
                    Modification
                  </Button>
                </div>
              </div>
              <div className="flex">
                <div className="border-r p-3 space-y-1 w-[170px]">
                  <p className="text-sm font-medium text-muted-foreground mb-2 px-2">Raccourcis</p>
                  {[
                    { label: "Aujourd'hui", from: today, to: today },
                    { label: "Hier", from: subDays(today, 1), to: subDays(today, 1) },
                    { label: "Hier et aujourd'hui", from: subDays(today, 1), to: today },
                    { label: "7 derniers jours", from: subDays(today, 6), to: today },
                    { label: "30 derniers jours", from: subDays(today, 29), to: today },
                    { label: "Ce mois", from: startOfMonth(today), to: today },
                    { label: "Maximum", from: new Date(2020, 0, 1), to: today },
                  ].map((preset) => (
                    <Button
                      key={preset.label}
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "w-full justify-start text-sm font-normal h-8 px-2",
                        dateRange.from?.toDateString() === preset.from.toDateString() &&
                        dateRange.to?.toDateString() === preset.to.toDateString() &&
                        "bg-accent text-accent-foreground"
                      )}
                      onClick={() => setDateRange({ from: preset.from, to: preset.to })}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={(range) => {
                    if (range?.from) {
                      setDateRange({ from: range.from, to: range.to || range.from });
                    }
                  }}
                  locale={fr}
                  disabled={(date) => date > new Date()}
                  numberOfMonths={2}
                  className={cn("p-3 pointer-events-auto")}
                />
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant={showFilters ? "default" : "outline"}
            className="gap-2"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtrage
            {activeFilterCount > 0 && (
              <span className="ml-1 flex items-center justify-center h-5 w-5 rounded-full bg-primary-foreground text-primary text-xs font-bold">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Filters floating panel with click-outside-to-close */}
      {showFilters && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowFilters(false)} />
          <div className="fixed top-20 right-6 z-40 w-[360px]">
            <DashboardFilters
              products={(allProducts || []).map(p => ({ id: p.id, name: p.name, sku: p.sku, category: p.category }))}
              orders={(allOrders || []).map(o => ({ wilaya: o.wilaya, assigned_agent: o.assigned_agent, delivery_company: o.delivery_company, source: o.source }))}
              filters={filters}
              onFiltersChange={setFilters}
            />
          </div>
        </>
      )}

      {/* Main dashboard content - unaffected by filters */}
      <div className="space-y-6">
        {statsLoading ? (
          <Skeleton className="h-[200px] rounded-xl" />
        ) : (
          <DashboardStatsCards orderStats={orderStats} orders={allOrders} dateRange={dateRange} />
        )}

        {/* Charts Row - Area chart + Map 50/50 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AlgeriaOrdersMap wilayaCounts={wilayaCounts || {}} filterStatus={mapFilter} onFilterChange={setMapFilter} />
          <div>
            {ordersChartLoading ? (
              <Skeleton className="h-[400px] rounded-xl" />
            ) : (
              <OrdersChart data={dailyOrders || []} title="Commandes :" />
            )}
          </div>
        </div>

        {/* 3 Donut Charts Row — based on orders CREATED in the period (matches "Reçues") */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <OrderStatusChart data={orderStats?.ordersByStatusCreated || []} />
          <ConfirmationRateChart data={orderStats?.ordersByStatusCreated || []} />
          <DeliveryRateChart data={orderStats?.ordersByStatusCreated || []} />
        </div>




        {/* Tables Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {productsLoading ? (
            <Skeleton className="h-[300px] rounded-xl" />
          ) : (
            <TopProductsTable data={topProducts || []} />
          )}
          {agentsLoading ? (
            <Skeleton className="h-[300px] rounded-xl" />
          ) : (
            <AgentPerformanceTable data={agentPerformance || []} />
          )}
          <DeliveryPerformanceTable />
        </div>
      </div>
    </div>
  );
}
