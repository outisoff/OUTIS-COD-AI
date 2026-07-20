## Goal

Every time someone edits an order (wilaya, commune, address, phone, price, delivery fee, discount, delivery company, delivery type, status, notes, products added/removed/modified…), record **who did it, what changed, and when**, and show these entries inside the existing **Historique Statut** popover on every commandes page (Orders, Confirmation, Tracking, Expedition, Paye/Retour, Echange).

## 1. Database (you run this SQL on Supabase)

New table `public.order_edit_history`:

```text
id            uuid pk
order_id      uuid  -> orders.id (on delete cascade)
changed_by_user_id uuid nullable
changed_by    text  nullable   -- fallback label (e.g. "IA", "Livreur: X")
field         text            -- 'wilaya', 'total_price', 'items.add', 'items.remove', 'items.update', 'delivery_company', ...
old_value     text nullable
new_value     text nullable
label         text nullable   -- pretty human summary shown in the UI
created_at    timestamptz default now()
```

+ GRANTs to `authenticated` / `service_role` + RLS: `authenticated` may `select` for orders they can already see; `insert` allowed when `auth.uid()` is the acting user (or via service_role from Edge Functions later).

I'll generate the SQL migration file `public/order-edit-history-migration.sql` for you to paste into the Supabase SQL editor.

## 2. Frontend helper

New `src/lib/orderEditHistory.ts` exporting `logOrderEdits(orderId, before, after, currentUserId)`:
- Diffs a whitelist of fields on the `orders` row.
- Diffs `order_items` arrays (added / removed / quantity or price changed / product renamed).
- Batches all diffs into a single `insert` into `order_edit_history` with a friendly `label` per row (e.g. `Wilaya: Alger → Oran`, `Prix total: 3200 → 3500 DA`, `+ Produit "T-Shirt XL" (x2 · 1500 DA)`).

## 3. EditOrderDialog

Before running the `update`, snapshot the incoming `order` (fields + items). After all updates succeed, call `logOrderEdits(...)`. Non-blocking: if logging fails, we `console.warn` and still show success toast. No behaviour change to the save flow itself.

## 4. StatusHistoryPopover

- Rename header to keep "Historique Statut" but the popover already merges data; add a second query for `order_edit_history` (enabled when open, same prefetch pattern).
- Merge both arrays into one timeline sorted by `created_at desc`. Status entries keep current bubble style; edit entries get a neutral slate style with a `Pencil` icon and show `label` as the text and the user chip already computed the same way (`changed_by_user_id` → `profileMap` / `roleMap`).
- Counter badge shows the combined count.

## 5. Coverage

Only `EditOrderDialog.onSubmit` writes multi-field edits from the UI. Quick inline status changes already flow through `order_history` (unchanged). Deletion of items via other flows (bulk ship, ecotrack sync) are intentionally out of scope — this feature covers manual edits from the commandes pages, which is what you asked for.

## Technical notes

- No changes to backend edge functions.
- No new dependencies.
- The popover is used by every commandes list, so a single edit here covers Orders, Confirmation, Tracking, Expedition, Paye/Retour, and Echange automatically.
- After running the SQL, regenerate `src/integrations/supabase/types.ts` (or I'll add a minimal manual type augmentation so TypeScript compiles until you regenerate).
