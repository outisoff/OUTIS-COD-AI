import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, CreditCard, Banknote, ArrowUpRight, ArrowDownRight, Clock, Landmark } from 'lucide-react';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useReportStats } from '@/hooks/useReportStats';
import { useStoreFilter } from '@/contexts/StoreFilterContext';

const ALL_TIME_START = new Date(2020, 0, 1);
const ALL_TIME_END = new Date(2030, 11, 31);

const formatCurrency = (v: number) => `${new Intl.NumberFormat('fr-DZ').format(Math.round(v))} DA`;

export default function Finance() {
  const { selectedStoreId } = useStoreFilter();
  const { data: stats, isLoading } = useReportStats(ALL_TIME_START, ALL_TIME_END, selectedStoreId);

  const totalEncaisse = (stats?.totalRevenue ?? 0) - (stats?.totalDeliveryFees ?? 0) - (stats?.totalReturnFees ?? 0);
  const pendingAmount = totalEncaisse - (stats?.deliveredPaidRevenue ?? 0);
  const deliveredOrders = stats?.deliveredCount ?? 0;
  const collectionRate = stats?.deliveryRate ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Landmark className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Finance</h1>
          <p className="text-sm text-muted-foreground">Gestion financière et suivi des paiements</p>
        </div>
      </div>

      <Tabs defaultValue="payments" className="space-y-6">
        <TabsList>
          <TabsTrigger value="payments">
            <DollarSign className="h-4 w-4 mr-2" />
            Paiements
          </TabsTrigger>
          <TabsTrigger value="overview">
            <Landmark className="h-4 w-4 mr-2" />
            Vue d'ensemble
          </TabsTrigger>
        </TabsList>

        <TabsContent value="payments" className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Total encaissé"
              value={isLoading ? '...' : formatCurrency(totalEncaisse)}
              icon={<Banknote className="h-5 w-5" />}
              trend={{ value: Math.round(collectionRate), isPositive: collectionRate >= 50 }}
              subtitle="sur période"
            />
            <StatsCard
              title="En attente"
              value={isLoading ? '...' : formatCurrency(pendingAmount)}
              icon={<Clock className="h-5 w-5" />}
              subtitle="commandes en cours"
            />
            <StatsCard
              title="Commandes livrées"
              value={isLoading ? '...' : deliveredOrders}
              icon={<CreditCard className="h-5 w-5" />}
              subtitle="sur période"
            />
            <StatsCard
              title="Taux de collecte"
              value={isLoading ? '...' : `${Math.round(collectionRate)}%`}
              icon={<TrendingUp className="h-5 w-5" />}
              subtitle="livrées / expédiées"
            />
          </div>

          {/* Main content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4 text-green-500" />
                  Paiements récents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Banknote className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm">Aucun paiement enregistré</p>
                  <p className="text-xs mt-1">Les paiements apparaîtront ici une fois les commandes livrées</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <ArrowDownRight className="h-4 w-4 text-orange-500" />
                  Résumé par société
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <CreditCard className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm">Aucune donnée</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Vue d'ensemble financière</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Rapports financiers détaillés — À venir.</p>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
