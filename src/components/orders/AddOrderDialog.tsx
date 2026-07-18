import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateOrder } from '@/hooks/useOrders';
import { useActiveStores } from '@/hooks/useStores';
import { useProducts } from '@/hooks/useProducts';
import { useCustomerByPhone, useCreateCustomer } from '@/hooks/useCustomers';
import { useDeliveryFees } from '@/hooks/useDeliveryFees';
import { useDeliveryCompanyFees } from '@/hooks/useDeliveryCompanyFees';
import { useSpecialDeliveryFees2 } from '@/hooks/useSpecialDeliveryFees2';
import { useActiveDeliveryPromotions, calculateDiscountedFee } from '@/hooks/useDeliveryPromotions';
import { useActiveProductPacks, findApplicablePacks } from '@/hooks/useProductPacks';
import { useIntegrations, DELIVERY_COMPANIES } from '@/hooks/useIntegrations';
import { usePickupPoints } from '@/hooks/usePickupPoints';
import { algeriaWilayas, communesByWilaya } from '@/data/algeriaLocations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator, SelectLabel, SelectGroup } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, AlertTriangle, Home, Building2, Truck, Package } from 'lucide-react';
import { ProductSearchSelect } from './ProductSearchSelect';
import { getOrderErrorMessage } from '@/lib/errorMessages';
import { WilayaSelect } from './WilayaSelect';
import { CommuneSelect } from './CommuneSelect';
import { StopDeskSelect } from './StopDeskSelect';
import { DeliveryCompanyBadge } from './DeliveryCompanyBadge';

const phoneRegex = /^(\+213|0)(5|6|7)[0-9]{8}$/;

const orderItemSchema = z.object({
  product_id: z.string().optional(),
  product_name: z.string().trim().min(1, 'Produit requis').max(200),
  quantity: z.coerce.number().min(1, 'Min 1'),
  unit_price: z.coerce.number().min(0, 'Prix invalide'),
  sku: z.string().trim().max(50).optional(),
  variant: z.string().trim().max(100).optional(),
  free_delivery: z.boolean().optional(),
  delivery_pricing_tier: z.string().optional(),
});

const orderSchema = z.object({
  customer_name: z.string().trim().min(1, 'Le nom est requis').max(100),
  customer_phone: z.string().regex(phoneRegex, 'Format: +213 5XX XX XX XX ou 05XX XX XX XX'),
  customer_address: z.string().trim().min(1, "L'adresse est requise").max(500),
  wilaya: z.string().trim().min(1, 'La wilaya est requise').max(100),
  commune: z.string().trim().max(100).optional(),
  source: z.enum(['facebook', 'instagram', 'website', 'phone', 'other']),
  store_id: z.string().optional(),
  delivery_type: z.enum(['home', 'stop_desk']),
  delivery_company: z.string().optional(),
  delivery_fee: z.coerce.number().min(0, 'Frais invalides'),
  discount: z.coerce.number().min(0, 'Réduction invalide').optional(),
  notes: z.string().trim().max(1000).optional(),
  items: z.array(orderItemSchema).min(1, 'Au moins un produit requis'),
});

type OrderFormData = z.infer<typeof orderSchema>;

interface AddOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const sources = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'website', label: 'Site Web' },
  { value: 'phone', label: 'Téléphone' },
  { value: 'other', label: 'Autre' },
];

export function AddOrderDialog({ open, onOpenChange }: AddOrderDialogProps) {
  const { toast } = useToast();
  const createOrder = useCreateOrder();
  const createCustomer = useCreateCustomer();
  const { data: products } = useProducts();
  const { data: stores } = useActiveStores();
  const { data: deliveryFees } = useDeliveryFees();
  const { data: specialFees2 } = useSpecialDeliveryFees2();
  const { data: activePromotions } = useActiveDeliveryPromotions();
  const { data: activePacks } = useActiveProductPacks();
  const { data: deliveryIntegrations } = useIntegrations('delivery');
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [selectedStopDeskId, setSelectedStopDeskId] = useState('');

  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const addItemButtonRef = useRef<HTMLButtonElement | null>(null);

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

  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      customer_name: '',
      customer_phone: '',
      customer_address: '',
      wilaya: '',
      commune: '',
      source: 'facebook',
      store_id: '',
      delivery_type: 'home',
      delivery_company: '',
      delivery_fee: 0,
      discount: 0,
      notes: '',
      items: [{ product_id: '', product_name: '', quantity: 1, unit_price: 0, sku: '', variant: '', free_delivery: false, delivery_pricing_tier: 'standard' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const watchedPhone = form.watch('customer_phone');
  const watchedWilaya = form.watch('wilaya');
  const watchedDeliveryType = form.watch('delivery_type');
  const watchedDeliveryCompany = form.watch('delivery_company');
  const watchedItems = form.watch('items');
  const watchedItemsKey = JSON.stringify(watchedItems?.map(i => ({ pid: i.product_id, q: i.quantity, p: i.unit_price, s: i.sku, n: i.product_name })));
  const watchedDeliveryFee = form.watch('delivery_fee');
  const watchedDiscount = form.watch('discount');

  const { data: companyFees } = useDeliveryCompanyFees(watchedDeliveryCompany || '');
  const { data: existingCustomer } = useCustomerByPhone(watchedPhone?.replace(/\s/g, '') || '');

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

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setHasAttemptedSubmit(false);
      setSelectedStopDeskId('');
      form.reset({
        customer_name: '',
        customer_phone: '',
        customer_address: '',
        wilaya: '',
        commune: '',
        source: 'facebook',
        store_id: '',
        delivery_type: 'home',
        delivery_company: '',
        delivery_fee: 0,
        discount: 0,
        notes: '',
        items: [{ product_id: '', product_name: '', quantity: 1, unit_price: 0, sku: '', variant: '', free_delivery: false, delivery_pricing_tier: 'standard' }],
      });
    }
  }, [open, form]);

  // Auto-fill customer data
  useEffect(() => {
    if (existingCustomer) {
      form.setValue('customer_name', existingCustomer.name);
      form.setValue('customer_address', existingCustomer.address || '');
      form.setValue('wilaya', existingCustomer.wilaya);
      form.setValue('commune', existingCustomer.commune || '');
    }
  }, [existingCustomer, form]);

  // Fetch all company fees for fallback when no specific company is selected
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

  const hasFreeDelivery = useMemo(() => watchedItems.some(item => {
    if (!item.product_id) return false;
    const product = products?.find(p => p.id === item.product_id);
    return Boolean(product?.free_delivery);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [watchedItems, products]);

  // Pack logic
  const packResults = useMemo(() => {
    if (!activePacks || activePacks.length === 0) return [];

    const normalizedItems = watchedItems.map((item) => {
      let resolvedProductId = item.product_id;

      if (!resolvedProductId && products?.length) {
        const bySku = item.sku
          ? products.find((p) => p.sku?.toLowerCase() === item.sku?.toLowerCase())
          : undefined;
        const byName = item.product_name
          ? products.find((p) => p.name?.toLowerCase() === item.product_name?.toLowerCase())
          : undefined;
        resolvedProductId = bySku?.id || byName?.id;
      }

      return {
        product_id: resolvedProductId,
        quantity: Number(item.quantity) || 0,
        unit_price: Number(item.unit_price) || 0,
      };
    });

    return findApplicablePacks(activePacks, normalizedItems);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePacks, watchedItemsKey, products]);

  const packDiscount = useMemo(() => packResults.reduce((sum, r) => sum + r.discountAmount, 0), [packResults]);
  const packFreeDelivery = packResults.some(r => r.freeDelivery);

  // Determine product delivery pricing tier
  const productTier = useMemo(() => {
    const firstProductWithTier = watchedItems.find(item => item.delivery_pricing_tier && item.delivery_pricing_tier !== 'standard');
    return firstProductWithTier?.delivery_pricing_tier || 'standard';
  }, [watchedItems]);

  // Auto-apply delivery fee
  useEffect(() => {
    if (!watchedWilaya || !open) return;

    // Check free delivery first (product-level or pack-level)
    if (hasFreeDelivery || packFreeDelivery) {
      form.setValue('delivery_fee', 0);
      return;
    }

    // Don't calculate delivery fee until a delivery company or livreur is selected
    if (!watchedDeliveryCompany) {
      form.setValue('delivery_fee', 0);
      return;
    }

    const match = watchedWilaya.match(/^(\d+)\s*-\s*/);
    let code = match ? match[1] : null;
    if (!code) {
      const wilaya = algeriaWilayas.find(
        w => w.name === watchedWilaya || `${w.code} - ${w.name}` === watchedWilaya
      );
      code = wilaya?.code || null;
    }
    if (!code) {
      form.setValue('delivery_fee', 0);
      return;
    }

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
      // special_1 → delivery_fees table (Tarifs Spécial)
      const specialFee = deliveryFees.find(f => matchesCode(f.wilaya_code));
      if (specialFee) {
        baseFee = watchedDeliveryType === 'home' ? specialFee.home_delivery_fee : specialFee.stop_desk_fee;
      }
    } else if (productTier === 'special_2' && specialFees2) {
      // special_2 → special_delivery_fees_2 table (Gratuit au Bureau)
      const special2Fee = specialFees2.find(f => matchesCode(f.wilaya_code));
      if (special2Fee) {
        baseFee = watchedDeliveryType === 'home' ? special2Fee.home_delivery_fee : special2Fee.stop_desk_fee;
      }
    }

    // If no tier-specific fee found, use company fees or general fees
    if (baseFee === 0) {
      // Priority 1: Selected company fees
      if (watchedDeliveryCompany && companyFees && companyFees.length > 0) {
        const companyFee = companyFees.find(f => matchesCode(f.wilaya_code));
        if (companyFee) {
          baseFee = watchedDeliveryType === 'home' ? companyFee.home_delivery_fee : companyFee.stop_desk_fee;
        }
      }

      // Priority 2: General delivery fees
      if (baseFee === 0 && deliveryFees) {
        const generalFee = deliveryFees.find(f => matchesCode(f.wilaya_code));
        if (generalFee) {
          baseFee = watchedDeliveryType === 'home' ? generalFee.home_delivery_fee : generalFee.stop_desk_fee;
        }
      }
    }

    const activePromotion = activePromotions?.[0] || null;
    const finalFee = activePromotion
      ? calculateDiscountedFee(baseFee, activePromotion, watchedDeliveryType)
      : baseFee;

    form.setValue('delivery_fee', finalFee);
  }, [watchedWilaya, watchedDeliveryType, watchedDeliveryCompany, watchedItems, productTier, deliveryFees, specialFees2, companyFees, allCompanyFees, activePromotions, products, hasFreeDelivery, packFreeDelivery, open, form]);

  const subtotal = watchedItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const effectiveDeliveryFee = (hasFreeDelivery || packFreeDelivery) ? 0 : (Number(watchedDeliveryFee) || 0);
  const totalDiscount = (Number(watchedDiscount) || 0) + packDiscount;
  const total = subtotal + effectiveDeliveryFee - totalDiscount;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-DZ').format(value) + ' DA';
  };

  const onSubmit = async (data: OrderFormData) => {
    setHasAttemptedSubmit(true);

    const validItems = data.items.filter(item => item.product_id && item.quantity > 0);
    if (validItems.length === 0) {
      toast({
        title: 'Erreur',
        description: 'Ajoutez au moins un produit valide',
        variant: 'destructive',
      });
      return;
    }

    try {
      let customerId: string | undefined;

      if (!existingCustomer) {
        const customer = await createCustomer.mutateAsync({
          name: data.customer_name,
          phone: data.customer_phone.replace(/\s/g, ''),
          address: data.customer_address,
          wilaya: data.wilaya,
          commune: data.commune,
        });
        customerId = customer.id;
      } else {
        customerId = existingCustomer.id;
      }

      await createOrder.mutateAsync({
        order: {
          customer_id: customerId,
          customer_name: data.customer_name,
          customer_phone: data.customer_phone.replace(/\s/g, ''),
          customer_address: data.customer_address,
          wilaya: data.wilaya,
          commune: data.commune || null,
          source: data.source,
          store_id: data.store_id || null,
          notes: data.notes || null,
          total_price: total,
          delivery_fee: effectiveDeliveryFee,
          delivery_type: data.delivery_type,
          delivery_company: data.delivery_company || null,
          discount: (Number(data.discount) || 0) + packDiscount,
        },
        items: [
          ...validItems.map(item => ({
            product_id: item.product_id!,
            product_name: item.product_name,
            variant: item.variant || null,
            quantity: item.quantity,
            unit_price: item.unit_price,
          })),
          ...packResults
            .filter(r => r.giftProductId && r.giftQuantity > 0)
            .map(r => {
              const giftProduct = products?.find(p => p.id === r.giftProductId);
              return {
                product_id: r.giftProductId!,
                product_name: giftProduct?.name || 'Cadeau',
                variant: 'cadeau',
                quantity: r.giftQuantity,
                unit_price: 0,
              };
            }),
        ],
      });

      toast({
        title: 'Commande créée',
        description: `Commande pour ${data.customer_name} créée avec succès`,
      });

      onOpenChange(false);
    } catch (error: unknown) {
      toast({
        title: 'Erreur',
        description: getOrderErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[500px] max-h-[90vh]"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          requestAnimationFrame(() => titleRef.current?.focus());
        }}
      >
        <DialogHeader>
          <DialogTitle ref={titleRef} tabIndex={-1}>
            Nouvelle Commande
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

                {existingCustomer && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/10 text-primary text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    Client existant trouvé - données auto-remplies
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
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
                              placeholder="+213 555 12 34 56"
                              className={hasError ? 'border-destructive focus-visible:ring-destructive' : ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                  <FormField
                    control={form.control}
                    name="customer_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Nom du client" autoFocus={false} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
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
                        <Textarea {...field} rows={2} placeholder="Adresse de livraison" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* Products */}
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
                        { product_id: '', product_name: '', quantity: 1, unit_price: 0, sku: '', variant: '', free_delivery: false, delivery_pricing_tier: 'standard' },
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
                {/* Delivery Type - Visual Buttons */}
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
                    // Normalize code for comparison
                    const btnCodeNum = wilayaCode ? parseInt(wilayaCode, 10).toString() : null;
                    const btnCodePad = wilayaCode ? wilayaCode.padStart(2, '0') : null;
                    const btnMatchesCode = (feeCode: string) => feeCode === wilayaCode || feeCode === btnCodeNum || feeCode === btnCodePad;
                    // Check general fees first, then company fees as fallback
                    const generalFee = wilayaCode ? deliveryFees?.find(f => btnMatchesCode(f.wilaya_code)) : null;
                    const special2Fee = wilayaCode ? specialFees2?.find(f => btnMatchesCode(f.wilaya_code)) : null;
                    const companyFeeForWilaya = wilayaCode && watchedDeliveryCompany && companyFees
                      ? companyFees.find(f => btnMatchesCode(f.wilaya_code))
                      : wilayaCode && allCompanyFees
                        ? allCompanyFees.find(f => btnMatchesCode(f.wilaya_code))
                        : null;

                    // Check product-level overrides
                    const productWithCustomFee = watchedItems.find(item => {
                      if (!item.product_id) return false;
                      const p = products?.find(pr => pr.id === item.product_id);
                      return p && (p.custom_home_delivery_fee !== null || p.custom_stop_desk_fee !== null);
                    });
                    const customProduct = productWithCustomFee ? products?.find(p => p.id === productWithCustomFee.product_id) : null;

                    const calcFee = (type: 'home' | 'stop_desk'): number | null => {
                      if (!wilayaCode) return null;
                      if (hasFreeDelivery || packFreeDelivery) return 0;
                      if (!watchedDeliveryCompany) return null;
                      // Custom product fee
                      if (customProduct) {
                        const f = type === 'home' ? customProduct.custom_home_delivery_fee : customProduct.custom_stop_desk_fee;
                        if (f !== null && f !== undefined) return f;
                      }
                      // Pricing tier
                      if (productTier === 'free') return 0;
                      if (productTier === 'special_1' && generalFee) {
                        return type === 'home' ? generalFee.home_delivery_fee : generalFee.stop_desk_fee;
                      }
                      if (productTier === 'special_2' && special2Fee) {
                        return type === 'home' ? special2Fee.home_delivery_fee : special2Fee.stop_desk_fee;
                      }
                      // Company fees
                      if (companyFeeForWilaya) {
                        return type === 'home' ? companyFeeForWilaya.home_delivery_fee : companyFeeForWilaya.stop_desk_fee;
                      }
                      // General fees
                      if (generalFee) {
                        return type === 'home' ? generalFee.home_delivery_fee : generalFee.stop_desk_fee;
                      }
                      return null;
                    };

                    const homeFee = calcFee('home');
                    const stopDeskFee = calcFee('stop_desk');

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
                                    ? 'bg-emerald-500/20 text-emerald-600'
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
                                    ? 'bg-emerald-500/20 text-emerald-600'
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

                {/* Delivery Company */}
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
                          value={field.value && field.value.length > 0 ? field.value : '__none__'}
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

                {/* Source */}
                <FormField
                  control={form.control}
                  name="source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-popover border border-border shadow-lg z-[200]">
                          {sources.map((s) => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Store */}
                {stores && stores.length > 0 && (
                  <FormField
                    control={form.control}
                    name="store_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Store</FormLabel>
                        <Select
                          value={field.value || '__none__'}
                          onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un store" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-popover border border-border shadow-lg z-[200]">
                            <SelectItem value="__none__">Aucun</SelectItem>
                            {stores.map((s) => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <Separator />

              {/* Pricing */}
              <div className="space-y-3">
                {/* Pack badges */}
                {packResults.length > 0 && (
                  <div className="space-y-1.5">
                    {packResults.map((pr, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-primary/10 text-primary text-sm">
                        <Package className="h-4 w-4 shrink-0" />
                        <span className="font-medium">{pr.packName}</span>
                        {pr.discountAmount > 0 && <Badge variant="outline" className="text-xs border-primary text-primary">-{formatCurrency(pr.discountAmount)}</Badge>}
                        {pr.freeDelivery && <Badge className="bg-success hover:bg-success text-xs">Livraison gratuite</Badge>}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Prix Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <FormField
                  control={form.control}
                  name="delivery_fee"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel className="flex items-center gap-2">
                          Frais de livraison
                        </FormLabel>
                        <FormControl>
                          {(hasFreeDelivery || packFreeDelivery) ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-semibold bg-emerald-500/20 text-emerald-600">
                              GRATUIT
                            </span>
                          ) : (
                            <Input type="number" min={0} className="w-32 text-right" {...field} />
                          )}
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {packDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-primary font-medium">Réduction Pack</span>
                    <span className="text-primary font-medium">-{formatCurrency(packDiscount)}</span>
                  </div>
                )}
                <FormField
                  control={form.control}
                  name="discount"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Réduction manuelle</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} className="w-32 text-right" {...field} />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-between font-semibold">
                  <span>Total COD</span>
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
                      <Textarea {...field} rows={2} placeholder="Notes sur la commande..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={createOrder.isPending}>
                  {createOrder.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Création...
                    </>
                  ) : (
                    'Créer la commande'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
