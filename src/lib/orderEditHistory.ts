import { supabase } from '@/integrations/supabase/client';
import type { OrderWithItems } from '@/hooks/useOrders';

export interface EditHistoryEntry {
  order_id: string;
  changed_by_user_id: string | null;
  changed_by: string | null;
  field: string;
  old_value: string | null;
  new_value: string | null;
  label: string;
}

interface OrderAfter {
  status?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  wilaya?: string;
  commune?: string | null;
  store_id?: string | null;
  delivery_type?: string;
  delivery_company?: string | null;
  delivery_fee?: number;
  discount?: number;
  notes?: string | null;
  total_price?: number;
}

interface ItemLike {
  id?: string;
  product_id?: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  variant?: string | null;
}

const FIELD_LABELS: Record<string, string> = {
  status: 'Statut',
  customer_name: 'Nom client',
  customer_phone: 'Téléphone',
  customer_address: 'Adresse',
  wilaya: 'Wilaya',
  commune: 'Commune',
  store_id: 'Store',
  delivery_type: 'Type livraison',
  delivery_company: 'Société livraison',
  delivery_fee: 'Frais livraison',
  discount: 'Remise',
  notes: 'Notes',
  total_price: 'Prix total',
};

const norm = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(v);
  return String(v).trim();
};

const fmt = (v: unknown): string => {
  const s = norm(v);
  return s === '' ? '—' : s;
};

export async function logOrderEdits(
  orderId: string,
  before: OrderWithItems,
  after: OrderAfter,
  afterItems: ItemLike[],
  currentUserId: string | null,
  currentUserName?: string | null,
): Promise<void> {
  try {
    const entries: EditHistoryEntry[] = [];

    // ---- Order-level field diffs ----
    const beforeMap: Record<string, unknown> = {
      status: (before as any).status,
      customer_name: (before as any).customer_name,
      customer_phone: (before as any).customer_phone,
      customer_address: (before as any).customer_address,
      wilaya: (before as any).wilaya,
      commune: (before as any).commune,
      store_id: (before as any).store_id,
      delivery_type: (before as any).delivery_type,
      delivery_company: (before as any).delivery_company,
      delivery_fee: (before as any).delivery_fee,
      discount: (before as any).discount,
      notes: (before as any).notes,
      total_price: (before as any).total_price,
    };

    for (const key of Object.keys(FIELD_LABELS)) {
      if (!(key in after)) continue;
      const oldV = beforeMap[key];
      const newV = (after as any)[key];
      if (norm(oldV) === norm(newV)) continue;
      // Skip status here — it's already tracked by order_history to avoid duplicates
      if (key === 'status') continue;
      entries.push({
        order_id: orderId,
        changed_by_user_id: currentUserId,
        changed_by: currentUserName || null,
        field: key,
        old_value: norm(oldV) || null,
        new_value: norm(newV) || null,
        label: `${FIELD_LABELS[key]}: ${fmt(oldV)} → ${fmt(newV)}`,
      });
    }

    // ---- Items diff ----
    const beforeItems = (before.order_items || []) as ItemLike[];
    const beforeById = new Map(beforeItems.filter(i => i.id).map(i => [i.id!, i]));
    const afterIds = new Set(afterItems.filter(i => i.id).map(i => i.id!));

    // Removed
    for (const b of beforeItems) {
      if (b.id && !afterIds.has(b.id)) {
        entries.push({
          order_id: orderId,
          changed_by_user_id: currentUserId,
          changed_by: currentUserName || null,
          field: 'items.remove',
          old_value: `${b.product_name} × ${b.quantity} @ ${b.unit_price}`,
          new_value: null,
          label: `– Produit retiré : ${b.product_name} (×${b.quantity} · ${b.unit_price} DA)`,
        });
      }
    }

    // Added / updated
    for (const a of afterItems) {
      if (!a.id) {
        entries.push({
          order_id: orderId,
          changed_by_user_id: currentUserId,
          changed_by: currentUserName || null,
          field: 'items.add',
          old_value: null,
          new_value: `${a.product_name} × ${a.quantity} @ ${a.unit_price}`,
          label: `+ Produit ajouté : ${a.product_name} (×${a.quantity} · ${a.unit_price} DA)`,
        });
        continue;
      }
      const b = beforeById.get(a.id);
      if (!b) continue;
      const changes: string[] = [];
      if (norm(b.product_name) !== norm(a.product_name))
        changes.push(`nom: ${fmt(b.product_name)} → ${fmt(a.product_name)}`);
      if (Number(b.quantity) !== Number(a.quantity))
        changes.push(`qté: ${b.quantity} → ${a.quantity}`);
      if (Number(b.unit_price) !== Number(a.unit_price))
        changes.push(`prix: ${b.unit_price} → ${a.unit_price} DA`);
      if (norm(b.variant) !== norm(a.variant))
        changes.push(`variante: ${fmt(b.variant)} → ${fmt(a.variant)}`);
      if (changes.length === 0) continue;
      entries.push({
        order_id: orderId,
        changed_by_user_id: currentUserId,
        changed_by: currentUserName || null,
        field: 'items.update',
        old_value: `${b.product_name} × ${b.quantity} @ ${b.unit_price}`,
        new_value: `${a.product_name} × ${a.quantity} @ ${a.unit_price}`,
        label: `✎ Produit modifié : ${a.product_name} — ${changes.join(', ')}`,
      });
    }

    if (entries.length === 0) return;

    // Cast to any because types.ts hasn't been regenerated yet with this table.
    const { error } = await (supabase as any)
      .from('order_edit_history')
      .insert(entries);

    if (error) {
      console.warn('[order_edit_history] insert failed:', error.message);
    }
  } catch (e) {
    console.warn('[order_edit_history] logging error:', e);
  }
}
