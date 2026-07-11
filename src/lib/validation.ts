import { z } from 'zod';

// Phone number validation for Algeria
export const algerianPhoneRegex = /^(\+213|0)(5|6|7)[0-9]{8}$/;

// Customer validation schemas
export const customerInsertSchema = z.object({
  name: z.string().min(2, 'Nom doit avoir au moins 2 caractères').max(100, 'Nom trop long'),
  phone: z.string().regex(algerianPhoneRegex, 'Format invalide: +213 ou 0 suivi de 5, 6, ou 7 et 8 chiffres'),
  wilaya: z.string().min(1, 'Wilaya requise').max(50, 'Wilaya trop longue'),
  commune: z.string().max(50, 'Commune trop longue').optional().nullable(),
  address: z.string().max(500, 'Adresse trop longue').optional().nullable(),
  notes: z.string().max(1000, 'Notes trop longues').optional().nullable(),
  status: z.enum(['new', 'regular', 'vip', 'blacklisted']).optional(),
  total_orders: z.number().int().min(0).optional(),
  total_spent: z.number().min(0).optional(),
  last_order_date: z.string().optional().nullable(),
});

export const customerUpdateSchema = customerInsertSchema.partial().extend({
  id: z.string().uuid(),
});

// Product validation schemas
export const productInsertSchema = z.object({
  sku: z.string().min(1, 'SKU requis').max(50, 'SKU trop long'),
  name: z.string().min(1, 'Nom requis').max(200, 'Nom trop long'),
  category: z.string().min(1, 'Catégorie requise').max(100, 'Catégorie trop longue'),
  description: z.string().max(2000, 'Description trop longue').optional().nullable(),
  purchase_price: z.number().min(0, 'Prix doit être positif'),
  selling_price: z.number().min(0, 'Prix doit être positif'),
  current_stock: z.number().int().min(0, 'Stock doit être positif'),
  reorder_level: z.number().int().min(0, 'Seuil doit être positif'),
  reserved_stock: z.number().int().min(0).optional(),
  barcode: z.string().max(100).optional().nullable(),
  free_delivery: z.boolean().optional(),
  delivery_pricing_tier: z.enum(['standard', 'special_1', 'special_2', 'special', 'office', 'free']).optional(),
  ai_confirmation: z.boolean().optional(),
  custom_home_delivery_fee: z.number().min(0).optional().nullable(),
  custom_stop_desk_fee: z.number().min(0).optional().nullable(),
});

export const productUpdateSchema = productInsertSchema.partial().extend({
  id: z.string().uuid(),
});

// Order validation schemas
export const orderStatusSchema = z.enum([
  'new', 'validated', 'confirmed', 'cancelled', 
  'failed_1', 'failed_2', 'failed_3', 'failed_4', 'failed_5', 'failed_6', 
  'no_answer', 'wrong_number', 'postponed', 
  'to_reconfirm', 'callback', 'duplicate', 
  'out_of_stock', 'ready', 'preparing', 'to_station', 'at_station', 'au_bureau', 'en_livraison', 'shipped', 
  'delivered', 'delivered_paid', 'returned', 'erreur', 'Échec_de_livraison',
  'exchange', 'alerte'
]);

export const orderUpdateStatusSchema = z.object({
  id: z.string().uuid(),
  status: orderStatusSchema,
  notes: z.string().max(1000, 'Notes trop longues').optional(),
});

// Order item validation
export const orderItemSchema = z.object({
  product_id: z.string().uuid().optional().nullable(),
  product_name: z.string().min(1).max(200),
  quantity: z.number().int().min(1, 'Quantité doit être au moins 1'),
  unit_price: z.number().min(0, 'Prix doit être positif'),
  variant: z.string().max(100).optional().nullable(),
});

export const orderInsertSchema = z.object({
  customer_name: z.string().min(1, 'Nom requis').max(100, 'Nom trop long'),
  customer_phone: z.string().regex(algerianPhoneRegex, 'Format de téléphone invalide'),
  customer_address: z.string().min(1, 'Adresse requise').max(500, 'Adresse trop longue'),
  wilaya: z.string().min(1, 'Wilaya requise').max(50, 'Wilaya trop longue'),
  commune: z.string().max(50).optional().nullable(),
  source: z.enum(['facebook', 'instagram', 'website', 'phone', 'other']),
  notes: z.string().max(1000).optional().nullable(),
  customer_id: z.string().uuid().optional().nullable(),
  total_price: z.number().min(0).optional(),
  delivery_fee: z.number().min(0).optional(),
  assigned_agent: z.string().max(100).optional().nullable(),
  delivery_company: z.string().max(100).optional().nullable(),
  tracking_number: z.string().max(100).optional().nullable(),
});

export type CustomerInsertInput = z.infer<typeof customerInsertSchema>;
export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>;
export type ProductInsertInput = z.infer<typeof productInsertSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type OrderStatusUpdateInput = z.infer<typeof orderUpdateStatusSchema>;
export type OrderInsertInput = z.infer<typeof orderInsertSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;
