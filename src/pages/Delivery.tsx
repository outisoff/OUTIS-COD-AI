import { Building, Tag, Users, BarChart3, Truck } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { DeliveryCompanyFeesManager } from '@/components/delivery/DeliveryCompanyFeesManager';
import { SpecialDeliveryFeesManager } from '@/components/delivery/SpecialDeliveryFeesManager';
import { SpecialDeliveryFees2Manager } from '@/components/delivery/SpecialDeliveryFees2Manager';
import { DeliveryCompaniesTab } from '@/components/delivery/DeliveryCompaniesTab';
import { LivreursTab } from '@/components/delivery/LivreursTab';

export default function Delivery() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Gestion Livraison</h1>
        <p className="page-description">
          Gérez vos expéditions et suivez les livraisons
        </p>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="societes" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="societes" className="gap-2">
            <Truck className="h-4 w-4" />
            Sociétés de Livraison
          </TabsTrigger>
          <TabsTrigger value="livreur" className="gap-2">
            <Users className="h-4 w-4" />
            Livreur
          </TabsTrigger>
          <TabsTrigger value="tarifs" className="gap-2">
            <Building className="h-4 w-4" />
            Tarifs
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Stats
          </TabsTrigger>
        </TabsList>

        {/* Tarifs Tab - contains sub-tabs */}
        <TabsContent value="tarifs">
          <Card>
            <Tabs defaultValue="company-fees">
              <CardHeader className="pb-2">
                <TabsList className="flex-wrap h-auto gap-1">
                  <TabsTrigger value="company-fees" className="gap-2">
                    <Building className="h-4 w-4" />
                    Tarifs Sociétés
                  </TabsTrigger>
                  <TabsTrigger value="product-fees" className="gap-2">
                    <Tag className="h-4 w-4" />
                    Tarifs Spécial
                  </TabsTrigger>
                  <TabsTrigger value="special-fees-2" className="gap-2">
                    <Tag className="h-4 w-4" />
                    Gratuit au Bureau
                  </TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent>
                <TabsContent value="company-fees" className="mt-0">
                  <DeliveryCompanyFeesManager />
                </TabsContent>
                <TabsContent value="product-fees" className="mt-0">
                  <SpecialDeliveryFeesManager />
                </TabsContent>
                <TabsContent value="special-fees-2" className="mt-0">
                  <SpecialDeliveryFees2Manager />
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </TabsContent>

        <TabsContent value="societes">
          <DeliveryCompaniesTab />
        </TabsContent>

        <TabsContent value="livreur">
          <LivreursTab />
        </TabsContent>

        {/* Stats Tab */}
        <TabsContent value="stats">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">Statistiques de livraison</p>
              <p className="text-xs mt-1">Les statistiques apparaîtront ici</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
