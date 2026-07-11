import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { getInternalSecret } from "../_shared/auth.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature, x-svix-id, x-svix-timestamp, x-svix-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" }

// Map ZR Express webhook status descriptions → app order_status
const STATUS_MAP: Record<string, { orderStatus: string; type: string; emoji: string }> = {
  "Créé":                    { orderStatus: "preparing",          type: "info",     emoji: "🆕" },
  // "Prêt à expédier" intentionally excluded — we don't want the webhook to auto-change ready → to_station
  "Pris en charge":          { orderStatus: "to_station",        type: "info",     emoji: "🔵" },
  "Vers wilaya":             { orderStatus: "at_station",        type: "info",     emoji: "🚚" },
  "Transféré":               { orderStatus: "at_station",        type: "info",     emoji: "🔄" },
  "Reçu au hub":             { orderStatus: "at_station",        type: "info",     emoji: "📍" },
  "Confirmé au bureau":      { orderStatus: "at_station",        type: "info",     emoji: "🟣" },
  "Confirmée au bureau":     { orderStatus: "at_station",        type: "info",     emoji: "🟣" },
  "Au bureau":               { orderStatus: "at_station",        type: "info",     emoji: "🟣" },
  "Dispatch dans une autre wilaya": { orderStatus: "at_station", type: "info",     emoji: "🔄" },
  "Dispatch dans la même wilaya":  { orderStatus: "at_station", type: "info",     emoji: "🔄" },
  "Sorti en livraison":      { orderStatus: "en_livraison",      type: "info",     emoji: "🟠" },
  "Sortie en livraison":     { orderStatus: "en_livraison",      type: "info",     emoji: "🟠" },
  "En cours de livraison":   { orderStatus: "en_livraison",      type: "info",     emoji: "🟠" },
  "Expédié":                 { orderStatus: "en_livraison",      type: "info",     emoji: "🔵" },
  "Livré":                   { orderStatus: "delivered",         type: "success",  emoji: "🟢" },
  "Encaissé":                { orderStatus: "delivered",         type: "success",  emoji: "💰" },
  "Encaissee":               { orderStatus: "delivered",         type: "success",  emoji: "💰" },
  "Tentative échouée":       { orderStatus: "Échec_de_livraison", type: "warning",  emoji: "🟡" },
  "Echec de livraison":      { orderStatus: "Échec_de_livraison", type: "error",    emoji: "🔴" },
  "Échec de livraison":      { orderStatus: "Échec_de_livraison", type: "error",    emoji: "🔴" },
  "Retourné":                { orderStatus: "Échec_de_livraison", type: "warning",  emoji: "↩️" },
  "Retour vers centre":      { orderStatus: "Échec_de_livraison", type: "warning",  emoji: "↩️" },
  "Retour reçu":             { orderStatus: "Échec_de_livraison", type: "warning",  emoji: "↩️" },
  "Récupéré par fournisseur": { orderStatus: "Échec_de_livraison", type: "warning", emoji: "↩️" },
  "Perdu":                   { orderStatus: "alerte",            type: "critical", emoji: "⚫" },
  "Commande annulée":        { orderStatus: "Échec_de_livraison", type: "error",    emoji: "🔴" },
}

// Bureau statuses where we check if parcel is at destination hub
const BUREAU_WEBHOOK_STATUSES = [
  "Confirmé au bureau", "Confirmée au bureau", "Au bureau", "Reçu au hub"
]

// Terminal statuses: don't overwrite these
const TERMINAL_STATUSES = ['delivered', 'delivered_paid', 'cancelled', 'erreur', 'returned']

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== "POST") return new Response("OK", { status: 200, headers: corsHeaders })

  // Instantiate supabase client per-request so missing env vars don't crash cold start
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  // Validate Svix webhook signature headers
  const svixId = req.headers.get('svix-id') || req.headers.get('x-svix-id')
  const svixTimestamp = req.headers.get('svix-timestamp') || req.headers.get('x-svix-timestamp')
  const svixSignature = req.headers.get('svix-signature') || req.headers.get('x-svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error('Missing Svix webhook signature headers')
    return new Response(JSON.stringify({ error: 'Missing webhook signature' }), { status: 401, headers: jsonHeaders })
  }

  // Validate timestamp is within 5 minutes to prevent replay attacks
  const timestampSeconds = parseInt(svixTimestamp, 10)
  const now = Math.floor(Date.now() / 1000)
  if (isNaN(timestampSeconds) || Math.abs(now - timestampSeconds) > 300) {
    console.error('Webhook timestamp too old or invalid:', svixTimestamp)
    return new Response(JSON.stringify({ error: 'Invalid webhook timestamp' }), { status: 401, headers: jsonHeaders })
  }

  // Read raw body for HMAC verification
  const rawBody = await req.text()

  // Verify HMAC-SHA256 signature per Svix spec:
  //   signed_content = `${svix_id}.${svix_timestamp}.${rawBody}`
  //   expected = base64( HMAC_SHA256(secret_bytes, signed_content) )
  //   svix-signature header is space-delimited list of `v1,<base64sig>` entries
  const signingSecretRaw = Deno.env.get('SVIX_WEBHOOK_SECRET')
  if (!signingSecretRaw) {
    console.error('SVIX_WEBHOOK_SECRET is not configured — rejecting webhook')
    return new Response(JSON.stringify({ error: 'Webhook not configured' }), { status: 503, headers: jsonHeaders })
  }
  try {
    // Svix secrets are typically formatted as `whsec_<base64>`
    const secretB64 = signingSecretRaw.startsWith('whsec_') ? signingSecretRaw.slice(6) : signingSecretRaw
    const secretBytes = Uint8Array.from(atob(secretB64), (c) => c.charCodeAt(0))
    const key = await crypto.subtle.importKey(
      'raw',
      secretBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`
    const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedContent))
    const expectedB64 = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))

    const provided = svixSignature.split(' ')
      .map((s) => s.trim())
      .filter((s) => s.startsWith('v1,'))
      .map((s) => s.slice(3))

    // Constant-time compare
    const timingSafeEqual = (a: string, b: string) => {
      if (a.length !== b.length) return false
      let diff = 0
      for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
      return diff === 0
    }
    const valid = provided.some((p) => timingSafeEqual(p, expectedB64))
    if (!valid) {
      console.error('Invalid Svix HMAC signature')
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401, headers: jsonHeaders })
    }
  } catch (err) {
    console.error('Signature verification failed:', err)
    return new Response(JSON.stringify({ error: 'Signature verification failed' }), { status: 401, headers: jsonHeaders })
  }

  // ZR Express uses Svix — data is inside req.body.data
  const body = JSON.parse(rawBody)
  const { tracking_number, status, situation, timestamp, updatedAt, created_at: eventCreatedAt } = body.data || {}

  // Check situation for "Commande annulée"
  const situationText = situation?.description || situation?.name || situation || null

  if (!tracking_number || !status) {
    return new Response("OK", { status: 200 })
  }

  // Use the real event timestamp from webhook payload
  const realEventTime = timestamp || updatedAt || eventCreatedAt || new Date().toISOString()

  console.log(`ZR webhook: tracking=${tracking_number}, status="${status}", eventTime=${realEventTime}, dataKeys=${Object.keys(body.data || {}).join(',')}`)

  // Find order by tracking_number in orders table (primary) or deliveries table (fallback)
  let orderId: string | null = null
  let currentStatus: string | null = null

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, order_number")
    .eq("tracking_number", tracking_number)
    .eq("delivery_company", "ZR Express")
    .maybeSingle()

  if (order) {
    orderId = order.id
    currentStatus = order.status
  } else {
    // Fallback: check deliveries table
    const { data: delivery } = await supabase
      .from("deliveries")
      .select("order_id")
      .eq("tracking_number", tracking_number)
      .maybeSingle()

    if (delivery) {
      orderId = delivery.order_id
      const { data: orderData } = await supabase
        .from("orders")
        .select("status, order_number")
        .eq("id", delivery.order_id)
        .single()
      currentStatus = orderData?.status || null
    }
  }

  if (!orderId) {
    console.warn(`No order found for tracking ${tracking_number}`)
    return new Response("OK", { status: 200 })
  }

  // Update delivery status in deliveries table
  await supabase
    .from("deliveries")
    .update({ 
      delivery_status: status, 
      last_update: realEventTime 
    })
    .eq("tracking_number", tracking_number)

  let info = STATUS_MAP[status]
  
  // Override: if situation contains "Commande annulée", force Échec_de_livraison
  if (situationText && typeof situationText === 'string' && situationText.toLowerCase().includes('commande annulée')) {
    info = { orderStatus: 'Échec_de_livraison', type: 'error', emoji: '🔴' }
    console.log(`🚫 Situation "Commande annulée" detected → Échec_de_livraison`)
  }
  
  if (!info) {
    console.warn(`Unknown ZR status: "${status}"`)
    return new Response("OK", { status: 200 })
  }

  // Don't overwrite terminal statuses
  if (currentStatus && TERMINAL_STATUSES.includes(currentStatus)) {
    console.log(`Skipping update: order is in terminal status "${currentStatus}"`)
    return new Response("OK", { status: 200 })
  }

  // Don't downgrade status (e.g. don't go from en_livraison back to to_station)
  const statusPriority: Record<string, number> = {
    preparing: 1, ready: 2, to_station: 3, at_station: 4,
    au_bureau: 5, en_livraison: 6, delivered: 7,
    'Échec_de_livraison': 6, returned: 7, alerte: 6,
  }
  const currentPriority = statusPriority[currentStatus || ''] || 0
  const newPriority = statusPriority[info.orderStatus] || 0
  
  if (newPriority < currentPriority && newPriority > 0) {
    console.log(`Skipping downgrade: ${currentStatus} (${currentPriority}) → ${info.orderStatus} (${newPriority})`)
    return new Response("OK", { status: 200 })
  }

  // Check if parcel is at destination hub for bureau statuses
  let finalStatus = info.orderStatus
  if (BUREAU_WEBHOOK_STATUSES.includes(status)) {
    try {
      // Get ZR Express integration for API access
      const { data: integration } = await supabase
        .from('integrations')
        .select('*')
        .eq('integration_type', 'delivery')
        .eq('name', 'ZR Express')
        .eq('is_enabled', true)
        .maybeSingle()

      if (integration) {
        const tenantId = integration.settings?.tenant_id || integration.api_key || ''
        const apiKey = integration.api_secret || ''
        const res = await fetch(`https://api.zrexpress.app/api/v1/parcels/${tracking_number}`, {
          method: 'GET',
          headers: {
            'X-Api-Key': apiKey,
            'X-Tenant': tenantId,
            'Accept': 'application/json',
          },
        })
        if (res.ok) {
          const parcel = await res.json()
          const destinationHubId = parcel?.deliveryAddress?.hubId
          const currentHubId = parcel?.lastLocationHubId
          if (destinationHubId && currentHubId && destinationHubId === currentHubId) {
            finalStatus = 'au_bureau'
            console.log(`📍 Parcel at destination hub: ${parcel?.deliveryAddress?.hubName}`)
          }
        } else {
          await res.text() // consume body
        }
      }
    } catch (err) {
      console.warn('Hub check failed, using default status:', err)
    }
  }

  // Update order status using attributed function (trigger will log with correct changed_by)
  const { error: rpcError } = await supabase.rpc('update_order_status_attributed', {
    _order_id: orderId,
    _status: finalStatus,
    _changed_by: 'ZR Express',
    _delivered_at: finalStatus === 'delivered' ? new Date().toISOString() : null,
  })
  if (rpcError) {
    console.error(`Failed to update order ${orderId}:`, rpcError.message)
    return new Response(JSON.stringify({ error: rpcError.message }), { status: 500, headers: jsonHeaders })
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
    body: JSON.stringify({ orderId, newStatus: finalStatus, trackingNumber: tracking_number }),
  }).catch(err => console.error('Tracking notification error:', err))

  // Create alert
  await supabase.from("alerts").insert({
    order_id: orderId,
    type: info.type,
    message: `${info.emoji} ${order?.order_number || tracking_number} — ${status}`
  })

  console.log(`✅ ${order?.order_number || tracking_number}: ${currentStatus} → ${finalStatus}`)

  return new Response(JSON.stringify({ received: true }), { status: 200, headers: jsonHeaders })
})
