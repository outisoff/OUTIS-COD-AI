## Goal

Make the **Swap** flow on `/echange-remboursement` work **purely locally** — no calls to ZR Express. The Échange flow already works locally and stays as-is.

## Changes

### 1. `src/pages/EchangeRemboursement.tsx` — local swap handler

Replace `handleSwap` so it:
- Updates the order directly in the `orders` table with the new values from the form (`customer_name`, `customer_phone`, `total_price`, `delivery_type`, `wilaya`, `commune`, `customer_address`).
- Inserts a row in `order_history` with `changed_by: 'ZR Express Swap'` (kept as-is so `useSwappedOrders` continues to detect it) and a note like `Swap local — ancien client: X → nouveau: Y`.
- No call to `supabase.functions.invoke('zr-express-swap', …)`.
- On success: invalidate `['orders']`, `['orders-echange']`, `['orders-swapped']`, close dialog.

### 2. `src/pages/EchangeRemboursement.tsx` — relax swap button visibility

In the actions cell (currently line 422), drop the `delivery_company === 'ZR Express' && tracking_number && SWAP_ELIGIBLE_STATUSES.includes(...)` gate. Show the swap button on every row (still excluding already-exchanged/returned rows is implicit via the tab filter).

Also update the tooltip text from "Swap ZR Express (…)" → "Swap commande".

### 3. `src/pages/EchangeRemboursement.tsx` — dialog copy

- Chooser button: "Swap ZR Express d'une commande" → "Swap d'une commande".
- Swap dialog title: keep "Swap" (drop "ZR Express").
- Drop the description line mentioning "directement sur ZR Express" and the "Ne répond pas 3 / Annulée" requirement.
- Drop the ZR-specific warning paragraph (limite 2x, wilayas restreintes).
- Hide the "Tracking ZR" line in the summary when there is no `tracking_number`.

### 4. `src/hooks/useEchangeOrders.ts` — eligible list for new swap

In `useEligibleOrderSearch`, replace the `mode === 'swap'` branch:

```ts
if (mode === 'swap') {
  const excludeStatuses: OrderStatus[] = ['exchange', 'returned', 'new'];
  query = query.not('status', 'in', `(${excludeStatuses.join(',')})`);
} else { /* unchanged */ }
```

This lets any non-terminal order be picked for a local swap, regardless of carrier/tracking.

### 5. `src/pages/EchangeRemboursement.tsx` — eligible-orders filter

Remove the client-side filter block at lines 158–166 that restricts to `ZR Express + tracking_number + SWAP_ELIGIBLE_STATUSES`. Use `eligibleOrdersAll` directly. The constant `SWAP_ELIGIBLE_STATUSES` can be deleted.

## Out of scope / left untouched

- `supabase/functions/zr-express-swap/index.ts` stays on disk but is no longer called from the UI.
- "Échange" tab logic, "Retirer de l'échange", chat panel, WhatsApp indicator — unchanged.
- DB schema — no migration needed; we reuse `orders` + `order_history`.

## Verification

After build:
1. Open `/echange-remboursement` → tab **Swaps** loads existing swapped orders.
2. Click "Nouvelle commande" → "Swap" → any non-terminal order is selectable.
3. Submit swap form with new phone/amount → toast success, order updated in DB, new row appears in Swaps tab on refetch.
4. No network call to `zr-express-swap` edge function (check Network panel).
