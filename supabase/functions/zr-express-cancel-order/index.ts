import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { authenticateRequest } from '../_shared/auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase()

async function searchParcels(
  keyword: string,
  fields: string[],
  apiKey: string,
  tenantId: string,
): Promise<any[]> {
  if (!keyword) return []

  const searchRes = await fetch("https://api.zrexpress.app/api/v1/parcels/search", {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
      "X-Tenant": tenantId,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      advancedSearch: { fields, keyword },
      pageNumber: 1,
      pageSize: 20,
    }),
  })

  if (!searchRes.ok) {
    const text = await searchRes.text()
    console.warn(`Parcel search failed (${fields.join(",")}:${keyword}): ${searchRes.status} ${text}`)
    return []
  }

  const data = await searchRes.json()
  return data?.items || []
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

    const { data: deliveries, error: deliveriesError } = await supabase
      .from("deliveries")
      .select("id, tracking_number, carrier")
      .eq("order_id", orderId)

    if (deliveriesError) {
      console.error(`Error loading deliveries for order ${orderId}:`, deliveriesError)
    }

    const zrDeliveries = (deliveries || []).filter((d: any) => !d.carrier || d.carrier === "zr_express")
    const trackingCandidates = Array.from(new Set(
      [record.tracking_number, ...zrDeliveries.map((d: any) => d.tracking_number)].filter(Boolean)
    )) as string[]

    // Get ZR Express integration credentials
    const { data: integration } = await supabase
      .from("integrations")
      .select("*")
      .eq("integration_type", "delivery")
      .eq("name", "ZR Express")
      .eq("is_enabled", true)
      .maybeSingle()

    if (!integration) {
      console.error("ZR Express integration not found or disabled")
      return new Response(JSON.stringify({ error: "Integration not configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const tenantId = integration.settings?.tenant_id || integration.api_key || ""
    const apiKey = integration.api_secret || ""

    console.log(`Cancelling ZR Express parcel(s) for order #${orderNumber}`)

    const parcelMap = new Map<string, { id: string; trackingNumber?: string }>()

    // Search by ExternalId first (new records use order id, older ones may use order number)
    for (const externalId of [orderId, orderNumber].filter(Boolean)) {
      const byExternalId = await searchParcels(externalId, ["externalId"], apiKey, tenantId)
      const normalizedExternalId = normalize(externalId)

      for (const parcel of byExternalId) {
        if (!parcel?.id) continue
        if (normalize(parcel.externalId) === normalizedExternalId) {
          parcelMap.set(parcel.id, { id: parcel.id, trackingNumber: parcel.trackingNumber })
        }
      }

      if (parcelMap.size === 0 && byExternalId.length === 1 && byExternalId[0]?.id) {
        parcelMap.set(byExternalId[0].id, { id: byExternalId[0].id, trackingNumber: byExternalId[0].trackingNumber })
      }
    }

    // Also search by all known tracking numbers (for safety)
    for (const tracking of trackingCandidates) {
      const byTracking = await searchParcels(tracking, ["trackingNumber"], apiKey, tenantId)
      const normalizedTracking = normalize(tracking)

      for (const parcel of byTracking) {
        if (!parcel?.id) continue
        if (normalize(parcel.trackingNumber) === normalizedTracking) {
          parcelMap.set(parcel.id, { id: parcel.id, trackingNumber: parcel.trackingNumber })
        }
      }

      if (byTracking.length === 1 && byTracking[0]?.id) {
        parcelMap.set(byTracking[0].id, { id: byTracking[0].id, trackingNumber: byTracking[0].trackingNumber })
      }
    }

    if (parcelMap.size === 0) {
      console.warn(`No remote parcel found for order #${orderNumber}, cleaning local data`)
      await supabase.from("deliveries").delete().eq("order_id", orderId)
      await supabase.from("orders").update({ tracking_number: null }).eq("id", orderId)
      await supabase.from("alerts").insert({
        order_id: orderId, type: "warning",
        message: `⚠️ Colis introuvable sur ZR Express — nettoyage local effectué pour #${orderNumber}`,
      })

      return new Response(JSON.stringify({ success: true, cleaned: true, reason: "Parcel not found on ZR Express, local cleanup done" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const deleteErrors: string[] = []
    let deletedCount = 0

    for (const [parcelUuid, parcel] of parcelMap.entries()) {
      const response = await fetch(`https://api.zrexpress.app/api/v1/parcels/${parcelUuid}`, {
        method: "DELETE",
        headers: {
          "X-Api-Key": apiKey,
          "X-Tenant": tenantId,
          "Accept": "application/json",
        },
      })

      const responseText = await response.text()
      console.log(`ZR Express cancel response (${parcelUuid}): ${response.status} ${responseText}`)

      // 404 means already removed remotely; treat as non-blocking
      if (response.ok || response.status === 204) {
        deletedCount += 1
        continue
      }

      if (response.status === 404) {
        continue
      }

      deleteErrors.push(`${parcelUuid}: ${response.status} ${responseText}`)
      console.error(`ZR Express cancel failed for ${parcelUuid}: ${response.status} ${responseText}`)
    }

    if (deleteErrors.length > 0) {
      await supabase.from("alerts").insert({
        order_id: orderId,
        type: "error",
        message: `❌ Échec suppression ZR Express partiel — commande #${orderNumber}`,
      })

      return new Response(JSON.stringify({ success: false, errors: deleteErrors }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    await supabase.from("deliveries").delete().eq("order_id", orderId)
    await supabase.from("orders").update({ tracking_number: null }).eq("id", orderId)
    await supabase.from("alerts").insert({
      order_id: orderId,
      type: "info",
      message: `🗑️ ${deletedCount} colis supprimé(s) de ZR Express — commande #${orderNumber}`,
    })

    return new Response(JSON.stringify({ success: true, deleted_count: deletedCount }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("zr-express-cancel-order error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
