import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Plus, Trash2, Pencil, Calendar, Percent, DollarSign, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  useDeliveryPromotions,
  useCreateDeliveryPromotion,
  useUpdateDeliveryPromotion,
  useDeleteDeliveryPromotion,
  DeliveryPromotion,
  DeliveryPromotionInsert,
} from '@/hooks/useDeliveryPromotions';

export function DeliveryPromotionsManager() {
  const { data: promotions, isLoading } = useDeliveryPromotions();
  const createPromotion = useCreateDeliveryPromotion();
  const updatePromotion = useUpdateDeliveryPromotion();
  const deletePromotion = useDeleteDeliveryPromotion();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<DeliveryPromotion | null>(null);
  
  const [formData, setFormData] = useState<DeliveryPromotionInsert>({
    name: '',
    description: '',
    discount_type: 'percentage',
    discount_value: 0,
    applies_to: 'all',
    start_date: new Date().toISOString(),
    end_date: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(), // 20 days from now
    is_active: true,
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      discount_type: 'percentage',
      discount_value: 0,
      applies_to: 'all',
      start_date: new Date().toISOString(),
      end_date: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
      is_active: true,
    });
    setEditingPromotion(null);
  };

  const handleOpenDialog = (promotion?: DeliveryPromotion) => {
    if (promotion) {
      setEditingPromotion(promotion);
      setFormData({
        name: promotion.name,
        description: promotion.description || '',
        discount_type: promotion.discount_type,
        discount_value: promotion.discount_value,
        applies_to: promotion.applies_to,
        start_date: promotion.start_date,
        end_date: promotion.end_date,
        is_active: promotion.is_active,
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (editingPromotion) {
      await updatePromotion.mutateAsync({ id: editingPromotion.id, ...formData });
    } else {
      await createPromotion.mutateAsync(formData);
    }
    setIsDialogOpen(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    await deletePromotion.mutateAsync(id);
  };

  const handleToggleActive = async (promotion: DeliveryPromotion) => {
    await updatePromotion.mutateAsync({ id: promotion.id, is_active: !promotion.is_active });
  };

  const isPromotionActive = (promotion: DeliveryPromotion) => {
    const now = new Date();
    const start = new Date(promotion.start_date);
    const end = new Date(promotion.end_date);
    return promotion.is_active && now >= start && now <= end;
  };

  const getAppliesLabel = (applies_to: string) => {
    switch (applies_to) {
      case 'all': return 'Tous';
      case 'home': return 'Domicile';
      case 'stop_desk': return 'Stop Desk';
      default: return applies_to;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Promotions Livraison</h3>
          <p className="text-sm text-muted-foreground">
            Créez des promotions temporaires sur les frais de livraison
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle Promotion
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingPromotion ? 'Modifier la Promotion' : 'Nouvelle Promotion'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nom de la promotion</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Promo Été -20%"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Description (optionnel)</Label>
                <Input
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description de la promotion"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Type de réduction</Label>
                  <Select
                    value={formData.discount_type}
                    onValueChange={(value: 'percentage' | 'fixed_amount') => 
                      setFormData({ ...formData, discount_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">
                        <span className="flex items-center gap-2">
                          <Percent className="h-4 w-4" /> Pourcentage
                        </span>
                      </SelectItem>
                      <SelectItem value="fixed_amount">
                        <span className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4" /> Montant fixe
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="discount_value">
                    Valeur {formData.discount_type === 'percentage' ? '(%)' : '(DA)'}
                  </Label>
                  <Input
                    id="discount_value"
                    type="number"
                    min="0"
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>S'applique à</Label>
                <Select
                  value={formData.applies_to}
                  onValueChange={(value: 'all' | 'home' | 'stop_desk') => 
                    setFormData({ ...formData, applies_to: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous (Domicile + Stop Desk)</SelectItem>
                    <SelectItem value="home">Domicile uniquement</SelectItem>
                    <SelectItem value="stop_desk">Stop Desk uniquement</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Date de début</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="justify-start text-left font-normal">
                        <Calendar className="mr-2 h-4 w-4" />
                        {format(new Date(formData.start_date), 'dd MMM yyyy', { locale: fr })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={new Date(formData.start_date)}
                        onSelect={(date) => date && setFormData({ ...formData, start_date: date.toISOString() })}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid gap-2">
                  <Label>Date de fin</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="justify-start text-left font-normal">
                        <Calendar className="mr-2 h-4 w-4" />
                        {format(new Date(formData.end_date), 'dd MMM yyyy', { locale: fr })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={new Date(formData.end_date)}
                        onSelect={(date) => date && setFormData({ ...formData, end_date: date.toISOString() })}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Annuler
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={!formData.name || createPromotion.isPending || updatePromotion.isPending}
              >
                {(createPromotion.isPending || updatePromotion.isPending) && (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                )}
                {editingPromotion ? 'Modifier' : 'Créer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Promotions List */}
      {promotions && promotions.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {promotions.map((promotion) => (
            <Card key={promotion.id} className={cn(!promotion.is_active && 'opacity-60')}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {promotion.name}
                      {isPromotionActive(promotion) && (
                        <Badge className="bg-primary text-primary-foreground">Active</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>{promotion.description}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={promotion.is_active}
                      onCheckedChange={() => handleToggleActive(promotion)}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleOpenDialog(promotion)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(promotion.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 text-sm">
                  <Badge variant="outline">
                    {promotion.discount_type === 'percentage' 
                      ? `-${promotion.discount_value}%` 
                      : `-${promotion.discount_value} DA`
                    }
                  </Badge>
                  <Badge variant="secondary">
                    {getAppliesLabel(promotion.applies_to)}
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(promotion.start_date), 'dd/MM')} - {format(new Date(promotion.end_date), 'dd/MM/yyyy')}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Aucune promotion créée. Cliquez sur "Nouvelle Promotion" pour en créer une.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
