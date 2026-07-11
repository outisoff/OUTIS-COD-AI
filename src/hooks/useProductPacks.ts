import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PriceTier {
  quantity: number;
  price: number;
}

export interface ProductPack {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  product_id: string | null;
  min_quantity: number;
  required_product_ids: string[];
  discount_type: 'percentage' | 'fixed_amount' | 'fixed_price' | 'tiered';
  discount_value: number;
  free_delivery: boolean;
  price_tiers: PriceTier[];
  gift_product_id: string | null;
  gift_quantity: number;
  created_at: string;
  updated_at: string;
}

export type ProductPackInsert = Omit<ProductPack, 'id' | 'created_at' | 'updated_at'>;

export function useProductPacks() {
  return useQuery({
    queryKey: ['product-packs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_packs')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(d => ({ ...d, price_tiers: (d.price_tiers || []) as unknown as PriceTier[], discount_type: d.discount_type as ProductPack['discount_type'] })) as ProductPack[];
    },
  });
}

export function useActiveProductPacks() {
  return useQuery({
    queryKey: ['product-packs', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_packs')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      return (data || []).map(d => ({ ...d, price_tiers: (d.price_tiers || []) as unknown as PriceTier[], discount_type: d.discount_type as ProductPack['discount_type'] })) as ProductPack[];
    },
  });
}

export function useCreateProductPack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pack: ProductPackInsert) => {
      const { data, error } = await supabase
        .from('product_packs')
        .insert(pack as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-packs'] });
      toast.success('Pack créé avec succès');
    },
    onError: () => toast.error('Erreur lors de la création du pack'),
  });
}

export function useUpdateProductPack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProductPack> & { id: string }) => {
      const { error } = await supabase
        .from('product_packs')
        .update(updates as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-packs'] });
      toast.success('Pack mis à jour');
    },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  });
}

export function useDeleteProductPack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_packs')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-packs'] });
      toast.success('Pack supprimé');
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  });
}

// Apply pack logic to order items
export interface PackResult {
  packName: string;
  discountAmount: number;
  freeDelivery: boolean;
  giftProductId: string | null;
  giftQuantity: number;
}

export function findApplicablePacks(
  packs: ProductPack[],
  orderItems: Array<{ product_id?: string; quantity: number; unit_price: number }>
): PackResult[] {
  const results: PackResult[] = [];
  if (!packs || packs.length === 0) return results;

  for (const pack of packs) {
    if (!pack.is_active) continue;

    // Single product quantity pack (supports split quantities across multiple lines)
    if (pack.product_id) {
      const matchingItems = orderItems.filter(item => item.product_id === pack.product_id);
      const totalQuantity = matchingItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

      if (matchingItems.length > 0 && totalQuantity >= pack.min_quantity) {
        let discountAmount = 0;
        const lineTotal = matchingItems.reduce(
          (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
          0
        );

        if (pack.discount_type === 'tiered' && pack.price_tiers && pack.price_tiers.length > 0) {
          // Find the best matching tier (highest quantity that fits)
          const sortedTiers = [...pack.price_tiers].sort((a, b) => b.quantity - a.quantity);
          const matchingTier = sortedTiers.find(t => totalQuantity >= t.quantity);
          if (matchingTier) {
            // Tier price is total for that quantity, calculate per-unit and apply
            const tierUnitPrice = matchingTier.price / matchingTier.quantity;
            const newTotal = tierUnitPrice * totalQuantity;
            discountAmount = lineTotal - newTotal;
          }
        } else if (pack.discount_type === 'percentage') {
          discountAmount = lineTotal * (pack.discount_value / 100);
        } else if (pack.discount_type === 'fixed_amount') {
          discountAmount = pack.discount_value;
        } else if (pack.discount_type === 'fixed_price') {
          const packUnitPrice = pack.discount_value / pack.min_quantity;
          const newTotal = packUnitPrice * totalQuantity;
          discountAmount = lineTotal - newTotal;
        }

        results.push({
          packName: pack.name,
          discountAmount: Math.max(0, discountAmount),
          freeDelivery: pack.free_delivery,
          giftProductId: pack.gift_product_id,
          giftQuantity: pack.gift_quantity,
        });
        continue;
      }
    }

    // Multi-product pack
    if (pack.required_product_ids && pack.required_product_ids.length > 0) {
      const orderProductIds = orderItems.filter(i => i.product_id).map(i => i.product_id);
      const allPresent = pack.required_product_ids.every(pid => orderProductIds.includes(pid));
      
      if (allPresent) {
        const matchingTotal = orderItems
          .filter(i => i.product_id && pack.required_product_ids.includes(i.product_id))
          .reduce((sum, i) => sum + i.quantity * i.unit_price, 0);

        let discountAmount = 0;
        if (pack.discount_type === 'percentage') {
          discountAmount = matchingTotal * (pack.discount_value / 100);
        } else if (pack.discount_type === 'fixed_amount') {
          discountAmount = pack.discount_value;
        } else if (pack.discount_type === 'fixed_price') {
          discountAmount = matchingTotal - pack.discount_value;
        }

        results.push({
          packName: pack.name,
          discountAmount: Math.max(0, discountAmount),
          freeDelivery: pack.free_delivery,
          giftProductId: pack.gift_product_id,
          giftQuantity: pack.gift_quantity,
        });
      }
    }
  }

  return results;
}
