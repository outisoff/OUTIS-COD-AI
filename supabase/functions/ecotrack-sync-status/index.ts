import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { getInternalSecret } from "../_shared/auth.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Mapping RJ360 statuses to platform order statuses
const STATUS_MAP: Record<string, string> = {
  "prete_a_expedier":        "preparing",
  "en_ramassage":            "to_station",
  "en_preparation_stock":    "preparing",
  "vers_hub":                "to_station",
  "en_hub":                  "at_station",
  "vers_wilaya":             "to_station",
  "en_preparation":          "au_bureau",
  "en_livraison":            "en_livraison",
  "suspendu":                "alerte",
  "livre_non_encaisse":      "delivered",
  "encaisse_non_paye":       "delivered",
  "paiements_prets":         "delivered_paid",
  "paye_et_archive":         "delivered_paid",
  "retour_chez_livreur":     "Échec_de_livraison",
  "retour_transit_entrepot": "Échec_de_livraison",
  "retour_en_traitement":    "Échec_de_livraison",
  "retour_recu":             "returned",
  "retour_archive":          "returned",
  "annule":                  "cancelled",
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

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

    // Get all RJ360 orders with tracking numbers that are in active statuses
    const activeStatuses = ['preparing', 'ready', 'to_station', 'at_station', 'au_bureau', 'en_livraison', 'alerte', 'Échec_de_livraison', 'shipped']
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, order_number, tracking_number, status, delivery_company')
      .eq('delivery_company', 'RJ360')
      .not('tracking_number', 'is', null)
      .in('status', activeStatuses)

    if (ordersError) {
      console.error('Error fetching orders:', ordersError)
      return new Response(JSON.stringify({ error: 'Erreur lors de la récupération des commandes' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!orders || orders.length === 0) {
      return new Response(JSON.stringify({ success: true, synced: 0, message: 'Aucune commande RJ360 active à synchroniser' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Batch trackings in groups of 100 (API limit)
    const trackings = orders.map(o => o.tracking_number).filter(Boolean) as string[]
    const batchSize = 100
    let totalSynced = 0
    let totalErrors = 0
    const details: { tracking: string; oldStatus: string; newStatus: string }[] = []

    for (let i = 0; i < trackings.length; i += batchSize) {
      const batch = trackings.slice(i, i + batchSize)
      const trackingsParam = batch.join(',')
      const statusParam = 'all'

      const url = `${BASE_URL}/api/v1/get/orders/status?api_token=${encodeURIComponent(apiToken)}&trackings=${encodeURIComponent(trackingsParam)}&status=${statusParam}`

      console.log(`Syncing batch ${i / batchSize + 1}: ${batch.length} trackings`)

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Accept': 'application/json',
          },
        })

        const responseText = await response.text()
        
        if (!response.ok) {
          console.error(`RJ360 status API error: ${response.status} ${responseText.substring(0, 200)}`)
          totalErrors += batch.length
          continue
        }

        let data: any
        try {
          data = JSON.parse(responseText)
        } catch {
          console.error('Failed to parse status response:', responseText.substring(0, 200))
          totalErrors += batch.length
          continue
        }

        const statusData = data.data || data
        
        // Process each tracking result
        for (const tracking of batch) {
          const info = statusData[tracking]
          if (!info || !info.status) continue

          const rj360Status = info.status
          const mappedStatus = STATUS_MAP[rj360Status]
          
          if (!mappedStatus) {
            console.log(`Unknown RJ360 status for ${tracking}: ${rj360Status}`)
            continue
          }

          // Find the matching order
          const order = orders.find(o => o.tracking_number === tracking)
          if (!order) continue

          // Only update if status actually changed
          if (order.status !== mappedStatus) {
            const { error: updateError } = await supabase
              .from('orders')
              .update({ status: mappedStatus })
              .eq('id', order.id)

            if (updateError) {
              console.error(`Error updating order ${order.order_number}:`, updateError)
              totalErrors++
            } else {
              details.push({
                tracking,
                oldStatus: order.status,
                newStatus: mappedStatus,
              })
              totalSynced++

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
                body: JSON.stringify({ orderId: order.id, newStatus: mappedStatus, trackingNumber: tracking }),
              }).catch(err => console.error('Tracking notification error:', err))

              // Update delivery record too
              await supabase
                .from('deliveries')
                .update({
                  delivery_status: rj360Status,
                  last_update: new Date().toISOString(),
                })
                .eq('tracking_number', tracking)
            }
          }

          // Store activity data as alert if there are new activities
          if (info.activity && info.activity.length > 0) {
            const lastActivity = info.activity[info.activity.length - 1]
            if (lastActivity.reason) {
              // Check if we already logged this activity
              const activityMsg = `📬 RJ360 — ${tracking}: ${lastActivity.reason}${lastActivity.details ? ` (${lastActivity.details})` : ''}`
              const { data: existingAlert } = await supabase
                .from('alerts')
                .select('id')
                .eq('order_id', order.id)
                .eq('message', activityMsg)
                .maybeSingle()

              if (!existingAlert) {
                await supabase.from('alerts').insert({
                  order_id: order.id,
                  type: 'info',
                  message: activityMsg,
                })
              }
            }
          }
        }
      } catch (fetchErr) {
        console.error(`Network error syncing batch:`, fetchErr)
        totalErrors += batch.length
      }
    }

    const message = `Synchronisation terminée: ${totalSynced} mise(s) à jour, ${totalErrors} erreur(s) sur ${trackings.length} commande(s)`
    console.log(message)

    return new Response(JSON.stringify({ 
      success: true, 
      synced: totalSynced, 
      errors: totalErrors,
      total: trackings.length,
      message,
      details,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('ecotrack-sync-status error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})