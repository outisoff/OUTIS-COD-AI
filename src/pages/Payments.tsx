import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, CreditCard, Banknote, ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';
import { StatsCard } from '@/components/dashboard/StatsCard';

export default function Payments() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <DollarSign className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Paiements</h1>
          <p className="text-sm text-muted-foreground">Suivi des paiements et encaissements</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total encaissé"
          value="0 DA"
          icon={<Banknote className="h-5 w-5" />}
          trend={{ value: 0, isPositive: true }}
          subtitle="ce mois"
        />
        <StatsCard
          title="En attente"
          value="0 DA"
          icon={<Clock className="h-5 w-5" />}
          subtitle="à collecter"
        />
        <StatsCard
          title="Commandes livrées"
          value="0"
          icon={<CreditCard className="h-5 w-5" />}
          subtitle="payées"
        />
        <StatsCard
          title="Taux de collecte"
          value="0%"
          icon={<TrendingUp className="h-5 w-5" />}
          subtitle="objectif 95%"
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
    </div>
  );
}
