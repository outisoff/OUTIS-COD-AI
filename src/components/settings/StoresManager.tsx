import { useState } from 'react';
import { useStores, useCreateStore, useUpdateStore, useDeleteStore } from '@/hooks/useStores';
import { useProducts, useUpdateProduct } from '@/hooks/useProducts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Store, Pencil, Check, X, ChevronDown, ChevronRight, Package, ArrowRightLeft } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

export function StoresManager() {
  const { data: stores, isLoading } = useStores();
  const { data: products } = useProducts();
  const updateProduct = useUpdateProduct();
  const { toast } = useToast();
  const createStore = useCreateStore();
  const updateStore = useUpdateStore();
  const deleteStore = useDeleteStore();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [expandedStoreId, setExpandedStoreId] = useState<string | null>(null);

  const getStoreProducts = (storeId: string) => 
    products?.filter(p => p.store_id === storeId) || [];

  const unassignedProducts = products?.filter(p => !p.store_id) || [];

  const handleSwitchStore = (productId: string, productName: string, newStoreId: string) => {
    const targetStore = stores?.find(s => s.id === newStoreId);
    updateProduct.mutate(
      { id: productId, store_id: newStoreId || null } as any,
      {
        onSuccess: () => {
          toast({
            title: 'Produit déplacé',
            description: `${productName} → ${targetStore?.name || 'Sans store'}`,
          });
        },
      }
    );
  };

  const handleAdd = () => {
    if (!newName.trim()) return;
    createStore.mutate(newName.trim(), {
      onSuccess: () => setNewName(''),
    });
  };

  const handleStartEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const handleSaveEdit = () => {
    if (!editingId || !editName.trim()) return;
    updateStore.mutate({ id: editingId, name: editName.trim() }, {
      onSuccess: () => setEditingId(null),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Store className="h-5 w-5" />
          Gestion des Stores
        </CardTitle>
        <CardDescription>
          Ajoutez vos stores pour taguer et filtrer les commandes par boutique.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new store */}
        <div className="flex gap-2">
          <Input
            placeholder="Nom du store..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Button onClick={handleAdd} disabled={createStore.isPending || !newName.trim()}>
            <Plus className="h-4 w-4 mr-1" />
            Ajouter
          </Button>
        </div>

        {/* Stores list */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : stores && stores.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>Nom</TableHead>
                <TableHead className="text-center">Produits</TableHead>
                <TableHead className="w-[100px] text-center">Actif</TableHead>
                <TableHead className="w-[100px] text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stores.map((store) => {
                const storeProducts = getStoreProducts(store.id);
                const isExpanded = expandedStoreId === store.id;
                return (
                  <>
                    <TableRow key={store.id}>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => setExpandedStoreId(isExpanded ? null : store.id)}
                          disabled={storeProducts.length === 0}
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                      <TableCell>
                        {editingId === store.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                              className="h-8"
                            />
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSaveEdit}>
                              <Check className="h-4 w-4 text-success" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <span className="font-medium">{store.name}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={storeProducts.length > 0 ? 'default' : 'outline'}>
                          {storeProducts.length}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={store.is_active}
                          onCheckedChange={(checked) => updateStore.mutate({ id: store.id, is_active: checked })}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleStartEdit(store.id, store.name)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm(`Supprimer le store "${store.name}" ?`)) {
                                deleteStore.mutate(store.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && storeProducts.length > 0 && (
                      <TableRow key={`${store.id}-products`}>
                        <TableCell colSpan={5} className="bg-muted/50 p-0">
                          <div className="px-8 py-3 space-y-1">
                            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                              <Package className="h-3 w-3" />
                              Produits dans {store.name}
                            </p>
                            <Table>
                              <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                  <TableHead className="text-xs h-8">SKU</TableHead>
                                  <TableHead className="text-xs h-8">Nom</TableHead>
                                  <TableHead className="text-xs h-8">Catégorie</TableHead>
                                  <TableHead className="text-xs h-8 text-right">Prix Vente</TableHead>
                                  <TableHead className="text-xs h-8 text-right">Stock</TableHead>
                                  <TableHead className="text-xs h-8">Déplacer vers</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {storeProducts.map((p) => (
                                  <TableRow key={p.id} className="hover:bg-muted/30">
                                    <TableCell className="text-xs font-mono py-1">{p.sku}</TableCell>
                                    <TableCell className="text-xs py-1">{p.name}</TableCell>
                                    <TableCell className="text-xs py-1">{p.category}</TableCell>
                                    <TableCell className="text-xs text-right py-1">
                                      {new Intl.NumberFormat('fr-DZ').format(Number(p.selling_price))} DA
                                    </TableCell>
                                    <TableCell className="text-xs text-right py-1">
                                      {p.current_stock - p.reserved_stock}
                                    </TableCell>
                                    <TableCell className="py-1">
                                      <Select
                                        value={p.store_id || ''}
                                        onValueChange={(val) => handleSwitchStore(p.id, p.name, val)}
                                      >
                                        <SelectTrigger className="h-7 text-xs w-[140px]">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-popover border border-border shadow-lg z-50">
                                          {stores?.filter(s => s.id !== store.id).map((s) => (
                                            <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucun store configuré. Ajoutez votre premier store ci-dessus.
          </p>
        )}

        {/* Unassigned products */}
        {unassignedProducts.length > 0 && (
          <Card className="border-dashed">
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                Produits sans store ({unassignedProducts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1">
                {unassignedProducts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm py-1">
                    <span className="font-mono text-xs text-muted-foreground">{p.sku}</span>
                    <span>{p.name}</span>
                    <span className="text-muted-foreground">{p.category}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}
