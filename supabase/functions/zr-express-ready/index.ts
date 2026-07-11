import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

async function findPretAExpedierStateId(apiHeaders: Record<string, string>): Promise<string | null> {
  // Method 1: Try /api/v1/states/search
  try {
    const res = await fetch("https://api.zrexpress.app/api/v1/states/search", {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify({
        advancedSearch: { fields: ["name"], keyword: "pret_a_expedier" },
        pageNumber: 1,
        pageSize: 50,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      const items = data?.items || data || []
      console.log(`States search: ${JSON.stringify(items).substring(0, 500)}`)
      const match = Array.isArray(items) ? items.find((s: any) => s.name === "pret_a_expedier") : null
      if (match?.id) {
        console.log(`Found state via /states/search: ${match.id}`)
        return match.id
      }
      // If items exist, log all state names
      if (Array.isArray(items) && items.length > 0) {
        console.log(`Available states: ${items.map((s: any) => `${s.name}(${s.id})`).join(', ')}`)
      }
    } else {
      console.log(`/states/search returned ${res.status}: ${(await res.text()).substring(0, 200)}`)
    }
  } catch (e) {
    console.log(`/states/search error: ${e.message}`)
  }

  // Method 2: Try /api/v1/workflows/search to find workflow with states
  try {
    const res = await fetch("https://api.zrexpress.app/api/v1/workflows/search", {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify({ pageNumber: 1, pageSize: 10 }),
    })
    if (res.ok) {
      const data = await res.json()
      const items = data?.items || data || []
      console.log(`Workflows search: ${JSON.stringify(items).substring(0, 1000)}`)
      for (const wf of (Array.isArray(items) ? items : [])) {
        const states = wf.states || wf.workflowStates || []
        for (const st of states) {
          if (st.name === "pret_a_expedier" || st.state?.name === "pret_a_expedier") {
            const id = st.stateId || st.state?.id || st.id
            console.log(`Found state via workflow: ${id}`)
            return id
          }
        }
      }
    } else {
      console.log(`/workflows/search returned ${res.status}: ${(await res.text()).substring(0, 200)}`)
    }
  } catch (e) {
    console.log(`/workflows/search error: ${e.message}`)
  }

  // Method 3: Search parcels with keyword "pret" in state
  try {
    const res = await fetch("https://api.zrexpress.app/api/v1/parcels/search", {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify({
        advancedSearch: { fields: ["state.name"], keyword: "pret" },
        pageNumber: 1,
        pageSize: 5,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      const items = data?.items || []
      console.log(`Parcel search by state keyword: ${items.length} results`)
      for (const p of items) {
        if (p.state?.name?.includes("pret") || p.state?.name?.includes("expedier")) {
          console.log(`Found state from parcel: ${p.state.name} = ${p.state.id}`)
          return p.state.id
        }
      }
    }
  } catch (e) {
    console.log(`Parcel state search error: ${e.message}`)
  }

  // Method 4: Try advanced filter with contains
  try {
    const res = await fetch("https://api.zrexpress.app/api/v1/parcels/search", {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify({
        advancedFilter: {
          logic: "and",
          filters: [{ field: "state.name", operator: "contains", value: "pret" }]
        },
        pageNumber: 1,
        pageSize: 5,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      const items = data?.items || []
      console.log(`Parcel filter contains 'pret': ${items.length} results`)
      for (const p of items) {
        if (p.state?.id) {
          console.log(`Found state: ${p.state.name} = ${p.state.id}`)
          return p.state.id
        }
      }
    }
  } catch (e) {
    console.log(`Parcel filter error: ${e.message}`)
  }

  return null
}

async function findParcel(orderId: string, orderNumber: string, trackingNumber: string | null, apiHeaders: Record<string, string>): Promise<string | null> {
  const externalIdCandidates = [orderId, orderNumber].filter(Boolean)

  for (const externalId of externalIdCandidates) {
    const searchRes = await fetch("https://api.zrexpress.app/api/v1/parcels/search", {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify({
        advancedSearch: { fields: ["externalId"], keyword: externalId },
        pageNumber: 1,
        pageSize: 5,
      }),
    })

    if (searchRes.ok) {
      const data = await searchRes.json()
      const items = data?.items || []
      const match = items.find((p: any) => (p.externalId || "") === externalId) || items[0]
      if (match) {
        console.log(`Found parcel by externalId (${externalId}): ${match.id}, tracking=${match.trackingNumber}`)
        return match.id
      }
    }
  }

  if (trackingNumber) {
    const res = await fetch("https://api.zrexpress.app/api/v1/parcels/search", {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify({
        advancedSearch: { fields: ["trackingNumber"], keyword: trackingNumber },
        pageNumber: 1,
        pageSize: 5,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      const items = data?.items || []
      if (items.length > 0) {
        console.log(`Found parcel by tracking: ${items[0].id}`)
        return items[0].id
      }
    }
  }

  return null
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
      return new Response(JSON.stringify({ error: "No record" }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const orderId = record.id
    const orderNumber = record.order_number || orderId

    if (record.delivery_company !== 'ZR Express') {
      return new Response(JSON.stringify({ skipped: true, reason: "Not ZR Express" }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('integration_type', 'delivery')
      .eq('name', 'ZR Express')
      .eq('is_enabled', true)
      .maybeSingle()

    if (!integration) {
      return new Response(JSON.stringify({ error: "ZR Express non configuré" }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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

    // Step 1: Find the parcel
    const parcelId = await findParcel(orderId, orderNumber, record.tracking_number, apiHeaders)
    if (!parcelId) {
      return new Response(JSON.stringify({ success: false, error: "Parcel not found" }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Step 2: Find the pret_a_expedier state UUID
    const targetStateId = await findPretAExpedierStateId(apiHeaders)

    if (!targetStateId) {
      console.error(`Cannot find UUID for pret_a_expedier state.`)
      return new Response(JSON.stringify({ success: false, error: "pret_a_expedier state UUID not found" }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Step 3: Update parcel state
    console.log(`Updating parcel ${parcelId} → newStateId=${targetStateId}`)

    const res = await fetch(`https://api.zrexpress.app/api/v1/parcels/${parcelId}/state`, {
      method: 'PATCH',
      headers: apiHeaders,
      body: JSON.stringify({ parcelId, newStateId: targetStateId }),
    })

    const responseText = await res.text()
    console.log(`State update response: ${res.status} ${responseText.substring(0, 500)}`)

    if (res.ok) {
      await supabase.from('alerts').insert({
        order_id: orderId,
        type: 'success',
        message: `📦 Commande #${orderNumber} marquée "Prêt à expédier" sur ZR Express`,
      })
      return new Response(JSON.stringify({ success: true, parcel_id: parcelId }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } else {
      console.error(`State update failed: ${res.status} ${responseText}`)
      return new Response(JSON.stringify({ success: false, error: responseText }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  } catch (error) {
    console.error('zr-express-ready error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
