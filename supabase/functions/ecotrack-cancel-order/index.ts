import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { authenticateRequest } from '../_shared/auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const auth = await authenticateRequest(req, { requireRoles: ['admin', 'confirmateur', 'stock_manager'] })
  if (!auth.ok) return new Response(JSON.stringify({ error: auth.message }), { status: auth.status, headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const { record } = await req.json()
    if (!record) {
      return new Response(JSON.stringify({ error: "No order data" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const orderId = record.id
    const orderNumber = record.order_number || orderId

    // Find the delivery record
    const { data: delivery } = await supabase
      .from("deliveries")
      .select("id, tracking_number, carrier")
      .eq("order_id", orderId)
      .maybeSingle()

    if (!delivery || !delivery.tracking_number) {
      console.log(`No delivery/tracking found for order ${orderId}, skipping cancel`)
      return new Response(JSON.stringify({ skipped: true, reason: "No delivery record" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Only cancel if carrier is rj360
    if (delivery.carrier !== "rj360") {
      console.log(`Carrier is ${delivery.carrier}, not rj360. Skipping.`)
      return new Response(JSON.stringify({ skipped: true, reason: "Not RJ360" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Get RJ360 integration credentials
    const { data: integration } = await supabase
      .from("integrations")
      .select("*")
      .eq("integration_type", "delivery")
      .eq("name", "RJ360")
      .eq("is_enabled", true)
      .maybeSingle()

    if (!integration) {
      console.error("RJ360 integration not found or disabled")
      return new Response(JSON.stringify({ error: "Integration not configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const apiToken = integration.api_key || ""
    const BASE_URL = (integration.store_url || "https://rj360express.ecotrack.dz").replace(/\/+$/, '').trim()
    const tracking = delivery.tracking_number

    console.log(`Cancelling RJ360 order: ${tracking} for order #${orderNumber}`)

    const response = await fetch(
      `${BASE_URL}/api/v1/delete/order?api_token=${encodeURIComponent(apiToken)}&tracking=${encodeURIComponent(tracking)}`,
      {
        method: "DELETE",
        headers: {
          "Accept": "application/json",
        },
      }
    )

    const responseText = await response.text()
    console.log(`RJ360 cancel response: ${response.status} ${responseText}`)

    let data: any = {}
    try { data = JSON.parse(responseText) } catch {}

    if (response.ok && data.success !== false) {
      await supabase.from("deliveries").delete().eq("id", delivery.id)
      await supabase.from("orders").update({ tracking_number: null }).eq("id", orderId)

      await supabase.from("alerts").insert({
        order_id: orderId,
        type: "info",
        message: `🗑️ Colis supprimé de RJ360 — commande #${orderNumber} (${tracking})`,
      })

      return new Response(JSON.stringify({ success: true, cancelled: tracking }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    } else {
      const errMsg = data.message || responseText.substring(0, 150)
      console.error(`RJ360 cancel failed: ${errMsg}`)
      await supabase.from("alerts").insert({
        order_id: orderId,
        type: "error",
        message: `❌ Échec suppression RJ360 (${response.status}) — commande #${orderNumber}: ${errMsg}`,
      })

      return new Response(JSON.stringify({ success: false, error: errMsg }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
  } catch (error) {
    console.error("rj360-cancel-order error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
