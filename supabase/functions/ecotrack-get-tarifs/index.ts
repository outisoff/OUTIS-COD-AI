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

    // Role check - admin only
    const { data: roleData } = await supabase.rpc('get_user_role', { _user_id: userId })
    if (roleData !== 'admin') {
      return new Response(JSON.stringify({ error: 'Droits insuffisants' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
    const apiHeaders = {
      'Authorization': `Bearer ${apiToken}`,
      'Accept': 'application/json',
    }

    // Step 1: Get fees from /api/v1/get/fees (structured with livraison array)
    console.log('Fetching fees from RJ360 /api/v1/get/fees...')
    const feesRes = await fetch(`${BASE_URL}/api/v1/get/fees`, {
      method: 'GET',
      headers: apiHeaders,
    })

    let feesData: any[] = []
    if (feesRes.ok) {
      const feesJson = await feesRes.json()
      feesData = Array.isArray(feesJson?.livraison) ? feesJson.livraison : 
                 Array.isArray(feesJson) ? feesJson : []
      console.log(`Got ${feesData.length} fee entries from /fees`)
    } else {
      console.log('fees endpoint failed, trying /tarifs fallback')
    }

    // Step 2: If fees empty, fallback to /api/v1/get/tarifs
    if (feesData.length === 0) {
      console.log('Fetching tarifs from RJ360 /api/v1/get/tarifs...')
      const tarifsRes = await fetch(`${BASE_URL}/api/v1/get/tarifs`, {
        method: 'GET',
        headers: apiHeaders,
      })

      if (tarifsRes.ok) {
        const tarifsJson = await tarifsRes.json()
        feesData = Array.isArray(tarifsJson) ? tarifsJson : Object.values(tarifsJson)
        console.log(`Got ${feesData.length} tarif entries from /tarifs`)
      }
    }

    // Step 3: Get wilayas for names
    const wilayasRes = await fetch(`${BASE_URL}/api/v1/get/wilayas`, {
      method: 'GET',
      headers: apiHeaders,
    })

    let wilayasMap: Record<string, string> = {}
    if (wilayasRes.ok) {
      const wilayas = await wilayasRes.json()
      if (Array.isArray(wilayas)) {
        for (const w of wilayas) {
          wilayasMap[String(w.wilaya_id)] = w.wilaya_name || ''
        }
      }
    }

    if (feesData.length === 0) {
      return new Response(JSON.stringify({ error: 'Aucun tarif retourné par RJ360' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Step 4: Build fee records
    const feeRecords: any[] = []
    
    for (const item of feesData) {
      const wilayaId = String(item.wilaya_id || item.IDWilaya || '')
      if (!wilayaId) continue

      const wilayaName = item.wilaya_name || wilayasMap[wilayaId] || ''

      feeRecords.push({
        delivery_company: 'RJ360',
        wilaya_code: wilayaId,
        wilaya_name: wilayaName,
        home_delivery_fee: item.tarif_domicile || item.home_fee || item.tarif || 0,
        stop_desk_fee: item.tarif_stopdesk || item.desk_fee || item.tarif_point_relais || 0,
        return_fee: item.tarif_retour || item.return_fee || item.retour || 0,
      })
    }

    // Delete existing RJ360 fees and insert fresh ones
    await supabase
      .from('delivery_company_fees')
      .delete()
      .eq('delivery_company', 'RJ360')

    const batchSize = 50
    let inserted = 0
    for (let i = 0; i < feeRecords.length; i += batchSize) {
      const batch = feeRecords.slice(i, i + batchSize)
      const { error: insertError } = await supabase
        .from('delivery_company_fees')
        .insert(batch)

      if (insertError) {
        console.error(`Error inserting batch ${i / batchSize + 1}:`, insertError)
      } else {
        inserted += batch.length
      }
    }

    const message = `${inserted} tarif(s) RJ360 importé(s)`
    console.log(message)

    return new Response(JSON.stringify({
      success: true,
      inserted,
      message,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('ecotrack-get-tarifs error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
