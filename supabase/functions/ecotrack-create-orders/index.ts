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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

    // Auth check
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Token invalide' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = claimsData.claims.sub as string
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Role check
    const { data: roleData } = await supabase.rpc('get_user_role', { _user_id: userId })
    if (!roleData || !['admin', 'stock_manager', 'confirmateur'].includes(roleData)) {
      return new Response(JSON.stringify({ error: 'Droits insuffisants' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { order_ids } = body

    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return new Response(JSON.stringify({ error: 'order_ids (array) requis' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (order_ids.length > 100) {
      return new Response(JSON.stringify({ error: 'Maximum 100 commandes par requête' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get RJ360 integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('api_key, store_url')
      .eq('integration_type', 'delivery')
      .eq('name', 'RJ360')
      .eq('is_enabled', true)
      .maybeSingle()

    if (!integration) {
      return new Response(JSON.stringify({ error: 'Intégration RJ360 non configurée' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const BASE_URL = (integration.store_url || 'https://rj360express.ecotrack.dz').replace(/\/+$/, '').trim()
    const apiToken = integration.api_key || ''

    // Fetch all orders with their items
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*, order_items(product_name, quantity)')
      .in('id', order_ids)

    if (ordersError || !orders || orders.length === 0) {
      return new Response(JSON.stringify({ error: 'Commandes non trouvées' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check for already-delivered orders
    const existingDeliveries = await supabase
      .from('deliveries')
      .select('order_id')
      .in('order_id', order_ids)

    const alreadyShipped = new Set((existingDeliveries.data || []).map(d => d.order_id))

    // Build bulk orders payload per RJ360 API format
    const ordersPayload: Record<string, any> = {}
    const orderMap: Record<string, any> = {} // reference -> order
    let index = 0

    for (const order of orders) {
      if (alreadyShipped.has(order.id)) continue

      // Format phone
      let phone = order.customer_phone || ''
      if (phone.startsWith('+213')) phone = '0' + phone.substring(4)
      else if (!phone.startsWith('0') && phone.length <= 9) phone = '0' + phone

      // Extract wilaya code
      const wilayaParts = order.wilaya?.split(' - ') || []
      let wilayaCode = wilayaParts[0]?.trim() || ''
      const wilayaNum = parseInt(wilayaCode, 10)
      if (isNaN(wilayaNum) || wilayaNum < 1 || wilayaNum > 58) wilayaCode = ''

      // Product names
      const productNames = (order.order_items || [])
        .map((item: any) => item.quantity > 1 ? `${item.product_name} x${item.quantity}` : item.product_name)
        .join(', ') || 'Colis'

      // Clean remarks
      const remarque = ([order.remarks, order.notes]
        .filter(Boolean)
        .map((s: string) => s.replace(/\[\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}\]/g, '').replace(/\[[^\]]*\]/g, '').trim())
        .filter(Boolean)
        .join(' | ') || ''
      ).substring(0, 255)

      const reference = order.order_number || order.id

      ordersPayload[String(index)] = {
        reference,
        nom_client: order.customer_name || '',
        telephone: phone,
        telephone_2: '',
        adresse: order.customer_address || '',
        code_postal: '',
        commune: order.commune || '',
        code_wilaya: wilayaCode,
        montant: String(Number(order.total_price) || 0),
        remarque,
        produit: productNames.substring(0, 255),
        stock: 0,
        quantite: '',
        produit_a_recuperer: '',
        boutique: '',
        type: '1', // Livraison
        stop_desk: order.delivery_type === 'stop_desk' ? 1 : 0,
        weight: '',
      }

      orderMap[reference] = order
      index++
    }

    if (index === 0) {
      return new Response(JSON.stringify({ success: true, message: 'Toutes les commandes sont déjà expédiées', results: {} }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`RJ360 bulk create: ${index} orders`)

    // Call RJ360 bulk create API
    const response = await fetch(`${BASE_URL}/api/v1/create/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ orders: ordersPayload }),
    })

    const responseText = await response.text()
    console.log(`RJ360 bulk create response: ${response.status} (${responseText.length} chars)`)

    let data: any
    try { data = JSON.parse(responseText) } catch { data = { raw: responseText } }

    // Process results
    const results: Record<string, { success: boolean; tracking?: string; errors?: any }> = {}
    const apiResults = data.results || data

    let successCount = 0
    let errorCount = 0

    for (const [reference, result] of Object.entries(apiResults as Record<string, any>)) {
      const order = orderMap[reference]
      if (!order) continue

      if (result.success && result.tracking) {
        // Success - create delivery record and update order
        const trackingNumber = result.tracking

        await supabase.from('deliveries').insert({
          order_id: order.id,
          tracking_number: trackingNumber,
          carrier: 'rj360',
          delivery_status: 'preparing',
        })

        await supabase.from('orders')
          .update({
            tracking_number: trackingNumber,
            delivery_company: 'RJ360',
            status: 'preparing',
          })
          .eq('id', order.id)

        await supabase.from('order_history').insert({
          order_id: order.id,
          old_status: order.status,
          new_status: 'preparing',
          notes: `Import en masse RJ360 — Tracking: ${trackingNumber}`,
          changed_by_user_id: userId,
        })

        await supabase.from('alerts').insert({
          order_id: order.id,
          type: 'success',
          message: `✅ Commande envoyée à RJ360 (masse) — Tracking: ${trackingNumber}`,
        })

        results[reference] = { success: true, tracking: trackingNumber }
        successCount++
      } else {
        // Error
        const errors = result.success === undefined ? result : result.errors || result.message
        
        await supabase.from('alerts').insert({
          order_id: order.id,
          type: 'error',
          message: `❌ Erreur RJ360 (masse) — #${reference}: ${JSON.stringify(errors).substring(0, 200)}`,
        })

        results[reference] = { success: false, errors }
        errorCount++
      }
    }

    const message = `Import en masse: ${successCount} succès, ${errorCount} erreur(s) sur ${index} commande(s)`
    console.log(message)

    return new Response(JSON.stringify({ success: true, message, results, successCount, errorCount }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('ecotrack-create-orders error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
