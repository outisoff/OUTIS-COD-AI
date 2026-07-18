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
  min_quantity: 2, required_product_ids: [], discount_type: 'tiered',
  discount_value: 0, free_delivery: false, price_tiers: [],
  gift_product_id: null, gift_quantity: 0,
};

export function ProductBundlesManager() {
  const { data: allPacks, isLoading } = useProductPacks();
  const { data: products } = useProducts();
  const createPack = useCreateProductPack();
  const updatePack = useUpdateProductPack();
  const deletePack = useDeleteProductPack();
  const [showDialog, setShowDialog] = useState(false);
  const [editingPack, setEditingPack] = useState<string | null>(null);
  const [form, setForm] = useState<ProductPackInsert>({ ...emptyForm });

  // Only show tiered packs
  const bundles = allPacks?.filter(p => p.discount_type === 'tiered');

  const resetForm = () => {
    setForm({ ...emptyForm });
    setEditingPack(null);
  };

  const handleEdit = (pack: NonNullable<typeof allPacks>[0]) => {
    setForm({
      name: pack.name,
      description: pack.description,
      is_active: pack.is_active,
      product_id: pack.product_id,
      min_quantity: pack.min_quantity,
      required_product_ids: pack.required_product_ids || [],
      discount_type: 'tiered',
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
    if (!form.name.trim() || form.price_tiers.length === 0) return;
    const payload = { ...form, discount_type: 'tiered' as const, min_quantity: form.price_tiers.length > 0 ? Math.min(...form.price_tiers.map(t => t.quantity)) : 2 };
    if (editingPack) {
      await updatePack.mutateAsync({ id: editingPack, ...payload });
    } else {
      await createPack.mutateAsync(payload);
    }
    setShowDialog(false);
    resetForm();
  };

  const getProductName = (id: string | null) => {
    if (!id) return 'Tous';
    return products?.find(p => p.id === id)?.name || id;
  };

  const formatTiers = (tiers: PriceTier[]) => {
    if (!tiers || tiers.length === 0) return '—';
    return tiers
      .sort((a, b) => a.quantity - b.quantity)
      .map(t => `${t.quantity} pcs = ${new Intl.NumberFormat('fr-DZ').format(t.price)} DA`)
      .join(' · ');
  };

  // Tier management
  const addTier = () => {
    const lastQty = form.price_tiers.length > 0 ? form.price_tiers[form.price_tiers.length - 1].quantity + 1 : 2;
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
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Bundles ({bundles?.length || 0})
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Définissez des prix par palier : 2 pcs = X DA, 3 pcs = Y DA, etc.
            </p>
          </div>
          <Button size="sm" onClick={() => { resetForm(); setShowDialog(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Nouveau Bundle
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : bundles && bundles.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bundle</TableHead>
                <TableHead>Produit</TableHead>
                <TableHead>Paliers</TableHead>
                <TableHead>Cadeau</TableHead>
                <TableHead>Livraison</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bundles.map((pack) => (
                <TableRow key={pack.id}>
                  <TableCell className="font-medium">{pack.name}</TableCell>
                  <TableCell className="text-sm">{getProductName(pack.product_id)}</TableCell>
                  <TableCell className="text-sm">
                    <div className="flex flex-wrap gap-1">
                      {((pack.price_tiers || []) as PriceTier[])
                        .sort((a, b) => a.quantity - b.quantity)
                        .map((t, i) => (
                          <Badge key={i} variant="outline" className="border-primary text-primary text-xs">
                            {t.quantity} pcs = {new Intl.NumberFormat('fr-DZ').format(t.price)} DA
                          </Badge>
                        ))}
                    </div>
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
            Aucun bundle configuré. Créez un bundle pour définir des prix par palier.
          </div>
        )}
      </CardContent>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[500px] bg-card">
          <DialogHeader>
            <DialogTitle>{editingPack ? 'Modifier le Bundle' : 'Nouveau Bundle'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom du bundle *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Bundle Parfum" />
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

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Paliers de prix *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addTier}>
                  <Plus className="h-3 w-3 mr-1" /> Ajouter palier
                </Button>
              </div>
              {form.price_tiers.length === 0 && (
                <p className="text-xs text-muted-foreground">Ajoutez des paliers : ex. 2 pcs = 7000 DA, 3 pcs = 9500 DA</p>
              )}
              {form.price_tiers.map((tier, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1">
                    <Input
                      type="number" min={1}
                      value={tier.quantity}
                      onChange={e => updateTier(i, 'quantity', parseInt(e.target.value) || 1)}
                      placeholder="Qté"
                    />
                  </div>
                  <span className="text-sm text-muted-foreground">=</span>
                  <div className="flex-1">
                    <Input
                      type="number" min={0}
                      value={tier.price}
                      onChange={e => updateTier(i, 'price', parseFloat(e.target.value) || 0)}
                      placeholder="Prix DA"
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">DA</span>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeTier(i)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>

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
            <Button onClick={handleSubmit} disabled={!form.name.trim() || form.price_tiers.length === 0}>
              {editingPack ? 'Mettre à jour' : 'Créer le bundle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
