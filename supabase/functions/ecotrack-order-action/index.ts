import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const DEFAULT_BASE_URL = 'https://rj360express.ecotrack.dz'

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
    const { action, order_id, content, updates } = body

    if (!action || !order_id) {
      return new Response(JSON.stringify({ error: 'action et order_id requis' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, tracking_number, delivery_company, customer_name, customer_phone, customer_address, commune, wilaya, total_price, delivery_type, remarks, notes')
      .eq('id', order_id)
      .single()

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'Commande non trouvée' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (order.delivery_company !== 'RJ360' || !order.tracking_number) {
      return new Response(JSON.stringify({ error: 'Commande non assignée à RJ360 ou pas de tracking' }), {
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

    const BASE_URL = (integration.store_url || DEFAULT_BASE_URL).replace(/\/+$/, '').trim()

    const apiToken = integration.api_key || ''
    const tracking = order.tracking_number
    const headers = {
      'Authorization': `Bearer ${apiToken}`,
      'Accept': 'application/json',
    }

    let result: any

    switch (action) {
      // ====== Modifier une commande ======
      case 'modify': {
        if (!updates || typeof updates !== 'object') {
          return new Response(JSON.stringify({ error: 'updates requis pour modifier' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const params = new URLSearchParams({ tracking })
        // Map our field names to RJ360 API field names
        const fieldMap: Record<string, string> = {
          customer_name: 'client',
          customer_phone: 'tel',
          customer_address: 'adresse',
          commune: 'commune',
          wilaya: 'wilaya',
          total_price: 'montant',
          remarks: 'remarque',
          delivery_type: 'stop_desk',
        }

        for (const [key, value] of Object.entries(updates)) {
          const apiField = fieldMap[key]
          if (!apiField || value === undefined || value === null) continue
          
          if (key === 'delivery_type') {
            params.set('stop_desk', value === 'stop_desk' ? '1' : '0')
          } else if (key === 'wilaya') {
            const wilayaCode = String(value).split(' - ')[0]?.trim()
            params.set('wilaya', wilayaCode)
          } else {
            params.set(apiField, String(value))
          }
        }

        const modRes = await fetch(`${BASE_URL}/api/v1/update/order?${params.toString()}`, {
          method: 'POST', headers,
        })
        const modText = await modRes.text()
        console.log(`RJ360 modify response: ${modRes.status} ${modText}`)
        
        try { result = JSON.parse(modText) } catch { result = { message: modText } }

        if (result.success) {
          await supabase.from('alerts').insert({
            order_id: order.id, type: 'success',
            message: `✏️ Commande modifiée sur RJ360 — #${order.order_number} (${tracking})`,
          })
        }
        break
      }

      // ====== Ajouter une mise à jour de suivi ======
      case 'add_update': {
        if (!content || typeof content !== 'string') {
          return new Response(JSON.stringify({ error: 'content requis pour add_update' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const majRes = await fetch(
          `${BASE_URL}/api/v1/add/maj?tracking=${encodeURIComponent(tracking)}&content=${encodeURIComponent(content.substring(0, 255))}`,
          { method: 'POST', headers }
        )
        const majText = await majRes.text()
        console.log(`RJ360 add_update response: ${majRes.status} ${majText}`)
        
        try { result = JSON.parse(majText) } catch { result = { message: majText } }

        if (result.success) {
          await supabase.from('alerts').insert({
            order_id: order.id, type: 'info',
            message: `📝 MAJ envoyée à RJ360 — #${order.order_number}: ${content.substring(0, 100)}`,
          })
        }
        break
      }

      // ====== Récupérer l'historique de suivi ======
      case 'get_tracking': {
        const trkRes = await fetch(
          `${BASE_URL}/api/v1/get/tracking/info?tracking=${encodeURIComponent(tracking)}`,
          { method: 'GET', headers }
        )
        const trkText = await trkRes.text()
        console.log(`RJ360 get_tracking response: ${trkRes.status} ${trkText.substring(0, 300)}`)
        
        try { result = JSON.parse(trkText) } catch { result = { raw: trkText } }
        break
      }

      // ====== Récupérer les MAJ d'un colis ======
      case 'get_updates': {
        const majListRes = await fetch(
          `${BASE_URL}/api/v1/get/maj?tracking=${encodeURIComponent(tracking)}`,
          { method: 'GET', headers }
        )
        const majListText = await majListRes.text()
        console.log(`RJ360 get_updates response: ${majListRes.status} ${majListText.substring(0, 300)}`)
        
        try { result = JSON.parse(majListText) } catch { result = { raw: majListText } }
        break
      }

      // ====== Demander le retour d'un colis ======
      case 'request_return': {
        const retRes = await fetch(
          `${BASE_URL}/api/v1/ask/for/order/return?tracking=${encodeURIComponent(tracking)}`,
          { method: 'POST', headers }
        )
        const retText = await retRes.text()
        console.log(`RJ360 request_return response: ${retRes.status} ${retText}`)
        
        try { result = JSON.parse(retText) } catch { result = { message: retText } }

        if (result.success) {
          await supabase.from('alerts').insert({
            order_id: order.id, type: 'warning',
            message: `🔄 Demande de retour envoyée à RJ360 — #${order.order_number} (${tracking})`,
          })
        }
        break
      }

      // ====== Valider/Expédier une commande ======
      case 'validate': {
        const askCollection = body.ask_collection ? '1' : '0'
        const valRes = await fetch(
          `${BASE_URL}/api/v1/valid/order?tracking=${encodeURIComponent(tracking)}&ask_collection=${askCollection}`,
          { method: 'POST', headers }
        )
        const valText = await valRes.text()
        console.log(`RJ360 validate response: ${valRes.status} ${valText}`)
        
        try { result = JSON.parse(valText) } catch { result = { message: valText } }

        if (result.success) {
          await supabase.from('alerts').insert({
            order_id: order.id, type: 'success',
            message: `🚀 Commande validée/expédiée sur RJ360 — #${order.order_number} (${tracking})`,
          })
        }
        break
      }

      default:
        return new Response(JSON.stringify({ error: `Action inconnue: ${action}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    return new Response(JSON.stringify({ success: true, action, tracking, result }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('ecotrack-order-action error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})