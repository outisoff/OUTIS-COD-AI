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

    // Optional wilaya_id filter from query params or body
    let wilayaId = ''
    try {
      const url = new URL(req.url)
      wilayaId = url.searchParams.get('wilaya_id') || ''
    } catch { /* ignore */ }

    if (!wilayaId && req.method === 'POST') {
      try {
        const body = await req.json()
        wilayaId = body.wilaya_id || ''
      } catch { /* ignore */ }
    }

    const queryParam = wilayaId ? `?wilaya_id=${encodeURIComponent(wilayaId)}` : ''
    
    const response = await fetch(`${BASE_URL}/api/v1/get/communes${queryParam}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Accept': 'application/json',
      },
    })

    const responseText = await response.text()
    console.log(`RJ360 get/communes response: ${response.status} (${responseText.length} chars)`)

    let data: any
    try { data = JSON.parse(responseText) } catch { data = { raw: responseText } }

    return new Response(JSON.stringify({ success: true, communes: data }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('ecotrack-get-communes error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
