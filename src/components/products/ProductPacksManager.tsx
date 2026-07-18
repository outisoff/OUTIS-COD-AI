import { useState } from 'react';
import { useProductPacks, useCreateProductPack, useUpdateProductPack, useDeleteProductPack, type ProductPackInsert, type PriceTier } from '@/hooks/useProductPacks';
import { useProducts } from '@/hooks/useProducts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Trash2, Pencil, Package, Truck, Gift } from 'lucide-react';

const emptyForm: ProductPackInsert = {
  name: '', description: null, is_active: true, product_id: null,
  min_quantity: 2, required_product_ids: [], discount_type: 'percentage',
  discount_value: 0, free_delivery: false, price_tiers: [],
  gift_product_id: null, gift_quantity: 0,
};

export function ProductPacksManager() {
  const { data: allPacks, isLoading } = useProductPacks();
  const packs = allPacks?.filter(p => p.discount_type !== 'tiered');
  const { data: products } = useProducts();
  const createPack = useCreateProductPack();
  const updatePack = useUpdateProductPack();
  const deletePack = useDeleteProductPack();
  const [showDialog, setShowDialog] = useState(false);
  const [editingPack, setEditingPack] = useState<string | null>(null);
  const [form, setForm] = useState<ProductPackInsert>({ ...emptyForm });

  const resetForm = () => {
    setForm({ ...emptyForm });
    setEditingPack(null);
  };

  const handleEdit = (pack: NonNullable<typeof packs>[0]) => {
    setForm({
      name: pack.name,
      description: pack.description,
      is_active: pack.is_active,
      product_id: pack.product_id,
      min_quantity: pack.min_quantity,
      required_product_ids: pack.required_product_ids || [],
      discount_type: pack.discount_type as ProductPackInsert['discount_type'],
      discount_value: pack.discount_value,
      free_delivery: pack.free_delivery,
      price_tiers: (pack.price_tiers || []) as PriceTier[],
      gift_product_id: pack.gift_product_id || null,
      gift_quantity: pack.gift_quantity || 0,
    });
    setEditingPack(pack.id);
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    if (editingPack) {
      await updatePack.mutateAsync({ id: editingPack, ...form });
    } else {
      await createPack.mutateAsync(form);
    }
    setShowDialog(false);
    resetForm();
  };

  const getProductName = (id: string | null) => {
    if (!id) return 'Tous';
    return products?.find(p => p.id === id)?.name || id;
  };

  const formatDiscount = (pack: NonNullable<typeof packs>[0]) => {
    if (pack.discount_type === 'percentage') return `-${pack.discount_value}%`;
    if (pack.discount_type === 'fixed_amount') return `-${pack.discount_value} DA`;
    return `${pack.discount_value} DA (prix fixe)`;
  };

  // Tier management
  const addTier = () => {
    const lastQty = form.price_tiers.length > 0 ? form.price_tiers[form.price_tiers.length - 1].quantity + 1 : form.min_quantity;
    setForm({ ...form, price_tiers: [...form.price_tiers, { quantity: lastQty, price: 0 }] });
  };

  const updateTier = (index: number, field: keyof PriceTier, value: number) => {
    const newTiers = [...form.price_tiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    setForm({ ...form, price_tiers: newTiers });
  };

  const removeTier = (index: number) => {
    setForm({ ...form, price_tiers: form.price_tiers.filter((_, i) => i !== index) });
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Packs & Offres ({packs?.length || 0})
          </CardTitle>
          <Button size="sm" onClick={() => { resetForm(); setShowDialog(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Nouveau Pack
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : packs && packs.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pack</TableHead>
                <TableHead>Produit</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Réduction</TableHead>
                <TableHead>Cadeau</TableHead>
                <TableHead>Livraison</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packs.map((pack) => (
                <TableRow key={pack.id}>
                  <TableCell className="font-medium">{pack.name}</TableCell>
                  <TableCell className="text-sm">{getProductName(pack.product_id)}</TableCell>
                  <TableCell className="text-sm">≥ {pack.min_quantity} pcs</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-primary text-primary">
                      {formatDiscount(pack)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {pack.gift_product_id && pack.gift_quantity > 0 ? (
                      <Badge variant="outline" className="border-accent text-accent-foreground">
                        <Gift className="h-3 w-3 mr-1" /> {pack.gift_quantity}x {getProductName(pack.gift_product_id)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {pack.free_delivery && (
                      <Badge className="bg-success hover:bg-success">
                        <Truck className="h-3 w-3 mr-1" /> Gratuite
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={pack.is_active}
                      onCheckedChange={(checked) => updatePack.mutate({ id: pack.id, is_active: checked })}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(pack)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deletePack.mutate(pack.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="py-8 text-center text-muted-foreground text-sm">
            Aucun pack configuré. Créez un pack pour offrir des réductions.
          </div>
        )}
      </CardContent>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[500px] bg-card">
          <DialogHeader>
            <DialogTitle>{editingPack ? 'Modifier le Pack' : 'Nouveau Pack'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom du pack *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Pack 2 pièces" />
            </div>

            <div className="space-y-2">
              <Label>Produit concerné</Label>
              <Select value={form.product_id || '_all'} onValueChange={v => setForm({ ...form, product_id: v === '_all' ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Tous les produits" /></SelectTrigger>
                <SelectContent className="bg-popover border border-border shadow-lg z-50 max-h-60">
                  <SelectItem value="_all">Tous les produits</SelectItem>
                  {products?.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Quantité minimum</Label>
              <Input type="number" min={1} value={form.min_quantity} onChange={e => setForm({ ...form, min_quantity: parseInt(e.target.value) || 2 })} />
            </div>

            <div className="space-y-2">
              <Label>Type de réduction</Label>
              <Select value={form.discount_type} onValueChange={v => setForm({ ...form, discount_type: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover border border-border shadow-lg z-50">
                  <SelectItem value="percentage">Pourcentage (%)</SelectItem>
                  <SelectItem value="fixed_amount">Montant fixe (DA)</SelectItem>
                  <SelectItem value="fixed_price">Prix total fixe (DA)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.discount_type !== 'tiered' && (
              <div className="space-y-2">
                <Label>Valeur</Label>
                <Input
                  type="number" min={0}
                  value={form.discount_value}
                  onChange={e => setForm({ ...form, discount_value: parseFloat(e.target.value) || 0 })}
                  placeholder={form.discount_type === 'percentage' ? '10' : '500'}
                />
              </div>
            )}

            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <Label className="cursor-pointer">Livraison gratuite</Label>
              </div>
              <Switch checked={form.free_delivery} onCheckedChange={checked => setForm({ ...form, free_delivery: checked })} />
            </div>

            <div className="p-3 rounded-lg border bg-muted/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gift className="h-4 w-4 text-muted-foreground" />
                  <Label className="cursor-pointer">Cadeau offert</Label>
                </div>
                <Switch
                  checked={!!form.gift_product_id || form.gift_quantity > 0}
                  onCheckedChange={checked => {
                    if (!checked) {
                      setForm({ ...form, gift_product_id: null, gift_quantity: 0 });
                    } else {
                      setForm({ ...form, gift_product_id: null, gift_quantity: 1 });
                    }
                  }}
                />
              </div>
              {form.gift_quantity > 0 && (
                <div className="space-y-2">
                  <Select value={form.gift_product_id || ''} onValueChange={v => setForm({ ...form, gift_product_id: v, gift_quantity: Math.max(form.gift_quantity, 1) })}>
                    <SelectTrigger><SelectValue placeholder="Choisir le produit cadeau" /></SelectTrigger>
                    <SelectContent className="bg-popover border border-border shadow-lg z-50 max-h-60">
                      {products?.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="space-y-1">
                    <Label className="text-xs">Quantité cadeau</Label>
                    <Input type="number" min={1} value={form.gift_quantity} onChange={e => setForm({ ...form, gift_quantity: parseInt(e.target.value) || 1 })} />
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Annuler</Button>
            <Button onClick={handleSubmit} disabled={!form.name.trim()}>
              {editingPack ? 'Mettre à jour' : 'Créer le pack'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
