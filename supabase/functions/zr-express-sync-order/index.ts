import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

async function searchTerritory(
  keyword: string,
  level: "wilaya" | "commune",
  apiKey: string,
  tenantId: string,
  parentId?: string
): Promise<{ id: string; name: string } | null> {
  const keywords = [...new Set([keyword, removeAccents(keyword)])]

  for (const kw of keywords) {
    const filters: any[] = [{ field: "level", operator: "eq", value: level }]
    if (parentId) filters.push({ field: "parentId", operator: "eq", value: parentId })

    const res = await fetch("https://api.zrexpress.app/api/v1/territories/search", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "X-Tenant": tenantId,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        advancedSearch: { fields: ["name"], keyword: kw },
        advancedFilter: { logic: "and", filters },
        pageNumber: 1,
        pageSize: 10,
      }),
    })

    const text = await res.text()
    if (!res.ok) continue

    try {
      const data = JSON.parse(text)
      const items = data?.items || []
      if (items.length > 0) {
        const kwNorm = removeAccents(kw).toLowerCase()
        const exact = items.find((t: any) => removeAccents(t.name || "").toLowerCase() === kwNorm)
        return exact || items[0]
      }
    } catch { /* skip */ }
  }
  return null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
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

    const { data: roleData } = await supabase.rpc('get_user_role', { _user_id: userId })
    if (!roleData || !['admin', 'stock_manager', 'confirmateur'].includes(roleData)) {
      return new Response(JSON.stringify({ error: 'Droits insuffisants' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { action, order_id } = body

    // Get ZR Express integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('integration_type', 'delivery')
      .eq('name', 'ZR Express')
      .eq('is_enabled', true)
      .maybeSingle()

    if (!integration) {
      return new Response(JSON.stringify({ error: 'Intégration ZR Express non configurée' }), {
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

    // === ACTION: get_workflows ===
    if (action === 'get_workflows') {
      console.log('Fetching ZR Express workflows...')
      const res = await fetch('https://api.zrexpress.app/api/v1/workflows/search', {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({ pageNumber: 1, pageSize: 50 }),
      })

      const text = await res.text()
      if (!res.ok) {
        console.error('Workflows fetch failed:', res.status, text)
        return new Response(JSON.stringify({ error: `Échec: ${res.status}`, details: text }), {
          status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(text, {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // === ACTION: get_parcel (debug/inspect) ===
    if (action === 'get_parcel' && body.parcel_id) {
      const res = await fetch(`https://api.zrexpress.app/api/v1/parcels/${body.parcel_id}`, {
        method: 'GET',
        headers: apiHeaders,
      })
      const text = await res.text()
      return new Response(text, {
        status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // For all other actions, order_id is required
    if (!order_id) {
      return new Response(JSON.stringify({ error: 'order_id requis' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get order with tracking number
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', order_id)
      .single()

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'Commande non trouvée' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (order.delivery_company !== 'ZR Express' || !order.tracking_number) {
      return new Response(JSON.stringify({ success: true, skipped: true, message: 'Commande non ZR Express ou sans tracking, sync ignorée' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const parcelId = order.tracking_number
    const results: Record<string, any> = {}

    // === ACTION: update_total_amount ===
    if (action === 'sync_all' || action === 'update_total_amount') {
      const totalAmount = Number(order.total_price) || 0
      console.log(`Updating total amount for parcel ${parcelId}: ${totalAmount}`)

      const res = await fetch(`https://api.zrexpress.app/api/v1/parcels/${parcelId}/amount`, {
        method: 'PATCH',
        headers: apiHeaders,
        body: JSON.stringify({ amount: totalAmount }),
      })

      const text = await res.text()
      console.log(`Update amount response: ${res.status} ${text.substring(0, 300)}`)
      results.update_total_amount = { status: res.status, success: res.ok, response: text.substring(0, 300) }
    }

    // === ACTION: update_customer_infos ===
    if (action === 'sync_all' || action === 'update_customer_infos') {
      let phone = order.customer_phone || ''
      if (phone.startsWith('0')) {
        phone = '+213' + phone.substring(1)
      } else if (!phone.startsWith('+')) {
        phone = '+213' + phone
      }

      console.log(`Updating customer infos for parcel ${parcelId}: ${order.customer_name}, ${phone}`)

      const res = await fetch(`https://api.zrexpress.app/api/v1/parcels/${parcelId}/customer`, {
        method: 'PATCH',
        headers: apiHeaders,
        body: JSON.stringify({
          name: order.customer_name,
          phone: { number1: phone },
        }),
      })

      const text = await res.text()
      console.log(`Update customer response: ${res.status} ${text.substring(0, 300)}`)
      results.update_customer_infos = { status: res.status, success: res.ok, response: text.substring(0, 300) }
    }

    // === ACTION: update_delivery_address ===
    if (action === 'sync_all' || action === 'update_delivery_address') {
      const wilayaParts = order.wilaya?.split(' - ') || []
      const wilayaName = wilayaParts.length > 1 ? wilayaParts.slice(1).join(' - ') : order.wilaya || ''
      const communeName = order.commune || ''

      console.log(`Resolving territories for address update: wilaya="${wilayaName}", commune="${communeName}"`)

      const wilayaTerritory = await searchTerritory(wilayaName, 'wilaya', apiKey, tenantId)
      let districtTerritory: { id: string; name: string } | null = null

      if (communeName && wilayaTerritory) {
        districtTerritory = await searchTerritory(communeName, 'commune', apiKey, tenantId, wilayaTerritory.id)
        if (!districtTerritory) {
          districtTerritory = await searchTerritory(communeName, 'commune', apiKey, tenantId)
        }
      }

      if (!wilayaTerritory || !districtTerritory) {
        results.update_delivery_address = {
          success: false,
          error: `Territoire introuvable: wilaya=${wilayaName}, commune=${communeName}`,
        }
      } else {
        console.log(`Updating delivery address for parcel ${parcelId}`)

        const addressBody: Record<string, unknown> = {
          cityTerritoryId: wilayaTerritory.id,
          districtTerritoryId: districtTerritory.id,
          street: order.customer_address || '',
        }

        const res = await fetch(`https://api.zrexpress.app/api/v1/parcels/${parcelId}/delivery-address`, {
          method: 'PATCH',
          headers: apiHeaders,
          body: JSON.stringify(addressBody),
        })

        const text = await res.text()
        console.log(`Update address response: ${res.status} ${text.substring(0, 300)}`)
        results.update_delivery_address = { status: res.status, success: res.ok, response: text.substring(0, 300) }
      }
    }

    const allSuccess = Object.values(results).every((r: any) => r.success !== false)

    return new Response(JSON.stringify({
      success: allSuccess,
      results,
      parcel_id: parcelId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('zr-express-sync-order error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})