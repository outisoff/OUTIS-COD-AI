import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

    const { order_id } = await req.json()
    if (!order_id) {
      return new Response(JSON.stringify({ error: 'order_id requis' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('tracking_number, delivery_company, order_number')
      .eq('id', order_id)
      .single()

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'Commande non trouvée' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (order.delivery_company !== 'RJ360') {
      return new Response(JSON.stringify({ error: 'Commande non assignée à RJ360' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get the real RJ360 tracking from deliveries table (orders.tracking_number may be overwritten by other carriers)
    const { data: delivery } = await supabase
      .from('deliveries')
      .select('tracking_number')
      .eq('order_id', order_id)
      .eq('carrier', 'rj360')
      .maybeSingle()

    const tracking = delivery?.tracking_number || order.tracking_number
    if (!tracking) {
      return new Response(JSON.stringify({ error: 'Pas de numéro de suivi RJ360' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get RJ360 integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('integration_type', 'delivery')
      .eq('name', 'RJ360')
      .eq('is_enabled', true)
      .maybeSingle()

    if (!integration) {
      return new Response(JSON.stringify({ error: 'Intégration RJ360 non configurée' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiToken = integration.api_key || ''
    const BASE_URL = (integration.store_url || 'https://rj360express.ecotrack.dz').replace(/\/+$/, '').trim()
    // tracking already resolved above from deliveries table

    console.log(`Fetching RJ360 label for tracking: ${tracking}`)

    // RJ360 label endpoint returns PDF
    const response = await fetch(
      `${BASE_URL}/api/v1/get/order/label?api_token=${encodeURIComponent(apiToken)}&tracking=${encodeURIComponent(tracking)}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf, application/json',
        },
      }
    )

    const contentType = response.headers.get('Content-Type') || ''
    console.log(`RJ360 label response: ${response.status} ${contentType}`)

    if (response.ok) {
      if (contentType.includes('application/pdf') || contentType.includes('application/octet-stream')) {
        const pdfBuffer = await response.arrayBuffer()
        const bytes = new Uint8Array(pdfBuffer)
        // Encode to base64 properly using btoa on full binary string
        let binaryStr = ''
        for (let i = 0; i < bytes.length; i++) {
          binaryStr += String.fromCharCode(bytes[i])
        }
        const base64 = btoa(binaryStr)
        console.log(`Got PDF label (${bytes.length} bytes)`)
        return new Response(JSON.stringify({
          success: true, label_type: 'pdf', label_data: base64,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Non-PDF response
      const text = await response.text()
      console.log(`Non-PDF response: ${text.substring(0, 200)}`)
      return new Response(JSON.stringify({
        success: false, error: "Format de réponse inattendu", use_local: true,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    } else {
      const errText = await response.text()
      console.error(`RJ360 label error: ${response.status} ${errText}`)
      return new Response(JSON.stringify({
        success: false, error: `Erreur RJ360 (${response.status})`, use_local: true,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
  } catch (error) {
    console.error('rj360-label error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})