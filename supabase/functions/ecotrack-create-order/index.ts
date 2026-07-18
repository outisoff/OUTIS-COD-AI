import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const { record } = await req.json()

    if (!record) {
      return new Response(JSON.stringify({ error: "No order data provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const orderId = record.id
    const orderNumber = record.order_number || orderId

    if (record.status !== 'preparing') {
      return new Response(JSON.stringify({ skipped: true, reason: "Status is not preparing" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Check if delivery already exists
    const { data: existingDelivery } = await supabase
      .from("deliveries")
      .select("id")
      .eq("order_id", orderId)
      .maybeSingle()

    if (existingDelivery) {
      return new Response(JSON.stringify({ skipped: true, reason: "Delivery already exists" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Get RJ360 integration
    const { data: integration, error: intError } = await supabase
      .from("integrations")
      .select("*")
      .eq("integration_type", "delivery")
      .eq("name", "RJ360")
      .eq("is_enabled", true)
      .maybeSingle()

    if (intError || !integration) {
      console.error("RJ360 integration not found or disabled:", intError)
      await supabase.from("alerts").insert({
        order_id: orderId,
        type: "error",
        message: `❌ Intégration RJ360 non trouvée ou désactivée — commande #${orderNumber}`,
      })
      return new Response(JSON.stringify({ error: "RJ360 integration not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const apiToken = integration.api_key || ""
    const BASE_URL = (integration.store_url || "https://rj360express.ecotrack.dz").replace(/\/+$/, '').trim()

    // Fetch order items
    const { data: orderItems } = await supabase
      .from("order_items")
      .select("product_name, quantity, unit_price, product_id")
      .eq("order_id", orderId)

    const productNames = orderItems?.map((item: any) =>
      item.quantity > 1 ? `${item.product_name} x${item.quantity}` : item.product_name
    ).join(", ") || "Colis"

    // Format phone number — EcoTrack expects 9-10 digits local format
    let phone = record.customer_phone || ""
    if (phone.startsWith("+213")) {
      phone = "0" + phone.substring(4)
    } else if (!phone.startsWith("0") && phone.length <= 9) {
      phone = "0" + phone
    }

    // Extract wilaya code from format "16 - Alger" -> "16"
    const wilayaParts = record.wilaya?.split(" - ") || []
    let wilayaCode = wilayaParts[0]?.trim() || ""
    // Ensure it's a valid integer between 1 and 58
    const wilayaNum = parseInt(wilayaCode, 10)
    if (isNaN(wilayaNum) || wilayaNum < 1 || wilayaNum > 58) {
      wilayaCode = ""
    }
    
    const communeName = record.commune || ""

    // Clean description (strip bracketed metadata)
    const remarque = ([record.remarks, record.notes]
      .filter(Boolean)
      .map((s: string) => s.replace(/\[\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}\]/g, '').replace(/\[[^\]]*\]/g, '').trim())
      .filter(Boolean)
      .join(" | ") || ""
    ).substring(0, 255)

    // Build EcoTrack API query params per official docs:
    // POST /api/v1/create/order?api_token=&nom_client=&telephone=&adresse=&commune=&code_wilaya=&montant=&type=&...
    const params = new URLSearchParams({
      api_token: apiToken,
      reference: orderNumber,
      nom_client: record.customer_name || "",
      telephone: phone,
      telephone_2: "",
      adresse: record.customer_address || "",
      commune: communeName,
      code_wilaya: wilayaCode,
      montant: String(Number(record.total_price) || 0),
      remarque: remarque,
      produit: productNames.substring(0, 255),
      type: "1", // 1 = Livraison
      stop_desk: record.delivery_type === "stop_desk" ? "1" : "0",
      stock: "0",
    })

    const apiUrl = `${BASE_URL}/api/v1/create/order?${params.toString()}`
    console.log(`Sending to RJ360: POST ${BASE_URL}/api/v1/create/order (reference=${orderNumber}, wilaya=${wilayaCode}, commune=${communeName})`)

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Accept": "application/json",
      },
    })

    const responseText = await response.text()
    console.log("RJ360 response:", response.status, responseText)

    if (response.ok) {
      let data: any
      try {
        data = JSON.parse(responseText)
      } catch {
        console.error("Failed to parse RJ360 response:", responseText)
        await supabase.from("alerts").insert({
          order_id: orderId, type: "error",
          message: `❌ Réponse invalide de RJ360 — commande #${orderNumber}`,
        })
        return new Response(JSON.stringify({ success: false, error: "Invalid response" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      if (data.success === false) {
        const errorMsg = data.errors ? JSON.stringify(data.errors) : (data.message || "Erreur inconnue")
        console.error("RJ360 validation error:", errorMsg)
        await supabase.from("alerts").insert({
          order_id: orderId, type: "error",
          message: `❌ Erreur RJ360 — commande #${orderNumber}: ${String(errorMsg).substring(0, 200)}`,
        })
        return new Response(JSON.stringify({ success: false, error: errorMsg }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      const trackingNumber = data.tracking || data.Tracking || data.id || ""
      console.log("RJ360 success, tracking:", trackingNumber)

      if (trackingNumber) {
        await supabase.from("deliveries").insert({
          order_id: orderId,
          tracking_number: trackingNumber,
          carrier: "rj360",
          delivery_status: "preparing",
        })

        await supabase.from("orders")
          .update({ tracking_number: trackingNumber, delivery_company: "RJ360" })
          .eq("id", orderId)
      }

      await supabase.from("alerts").insert({
        order_id: orderId, type: "success",
        message: `✅ Commande envoyée à RJ360 — Tracking: ${trackingNumber || 'N/A'}`,
      })

      return new Response(JSON.stringify({ success: true, tracking_number: trackingNumber }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    } else {
      console.error("RJ360 API error:", response.status, responseText)
      
      // Try to parse error details
      let errorDetail = responseText.substring(0, 200)
      try {
        const errData = JSON.parse(responseText)
        if (errData.errors) {
          errorDetail = Object.entries(errData.errors).map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`).join(' | ')
        } else if (errData.message) {
          errorDetail = errData.message
        }
      } catch { /* use raw text */ }
      
      await supabase.from("alerts").insert({
        order_id: orderId, type: "error",
        message: `❌ Échec envoi RJ360 (${response.status}) — commande #${orderNumber}: ${errorDetail.substring(0, 200)}`,
      })
      return new Response(JSON.stringify({ success: false, error: errorDetail }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
  } catch (error) {
    console.error("ecotrack-create-order error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})