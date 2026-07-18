import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { getInternalSecret } from "../_shared/auth.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Map ZR Express API state.name → app order_status
const ZR_STATE_TO_APP_STATUS: Record<string, string> = {
  // Pre-shipping
  "new":                    "preparing",
  "confirmed":              "preparing",
  "pret_a_expedier":        "to_station",
  "prise_en_charge":        "to_station",
  // In transit
  "vers_wilaya":            "at_station",
  "transfere":              "at_station",
  "recu_au_hub":            "at_station",
  // At destination hub (default — overridden to "au_bureau" if hub matches)
  "confirme_au_bureau":     "at_station",
  "au_bureau":              "at_station",
  "dispatch":               "at_station",
  "dispatch_autre_wilaya":  "at_station",
  "dispatch_meme_wilaya":   "at_station",
  "sorti_en_livraison":     "en_livraison",
  "sortie_en_livraison":    "en_livraison",
  "en_livraison":           "en_livraison",
  // Final statuses
  "livre":                  "delivered",
  "livré":                  "delivered",
  "encaisse":               "delivered",
  "encaissé":               "delivered",
  "encaissee":              "delivered",
  "tentative_echouee":      "Échec_de_livraison",
  "echec_de_livraison":     "Échec_de_livraison",
  "echec_livraison":        "Échec_de_livraison",
  "retourné":               "Échec_de_livraison",
  "retourne":               "Échec_de_livraison",
  "retour_vers_centre":     "Échec_de_livraison",
  "retour_recu":            "Échec_de_livraison",
  "recupere_par_fournisseur": "Échec_de_livraison",
  // Alerts
  "perdu":                  "alerte",
  "alerte":                 "alerte",
  "commande_annulee":       "Échec_de_livraison",
  "commande annulée":       "Échec_de_livraison",
}

// States where we check if the parcel arrived at its destination hub
const BUREAU_STATES = ["confirme_au_bureau", "au_bureau", "recu_au_hub"]


// Terminal statuses that should NOT be overwritten by sync
const TERMINAL_APP_STATUSES = [
  'delivered', 'delivered_paid', 'cancelled', 'returned', 'erreur'
]

// Statuses to sync - includes 'delivered' to keep deliveries table situation updated
// (order status won't change since 'delivered' is terminal)
const ACTIVE_STATUSES_TO_SYNC = [
  'preparing', 'ready', 'to_station', 'at_station', 'au_bureau',
  'en_livraison', 'shipped', 'Échec_de_livraison', 'alerte', 'exchange',
  'delivered'
]

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()

  try {
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
      console.log('ZR Express integration not configured or disabled')
      return new Response(JSON.stringify({ success: true, message: 'ZR Express non configuré', synced: 0 }), {
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

    // Fetch all active ZR Express orders from the database
    const { data: activeOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id, order_number, tracking_number, status, delivery_company')
      .eq('delivery_company', 'ZR Express')
      .not('tracking_number', 'is', null)
      .in('status', ACTIVE_STATUSES_TO_SYNC)

    if (ordersError) {
      throw new Error(`Failed to fetch orders: ${ordersError.message}`)
    }

    if (!activeOrders || activeOrders.length === 0) {
      console.log('No active ZR Express orders to sync')
      return new Response(JSON.stringify({ success: true, message: 'Aucune commande active à synchroniser', synced: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`Syncing ${activeOrders.length} active ZR Express orders...`)

    let synced = 0
    let errors = 0
    const results: Array<{ order: string; old: string; new: string; zr_state: string }> = []

    // Process orders in batches of 10 to avoid overwhelming the API
    const BATCH_SIZE = 10
    for (let i = 0; i < activeOrders.length; i += BATCH_SIZE) {
      const batch = activeOrders.slice(i, i + BATCH_SIZE)
      
      const fetchWithRetry = async (url: string, attempts = 3): Promise<Response> => {
        let lastErr: unknown = null
        for (let a = 0; a < attempts; a++) {
          try {
            return await fetch(url, { method: 'GET', headers: apiHeaders })
          } catch (err) {
            lastErr = err
            await new Promise(r => setTimeout(r, 400 * (a + 1)))
          }
        }
        throw lastErr
      }

      const promises = batch.map(async (order) => {
        try {
          // Fetch parcel status from ZR Express API (with retry for transient HTTP/2 errors)
          const res = await fetchWithRetry(`https://api.zrexpress.app/api/v1/parcels/${order.tracking_number}`)

          if (!res.ok) {
            console.error(`ZR API error for ${order.order_number}: ${res.status}`)
            errors++
            return
          }

          const parcel = await res.json()
          const zrStateName = parcel?.state?.name
          let zrSituation = parcel?.situation?.description || parcel?.situation?.name || null
          
          // Use the real event timestamp from ZR Express
          let realTimestamp = parcel?.lastSituationUpdateAt || parcel?.lastStateUpdateAt || parcel?.lastStateHistoryAt || null

          // Fetch state history to get the REAL latest situation
          // (parcel.situation can be stale while newer situations exist in history)
          try {
            const parcelId = parcel?.id
            if (parcelId) {
              const histRes = await fetch(`https://api.zrexpress.app/api/v1/parcels/${parcelId}/state-history`, {
                method: 'GET',
                headers: apiHeaders,
              })
              if (histRes.ok) {
                const histData = await histRes.json()
                const historyItems = Array.isArray(histData) ? histData : (histData?.items || histData?.data || [])
                
                // Find the most recent situation across all state entries
                let latestSituation: { description: string; createdAt: string } | null = null
                for (const entry of historyItems) {
                  if (entry.situations && Array.isArray(entry.situations)) {
                    for (const sit of entry.situations) {
                      const sitDate = sit.createdAt
                      const sitDesc = sit.situationDescription || sit.situationName
                      if (sitDesc && (!latestSituation || sitDate > latestSituation.createdAt)) {
                        latestSituation = { description: sitDesc, createdAt: sitDate }
                      }
                    }
                  }
                }
                
                // Use the history situation if it's newer than parcel.situation
                if (latestSituation) {
                  const histSitTime = new Date(latestSituation.createdAt).getTime()
                  const parcelSitTime = realTimestamp ? new Date(realTimestamp).getTime() : 0
                  if (histSitTime > parcelSitTime || latestSituation.description !== zrSituation) {
                    zrSituation = latestSituation.description
                    realTimestamp = latestSituation.createdAt
                    console.log(`📋 ${order.order_number}: updated situation from history → "${zrSituation}" at ${realTimestamp}`)
                  }
                }
              }
            }
          } catch (histErr) {
            console.warn(`⚠️ ${order.order_number}: failed to fetch state history: ${histErr.message}`)
          }
          
          // For terminal states (livre, encaisse), override situation with state description
          // to prevent stale situations like "Appel téléphonique" from showing
          const TERMINAL_ZR_STATES = ['livre', 'livré', 'encaisse', 'encaissé', 'encaissee']
          if (TERMINAL_ZR_STATES.includes(zrStateName?.toLowerCase())) {
            const stateDesc = parcel.state?.description || zrStateName
            // Only override if situation is NOT already the terminal state
            if (zrSituation !== stateDesc) {
              console.log(`🏁 ${order.order_number}: terminal state "${stateDesc}" overrides stale situation "${zrSituation}"`)
              zrSituation = stateDesc
              realTimestamp = parcel?.lastStateUpdateAt || parcel?.lastStateHistoryAt || realTimestamp
            }
          }

          console.log(`📦 ${order.order_number}: state=${zrStateName}, situation=${zrSituation}, realTime=${realTimestamp}`)
          
          if (!zrStateName) {
            console.warn(`No state found for ${order.order_number}`)
            return
          }

          // Only UPDATE deliveries when status/situation actually changed.
          // Before this guard, this UPDATE fired for every parcel on every poll
          // (millions of no-op writes), bloating WAL and rolling back transactions.
          const newDeliveryStatus = parcel.state?.description || zrStateName
          const { data: existingDelivery } = await supabase
            .from('deliveries')
            .select('delivery_status, delivery_situation')
            .eq('tracking_number', order.tracking_number)
            .maybeSingle()

          const deliveryChanged =
            !existingDelivery ||
            existingDelivery.delivery_status !== newDeliveryStatus ||
            existingDelivery.delivery_situation !== zrSituation

          if (deliveryChanged) {
            await supabase
              .from('deliveries')
              .update({
                delivery_status: newDeliveryStatus,
                delivery_situation: zrSituation,
                last_update: realTimestamp || new Date().toISOString(),
              })
              .eq('tracking_number', order.tracking_number)
          }

          // Map ZR state to app status
          let newAppStatus = ZR_STATE_TO_APP_STATUS[zrStateName.toLowerCase()]
          
          if (!newAppStatus) {
            console.warn(`Unknown ZR Express state "${zrStateName}" for ${order.order_number}`)
            return
          }

          // Override: if situation indicates failed delivery, force Échec_de_livraison
          if (zrSituation) {
            const sitLower = zrSituation.toLowerCase()
            if (sitLower.includes('commande annulée')) {
              newAppStatus = 'Échec_de_livraison'
              console.log(`🚫 ${order.order_number}: situation "Commande annulée" → Échec_de_livraison`)
            } else if (sitLower.includes('ne réponds pas 3') || sitLower.includes('ne répond pas 3')) {
              newAppStatus = 'Échec_de_livraison'
              console.log(`🚫 ${order.order_number}: situation "${zrSituation}" → Échec_de_livraison`)
            }
          }

          // Check if parcel arrived at its destination hub
          if (BUREAU_STATES.includes(zrStateName.toLowerCase())) {
            const destinationHubId = parcel?.deliveryAddress?.hubId
            const currentHubId = parcel?.lastLocationHubId
            if (destinationHubId && currentHubId && destinationHubId === currentHubId) {
              newAppStatus = 'au_bureau'
              console.log(`📍 ${order.order_number}: parcel at destination hub (${parcel?.deliveryAddress?.hubName})`)
            }
          }

          // Skip if status hasn't changed
          if (newAppStatus === order.status) {
            return
          }

          // Skip if current app status is terminal
          if (TERMINAL_APP_STATUSES.includes(order.status)) {
            return
          }

          // Update order status
          const updates: Record<string, any> = { status: newAppStatus }
          
          // Set timestamps based on new status
          if (newAppStatus === 'delivered') {
            updates.delivered_at = new Date().toISOString()
          } else if (['shipped', 'to_station', 'at_station', 'au_bureau', 'en_livraison'].includes(newAppStatus)) {
            if (!order.status || !['shipped', 'to_station', 'at_station', 'au_bureau', 'en_livraison'].includes(order.status)) {
              updates.shipped_at = new Date().toISOString()
            }
          }

          // Update shipped_at separately if needed
          if (updates.shipped_at) {
            await supabase.from('orders').update({ shipped_at: updates.shipped_at }).eq('id', order.id)
          }

          const { error: updateError } = await supabase.rpc('update_order_status_attributed', {
            _order_id: order.id,
            _status: newAppStatus,
            _changed_by: 'ZR Express',
            _delivered_at: newAppStatus === 'delivered' ? new Date().toISOString() : null,
          })

          if (updateError) {
            console.error(`Failed to update ${order.order_number}: ${updateError.message}`)
            errors++
            return
          }

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
            body: JSON.stringify({ orderId: order.id, newStatus: newAppStatus, trackingNumber: order.tracking_number }),
          }).catch(err => console.error('Tracking notification error:', err))

          // Deliveries table already updated above with situation

          synced++
          results.push({
            order: order.order_number,
            old: order.status,
            new: newAppStatus,
            zr_state: zrStateName,
          })

          console.log(`✅ ${order.order_number}: ${order.status} → ${newAppStatus} (ZR: ${zrStateName})`)
        } catch (err) {
          console.error(`Error syncing ${order.order_number}:`, err)
          errors++
        }
      })

      await Promise.all(promises)
      
      // Small delay between batches to be kind to ZR API
      if (i + BATCH_SIZE < activeOrders.length) {
        await new Promise(r => setTimeout(r, 500))
      }
    }

    const duration = Date.now() - startTime
    console.log(`Sync complete: ${synced} updated, ${errors} errors, ${activeOrders.length} checked in ${duration}ms`)

    return new Response(JSON.stringify({
      success: true,
      total_checked: activeOrders.length,
      synced,
      errors,
      duration_ms: duration,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('zr-express-sync-statuses error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
