export type UserRole = 'admin' | 'confirmation_agent' | 'stock_manager' | 'delivery_manager';

export type OrderStatus = 
  | 'new'           // Nouveau
  | 'validated'     // Validé
  | 'confirmed'     // Confirmé
  | 'cancelled'     // Annulé
  | 'failed_1'      // Échouée 1
  | 'failed_2'      // Échouée 2
  | 'failed_3'      // Échouée 3
  | 'failed_4'      // Échouée 4
  | 'failed_5'      // Échouée 5
  | 'failed_6'      // Échouée 6
  | 'no_answer'     // Répondre pas
  | 'wrong_number'  // Faux numéro
  | 'postponed'     // Reporter
  | 'to_reconfirm'  // A reconfirmer
  | 'callback'      // Me rappelez
  | 'duplicate'     // Dupliquer
  | 'out_of_stock'  // Fin de stock
  | 'ready'         // Prêt
  | 'preparing'     // Préparer
  | 'to_station'    // Vers station
  | 'at_station'    // En station
  | 'au_bureau'     // Au bureau
  | 'en_livraison'  // En livraison
  | 'Échec_de_livraison' // Échec de livraison (Tracking)
  | 'shipped'       // Expédié
  | 'delivered'     // Livré
  | 'erreur'         // Erreur
  | 'exchange'      // Échange
  | 'alerte'        // Alerte
  | 'delivered_paid' // Livré Payé
  | 'returned';     // Retourné

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  lastLogin?: Date;
  isActive: boolean;
}

export type OrderSource = 'facebook' | 'instagram' | 'website' | 'phone' | 'other';

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  wilaya: string;
  commune: string;
  products: OrderProduct[];
  totalPrice: number;
  deliveryFee: number;
  status: OrderStatus;
  assignedAgent?: string;
  source: OrderSource;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  confirmedAt?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
  trackingNumber?: string;
  deliveryCompany?: string;
}

export interface OrderProduct {
  productId: string;
  productName: string;
  variant?: string;
  quantity: number;
  unitPrice: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  description?: string;
  purchasePrice: number;
  sellingPrice: number;
  currentStock: number;
  reservedStock: number;
  reorderLevel: number;
  variants?: ProductVariant[];
  images?: string[];
  supplierId?: string;
  barcode?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductVariant {
  id: string;
  name: string;
  type: 'size' | 'color';
  stock: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  wilaya: string;
  commune: string;
  address: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate?: Date;
  status: 'new' | 'regular' | 'vip' | 'blacklisted';
  notes?: string;
  createdAt: Date;
}

export interface DashboardStats {
  totalOrdersToday: number;
  confirmedOrders: number;
  pendingConfirmations: number;
  revenueToday: number;
  pendingCOD: number;
  ordersByStatus: { status: OrderStatus; count: number }[];
  dailyRevenue: { date: string; revenue: number }[];
  topProducts: { name: string; quantity: number; revenue: number }[];
  lowStockProducts: Product[];
  agentPerformance: { name: string; confirmed: number; cancelled: number; rate: number }[];
}

export interface Wilaya {
  id: number;
  name: string;
  arabicName: string;
  deliveryFeeHome: number;
  deliveryFeeStopDesk: number;
}
