import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { authenticateRequest } from '../_shared/auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase()
}

function buildKeywordVariants(input: string): string[] {
  const base = (input ?? "").trim()
  if (!base) return []
  const noAccents = removeAccents(base)
  const noSpecial = noAccents.replace(/['’`]/g, "")
  const hyphenated = noSpecial.replace(/\s+/g, "-")
  const spaced = noSpecial.replace(/[-_]+/g, " ")
  const collapsed = noSpecial.replace(/\s+/g, "")
  const variants = [base, noAccents, noSpecial, hyphenated, spaced, collapsed]
    .map((v) => v.trim())
    .filter(Boolean)
  return [...new Set(variants)]
}

function fuzzyKey(s: string): string {
  return removeAccents(String(s ?? ""))
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[-_\s]+/g, "")
}

async function searchTerritory(
  keyword: string,
  level: "wilaya" | "commune",
  apiKey: string,
  tenantId: string,
  parentId?: string
): Promise<{ id: string; name: string } | null> {
  const uniqueKeywords = buildKeywordVariants(keyword)
  const targetKey = fuzzyKey(keyword)

  for (const kw of uniqueKeywords) {
    const filters: any[] = [
      { field: "level", operator: "eq", value: level },
    ]
    if (parentId) {
      filters.push({ field: "parentId", operator: "eq", value: parentId })
    }

    const body: any = {
      advancedSearch: { fields: ["name"], keyword: kw },
      advancedFilter: { logic: "and", filters },
      pageNumber: 1,
      pageSize: 20,
    }

    const res = await fetch("https://api.zrexpress.app/api/v1/territories/search", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "X-Tenant": tenantId,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(body),
    })

    const text = await res.text()
    if (!res.ok) {
      console.error(`Territory search failed (${level}, "${kw}"):` , res.status, text)
      continue
    }

    try {
      const data = JSON.parse(text)
      const items = data?.items || []
      if (items.length > 0) {
        const exact = items.find((t: any) => fuzzyKey(t.name) === targetKey)
        if (exact) return exact
        const partial = items.find((t: any) => {
          const k = fuzzyKey(t.name)
          return k.includes(targetKey) || targetKey.includes(k)
        })
        if (partial) return partial
        return items[0]
      }
    } catch {
      console.error("Failed to parse territory response:", text)
    }
  }

  // Fallback: list all children of the parent and fuzzy-match locally
  if (parentId) {
    try {
      const res = await fetch("https://api.zrexpress.app/api/v1/territories/search", {
        method: "POST",
        headers: {
          "X-Api-Key": apiKey,
          "X-Tenant": tenantId,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          advancedFilter: {
            logic: "and",
            filters: [
              { field: "level", operator: "eq", value: level },
              { field: "parentId", operator: "eq", value: parentId },
            ],
          },
          pageNumber: 1,
          pageSize: 200,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const items = data?.items || []
        const exact = items.find((t: any) => fuzzyKey(t.name) === targetKey)
        if (exact) {
          console.log(`✅ Fallback exact match: "${keyword}" → "${exact.name}"`)
          return exact
        }
        const partial = items.find((t: any) => {
          const k = fuzzyKey(t.name)
          return k.includes(targetKey) || targetKey.includes(k)
        })
        if (partial) {
          console.log(`✅ Fallback partial match: "${keyword}" → "${partial.name}"`)
          return partial
        }
        console.warn(`Fallback found ${items.length} children but no match for "${keyword}" (key="${targetKey}")`)
      }
    } catch (e) {
      console.error("Fallback children listing failed:", e)
    }
  }

  return null
}

async function searchParcels(
  keyword: string,
  fields: string[],
  apiKey: string,
  tenantId: string,
): Promise<any[]> {
  if (!keyword) return []

  const res = await fetch("https://api.zrexpress.app/api/v1/parcels/search", {
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

  const text = await res.text()
  if (!res.ok) {
    console.warn(`Parcel search failed (${fields.join(",")}:${keyword}): ${res.status} ${text.substring(0, 200)}`)
    return []
  }

  try {
    const data = JSON.parse(text)
    if (Array.isArray(data)) return data
    if (Array.isArray(data?.items)) return data.items
    if (Array.isArray(data?.data)) return data.data
  } catch {
    console.warn(`Failed to parse parcel search response for ${keyword}`)
  }

  return []
}

async function fetchParcelById(
  parcelId: string,
  apiKey: string,
  tenantId: string,
): Promise<any | null> {
  if (!parcelId) return null

  const res = await fetch(`https://api.zrexpress.app/api/v1/parcels/${parcelId}`, {
    method: "GET",
    headers: {
      "X-Api-Key": apiKey,
      "X-Tenant": tenantId,
      "Accept": "application/json",
    },
  })

  const text = await res.text()
  if (!res.ok) {
    console.warn(`Failed to fetch parcel ${parcelId}: ${res.status} ${text.substring(0, 200)}`)
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    console.warn(`Failed to parse parcel ${parcelId}`)
    return null
  }
}

async function findRemoteParcel(
  externalId: string,
  trackingNumber: string | null,
  apiKey: string,
  tenantId: string,
): Promise<{ id: string; trackingNumber: string | null } | null> {
  if (trackingNumber) {
    const byTracking = await searchParcels(trackingNumber, ["trackingNumber"], apiKey, tenantId)
    const exactTracking = byTracking.find((parcel: any) => normalize(parcel?.trackingNumber) === normalize(trackingNumber))
    if (exactTracking?.id) {
      return {
        id: String(exactTracking.id),
        trackingNumber: exactTracking.trackingNumber || null,
      }
    }
  }

  const byExternalId = await searchParcels(externalId, ["externalId"], apiKey, tenantId)
  const exactExternalId = byExternalId.find((parcel: any) => normalize(parcel?.externalId) === normalize(externalId))
  if (exactExternalId?.id) {
    return {
      id: String(exactExternalId.id),
      trackingNumber: exactExternalId.trackingNumber || null,
    }
  }

  return null
}

async function resolveCreatedParcel(
  externalId: string,
  createdParcelId: string | null,
  apiKey: string,
  tenantId: string,
): Promise<{ id: string | null; trackingNumber: string | null }> {
  if (createdParcelId) {
    const parcel = await fetchParcelById(createdParcelId, apiKey, tenantId)
    if (parcel?.id) {
      return {
        id: String(parcel.id),
        trackingNumber: parcel.trackingNumber || null,
      }
    }
  }

  const remoteParcel = await findRemoteParcel(externalId, null, apiKey, tenantId)
  if (remoteParcel) {
    return remoteParcel
  }

  return {
    id: createdParcelId,
    trackingNumber: null,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const auth = await authenticateRequest(req, { requireRoles: ['admin', 'confirmateur', 'stock_manager'] })
  if (!auth.ok) return new Response(JSON.stringify({ error: auth.message }), { status: auth.status, headers: corsHeaders })

  let lockDeliveryId: string | null = null

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const { record } = await req.json()

    let order = record
    if (!order && req.method === 'POST') {
      return new Response(JSON.stringify({ error: "No order data provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const orderId = order.id
    const orderNumber = order.order_number || orderId
    const externalId = orderId || orderNumber || crypto.randomUUID()

    if (order.status !== 'preparing') {
      return new Response(JSON.stringify({ skipped: true, reason: "Status is not preparing" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: integration, error: intError } = await supabase
      .from("integrations")
      .select("*")
      .eq("integration_type", "delivery")
      .eq("name", "ZR Express")
      .eq("is_enabled", true)
      .maybeSingle()

    if (intError || !integration) {
      console.error("ZR Express integration not found or disabled:", intError)
      await supabase.from("alerts").insert({
        order_id: orderId,
        type: "error",
        message: `❌ Intégration ZR Express non trouvée ou désactivée — commande #${orderNumber}`,
      })
      return new Response(JSON.stringify({ error: "ZR Express integration not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const tenantId = integration.settings?.tenant_id || integration.api_key || ""
    const apiKey = integration.api_secret || ""

    const { data: currentOrder } = await supabase
      .from("orders")
      .select("tracking_number")
      .eq("id", orderId)
      .single()

    const remoteOrderParcel = await findRemoteParcel(externalId, currentOrder?.tracking_number || null, apiKey, tenantId)
    if (remoteOrderParcel?.trackingNumber) {
      if (currentOrder?.tracking_number !== remoteOrderParcel.trackingNumber) {
        await supabase.from("orders")
          .update({ tracking_number: remoteOrderParcel.trackingNumber, delivery_company: "ZR Express" })
          .eq("id", orderId)

        await supabase.from("deliveries")
          .update({
            tracking_number: remoteOrderParcel.trackingNumber,
            carrier: "zr_express",
            delivery_status: "preparing",
            last_update: new Date().toISOString(),
          })
          .eq("order_id", orderId)
      }

      console.log(`Order ${orderNumber} already exists remotely with tracking: ${remoteOrderParcel.trackingNumber}`)
      return new Response(JSON.stringify({
        skipped: true,
        reason: "Order already exists on ZR Express",
        tracking_number: remoteOrderParcel.trackingNumber,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (currentOrder?.tracking_number) {
      console.warn(`Order ${orderNumber} has stale local tracking ${currentOrder.tracking_number}, cleaning local ZR records before recreate`)
      await supabase.from("deliveries").delete().eq("order_id", orderId)
      await supabase.from("orders")
        .update({ tracking_number: null })
        .eq("id", orderId)
    }

    const { data: existingDeliveries, error: existingDeliveryError } = await supabase
      .from("deliveries")
      .select("id, tracking_number")
      .eq("order_id", orderId)
      .limit(1)

    if (existingDeliveryError) {
      console.error(`Error checking existing deliveries for ${orderId}:`, existingDeliveryError)
    }

    const existingDelivery = existingDeliveries?.[0]
    if (existingDelivery) {
      const existingTracking = existingDelivery.tracking_number || ""
      if (existingTracking.startsWith("ZR-LOCK-")) {
        return new Response(JSON.stringify({ skipped: true, reason: "Delivery creation already in progress" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      const remoteDeliveryParcel = await findRemoteParcel(externalId, existingTracking || null, apiKey, tenantId)
      if (remoteDeliveryParcel?.trackingNumber) {
        if (existingTracking !== remoteDeliveryParcel.trackingNumber) {
          await supabase.from("deliveries")
            .update({
              tracking_number: remoteDeliveryParcel.trackingNumber,
              carrier: "zr_express",
              delivery_status: "preparing",
              last_update: new Date().toISOString(),
            })
            .eq("id", existingDelivery.id)
        }

        return new Response(JSON.stringify({
          skipped: true,
          reason: "Delivery already exists",
          tracking_number: remoteDeliveryParcel.trackingNumber,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      console.warn(`Delivery ${existingDelivery.id} has stale local tracking ${existingTracking}, removing it before recreate`)
      await supabase.from("deliveries").delete().eq("id", existingDelivery.id)
    }

    const { data: orderItems } = await supabase
      .from("order_items")
      .select("product_name, quantity, unit_price, product_id")
      .eq("order_id", orderId)

    const productNames = orderItems?.map((item: any) =>
      item.quantity > 1 ? `${item.product_name} x${item.quantity}` : item.product_name
    ).join(", ") || "Colis"

    let phone = order.customer_phone || ""
    if (phone.startsWith("0")) {
      phone = "+213" + phone.substring(1)
    } else if (!phone.startsWith("+")) {
      phone = "+213" + phone
    }

    const wilayaParts = order.wilaya?.split(" - ") || []
    const wilayaName = wilayaParts.length > 1 ? wilayaParts.slice(1).join(" - ") : order.wilaya || ""
    const communeName = order.commune || ""

    console.log(`Searching territories: wilaya="${wilayaName}", commune="${communeName}"`)

    const wilayaTerritory = await searchTerritory(wilayaName, "wilaya", apiKey, tenantId)
    if (!wilayaTerritory) {
      const errMsg = `❌ Wilaya "${wilayaName}" introuvable sur ZR Express — commande #${orderNumber}`
      console.error(errMsg)
      await supabase.from("alerts").insert({ order_id: orderId, type: "error", message: errMsg })
      return new Response(JSON.stringify({ success: false, error: `Wilaya not found: ${wilayaName}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    let districtTerritory: { id: string; name: string } | null = null
    if (communeName) {
      districtTerritory = await searchTerritory(communeName, "commune", apiKey, tenantId, wilayaTerritory.id)
    }
    if (!districtTerritory) {
      districtTerritory = communeName
        ? await searchTerritory(communeName, "commune", apiKey, tenantId)
        : null
    }
    if (!districtTerritory) {
      const errMsg = `❌ Commune "${communeName}" introuvable sur ZR Express — commande #${orderNumber}`
      console.error(errMsg)
      await supabase.from("alerts").insert({ order_id: orderId, type: "error", message: errMsg })
      return new Response(JSON.stringify({ success: false, error: `Commune not found: ${communeName}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    console.log(`Resolved: wilaya=${wilayaTerritory.id} (${wilayaTerritory.name}), commune=${districtTerritory.id} (${districtTerritory.name})`)

    let hubId: string | null = null
    if (order.delivery_type === "stop_desk") {
      let hubSearchKeyword = communeName
      const addressStr = order.customer_address || ""
      const stopDeskMatch = addressStr.match(/Stop Desk:\s*(.+?)(?:\s*—|$)/i)
      if (stopDeskMatch) {
        hubSearchKeyword = stopDeskMatch[1].trim()
      }

      console.log(`Searching hub for stop_desk: "${hubSearchKeyword}"`)

      const hubSearchBody = {
        advancedSearch: { fields: ["name", "address.city"], keyword: removeAccents(hubSearchKeyword) },
        advancedFilter: {
          logic: "and",
          filters: [{ field: "isPickupPoint", operator: "eq", value: true }],
        },
        pageNumber: 1,
        pageSize: 10,
      }

      const hubRes = await fetch("https://api.zrexpress.app/api/v1/hubs/search", {
        method: "POST",
        headers: {
          "X-Api-Key": apiKey,
          "X-Tenant": tenantId,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(hubSearchBody),
      })

      if (hubRes.ok) {
        const hubText = await hubRes.text()
        try {
          const hubData = JSON.parse(hubText)
          const hubs = hubData?.items || []
          if (hubs.length > 0) {
            hubId = hubs[0].id
            console.log(`Found hub: ${hubs[0].name} (${hubId})`)
          } else {
            console.warn(`No hub found for "${hubSearchKeyword}", trying wilaya "${wilayaName}"`)
            const fallbackBody = {
              advancedSearch: { fields: ["name", "address.city"], keyword: removeAccents(wilayaName) },
              advancedFilter: {
                logic: "and",
                filters: [{ field: "isPickupPoint", operator: "eq", value: true }],
              },
              pageNumber: 1,
              pageSize: 10,
            }
            const fallbackRes = await fetch("https://api.zrexpress.app/api/v1/hubs/search", {
              method: "POST",
              headers: {
                "X-Api-Key": apiKey,
                "X-Tenant": tenantId,
                "Content-Type": "application/json",
                "Accept": "application/json",
              },
              body: JSON.stringify(fallbackBody),
            })
            if (fallbackRes.ok) {
              const fallbackText = await fallbackRes.text()
              const fallbackData = JSON.parse(fallbackText)
              const fallbackHubs = fallbackData?.items || []
              if (fallbackHubs.length > 0) {
                hubId = fallbackHubs[0].id
                console.log(`Fallback hub found: ${fallbackHubs[0].name} (${hubId})`)
              }
            } else {
              await fallbackRes.text()
            }
          }
        } catch (e) {
          console.error("Failed to parse hub response:", e)
        }
      } else {
        const errText = await hubRes.text()
        console.error("Hub search failed:", hubRes.status, errText)
      }

      if (!hubId) {
        const errMsg = `❌ Point de retrait introuvable pour "${hubSearchKeyword}" — commande #${orderNumber}`
        console.error(errMsg)
        await supabase.from("alerts").insert({ order_id: orderId, type: "error", message: errMsg })
        return new Response(JSON.stringify({ success: false, error: `Hub not found for stop_desk delivery` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }
    }

    const parcelData: Record<string, unknown> = {
      customer: {
        customerId: crypto.randomUUID(),
        name: order.customer_name,
        phone: { number1: phone },
      },
      deliveryAddress: {
        cityTerritoryId: wilayaTerritory.id,
        districtTerritoryId: districtTerritory.id,
        street: order.customer_address || "",
      },
      orderedProducts: orderItems?.map((item: any) => ({
        productName: item.product_name,
        unitPrice: Number(item.unit_price) || 0,
        quantity: item.quantity || 1,
        stockType: "none",
      })) || [{
        productName: productNames,
        unitPrice: Number(order.total_price) || 0,
        quantity: 1,
        stockType: "none",
      }],
      deliveryType: order.delivery_type === "stop_desk" ? "pickup-point" : "home",
      description: ([order.remarks, order.notes]
        .filter(Boolean)
        .map((s: string) => s.replace(/\[\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}\]/g, '').replace(/\[[^\]]*\]/g, '').trim())
        .filter(Boolean)
        .join(" | ") || "Colis").substring(0, 250),
      amount: Number(order.total_price) || 0,
      externalId,
    }

    if (hubId) {
      parcelData.hubId = hubId
    }

    const lockTrackingNumber = `ZR-LOCK-${orderId}`
    const { data: lockDelivery, error: lockError } = await supabase
      .from("deliveries")
      .insert({
        order_id: orderId,
        tracking_number: lockTrackingNumber,
        carrier: "zr_express",
        delivery_status: "preparing",
      })
      .select("id")
      .single()

    if (lockError) {
      if (lockError.code === "23505") {
        return new Response(JSON.stringify({ skipped: true, reason: "Delivery creation already in progress" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      console.error("Failed to acquire delivery lock:", lockError)
      return new Response(JSON.stringify({ success: false, error: "Failed to acquire delivery lock" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    lockDeliveryId = lockDelivery.id

    const requestBody = JSON.stringify(parcelData)
    console.log("Sending to ZR Express:", requestBody)

    const response = await fetch("https://api.zrexpress.app/api/v1/parcels", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "X-Tenant": tenantId,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: requestBody,
    })

    const responseText = await response.text()
    console.log("ZR Express response:", response.status, responseText)

    if (response.ok) {
      let data: any
      try {
        data = JSON.parse(responseText)
      } catch {
        console.error("Failed to parse response:", responseText)
        if (lockDeliveryId) {
          await supabase.from("deliveries").delete().eq("id", lockDeliveryId)
        }
        await supabase.from("alerts").insert({
          order_id: orderId,
          type: "error",
          message: `❌ Réponse invalide de ZR Express — commande #${orderNumber}`,
        })
        return new Response(JSON.stringify({ success: false, error: "Invalid response" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      const createdParcelId = typeof data?.id === "string" ? data.id : null
      const resolvedParcel = await resolveCreatedParcel(externalId, createdParcelId, apiKey, tenantId)
      const trackingNumber = resolvedParcel.trackingNumber?.trim() || null

      if (!trackingNumber) {
        console.error(`ZR Express create succeeded but tracking could not be resolved for order ${orderNumber}`)
        if (lockDeliveryId) {
          await supabase.from("deliveries").delete().eq("id", lockDeliveryId)
        }
        await supabase.from("alerts").insert({
          order_id: orderId,
          type: "error",
          message: `❌ ZR Express a répondu sans tracking exploitable — commande #${orderNumber}`,
        })
        return new Response(JSON.stringify({ success: false, error: "Tracking number could not be resolved" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      console.log(`ZR Express success, tracking: ${trackingNumber}, parcelId: ${resolvedParcel.id || createdParcelId || "unknown"}`)

      await supabase.from("deliveries")
        .update({
          tracking_number: trackingNumber,
          carrier: "zr_express",
          delivery_status: "preparing",
          last_update: new Date().toISOString(),
        })
        .eq("id", lockDeliveryId)

      await supabase.from("orders")
        .update({ tracking_number: trackingNumber, delivery_company: "ZR Express" })
        .eq("id", orderId)

      await supabase.from("alerts").insert({
        order_id: orderId,
        type: "success",
        message: `✅ Commande envoyée à ZR Express — Tracking: ${trackingNumber}`,
      })

      return new Response(JSON.stringify({ success: true, tracking_number: trackingNumber }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    } else if (response.status === 409) {
      console.warn("ZR Express 409 DuplicateExternalId for order:", orderNumber)

      if (lockDeliveryId) {
        await supabase.from("deliveries").delete().eq("id", lockDeliveryId)
      }

      const remoteParcel = await findRemoteParcel(externalId, currentOrder?.tracking_number || null, apiKey, tenantId)
      if (remoteParcel?.trackingNumber) {
        await supabase.from("deliveries").upsert({
          order_id: orderId,
          tracking_number: remoteParcel.trackingNumber,
          carrier: "zr_express",
          delivery_status: "preparing",
          last_update: new Date().toISOString(),
        }, { onConflict: "order_id" })

        await supabase.from("orders")
          .update({ tracking_number: remoteParcel.trackingNumber, delivery_company: "ZR Express" })
          .eq("id", orderId)

        return new Response(JSON.stringify({
          success: true,
          duplicate: true,
          tracking_number: remoteParcel.trackingNumber,
          message: "Commande déjà envoyée à ZR Express",
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      const { data: existingDel } = await supabase
        .from("deliveries")
        .select("tracking_number")
        .eq("order_id", orderId)
        .not("tracking_number", "like", "ZR-LOCK-%")
        .maybeSingle()

      if (existingDel?.tracking_number) {
        return new Response(JSON.stringify({ success: true, tracking_number: existingDel.tracking_number, message: "Commande déjà envoyée à ZR Express" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      await supabase.from("alerts").insert({
        order_id: orderId,
        type: "warning",
        message: `⚠️ Commande #${orderNumber} déjà existante sur ZR Express (duplicate impossible à réconcilier automatiquement)`,
      })
      return new Response(JSON.stringify({ success: false, error: "Duplicate ExternalId without recoverable parcel" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    } else {
      console.error("ZR Express API error:", response.status, responseText)
      if (lockDeliveryId) {
        await supabase.from("deliveries").delete().eq("id", lockDeliveryId)
      }
      await supabase.from("alerts").insert({
        order_id: orderId,
        type: "error",
        message: `❌ Échec envoi ZR Express (${response.status}) — commande #${orderNumber}: ${responseText.substring(0, 200)}`,
      })
      return new Response(JSON.stringify({ success: false, error: responseText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
  } catch (error) {
    console.error("zr-express-create-order error:", error)
    if (lockDeliveryId) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      )
      await supabase.from("deliveries").delete().eq("id", lockDeliveryId)
    }
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
