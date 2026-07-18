import { useState } from 'react';
import { BarChart3, CalendarDays, SlidersHorizontal, ShoppingCart, CheckCircle, XCircle, Truck, PackageCheck, AlertTriangle, TrendingUp, TrendingDown, MapPin, Users, Package, Building2 } from 'lucide-react';
import { KpisRichTab } from '@/components/reports/KpisRichTab';
import { useDateRange } from '@/contexts/DateRangeContext';
import { useStoreFilter } from '@/contexts/StoreFilterContext';
import { DashboardFilters, type DashboardFiltersState } from '@/components/dashboard/DashboardFilters';
import { useProducts } from '@/hooks/useProducts';
import { useOrders } from '@/hooks/useOrders';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useReportStats } from '@/hooks/useReportStats';
import { format, subDays, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

const formatCurrency = (v: number) => new Intl.NumberFormat('fr-DZ').format(v) + ' DA';

function StatBox({ icon: Icon, label, value, color, sub }: { icon: any; label: string; value: string | number; color: string; sub?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all hover:scale-105 hover:shadow-md cursor-default", color)}>
      <div className="p-2 rounded-xl bg-background/60">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-extrabold tracking-tight">{value}</p>
      <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider text-center">{label}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function Reports() {
  const today = new Date();
  const { dateRange, setDateRange } = useDateRange();
  const [filters, setFilters] = useState<DashboardFiltersState>({ productIds: [], categories: [], wilayas: [], agents: [], deliveryCompanies: [], sources: [] });
  const [showFilters, setShowFilters] = useState(false);
  const { selectedStoreId } = useStoreFilter();
  const { data: stats, isLoading } = useReportStats(dateRange.from, dateRange.to, selectedStoreId);
  const { data: allProducts } = useProducts();
  const { data: allOrders } = useOrders();
  const activeFilterCount = Object.values(filters).filter(arr => arr.length > 0).length;

  const isToday = dateRange.from?.toDateString() === today.toDateString() && (!dateRange.to || dateRange.to.toDateString() === today.toDateString());

  const formatDateLabel = () => {
    if (!dateRange.from) return "Sélectionner";
    const fromStr = format(dateRange.from, 'd-MMM', { locale: fr }).replace('.', '');
    const toStr = dateRange.to ? format(dateRange.to, 'd-MMM', { locale: fr }).replace('.', '') : fromStr;
    const year = dateRange.to ? format(dateRange.to, 'yyyy') : format(dateRange.from, 'yyyy');
    if (fromStr === toStr) return `${fromStr} ( ${year} )`;
    return `${fromStr} / ${toStr} ( ${year} )`;
  };

  const presets = [
    { label: "Aujourd'hui", from: today, to: today },
    { label: "Hier", from: subDays(today, 1), to: subDays(today, 1) },
    { label: "7 derniers jours", from: subDays(today, 6), to: today },
    { label: "30 derniers jours", from: subDays(today, 29), to: today },
    { label: "Ce mois", from: startOfMonth(today), to: today },
    { label: "Maximum", from: new Date(2020, 0, 1), to: today },
  ];

  const sourceLabels: Record<string, string> = {
    facebook: 'Facebook', instagram: 'Instagram', website: 'Site web', phone: 'Téléphone', other: 'Autre',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <BarChart3 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Performance</h1>
            <p className="text-muted-foreground text-sm">Statistiques complètes de votre plateforme</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CalendarDays className="h-4 w-4" />
                {formatDateLabel()}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 flex" align="end">
              <div className="border-r p-3 space-y-1 w-[170px]">
                <p className="text-sm font-medium text-muted-foreground mb-2 px-2">Raccourcis</p>
                {presets.map((preset) => (
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
                onSelect={(range) => { if (range?.from) setDateRange({ from: range.from, to: range.to || range.from }); }}
                locale={fr}
                disabled={(date) => date > new Date()}
                numberOfMonths={2}
                className={cn("p-3 pointer-events-auto")}
              />
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

      {/* Filters floating panel */}
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

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[120px] rounded-xl" />)}
        </div>
      ) : stats ? (
        <Tabs defaultValue="platform" className="space-y-6">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="platform">📊 Plateforme</TabsTrigger>
            <TabsTrigger value="kpis">📈 KPI's</TabsTrigger>
            <TabsTrigger value="employees">👥 Employés</TabsTrigger>
          </TabsList>

          {/* PLATFORM TAB */}
          <TabsContent value="platform" className="space-y-6">
            {/* KPIs Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <StatBox icon={ShoppingCart} label="Total commandes" value={stats.totalOrders} color="bg-muted/50 border-border/50 text-foreground" />
              <StatBox icon={PackageCheck} label="Livrées" value={stats.deliveredCount} color="bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200/50 dark:border-emerald-500/20 text-emerald-600" />
              <StatBox icon={XCircle} label="Annulées" value={stats.cancelledCount} color="bg-red-50 dark:bg-red-500/10 border-red-200/50 dark:border-red-500/20 text-red-500" />
              <StatBox icon={AlertTriangle} label="Échec livraison" value={stats.failedCount} color="bg-orange-50 dark:bg-orange-500/10 border-orange-200/50 dark:border-orange-500/20 text-orange-500" />
              <StatBox icon={TrendingUp} label="Revenus" value={formatCurrency(stats.totalRevenue)} color="bg-blue-50 dark:bg-blue-500/10 border-blue-200/50 dark:border-blue-500/20 text-blue-600" />
              <StatBox icon={Truck} label="Frais livraison" value={formatCurrency(stats.totalDeliveryFees)} color="bg-purple-50 dark:bg-purple-500/10 border-purple-200/50 dark:border-purple-500/20 text-purple-500" />
            </div>

            {/* Rates */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Taux de confirmation</span>
                    <Badge variant="outline" className="text-emerald-600">{stats.confirmRate}%</Badge>
                  </div>
                  <Progress value={stats.confirmRate} className="h-2" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Taux de livraison</span>
                    <Badge variant="outline" className="text-blue-600">{stats.deliveryRate}%</Badge>
                  </div>
                  <Progress value={stats.deliveryRate} className="h-2" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Taux d'annulation</span>
                    <Badge variant="outline" className="text-red-500">{stats.cancelRate}%</Badge>
                  </div>
                  <Progress value={stats.cancelRate} className="h-2 [&>div]:bg-destructive" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Taux d'échec</span>
                    <Badge variant="outline" className="text-orange-500">{stats.failRate}%</Badge>
                  </div>
                  <Progress value={stats.failRate} className="h-2 [&>div]:bg-orange-500" />
                </CardContent>
              </Card>
            </div>

            {/* Tables Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top Wilayas */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    Top Wilayas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Wilaya</TableHead>
                        <TableHead className="text-center">Commandes</TableHead>
                        <TableHead className="text-center">Livrées</TableHead>
                        <TableHead className="text-right">Revenus</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.topWilayas.map((w, i) => (
                        <TableRow key={w.name}>
                          <TableCell className="font-medium">
                            <span className="text-muted-foreground mr-1">#{i + 1}</span> {w.name}
                          </TableCell>
                          <TableCell className="text-center">{w.orders}</TableCell>
                          <TableCell className="text-center text-emerald-600 font-medium">{w.delivered}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(w.revenue)}</TableCell>
                        </TableRow>
                      ))}
                      {stats.topWilayas.length === 0 && (
                        <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Aucune donnée</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Top Products */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" />
                    Top Produits (Livrés)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produit</TableHead>
                        <TableHead className="text-center">Qté vendue</TableHead>
                        <TableHead className="text-right">Revenus</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.topProducts.map((p, i) => (
                        <TableRow key={p.name}>
                          <TableCell className="font-medium">
                            <span className="text-muted-foreground mr-1">#{i + 1}</span> {p.name}
                          </TableCell>
                          <TableCell className="text-center">{p.quantity}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(p.revenue)}</TableCell>
                        </TableRow>
                      ))}
                      {stats.topProducts.length === 0 && (
                        <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Aucune donnée</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* Source & Delivery Companies */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Sources */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Sources des commandes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(stats.sourceCounts).sort(([,a],[,b]) => b - a).map(([source, count]) => (
                      <div key={source} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{sourceLabels[source] || source}</span>
                        <div className="flex items-center gap-3">
                          <Progress value={stats.totalOrders > 0 ? (count / stats.totalOrders) * 100 : 0} className="h-2 w-24" />
                          <span className="text-sm font-bold w-10 text-right">{count}</span>
                          <Badge variant="secondary" className="text-xs w-12 justify-center">
                            {stats.totalOrders > 0 ? Math.round((count / stats.totalOrders) * 100) : 0}%
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {Object.keys(stats.sourceCounts).length === 0 && (
                      <p className="text-center text-muted-foreground py-4">Aucune donnée</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Delivery Companies */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    Sociétés de livraison
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Société</TableHead>
                        <TableHead className="text-center">Total</TableHead>
                        <TableHead className="text-center">Livrées</TableHead>
                        <TableHead className="text-center">Échec</TableHead>
                        <TableHead className="text-right">Taux succès</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.deliveryCompanies.map((c) => (
                        <TableRow key={c.name}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell className="text-center">{c.total}</TableCell>
                          <TableCell className="text-center text-emerald-600">{c.delivered}</TableCell>
                          <TableCell className="text-center text-red-500">{c.failed}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={c.successRate >= 70 ? "default" : "destructive"} className="text-xs">
                              {c.successRate}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {stats.deliveryCompanies.length === 0 && (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucune donnée</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* Status breakdown */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Répartition par statut</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-3">
                  {Object.entries(stats.statusCounts).sort(([,a],[,b]) => b - a).map(([status, count]) => (
                    <div key={status} className="text-center p-3 rounded-xl bg-muted/50 border border-border/50">
                      <p className="text-lg font-bold">{count}</p>
                      <p className="text-xs text-muted-foreground truncate">{status}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* KPI's TAB - Rich design with trends, sparklines, comparison & goals */}
          <TabsContent value="kpis" className="space-y-6">
            <KpisRichTab dateFrom={dateRange.from} dateTo={dateRange.to} storeId={selectedStoreId} />
          </TabsContent>

          {/* EMPLOYEES TAB */}
          <TabsContent value="employees" className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatBox icon={Users} label="Total agents" value={stats.agents.length} color="bg-muted/50 border-border/50 text-foreground" />
              <StatBox
                icon={TrendingUp}
                label="Meilleur taux"
                value={stats.agents.length > 0 ? `${stats.agents[0].confirmRate}%` : '-'}
                color="bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200/50 dark:border-emerald-500/20 text-emerald-600"
                sub={stats.agents.length > 0 ? stats.agents[0].name : ''}
              />
              <StatBox
                icon={CheckCircle}
                label="Total confirmées"
                value={stats.agents.reduce((s, a) => s + a.confirmed, 0)}
                color="bg-blue-50 dark:bg-blue-500/10 border-blue-200/50 dark:border-blue-500/20 text-blue-600"
              />
              <StatBox
                icon={XCircle}
                label="Total annulées"
                value={stats.agents.reduce((s, a) => s + a.cancelled, 0)}
                color="bg-red-50 dark:bg-red-500/10 border-red-200/50 dark:border-red-500/20 text-red-500"
              />
            </div>

            {/* Agent ranking */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Classement des employés
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead className="text-center">Total</TableHead>
                      <TableHead className="text-center">Confirmées</TableHead>
                      <TableHead className="text-center">Annulées</TableHead>
                      <TableHead className="text-center">Livrées</TableHead>
                      <TableHead className="text-right">Taux confirmation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.agents.map((agent, i) => (
                      <TableRow key={agent.name}>
                        <TableCell>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-muted-foreground">{i + 1}</span>}
                        </TableCell>
                        <TableCell className="font-medium">{agent.name}</TableCell>
                        <TableCell className="text-center">{agent.total}</TableCell>
                        <TableCell className="text-center text-emerald-600 font-medium">{agent.confirmed}</TableCell>
                        <TableCell className="text-center text-red-500 font-medium">{agent.cancelled}</TableCell>
                        <TableCell className="text-center text-blue-600 font-medium">{agent.delivered}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Progress value={agent.confirmRate} className="h-2 w-16" />
                            <Badge variant={agent.confirmRate >= 60 ? "default" : agent.confirmRate >= 40 ? "secondary" : "destructive"} className="text-xs w-14 justify-center">
                              {agent.confirmRate}%
                            </Badge>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {stats.agents.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucun agent trouvé pour cette période</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Per-agent detail cards */}
            {stats.agents.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stats.agents.slice(0, 6).map((agent, i) => (
                  <Card key={agent.name} className="overflow-hidden">
                    <div className={cn("h-1", i === 0 ? "bg-yellow-400" : i === 1 ? "bg-gray-400" : i === 2 ? "bg-amber-600" : "bg-primary/30")} />
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {agent.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold">{agent.name}</p>
                          <p className="text-xs text-muted-foreground">{agent.total} commandes traitées</p>
                        </div>
                        <Badge className="ml-auto" variant={agent.confirmRate >= 60 ? "default" : "destructive"}>
                          {agent.confirmRate}%
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
                          <p className="text-lg font-bold text-emerald-600">{agent.confirmed}</p>
                          <p className="text-xs text-muted-foreground">Confirmées</p>
                        </div>
                        <div className="p-2 rounded-lg bg-red-50 dark:bg-red-500/10">
                          <p className="text-lg font-bold text-red-500">{agent.cancelled}</p>
                          <p className="text-xs text-muted-foreground">Annulées</p>
                        </div>
                        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10">
                          <p className="text-lg font-bold text-blue-600">{agent.delivered}</p>
                          <p className="text-xs text-muted-foreground">Livrées</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}
