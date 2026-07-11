import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useProducts } from '@/hooks/useProducts';
import { useCreateStockMovement, StockMovementType } from '@/hooks/useStockMovements';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  product_id: z.string().min(1, 'Sélectionnez un produit'),
  movement_type: z.enum(['entry', 'exit', 'adjustment', 'sale', 'return']),
  quantity: z.coerce.number().min(1, 'La quantité doit être supérieure à 0'),
  reason: z.string().optional(),
  reference: z.string().optional(),
  purchase_price: z.coerce.number().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface StockMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProductId?: string;
  defaultMovementType?: StockMovementType;
}

const movementTypeLabels: Record<StockMovementType, string> = {
  entry: 'Entrée de stock',
  exit: 'Sortie de stock',
  adjustment: 'Ajustement',
  sale: 'Vente',
  return: 'Retour',
};

export function StockMovementDialog({
  open,
  onOpenChange,
  defaultProductId,
  defaultMovementType = 'entry',
}: StockMovementDialogProps) {
  const { data: products } = useProducts();
  const createMovement = useCreateStockMovement();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      product_id: defaultProductId || '',
      movement_type: defaultMovementType,
      quantity: 1,
      reason: '',
      reference: '',
      purchase_price: undefined,
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await createMovement.mutateAsync({
        product_id: values.product_id,
        movement_type: values.movement_type,
        quantity: values.quantity,
        reason: values.reason,
        reference: values.reference,
        purchase_price: values.purchase_price,
      });
      toast.success('Mouvement de stock enregistré');
      form.reset();
      onOpenChange(false);
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement');
    }
  };

  const selectedProduct = products?.find(p => p.id === form.watch('product_id'));
  const movementType = form.watch('movement_type');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau mouvement de stock</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="product_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Produit</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un produit" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {products?.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} ({product.sku}) - Stock: {product.current_stock}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="movement_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type de mouvement</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(movementTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {movementType === 'adjustment' ? 'Nouveau stock' : 'Quantité'}
                  </FormLabel>
                  <FormControl>
                    <Input type="number" min={0} {...field} />
                  </FormControl>
                  {selectedProduct && movementType !== 'adjustment' && (
                    <p className="text-xs text-muted-foreground">
                      Stock actuel: {selectedProduct.current_stock} → 
                      Nouveau stock: {
                        movementType === 'entry' || movementType === 'return'
                          ? selectedProduct.current_stock + Number(field.value || 0)
                          : selectedProduct.current_stock - Number(field.value || 0)
                      }
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {movementType === 'entry' && (
              <FormField
                control={form.control}
                name="purchase_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prix d'achat (optionnel)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={0} 
                        step="0.01"
                        placeholder={selectedProduct ? `Actuel: ${selectedProduct.purchase_price} DA` : 'Nouveau prix d\'achat...'}
                        {...field} 
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Laissez vide pour garder le prix actuel
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Référence (optionnel)</FormLabel>
                  <FormControl>
                    <Input placeholder="N° de bon, commande..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motif (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Raison du mouvement..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={createMovement.isPending}>
                {createMovement.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
