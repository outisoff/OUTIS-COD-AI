import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { getInternalSecret } from "../_shared/auth.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" }

// Mapping RJ360 statuses to platform order statuses
const STATUS_MAP: Record<string, { type: string; orderStatus: string; emoji: string }> = {
  "prete_a_expedier":       { type: "info",     orderStatus: "preparing",          emoji: "📦" },
  "en_ramassage":           { type: "info",     orderStatus: "to_station",         emoji: "🚚" },
  "en_preparation_stock":   { type: "info",     orderStatus: "preparing",          emoji: "📋" },
  "vers_hub":               { type: "info",     orderStatus: "to_station",         emoji: "🔵" },
  "en_hub":                 { type: "info",     orderStatus: "at_station",         emoji: "🟣" },
  "vers_wilaya":            { type: "info",     orderStatus: "to_station",         emoji: "🔵" },
  "en_preparation":         { type: "info",     orderStatus: "au_bureau",          emoji: "🟣" },
  "en_livraison":           { type: "info",     orderStatus: "en_livraison",       emoji: "🟠" },
  "suspendu":               { type: "warning",  orderStatus: "alerte",             emoji: "🟡" },
  "livre_non_encaisse":     { type: "success",  orderStatus: "delivered",          emoji: "🟢" },
  "encaisse_non_paye":      { type: "success",  orderStatus: "delivered",          emoji: "🟢" },
  "paiements_prets":        { type: "success",  orderStatus: "delivered",          emoji: "💰" },
  "paye_et_archive":        { type: "success",  orderStatus: "delivered",          emoji: "✅" },
  "retour_chez_livreur":    { type: "warning",  orderStatus: "Échec_de_livraison", emoji: "🔴" },
  "retour_transit_entrepot":{ type: "warning",  orderStatus: "Échec_de_livraison", emoji: "🔴" },
  "retour_en_traitement":   { type: "warning",  orderStatus: "Échec_de_livraison", emoji: "🔴" },
  "retour_recu":            { type: "error",    orderStatus: "Échec_de_livraison", emoji: "🔴" },
  "retour_archive":         { type: "error",    orderStatus: "Échec_de_livraison", emoji: "⚫" },
  "annule":                 { type: "error",    orderStatus: "cancelled",          emoji: "❌" },
}

// Also handle RJ360 activity-based tracking events
const ACTIVITY_MAP: Record<string, { type: string; orderStatus: string; emoji: string }> = {
  "order_information_received_by_carrier": { type: "info",    orderStatus: "preparing",          emoji: "🆕" },
  "picked":                                { type: "info",    orderStatus: "to_station",         emoji: "🔵" },
  "accepted_by_carrier":                   { type: "info",    orderStatus: "at_station",         emoji: "🟣" },
  "dispatched_to_driver":                  { type: "info",    orderStatus: "en_livraison",       emoji: "🟠" },
  "attempt_delivery":                      { type: "warning", orderStatus: "alerte",             emoji: "🟡" },
  "return_asked":                          { type: "warning", orderStatus: "Échec_de_livraison", emoji: "🔴" },
  "return_in_transit":                     { type: "warning", orderStatus: "Échec_de_livraison", emoji: "🔴" },
  "Return_received":                       { type: "error",   orderStatus: "Échec_de_livraison", emoji: "🔴" },
  "livred":                                { type: "success", orderStatus: "delivered",          emoji: "🟢" },
  "encaissed":                             { type: "success", orderStatus: "delivered",          emoji: "💰" },
  "payed":                                 { type: "success", orderStatus: "delivered",          emoji: "✅" },
}

// Terminal app statuses we must not overwrite from a webhook
const TERMINAL_APP_STATUSES = ['delivered', 'delivered_paid', 'cancelled', 'erreur', 'returned']

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response("OK", { status: 200, headers: corsHeaders })
  }

  // Validate webhook shared secret to prevent impersonation.
  const expectedSecret = Deno.env.get("ECOTRACK_WEBHOOK_SECRET")
  if (expectedSecret) {
    const url = new URL(req.url)
    const providedSecret =
      url.searchParams.get("secret") ||
      req.headers.get("x-webhook-secret") ||
      req.headers.get("X-Webhook-Secret")

    if (providedSecret !== expectedSecret) {
      console.warn("ecotrack-webhook: invalid or missing secret")
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: jsonHeaders,
      })
    }
  } else {
    console.error("ecotrack-webhook: ECOTRACK_WEBHOOK_SECRET is not configured — rejecting request")
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
      status: 503,
      headers: jsonHeaders,
    })
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  try {
    const body = await req.json()
    console.log("RJ360 webhook received:", JSON.stringify(body).substring(0, 500))

    const tracking = body.tracking || body.Tracking || body.tracking_number || ""
    const status = body.status || body.Status || ""
    const activity = body.activity || body.Activity || ""

    if (!tracking) {
      console.log("No tracking number in webhook payload")
      return new Response("OK", { status: 200, headers: corsHeaders })
    }

    const { data: delivery } = await supabase
      .from("deliveries")
      .select("order_id")
      .eq("tracking_number", tracking)
      .maybeSingle()

    if (!delivery) {
      console.log(`No delivery found for tracking: ${tracking}`)
      return new Response("OK", { status: 200, headers: corsHeaders })
    }

    await supabase
      .from("deliveries")
      .update({
        delivery_status: status || activity,
        last_update: new Date().toISOString(),
      })
      .eq("tracking_number", tracking)

    const info = STATUS_MAP[status] || ACTIVITY_MAP[activity]
    if (!info) {
      console.log(`Unknown RJ360 status: "${status}" / activity: "${activity}"`)
      await supabase.from("alerts").insert({
        order_id: delivery.order_id,
        type: "info",
        message: `📬 RJ360 — ${tracking}: ${status || activity}`,
      })
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: jsonHeaders,
      })
    }

    if (info.orderStatus) {
      // Check current order status to avoid overwriting terminal states
      const { data: currentOrder } = await supabase
        .from("orders")
        .select("status")
        .eq("id", delivery.order_id)
        .maybeSingle()

      if (currentOrder && TERMINAL_APP_STATUSES.includes(currentOrder.status)) {
        console.log(`Skipping update for ${delivery.order_id} — terminal status "${currentOrder.status}"`)
      } else {
        // Use attributed RPC so order_history is logged with proper changed_by
        const { error: rpcError } = await supabase.rpc('update_order_status_attributed', {
          _order_id: delivery.order_id,
          _status: info.orderStatus,
          _changed_by: 'RJ360',
          _delivered_at: info.orderStatus === 'delivered' ? new Date().toISOString() : null,
        })

        if (rpcError) {
          console.error(`Failed to update order ${delivery.order_id}:`, rpcError.message)
          return new Response(JSON.stringify({ error: rpcError.message }), {
            status: 500,
            headers: jsonHeaders,
          })
        }

        // Send tracking notification (fire and forget)
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
        const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const _internalSecret = await getInternalSecret()
        fetch(`${SUPABASE_URL}/functions/v1/send-tracking-notification`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'x-internal-secret': _internalSecret || '',
          },
          body: JSON.stringify({ orderId: delivery.order_id, newStatus: info.orderStatus, trackingNumber: tracking }),
        }).catch(err => console.error('Tracking notification error:', err))
      }
    }

    await supabase.from("alerts").insert({
      order_id: delivery.order_id,
      type: info.type,
      message: `${info.emoji} RJ360 — ${tracking}: ${status || activity}`,
    })

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: jsonHeaders,
    })
  } catch (error) {
    console.error("rj360-webhook error:", error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: jsonHeaders,
    })
  }
})
