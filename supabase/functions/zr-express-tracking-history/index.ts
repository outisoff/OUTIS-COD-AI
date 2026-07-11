import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { tracking_number } = await req.json()

    if (!tracking_number) {
      return new Response(JSON.stringify({ error: 'tracking_number required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get ZR Express integration config
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('integration_type', 'delivery')
      .eq('name', 'ZR Express')
      .eq('is_enabled', true)
      .maybeSingle()

    if (!integration) {
      return new Response(JSON.stringify({ error: 'ZR Express non configuré' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const tenantId = integration.settings?.tenant_id || integration.api_key || ''
    const apiKey = integration.api_secret || ''
    const apiHeaders = {
      'X-Api-Key': apiKey,
      'X-Tenant': tenantId,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }

    // Fetch parcel details to get the parcel ID
    const parcelRes = await fetch(`https://api.zrexpress.app/api/v1/parcels/${tracking_number}`, {
      method: 'GET',
      headers: apiHeaders,
    })

    if (!parcelRes.ok) {
      return new Response(JSON.stringify({ error: `ZR API error: ${parcelRes.status}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const parcel = await parcelRes.json()
    const parcelId = parcel?.id

    // Try to fetch state history
    const historyEndpoints = [
      `https://api.zrexpress.app/api/v1/parcels/${parcelId}/state-history`,
      `https://api.zrexpress.app/api/v1/parcels/${parcelId}/history`,
      `https://api.zrexpress.app/api/v1/parcels/${parcelId}/states`,
      `https://api.zrexpress.app/api/v1/parcels/${tracking_number}/state-history`,
      `https://api.zrexpress.app/api/v1/parcels/${tracking_number}/history`,
    ]

    // Probe all endpoints in parallel — first valid one wins
    const probeResults = await Promise.all(
      historyEndpoints.map(async (endpoint) => {
        try {
          const res = await fetch(endpoint, { method: 'GET', headers: apiHeaders })
          if (!res.ok) return { endpoint, items: null }
          const data = await res.json()
          let items: any[] | null = null
          if (Array.isArray(data) && data.length > 0) items = data
          else if (data?.items && Array.isArray(data.items)) items = data.items
          else if (data?.data && Array.isArray(data.data)) items = data.data
          return { endpoint, items }
        } catch {
          return { endpoint, items: null }
        }
      })
    )

    const winner = probeResults.find(r => r.items && r.items.length > 0)
    const history = winner?.items ?? null
    const successEndpoint = winner?.endpoint ?? ''

    console.log(`History endpoint: ${successEndpoint || 'none found'}, items: ${history?.length || 0}`)
    if (history) {
      console.log(`Sample history item keys: ${Object.keys(history[0]).join(',')}`)
      console.log(`Sample item: ${JSON.stringify(history[0])}`)
    }

    return new Response(JSON.stringify({
      success: true,
      tracking_number,
      parcel_id: parcelId,
      current_state: parcel?.state,
      current_situation: parcel?.situation,
      history: history || [],
      parcel_summary: {
        createdAt: parcel?.createdAt,
        lastStateUpdateAt: parcel?.lastStateUpdateAt,
        lastSituationUpdateAt: parcel?.lastSituationUpdateAt,
        lastStateHistoryAt: parcel?.lastStateHistoryAt,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
