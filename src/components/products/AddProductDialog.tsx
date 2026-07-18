import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateProduct } from '@/hooks/useProducts';
import { useActiveStores } from '@/hooks/useStores';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, X, Bot } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';

import { getProductErrorMessage } from '@/lib/errorMessages';

const deliveryPricingTiers = [
  { value: 'standard', label: 'Standard (Tarifs société)' },
  { value: 'special_1', label: 'Tarifs Spécial' },
  { value: 'special_2', label: 'Gratuit au Bureau' },
  { value: 'free', label: 'Livraison Gratuite' },
] as const;

const productSchema = z.object({
  sku: z.string().min(1, 'SKU requis'),
  name: z.string().min(1, 'Nom requis'),
  category: z.string().min(1, 'Catégorie requise'),
  description: z.string().optional(),
  purchase_price: z.number().min(0, 'Prix doit être positif'),
  selling_price: z.number().min(0, 'Prix doit être positif'),
  current_stock: z.number().min(0, 'Stock doit être positif'),
  reorder_level: z.number().min(0, 'Seuil doit être positif'),
  barcode: z.string().optional(),
  delivery_pricing_tier: z.enum(['standard', 'special_1', 'special_2', 'free']).default('standard'),
});

type ProductFormData = z.infer<typeof productSchema>;

interface VariantRow {
  variant_type: string;
  name: string;
  stock: number;
}

interface AddProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const categories = [
  'Montres',
  'Audio',
  'Accessoires',
  'Batteries',
  'Câbles',
  'Électronique',
  'Mode',
  'Beauté',
  'Maison',
  'Autre',
];

export function AddProductDialog({ open, onOpenChange }: AddProductDialogProps) {
  const { toast } = useToast();
  const createProduct = useCreateProduct();
  const { data: stores } = useActiveStores();
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiConfirmation, setAiConfirmation] = useState(true);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      current_stock: 0,
      reorder_level: 10,
      purchase_price: 0,
      selling_price: 0,
      delivery_pricing_tier: 'standard',
    },
  });

  const purchasePrice = watch('purchase_price');
  const sellingPrice = watch('selling_price');
  const profitMargin = sellingPrice > 0 
    ? (((sellingPrice - purchasePrice) / sellingPrice) * 100).toFixed(1)
    : '0';

  const addVariant = () => {
    setVariants([...variants, { variant_type: '', name: '', stock: 0 }]);
  };

  const removeVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const updateVariant = (index: number, field: keyof VariantRow, value: string | number) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], [field]: value };
    setVariants(updated);
  };

  const onSubmit = async (data: ProductFormData) => {
    setIsSubmitting(true);
    try {
      const product = await createProduct.mutateAsync({
        sku: data.sku,
        name: data.name,
        category: data.category,
        description: data.description || null,
        purchase_price: data.purchase_price,
        selling_price: data.selling_price,
        current_stock: data.current_stock,
        reorder_level: data.reorder_level,
        barcode: data.barcode || null,
        reserved_stock: 0,
        free_delivery: data.delivery_pricing_tier === 'free',
        delivery_pricing_tier: data.delivery_pricing_tier,
        ai_confirmation: aiConfirmation,
        store_id: selectedStoreId || null,
      } as any);

      // Insert variants if any
      const validVariants = variants.filter(v => v.variant_type.trim() && v.name.trim());
      if (validVariants.length > 0 && product) {
        const { error: variantError } = await supabase
          .from('product_variants')
          .insert(validVariants.map(v => ({
            product_id: product.id,
            variant_type: v.variant_type.trim(),
            name: v.name.trim(),
            stock: v.stock,
          })));
        if (variantError) throw variantError;
      }
      
      toast({
        title: 'Produit ajouté',
        description: `${data.name} a été ajouté au catalogue`,
      });
      
      reset();
      setVariants([]);
      setAiConfirmation(true);
      setSelectedStoreId('');
      onOpenChange(false);
    } catch (error: unknown) {
      toast({
        title: 'Erreur',
        description: getProductErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-card max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajouter un Produit</DialogTitle>
          <DialogDescription>
            Remplissez les informations du nouveau produit
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU *</Label>
              <Input
                id="sku"
                {...register('sku')}
                placeholder="PRD-001"
              />
              {errors.sku && (
                <p className="text-xs text-destructive">{errors.sku.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="barcode">Code-barres</Label>
              <Input
                id="barcode"
                {...register('barcode')}
                placeholder="123456789"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nom du produit *</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="Nom du produit"
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Catégorie *</Label>
            <Select onValueChange={(value) => setValue('category', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une catégorie" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-lg z-50">
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && (
              <p className="text-xs text-destructive">{errors.category.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Store</Label>
            <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un store" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-lg z-50">
                {stores?.map((store) => (
                  <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Description du produit..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="purchase_price">Prix d'achat (DA) *</Label>
              <Input
                id="purchase_price"
                type="number"
                {...register('purchase_price', { valueAsNumber: true })}
                placeholder="0"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="selling_price">Prix de vente (DA) *</Label>
              <Input
                id="selling_price"
                type="number"
                {...register('selling_price', { valueAsNumber: true })}
                placeholder="0"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Marge</Label>
              <div className="h-10 px-3 py-2 rounded-md bg-muted text-sm flex items-center text-success font-medium">
                +{profitMargin}%
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="current_stock">Stock initial</Label>
              <Input
                id="current_stock"
                type="number"
                {...register('current_stock', { valueAsNumber: true })}
                placeholder="0"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="reorder_level">Seuil de réapprovisionnement</Label>
              <Input
                id="reorder_level"
                type="number"
                {...register('reorder_level', { valueAsNumber: true })}
                placeholder="10"
              />
            </div>
          </div>

          {/* Variants Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Variantes</Label>
              <Button type="button" variant="outline" size="sm" onClick={addVariant}>
                <Plus className="h-3 w-3 mr-1" />
                Ajouter une variante
              </Button>
            </div>
            
            {variants.length > 0 && (
              <div className="space-y-2">
                {variants.map((variant, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      placeholder="Type (ex: Couleur)"
                      value={variant.variant_type}
                      onChange={(e) => updateVariant(index, 'variant_type', e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Valeur (ex: Rouge)"
                      value={variant.name}
                      onChange={(e) => updateVariant(index, 'name', e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      placeholder="Stock"
                      value={variant.stock}
                      onChange={(e) => updateVariant(index, 'stock', parseInt(e.target.value) || 0)}
                      className="w-20"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => removeVariant(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="delivery_pricing_tier">Option de livraison</Label>
            <Select 
              value={watch('delivery_pricing_tier')} 
              onValueChange={(value) => setValue('delivery_pricing_tier', value as 'standard' | 'special_1' | 'special_2' | 'free')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une option" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-lg z-50">
                {deliveryPricingTiers.map((tier) => (
                  <SelectItem key={tier.value} value={tier.value}>
                    {tier.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* AI Confirmation Toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label className="text-sm font-medium">Confirmation IA</Label>
                <p className="text-xs text-muted-foreground">Autoriser la confirmation automatique par IA</p>
              </div>
            </div>
            <Switch checked={aiConfirmation} onCheckedChange={setAiConfirmation} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Ajout...
                </>
              ) : (
                'Ajouter le produit'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}