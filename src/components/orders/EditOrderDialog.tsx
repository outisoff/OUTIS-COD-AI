import { useState, useEffect, useMemo, useRef } from 'react';
import { useActiveStores } from '@/hooks/useStores';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil, Plus, Trash2, Home, Building2, Truck, Package } from 'lucide-react';
import { ProductSearchSelect } from './ProductSearchSelect';
import { DeliveryCompanyBadge } from './DeliveryCompanyBadge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator, SelectLabel, SelectGroup } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useProducts } from '@/hooks/useProducts';
import { useDeliveryFees } from '@/hooks/useDeliveryFees';
import { useDeliveryCompanyFees } from '@/hooks/useDeliveryCompanyFees';
import { useSpecialDeliveryFees2 } from '@/hooks/useSpecialDeliveryFees2';
import { useActiveDeliveryPromotions, calculateDiscountedFee } from '@/hooks/useDeliveryPromotions';
import { useIntegrations, DELIVERY_COMPANIES } from '@/hooks/useIntegrations';
import { usePickupPoints } from '@/hooks/usePickupPoints';
import { getOrderErrorMessage } from '@/lib/errorMessages';
import { logOrderEdits } from '@/lib/orderEditHistory';
import { useAuth } from '@/contexts/useAuth';
import { algeriaWilayas, communesByWilaya } from '@/data/algeriaLocations';
import { WilayaSelect } from './WilayaSelect';
import { CommuneSelect } from './CommuneSelect';
import { StopDeskSelect } from './StopDeskSelect';

const orderItemSchema = z.object({
  id: z.string().optional(),
  product_id: z.string().optional(),
  product_name: z.string().trim().min(1, 'Produit requis').max(200),
  quantity: z.coerce.number().min(1, 'Min 1'),
  unit_price: z.coerce.number().min(0, 'Prix invalide'),
  sku: z.string().trim().max(50).optional(),
  variant: z.string().trim().max(100).optional(),
  free_delivery: z.boolean().optional(),
  delivery_pricing_tier: z.string().optional(),
});

const allOrderStatuses = [
  { value: 'new', label: 'Nouvelle', color: 'bg-blue-100 text-blue-700' },
  { value: 'validated', label: 'Validée', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'confirmed', label: 'Confirmée', color: 'bg-green-100 text-green-700' },
  { value: 'cancelled', label: 'Annulée', color: 'bg-red-100 text-red-700' },
  { value: 'failed_1', label: 'Échouée 1 🟠', color: 'bg-orange-100 text-orange-700' },
  { value: 'failed_2', label: 'Échouée 2 🟠', color: 'bg-orange-100 text-orange-700' },
  { value: 'failed_3', label: 'Échouée 3 🟠', color: 'bg-orange-100 text-orange-700' },
  { value: 'no_answer', label: 'Répondre pas', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'wrong_number', label: 'Faux numéro', color: 'bg-rose-100 text-rose-700' },
  { value: 'postponed', label: 'Reporter', color: 'bg-purple-100 text-purple-700' },
  { value: 'to_reconfirm', label: 'A reconfirmer', color: 'bg-amber-100 text-amber-700' },
  { value: 'callback', label: 'Me rappelez', color: 'bg-cyan-100 text-cyan-700' },
  { value: 'duplicate', label: 'Dupliquer', color: 'bg-gray-100 text-gray-700' },
  { value: 'out_of_stock', label: 'Rupture de stock', color: 'bg-red-100 text-red-700' },
  { value: 'ready', label: 'Prête', color: 'bg-teal-100 text-teal-700' },
  { value: 'preparing', label: 'En préparation', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'at_station', label: 'Vers station', color: 'bg-violet-100 text-violet-700' },
  { value: 'shipped', label: 'Expédiée', color: 'bg-sky-100 text-sky-700' },
  { value: 'delivered', label: 'Livrée', color: 'bg-green-100 text-green-700' },
  { value: 'erreur', label: 'Erreur', color: 'bg-red-100 text-red-700' },
  { value: 'exchange', label: 'Échange', color: 'bg-violet-100 text-violet-700' },
] as const;

// Confirmation-only statuses (only the 12 specific confirmation statuses + Erreur)
const confirmationStatuses = [
  { value: 'validated', label: 'Validée', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'confirmed', label: 'Confirmée', color: 'bg-green-100 text-green-700' },
  { value: 'cancelled', label: 'Annulée', color: 'bg-red-100 text-red-700' },
  { value: 'failed_1', label: 'Échouée 1 🟠', color: 'bg-orange-100 text-orange-700' },
  { value: 'failed_2', label: 'Échouée 2 🟠', color: 'bg-orange-100 text-orange-700' },
  { value: 'failed_3', label: 'Échouée 3 🟠', color: 'bg-orange-100 text-orange-700' },
  { value: 'no_answer', label: 'Répondre pas', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'wrong_number', label: 'Faux numéro', color: 'bg-rose-100 text-rose-700' },
  { value: 'postponed', label: 'Reporter', color: 'bg-purple-100 text-purple-700' },
  { value: 'to_reconfirm', label: 'A reconfirmer', color: 'bg-amber-100 text-amber-700' },
  { value: 'callback', label: 'Me rappelez', color: 'bg-cyan-100 text-cyan-700' },
  { value: 'duplicate', label: 'Dupliquer', color: 'bg-gray-100 text-gray-700' },
  { value: 'erreur', label: 'Erreur', color: 'bg-red-100 text-red-700' },
] as const;

// Expedition-only statuses (5 specific expedition statuses - ordered as: Confirmé, En Préparation, Prêt, Expédié, Erreur)
const expeditionStatuses = [
  { value: 'confirmed', label: 'Confirmé', color: 'bg-green-100 text-green-600 border border-green-300' },
  { value: 'preparing', label: 'En Préparation', color: 'bg-orange-100 text-orange-600 border border-orange-300' },
  { value: 'ready', label: 'Prêt', color: 'bg-cyan-100 text-cyan-600 border border-cyan-300' },
  { value: 'to_station', label: 'Vers station', color: 'bg-violet-100 text-violet-600 border border-violet-300' },
  { value: 'shipped', label: 'Expédié', color: 'bg-blue-100 text-blue-600 border border-blue-300' },
  { value: 'erreur', label: 'Erreur', color: 'bg-red-100 text-red-600 border border-red-300' },
] as const;

const editOrderSchema = z.object({
  status: z.enum(['new', 'validated', 'confirmed', 'cancelled', 'failed_1', 'failed_2', 'failed_3', 'no_answer', 'wrong_number', 'postponed', 'to_reconfirm', 'callback', 'duplicate', 'out_of_stock', 'ready', 'preparing', 'to_station', 'at_station', 'au_bureau', 'en_livraison', 'shipped', 'delivered', 'erreur', 'Échec_de_livraison', 'exchange', 'alerte']),
  customer_name: z.string().trim().min(1, 'Le nom est requis').max(100),
  customer_phone: z.string().trim().min(1, 'Le téléphone est requis').max(20),
  customer_address: z.string().trim().min(1, "L'adresse est requise").max(500),
  wilaya: z.string().trim().min(1, 'La wilaya est requise').max(100),
  commune: z.string().trim().max(100).optional(),
  store_id: z.string().optional(),
  delivery_type: z.enum(['home', 'stop_desk']),
  delivery_company: z.string().optional(),
  delivery_fee: z.coerce.number().min(0, 'Frais invalides'),
  discount: z.coerce.number().min(0, 'Réduction invalide').optional(),
  notes: z.string().trim().max(1000).optional(),
  items: z.array(orderItemSchema).min(1, 'Au moins un produit requis'),
});

type EditOrderFormData = z.infer<typeof editOrderSchema>;

interface OrderItem {
  id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  variant: string | null;
  products?: { sku: string } | null;
}

type OrderStatus = 'new' | 'validated' | 'confirmed' | 'cancelled' | 'failed_1' | 'failed_2' | 'failed_3' | 'no_answer' | 'wrong_number' | 'postponed' | 'to_reconfirm' | 'callback' | 'duplicate' | 'out_of_stock' | 'ready' | 'preparing' | 'to_station' | 'at_station' | 'au_bureau' | 'en_livraison' | 'shipped' | 'delivered' | 'erreur' | 'Échec_de_livraison' | 'exchange' | 'alerte';

interface EditOrderDialogProps {
  order: {
    id: string;
    status: OrderStatus;
    customer_name: string;
    customer_phone: string;
    customer_address: string;
    wilaya: string;
    commune: string | null;
    store_id: string | null;
    delivery_type: 'home' | 'stop_desk';
    delivery_company: string | null;
    delivery_fee: number;
    discount: number;
    notes: string | null;
    tracking_number: string | null;
    order_items: OrderItem[];
  };
  /** If true, only show confirmation-related statuses (excludes expedition/delivery) */
  confirmationOnly?: boolean;
  /** If true, only show expedition-related statuses */
  expeditionOnly?: boolean;
  /** If true, hide the status field entirely */
  hideStatus?: boolean;
}

export function EditOrderDialog({ order, confirmationOnly = false, expeditionOnly = false, hideStatus = false }: EditOrderDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [selectedStopDeskId, setSelectedStopDeskId] = useState('');
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const addItemButtonRef = useRef<HTMLButtonElement | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: products } = useProducts();
  const { data: stores } = useActiveStores();
  const { data: deliveryFees } = useDeliveryFees();
  const { data: specialFees2 } = useSpecialDeliveryFees2();
  const { data: activePromotions } = useActiveDeliveryPromotions();
  const { data: deliveryIntegrations } = useIntegrations('delivery');

  // Get enabled delivery companies
  const enabledDeliveryCompanies = useMemo(() => {
    const enabled = deliveryIntegrations?.filter(i => i.is_enabled).map(i => i.name) || [];
    return enabled.length > 0 ? enabled : [...DELIVERY_COMPANIES];
  }, [deliveryIntegrations]);

  const { data: localLivreurs } = useQuery({
    queryKey: ['local_livreurs_active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('local_livreurs')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const availableProducts = (products ?? []).filter(
    (p) => Number(p.current_stock ?? 0) - Number(p.reserved_stock ?? 0) > 0,
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-DZ').format(value) + ' DA';
  };

  const form = useForm<EditOrderFormData>({
    resolver: zodResolver(editOrderSchema),
    defaultValues: {
      status: order.status,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      customer_address: order.customer_address,
      wilaya: order.wilaya,
      commune: order.commune || '',
      store_id: order.store_id || '',
      delivery_type: order.delivery_type || 'home',
      delivery_company: order.delivery_company || '',
      delivery_fee: Number(order.delivery_fee),
      discount: Number(order.discount) || 0,
      notes: order.notes || '',
      items: order.order_items.map(item => ({
        id: item.id,
        product_id: item.product_id || '',
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: Number(item.unit_price),
        sku: item.products?.sku || '',
        variant: item.variant || '',
        free_delivery: false,
        delivery_pricing_tier: 'standard',
      })),
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  // Reset form when order changes
  useEffect(() => {
    if (open) {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setHasAttemptedSubmit(false);
      setSelectedStopDeskId('');
      form.reset({
        status: order.status,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        customer_address: order.customer_address,
        wilaya: order.wilaya,
        commune: order.commune || '',
        store_id: order.store_id || '',
        delivery_type: order.delivery_type || 'home',
        delivery_company: order.delivery_company || '',
        delivery_fee: Number(order.delivery_fee),
        discount: Number(order.discount) || 0,
        notes: order.notes || '',
        items: order.order_items.map(item => ({
          id: item.id,
          product_id: item.product_id || '',
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: Number(item.unit_price),
          sku: item.products?.sku || '',
          variant: item.variant || '',
          free_delivery: false,
          delivery_pricing_tier: 'standard',
        })),
      });
    }
  }, [open, order, form]);

  const watchedItems = form.watch('items');
  const watchedItemsKey = JSON.stringify(watchedItems?.map(i => ({ pid: i.product_id, q: i.quantity, p: i.unit_price, s: i.sku, n: i.product_name })));
  const watchedDeliveryFee = form.watch('delivery_fee');
  const watchedDiscount = form.watch('discount');
  const watchedWilaya = form.watch('wilaya');
  const watchedDeliveryType = form.watch('delivery_type');
  const watchedDeliveryCompany = form.watch('delivery_company');

  // Fetch company-specific fees
  const { data: companyFees } = useDeliveryCompanyFees(watchedDeliveryCompany || '');

  // Fetch all company fees for fallback
  const { data: allCompanyFees } = useQuery({
    queryKey: ['all-delivery-company-fees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_company_fees')
        .select('*')
        .order('wilaya_code', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Extract wilaya name for pickup points
  const wilayaNameForPickup = useMemo(() => {
    const parts = watchedWilaya?.split(' - ') || [];
    return parts.length > 1 ? parts.slice(1).join(' - ') : watchedWilaya || '';
  }, [watchedWilaya]);

  const { data: pickupPoints, isLoading: pickupPointsLoading } = usePickupPoints(
    wilayaNameForPickup,
    watchedDeliveryCompany || '',
    watchedDeliveryType === 'stop_desk'
  );

  // Determine product delivery tier from order items
  const productTier = useMemo(() => {
    for (const item of watchedItems) {
      if (item.delivery_pricing_tier && item.delivery_pricing_tier !== 'standard') {
        return item.delivery_pricing_tier;
      }
      if (item.product_id) {
        const product = products?.find(p => p.id === item.product_id);
        if (product && product.delivery_pricing_tier && product.delivery_pricing_tier !== 'standard') {
          return product.delivery_pricing_tier;
        }
      }
    }
    return 'standard';
  }, [watchedItemsKey, watchedItems, products]);

  // Auto-apply delivery fee when wilaya, delivery type, or company changes
  useEffect(() => {
    if (!watchedWilaya || !open) return;

    // Check free delivery from products
    const hasFreeDeliveryProduct = watchedItems.some(item => {
      if (item.free_delivery === true) return true;
      if (!item.product_id) return false;
      const product = products?.find(p => p.id === item.product_id);
      return product?.free_delivery === true;
    });
    if (hasFreeDeliveryProduct || productTier === 'free') {
      form.setValue('delivery_fee', 0);
      return;
    }

    // Don't calculate delivery fee until a delivery company or livreur is selected
    if (!watchedDeliveryCompany) {
      form.setValue('delivery_fee', 0);
      return;
    }

    // Extract wilaya code
    const match = watchedWilaya.match(/^(\d+)\s*-\s*/);
    let code = match ? match[1] : null;
    if (!code) {
      const wilaya = algeriaWilayas.find(
        w => w.name === watchedWilaya || `${w.code} - ${w.name}` === watchedWilaya
      );
      code = wilaya?.code || null;
    }
    if (!code) return;

    // Normalize code for comparison (handle both "1" and "01" formats)
    const codeNum = parseInt(code, 10).toString();
    const codePadded = code.padStart(2, '0');
    const matchesCode = (feeCode: string) => feeCode === code || feeCode === codeNum || feeCode === codePadded;

    // Check product custom fees first
    const productWithCustomFee = watchedItems.find(item => {
      if (!item.product_id) return false;
      const product = products?.find(p => p.id === item.product_id);
      if (!product) return false;
      const fee = watchedDeliveryType === 'home' ? product.custom_home_delivery_fee : product.custom_stop_desk_fee;
      return fee !== null && fee !== undefined;
    });

    if (productWithCustomFee) {
      const product = products?.find(p => p.id === productWithCustomFee.product_id);
      if (product) {
        const customFee = watchedDeliveryType === 'home'
          ? product.custom_home_delivery_fee!
          : product.custom_stop_desk_fee!;
        form.setValue('delivery_fee', customFee);
        return;
      }
    }

    let baseFee = 0;

    // Use fee table based on product delivery pricing tier
    if (productTier === 'special_1' && deliveryFees) {
      const specialFee = deliveryFees.find(f => matchesCode(f.wilaya_code));
      if (specialFee) {
        baseFee = watchedDeliveryType === 'home' ? specialFee.home_delivery_fee : specialFee.stop_desk_fee;
      }
    } else if (productTier === 'special_2' && specialFees2) {
      const special2Fee = specialFees2.find(f => matchesCode(f.wilaya_code));
      if (special2Fee) {
        baseFee = watchedDeliveryType === 'home' ? special2Fee.home_delivery_fee : special2Fee.stop_desk_fee;
      }
    }

    // If no tier-specific fee, use company fees or general fees
    if (baseFee === 0) {
      if (watchedDeliveryCompany && companyFees && companyFees.length > 0) {
        const companyFee = companyFees.find(f => matchesCode(f.wilaya_code));
        if (companyFee) {
          baseFee = watchedDeliveryType === 'home' ? companyFee.home_delivery_fee : companyFee.stop_desk_fee;
        }
      }

      if (baseFee === 0 && deliveryFees) {
        const generalFee = deliveryFees.find(f => matchesCode(f.wilaya_code));
        if (generalFee) {
          baseFee = watchedDeliveryType === 'home' ? generalFee.home_delivery_fee : generalFee.stop_desk_fee;
        }
      }

    }

    // Apply active promotions
    const activePromotion = activePromotions?.[0] || null;
    const finalFee = activePromotion 
      ? calculateDiscountedFee(baseFee, activePromotion, watchedDeliveryType)
      : baseFee;

    form.setValue('delivery_fee', finalFee);
  }, [watchedWilaya, watchedDeliveryType, watchedDeliveryCompany, watchedItemsKey, productTier, deliveryFees, specialFees2, companyFees, allCompanyFees, activePromotions, products, open, form]);
  
  const subtotal = watchedItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const total = subtotal + (Number(watchedDeliveryFee) || 0) - (Number(watchedDiscount) || 0);

  const onSubmit = async (data: EditOrderFormData) => {
    setHasAttemptedSubmit(true);
    
    // Validate required fields
    const errors: string[] = [];
    
    if (!data.customer_phone?.trim()) {
      errors.push('Téléphone');
    }
    if (!data.wilaya?.trim()) {
      errors.push('Wilaya');
    }
    if (!data.commune?.trim() && data.wilaya?.trim()) {
      errors.push('Commune');
    }
    if (!data.items || data.items.length === 0) {
      errors.push('Produits (au moins un)');
    }
    
    if (errors.length > 0) {
      toast({
        title: 'Champs requis manquants',
        description: `Veuillez remplir: ${errors.join(', ')}`,
        variant: 'destructive',
      });
      return;
    }
    
    setIsSubmitting(true);
    try {
      // Update order
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: data.status,
          customer_name: data.customer_name,
          customer_phone: data.customer_phone,
          customer_address: data.customer_address,
          wilaya: data.wilaya,
          commune: data.commune || null,
          store_id: data.store_id || null,
          delivery_type: data.delivery_type,
          delivery_company: data.delivery_company || null,
          delivery_fee: data.delivery_fee,
          discount: data.discount || 0,
          notes: data.notes || null,
          total_price: total,
        })
        .eq('id', order.id);

      if (orderError) throw orderError;

      // Get existing item IDs
      const existingItemIds = order.order_items.map(i => i.id);
      const newItemIds = data.items.filter(i => i.id).map(i => i.id!);
      
      // Delete removed items
      const itemsToDelete = existingItemIds.filter(id => !newItemIds.includes(id));
      if (itemsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('order_items')
          .delete()
          .in('id', itemsToDelete);
        if (deleteError) throw deleteError;
      }

      // Update existing and insert new items
      for (const item of data.items) {
        if (item.id) {
          // Update existing
          const { error } = await supabase
            .from('order_items')
            .update({
              product_id: item.product_id || null,
              product_name: item.product_name,
              quantity: item.quantity,
              unit_price: item.unit_price,
              variant: item.variant || null,
            })
            .eq('id', item.id);
          if (error) throw error;
        } else {
          // Insert new
          const { error } = await supabase
            .from('order_items')
            .insert({
              order_id: order.id,
              product_id: item.product_id || null,
              product_name: item.product_name,
              quantity: item.quantity,
              unit_price: item.unit_price,
              variant: item.variant || null,
            });
          if (error) throw error;
        }
      }

      // If delivery company changed, cancel at old company then ship to new one
      // ONLY auto-ship if order is already in a shipping status (preparing+), NOT for confirmed/new orders
      const shippingStatuses = ['preparing', 'ready', 'to_station', 'at_station', 'au_bureau', 'en_livraison', 'shipped', 'Échec_de_livraison', 'alerte'];
      const isAlreadyShipping = shippingStatuses.includes(order.status);
      const deliveryCompanyChanged = data.delivery_company && data.delivery_company !== order.delivery_company && isAlreadyShipping;
      
      if (deliveryCompanyChanged && order.delivery_company && order.tracking_number) {
        // Step 1: Cancel at old delivery company
        try {
          console.log('Cancelling order at old company:', order.delivery_company);
          let cancelFn = '';
          if (order.delivery_company === 'RJ360') {
            cancelFn = 'ecotrack-cancel-order';
          } else if (order.delivery_company === 'ZR Express') {
            cancelFn = 'zr-express-cancel-order';
          }

          if (cancelFn) {
            const { data: cancelResult, error: cancelError } = await supabase.functions.invoke(cancelFn, {
              body: { record: { id: order.id, order_number: order.id } },
            });
            
            if (cancelError) {
              console.error(`Cancel at ${order.delivery_company} failed:`, cancelError);
              toast({
                title: 'Attention',
                description: `⚠️ Annulation chez ${order.delivery_company} échouée. Le colis peut encore exister.`,
                variant: 'default',
              });
            } else if (cancelResult?.success) {
              console.log(`Cancelled at ${order.delivery_company} successfully`);
            }
          }
        } catch (e) {
          console.error('Cancel exception:', e);
        }

        // Step 2: Ship to new company
        try {
          console.log('Shipping to new company:', data.delivery_company);
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const { data: shipResult, error: shipError } = await supabase.functions.invoke('ship-order', {
              headers: { Authorization: `Bearer ${session.access_token}` },
              body: {
                order_id: order.id,
                delivery_company: data.delivery_company,
              },
            });

            if (shipError) {
              toast({
                title: 'Commande mise à jour',
                description: `⚠️ Annulée chez ${order.delivery_company} mais l'envoi vers ${data.delivery_company} a échoué.`,
                variant: 'default',
              });
            } else if (shipResult?.success) {
              toast({
                title: 'Société de livraison changée',
                description: `✅ Annulée chez ${order.delivery_company} → Envoyée à ${data.delivery_company}${shipResult.tracking_number ? ` (${shipResult.tracking_number})` : ''}`,
              });
            } else {
              toast({
                title: 'Commande mise à jour',
                description: `⚠️ ${shipResult?.message || 'Envoi en cours...'}`,
                variant: 'default',
              });
            }
          }
        } catch (e) {
          console.error('Ship order exception:', e);
          toast({
            title: 'Commande mise à jour',
            description: `⚠️ Erreur lors de l'envoi vers ${data.delivery_company}.`,
            variant: 'default',
          });
        }
      } else if (deliveryCompanyChanged) {
        // No old tracking - just ship to new company directly
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const { data: shipResult, error: shipError } = await supabase.functions.invoke('ship-order', {
              headers: { Authorization: `Bearer ${session.access_token}` },
              body: {
                order_id: order.id,
                delivery_company: data.delivery_company,
              },
            });

            if (shipError) {
              toast({
                title: 'Commande mise à jour',
                description: `⚠️ L'envoi vers ${data.delivery_company} a échoué.`,
                variant: 'default',
              });
            } else if (shipResult?.success) {
              toast({
                title: 'Commande expédiée',
                description: `✅ Envoyée à ${data.delivery_company}${shipResult.tracking_number ? ` (${shipResult.tracking_number})` : ''}`,
              });
            } else {
              toast({
                title: 'Commande mise à jour',
                description: `⚠️ ${shipResult?.message || 'Envoi en cours...'}`,
                variant: 'default',
              });
            }
          }
        } catch (e) {
          toast({
            title: 'Commande mise à jour',
            description: `⚠️ Erreur lors de l'envoi vers ${data.delivery_company}.`,
            variant: 'default',
          });
        }
      } else if (order.delivery_company === 'ZR Express' && order.tracking_number) {
        try {
          const { data: syncResult, error: syncError } = await supabase.functions.invoke('zr-express-sync-order', {
            body: { action: 'sync_all', order_id: order.id },
          });
          if (syncError) {
            toast({ title: 'Commande mise à jour', description: '⚠️ Sync ZR Express échouée.', variant: 'default' });
          } else if (syncResult?.success) {
            toast({ title: 'Commande mise à jour', description: '✅ Synchronisée avec ZR Express.' });
          } else {
            toast({ title: 'Commande mise à jour', description: '⚠️ Sync partielle ZR Express.', variant: 'default' });
          }
        } catch (e) {
          toast({ title: 'Commande mise à jour', description: 'Enregistrée localement.' });
        }
      } else {
        toast({
          title: 'Commande mise à jour',
          description: 'Les informations ont été enregistrées.',
        });
      }

      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setOpen(false);
    } catch (error) {
      toast({
        title: 'Erreur',
        description: getOrderErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-[500px] max-h-[90vh]"
        onOpenAutoFocus={(e) => {
          // Prevent Radix from auto-focusing the first input (which selects the whole name)
          e.preventDefault();
          requestAnimationFrame(() => titleRef.current?.focus());
        }}
      >
        <DialogHeader>
          <DialogTitle ref={titleRef} tabIndex={-1}>
            Modifier la commande
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-100px)] pr-4">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit, () => {
                setHasAttemptedSubmit(true);
              })}
              className="space-y-4"
            >
              {/* Customer Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Informations client</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="customer_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom</FormLabel>
                        <FormControl>
                          <Input {...field} autoFocus={false} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="customer_phone"
                    render={({ field }) => {
                      const hasError = hasAttemptedSubmit && !field.value?.trim();
                      return (
                        <FormItem>
                          <FormLabel className={hasError ? 'text-destructive' : ''}>
                            Téléphone {hasError && <span className="text-destructive">*</span>}
                          </FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              className={hasError ? 'border-destructive focus-visible:ring-destructive' : ''}
                            />
                          </FormControl>
                          {hasError && (
                            <p className="text-sm text-destructive font-medium">
                              ⚠️ Le téléphone est requis
                            </p>
                          )}
                        </FormItem>
                      );
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="wilaya"
                    render={({ field }) => {
                      const hasError = hasAttemptedSubmit && !field.value?.trim();
                      
                      return (
                        <FormItem>
                          <FormLabel className={hasError ? 'text-destructive' : ''}>
                            Wilaya {hasError && <span className="text-destructive">*</span>}
                          </FormLabel>
                          <FormControl>
                            <div className={hasError ? '[&>button]:border-destructive [&>button]:focus:ring-destructive' : ''}>
                              <WilayaSelect
                                value={field.value}
                                onChange={(value) => {
                                  field.onChange(value);
                                  form.setValue('commune', '');
                                }}
                              />
                            </div>
                          </FormControl>
                          {hasError && (
                            <p className="text-sm text-destructive font-medium">
                              ⚠️ La wilaya est requise
                            </p>
                          )}
                        </FormItem>
                      );
                    }}
                  />
                  <FormField
                    control={form.control}
                    name="commune"
                    render={({ field }) => {
                      const wilayaValue = form.watch('wilaya');
                      const selectedWilaya = algeriaWilayas.find(
                        w => w.name === wilayaValue || w.code === wilayaValue || `${w.code} - ${w.name}` === wilayaValue
                      );
                      const communes = selectedWilaya ? communesByWilaya[selectedWilaya.code] || [] : [];
                      const hasError = hasAttemptedSubmit && !field.value?.trim() && wilayaValue?.trim();
                      
                      return (
                        <FormItem>
                          <FormLabel className={hasError ? 'text-destructive' : ''}>
                            Commune {hasError && <span className="text-destructive">*</span>}
                          </FormLabel>
                          <FormControl>
                            <div className={hasError ? '[&>button]:border-destructive [&>button]:focus:ring-destructive' : ''}>
                              <CommuneSelect
                                value={field.value || ''}
                                onChange={field.onChange}
                                communes={communes}
                              />
                            </div>
                          </FormControl>
                          {hasError && (
                            <p className="text-sm text-destructive font-medium">
                              ⚠️ La commune est requise
                            </p>
                          )}
                        </FormItem>
                      );
                    }}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="customer_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Adresse</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={2} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* Order Items */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-muted-foreground">Produits</h3>
                  <Button
                    ref={addItemButtonRef}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      append(
                        { product_id: '', product_name: '', quantity: 1, unit_price: 0, sku: '', variant: '' },
                        { shouldFocus: false },
                      );
                      requestAnimationFrame(() => addItemButtonRef.current?.focus());
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Ajouter
                  </Button>
                </div>

                {hasAttemptedSubmit && fields.length === 0 && (
                  <div className="p-4 border-2 border-dashed border-destructive/50 rounded-lg bg-destructive/5 text-center">
                    <p className="text-destructive text-sm font-medium">
                      ⚠️ Veuillez ajouter au moins un produit à la commande
                    </p>
                  </div>
                )}

                {fields.map((field, index) => (
                  <div key={field.id} className="p-4 rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Package className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-sm font-semibold text-foreground">Produit {index + 1}</span>
                      </div>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-lg"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <FormField
                      control={form.control}
                      name={`items.${index}.product_id`}
                      render={({ field: productIdField }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Sélectionner un produit</FormLabel>
                          <FormControl>
                            <ProductSearchSelect
                              products={availableProducts}
                              value={productIdField.value || ''}
                              onSelect={(productId) => {
                                const product = products?.find(p => p.id === productId);
                                  if (product) {
                                    productIdField.onChange(product.id);
                                    form.setValue(`items.${index}.product_name`, product.name);
                                    form.setValue(`items.${index}.unit_price`, Number(product.selling_price));
                                    form.setValue(`items.${index}.sku`, product.sku);
                                    form.setValue(`items.${index}.free_delivery`, product.free_delivery);
                                    form.setValue(`items.${index}.delivery_pricing_tier`, product.delivery_pricing_tier || 'standard');
                                  }
                              }}
                              placeholder="Rechercher par nom ou SKU..."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-4 gap-2">
                      <FormField
                        control={form.control}
                        name={`items.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Qté</FormLabel>
                            <FormControl>
                              <Input type="number" min={1} autoFocus={false} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${index}.unit_price`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Prix (DA)</FormLabel>
                            <FormControl>
                              <Input type="number" min={0} autoFocus={false} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${index}.sku`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">SKU</FormLabel>
                            <FormControl>
                              <Input placeholder="SKU..." autoFocus={false} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${index}.variant`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Variante</FormLabel>
                            <FormControl>
                              <Input placeholder="Couleur..." autoFocus={false} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Delivery */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Livraison</h3>
                <FormField
                  control={form.control}
                  name="delivery_type"
                  render={({ field }) => {
                    const match = watchedWilaya?.match(/^(\d+)\s*-\s*/);
                    let wilayaCode = match ? match[1] : null;
                    if (!wilayaCode) {
                      const wilaya = algeriaWilayas.find(
                        w => w.name === watchedWilaya || `${w.code} - ${w.name}` === watchedWilaya
                      );
                      wilayaCode = wilaya?.code || null;
                    }
                    const codePadded = wilayaCode ? wilayaCode.padStart(2, '0') : null;
                    const codeNum = wilayaCode ? parseInt(wilayaCode, 10).toString() : null;
                    const btnMatchesCode = (feeCode: string) => feeCode === wilayaCode || feeCode === codeNum || feeCode === codePadded;
                    const currentFees = wilayaCode ? deliveryFees?.find(f => btnMatchesCode(f.wilaya_code)) : null;
                    const companyFeeForWilaya = wilayaCode && watchedDeliveryCompany && companyFees
                      ? companyFees.find(f => btnMatchesCode(f.wilaya_code))
                      : null;
                    
                    // Check free delivery from products
                    const hasFreeDeliveryProduct = watchedItems.some(item => {
                      if (!item.product_id) return false;
                      const p = products?.find(pr => pr.id === item.product_id);
                      return p?.free_delivery === true;
                    });

                    const special2FeeForWilaya = wilayaCode && specialFees2
                      ? specialFees2.find(f => btnMatchesCode(f.wilaya_code))
                      : null;

                    const calcBadgeFee = (type: 'home' | 'stop_desk'): number | null => {
                      if (!wilayaCode) return null;
                      if (hasFreeDeliveryProduct) return 0;
                      if (!watchedDeliveryCompany) return null;
                      // Pricing tier
                      if (productTier === 'special_1' && currentFees) {
                        return type === 'home' ? currentFees.home_delivery_fee : currentFees.stop_desk_fee;
                      }
                      if (productTier === 'special_2' && special2FeeForWilaya) {
                        return type === 'home' ? special2FeeForWilaya.home_delivery_fee : special2FeeForWilaya.stop_desk_fee;
                      }
                      if (productTier === 'free') return 0;
                      // Company fees
                      if (companyFeeForWilaya) {
                        return type === 'home' ? companyFeeForWilaya.home_delivery_fee : companyFeeForWilaya.stop_desk_fee;
                      }
                      // General fees
                      if (currentFees) {
                        return type === 'home' ? currentFees.home_delivery_fee : currentFees.stop_desk_fee;
                      }
                      return null;
                    };

                    const homeFee = calcBadgeFee('home');
                    const stopDeskFee = calcBadgeFee('stop_desk');

                    return (
                      <FormItem>
                        <FormLabel>Type de livraison</FormLabel>
                        <FormControl>
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                field.onChange('home');
                                const currentAddress = form.getValues('customer_address');
                                if (currentAddress?.startsWith('Stop Desk:')) {
                                  form.setValue('customer_address', '');
                                }
                                setSelectedStopDeskId('');
                              }}
                              className={`group relative flex flex-col items-center justify-center gap-1 py-2 px-2.5 rounded-xl border-2 transition-all duration-300 ${
                                field.value === 'home'
                                  ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25'
                                  : 'bg-background text-foreground border-border hover:border-primary/50 hover:shadow-md'
                              }`}
                            >
                              <div className={`p-1.5 rounded-full transition-colors ${field.value === 'home' ? 'bg-primary-foreground/20' : 'bg-muted group-hover:bg-primary/10'}`}>
                                <Home className="h-3.5 w-3.5" />
                              </div>
                              <span className="text-[11px] font-semibold">À domicile</span>
                              {homeFee !== null && (
                                <span className={`text-xs font-bold tabular-nums tracking-tight px-2.5 py-0.5 rounded-full ${
                                  homeFee === 0
                                    ? (field.value === 'home' ? 'bg-primary-foreground/25 text-primary-foreground' : 'bg-primary/10 text-primary')
                                    : field.value === 'home' 
                                      ? 'bg-primary-foreground/25 text-primary-foreground' 
                                      : 'bg-primary/10 text-primary'
                                }`}>
                                  {homeFee === 0 ? 'GRATUIT' : `${Number(homeFee).toLocaleString('fr-DZ')} DA`}
                                </span>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => field.onChange('stop_desk')}
                              className={`group relative flex flex-col items-center justify-center gap-1 py-2 px-2.5 rounded-xl border-2 transition-all duration-300 ${
                                field.value === 'stop_desk'
                                  ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25'
                                  : 'bg-background text-foreground border-border hover:border-primary/50 hover:shadow-md'
                              }`}
                            >
                              <div className={`p-1.5 rounded-full transition-colors ${field.value === 'stop_desk' ? 'bg-primary-foreground/20' : 'bg-muted group-hover:bg-primary/10'}`}>
                                <Building2 className="h-3.5 w-3.5" />
                              </div>
                              <span className="text-[11px] font-semibold">Stop Desk</span>
                              {stopDeskFee !== null && (
                                <span className={`text-xs font-bold tabular-nums tracking-tight px-2.5 py-0.5 rounded-full ${
                                  stopDeskFee === 0
                                    ? (field.value === 'stop_desk' ? 'bg-primary-foreground/25 text-primary-foreground' : 'bg-primary/10 text-primary')
                                    : field.value === 'stop_desk' 
                                      ? 'bg-primary-foreground/25 text-primary-foreground' 
                                      : 'bg-primary/10 text-primary'
                                }`}>
                                  {stopDeskFee === 0 ? 'GRATUIT' : `${Number(stopDeskFee).toLocaleString('fr-DZ')} DA`}
                                </span>
                              )}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                <FormField
                  control={form.control}
                  name="delivery_company"
                  render={({ field }) => {
                    const selectedName = field.value?.toLowerCase() || '';
                    const isZR = selectedName.includes('zr');
                    const isMaystro = selectedName.includes('maystro');
                    const isRJ360 = selectedName.includes('rj360');
                    
                    const triggerBg = field.value
                      ? isZR
                        ? 'bg-yellow-50 border-yellow-300 hover:bg-yellow-100'
                        : isMaystro
                        ? 'bg-blue-50 border-blue-300 hover:bg-blue-100'
                        : isRJ360
                        ? 'bg-orange-50 border-orange-300 hover:bg-orange-100'
                        : ''
                      : '';

                    return (
                      <FormItem>
                        <FormLabel>Société de livraison</FormLabel>
                        <Select
                          value={field.value || undefined}
                          onValueChange={(value) => field.onChange(value === '__none__' ? '' : value)}
                        >
                          <FormControl>
                            <SelectTrigger className={`w-full transition-all ${triggerBg}`}>
                              <SelectValue placeholder="🚚 Choisir une société...">
                                {field.value && (
                                  <DeliveryCompanyBadge company={field.value} className="ml-1" />
                                )}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-popover border border-border shadow-xl z-[200] p-1">
                            <SelectItem 
                              value="__none__" 
                              className="cursor-pointer rounded-md my-0.5 transition-colors hover:bg-muted text-muted-foreground"
                            >
                              <span className="flex items-center gap-2">
                                <Truck className="h-4 w-4" />
                                Aucune société
                              </span>
                            </SelectItem>
                            {enabledDeliveryCompanies.map((company) => {
                              const name = company.toLowerCase();
                              const itemIsZR = name.includes('zr');
                              const itemIsMaystro = name.includes('maystro');
                              const itemIsRJ360 = name.includes('rj360');
                              
                              const hoverBg = itemIsZR
                                ? 'hover:bg-yellow-50'
                                : itemIsMaystro
                                ? 'hover:bg-blue-50'
                                : itemIsRJ360
                                ? 'hover:bg-orange-50'
                                : 'hover:bg-muted';

                              return (
                                <SelectItem 
                                  key={company} 
                                  value={company} 
                                  className={`cursor-pointer rounded-md my-0.5 transition-colors ${hoverBg}`}
                                >
                                  <DeliveryCompanyBadge company={company} />
                                </SelectItem>
                              );
                            })}
                            {localLivreurs && localLivreurs.length > 0 && (
                              <>
                                <SelectSeparator />
                                <SelectGroup>
                                  <SelectLabel className="text-xs text-muted-foreground">Livreurs locaux</SelectLabel>
                                  {localLivreurs.map((livreur) => (
                                    <SelectItem
                                      key={livreur.id}
                                      value={`local:${livreur.name}`}
                                      className="cursor-pointer rounded-md my-0.5 transition-colors hover:bg-green-50"
                                    >
                                      <DeliveryCompanyBadge company={livreur.name} />
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                {/* Stop Desk Selection */}
                {watchedDeliveryType === 'stop_desk' && watchedDeliveryCompany?.toLowerCase().includes('zr') && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Stop Desk</label>
                    <StopDeskSelect
                      value={selectedStopDeskId}
                      onChange={(id, point) => {
                        setSelectedStopDeskId(id);
                        if (point) {
                          form.setValue('customer_address', `Stop Desk: ${point.name} — ${point.commune}${point.address ? ', ' + point.address : ''}`);
                        }
                      }}
                      pickupPoints={pickupPoints || []}
                      isLoading={pickupPointsLoading}
                    />
                  </div>
                )}
              </div>

              <Separator />

              {/* Pricing */}
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Prix Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <FormField
                  control={form.control}
                  name="delivery_fee"
                  render={({ field }) => {
                    const isFreeDelivery = watchedItems.some(item => {
                      if (item.free_delivery === true) return true;
                      if (!item.product_id) return false;
                      const p = products?.find(pr => pr.id === item.product_id);
                      return p?.free_delivery === true;
                    }) || productTier === 'free';

                    return (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>Frais de livraison</FormLabel>
                          <FormControl>
                            {isFreeDelivery ? (
                              <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-semibold bg-primary/10 text-primary">
                                GRATUIT
                              </span>
                            ) : (
                              <Input type="number" min={0} className="w-32 text-right" {...field} />
                            )}
                          </FormControl>
                        </div>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                <FormField
                  control={form.control}
                  name="discount"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Réduction</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} className="w-32 text-right" {...field} />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>

              <Separator />

              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={2} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {!hideStatus && (
                <>
                  <Separator />

                  {/* Status */}
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Statut de la commande</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un statut" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-popover border border-border shadow-lg z-[200] max-h-[300px]">
                            {(expeditionOnly ? expeditionStatuses : confirmationOnly ? confirmationStatuses : allOrderStatuses).map((status) => (
                              <SelectItem key={status.value} value={status.value}>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                                  {status.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
