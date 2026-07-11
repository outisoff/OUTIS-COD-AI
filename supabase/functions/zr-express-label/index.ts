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

    const { order_id } = await req.json()
    if (!order_id) {
      return new Response(JSON.stringify({ error: 'order_id requis' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

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

    if (order.delivery_company !== 'ZR Express' || !order.tracking_number) {
      return new Response(JSON.stringify({ error: 'Commande non assignée à ZR Express ou pas de tracking' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
      return new Response(JSON.stringify({ error: 'Intégration ZR Express non configurée' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const tenantId = integration.settings?.tenant_id || integration.api_key || ''
    const apiKey = integration.api_secret || ''
    const parcelGuid = order.tracking_number

    const apiHeaders = {
      'X-Api-Key': apiKey,
      'X-Tenant': tenantId,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }

    // Step 1: Get parcel details to find the real ZR Express tracking number
    console.log(`Step 1: Getting parcel details for GUID: ${parcelGuid}`)
    
    let zrTrackingNumber = ''
    
    const parcelRes = await fetch(`https://api.zrexpress.app/api/v1/parcels/${parcelGuid}`, {
      method: 'GET',
      headers: apiHeaders,
    })
    
    if (parcelRes.ok) {
      const parcelData = await parcelRes.json()
      console.log(`Parcel data keys: ${Object.keys(parcelData).join(', ')}`)
      console.log(`Parcel data (partial): ${JSON.stringify(parcelData).substring(0, 1000)}`)
      
      // Look for the ZR tracking number in various possible fields
      zrTrackingNumber = parcelData.tracking || parcelData.trackingNumber || 
                         parcelData.barcode || parcelData.code || 
                         parcelData.reference || parcelData.number || ''
      
      console.log(`Found ZR tracking number: ${zrTrackingNumber}`)
    } else {
      const errText = await parcelRes.text()
      console.log(`Parcel details failed (${parcelRes.status}): ${errText.substring(0, 300)}`)
    }

    // Step 2: Try label endpoints with both GUID and ZR tracking number
    const idsToTry = [parcelGuid]
    if (zrTrackingNumber && zrTrackingNumber !== parcelGuid) {
      idsToTry.push(zrTrackingNumber)
    }

    for (const id of idsToTry) {
      console.log(`\n=== Trying with ID: ${id} ===`)

      // Try GET /parcels/{id}/label with PDF accept
      const endpoints = [
        { url: `https://api.zrexpress.app/api/v1/parcels/${id}/label`, method: 'GET' },
        { url: `https://api.zrexpress.app/api/v1/parcels/${id}/bordereau`, method: 'GET' },
        { url: `https://api.zrexpress.app/api/v1/parcels/${id}/print`, method: 'GET' },
        { url: `https://api.zrexpress.app/api/v1/parcels/label`, method: 'POST', body: JSON.stringify({ id }) },
        { url: `https://api.zrexpress.app/api/v1/parcels/label`, method: 'POST', body: JSON.stringify({ ids: [id] }) },
        { url: `https://api.zrexpress.app/api/v1/parcels/bordereau`, method: 'POST', body: JSON.stringify({ id }) },
        { url: `https://api.zrexpress.app/api/v1/parcels/bordereau`, method: 'POST', body: JSON.stringify({ ids: [id] }) },
        { url: `https://api.zrexpress.app/api/v1/labels/${id}`, method: 'GET' },
        { url: `https://api.zrexpress.app/api/v1/labels`, method: 'POST', body: JSON.stringify({ id }) },
        { url: `https://api.zrexpress.app/api/v1/labels`, method: 'POST', body: JSON.stringify({ ids: [id] }) },
      ]

      for (const ep of endpoints) {
        try {
          console.log(`Trying: ${ep.method} ${ep.url}`)
          const fetchOpts: RequestInit = {
            method: ep.method,
            headers: {
              ...apiHeaders,
              'Accept': 'application/pdf, application/json, */*',
            },
          }
          if (ep.body) fetchOpts.body = ep.body

          const response = await fetch(ep.url, fetchOpts)
          const contentType = response.headers.get('Content-Type') || ''
          console.log(`Response: ${response.status} ${contentType}`)

          if (response.ok) {
            // PDF binary response
            if (contentType.includes('application/pdf') || contentType.includes('application/octet-stream')) {
              const pdfBuffer = await response.arrayBuffer()
              const bytes = new Uint8Array(pdfBuffer)
              let binaryStr = ''
              for (let i = 0; i < bytes.length; i++) {
                binaryStr += String.fromCharCode(bytes[i])
              }
              const base64 = btoa(binaryStr)
              console.log(`SUCCESS: Got PDF (${bytes.length} bytes)`)
              return new Response(JSON.stringify({
                success: true, label_type: 'pdf', label_data: base64,
              }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }

            // JSON response - might contain URL or base64
            const text = await response.text()
            console.log(`Response body (first 500): ${text.substring(0, 500)}`)
            
            try {
              const data = JSON.parse(text)
              const pdfUrl = data.url || data.labelUrl || data.label_url || data.pdfUrl || data.bordereau || data.bordereauUrl
              if (pdfUrl) {
                console.log(`SUCCESS: Got label URL: ${pdfUrl}`)
                return new Response(JSON.stringify({
                  success: true, label_type: 'url', label_url: pdfUrl,
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
              }
              const pdfData = data.data || data.label || data.pdf || data.content
              if (pdfData && typeof pdfData === 'string' && pdfData.length > 100) {
                console.log(`SUCCESS: Got base64 label data`)
                return new Response(JSON.stringify({
                  success: true, label_type: 'pdf', label_data: pdfData,
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
              }
            } catch {
              // HTML response
              if (text.includes('<html') || text.includes('<body')) {
                console.log(`SUCCESS: Got HTML label`)
                return new Response(JSON.stringify({
                  success: true, label_type: 'html', label_data: text,
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
              }
            }
          } else {
            const errText = await response.text()
            console.log(`Failed: ${errText.substring(0, 150)}`)
          }
        } catch (e) {
          console.log(`Error: ${e.message}`)
        }
      }
    }

    // All failed
    console.log('All label endpoints failed')
    return new Response(JSON.stringify({
      success: false,
      error: "Impossible de télécharger le bordereau depuis ZR Express. L'API ne supporte pas cette fonctionnalité.",
      use_local: true,
      parcel_guid: parcelGuid,
      zr_tracking: zrTrackingNumber || null,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('zr-express-label error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})