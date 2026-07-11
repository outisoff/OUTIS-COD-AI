import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { authenticateRequest } from '../_shared/auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const WASENDER_API_URL = 'https://www.wasenderapi.com/api/send-message'

const STATUS_MESSAGES: Record<string, string> = {
  confirmed: '✅ Votre commande {order} a été confirmée ! Elle sera bientôt préparée.',
  preparing: '📦 Votre commande {order} est en cours de préparation.',
  ready: '✅ Votre commande {order} est prête pour l\'expédition.',
  shipped: '🚚 Votre commande {order} a été expédiée ! Numéro de suivi: {tracking}',
  to_station: '📍 Votre commande {order} est en route vers la station.',
  at_station: '🏢 Votre commande {order} est arrivée à la station. Vous pouvez la récupérer.',
  au_bureau: '🏢 Votre commande {order} est au bureau de livraison ({delivery_company}).\n📍 Bureau: {bureau_name}\n🗺️ Adresse: {bureau_address}\n📌 Localisation: {bureau_maps_link}',
  en_livraison: '🛵 Votre commande {order} est en cours de livraison. Le livreur arrive bientôt !',
  delivered: '🎉 Votre commande {order} a été livrée avec succès. Merci pour votre confiance !',
  'Échec_de_livraison': '⚠️ La livraison de votre commande {order} a échoué. Nous allons reprogrammer.',
  cancelled: '❌ Votre commande {order} a été annulée.',
  returned: '↩️ Votre commande {order} est en retour.',
  failed_1: '📞 1ère tentative échouée pour la commande {order}. Nous réessayerons.',
  failed_2: '📞 2ème tentative échouée pour la commande {order}. Nous réessayerons.',
  failed_3: '📞 3ème tentative échouée pour la commande {order}. Dernière chance de confirmer.',
  failed_4: '📞 4ème tentative échouée pour la commande {order}. Merci de nous rappeler.',
  failed_5: '📞 5ème tentative échouée pour la commande {order}. Dernier rappel.',
  failed_6: '📞 Dernière tentative pour la commande {order}. Sans réponse, elle sera annulée.',
}

const STATUS_MESSAGES_AR: Record<string, string> = {
  confirmed: '✅ طلبك {order} تأكد! راح يتحضر قريب.',
  preparing: '📦 طلبك {order} راه يتحضر.',
  ready: '✅ طلبك {order} جاهز للشحن.',
  shipped: '🚚 طلبك {order} تشحن! رقم التتبع: {tracking}',
  to_station: '📍 طلبك {order} في الطريق للمحطة.',
  at_station: '🏢 طلبك {order} وصل للمحطة. تقدر تجيبو.',
  au_bureau: '🏢 طلبك {order} في مكتب التوصيل ({delivery_company}).\n📍 المكتب: {bureau_name}\n🗺️ العنوان: {bureau_address}\n📌 الموقع: {bureau_maps_link}',
  en_livraison: '🛵 طلبك {order} راه في التوصيل! الليفرور جاي!',
  delivered: '🎉 طلبك {order} توصل. شكرا على ثقتك!',
  'Échec_de_livraison': '⚠️ توصيل طلبك {order} ما نجحش. راح نعاودو نبرمجوه.',
  cancelled: '❌ طلبك {order} تلغى.',
  returned: '↩️ طلبك {order} رجع.',
  failed_1: '📞 المحاولة الأولى لطلبك {order} ما نجحتش. راح نعاودو.',
  failed_2: '📞 المحاولة الثانية لطلبك {order} ما نجحتش. راح نعاودو.',
  failed_3: '📞 المحاولة الثالثة لطلبك {order}. آخر فرصة باش تأكد.',
  failed_4: '📞 المحاولة الرابعة لطلبك {order}. عاود اتصل بينا.',
  failed_5: '📞 المحاولة الخامسة لطلبك {order}. آخر تذكير.',
  failed_6: '📞 آخر محاولة لطلبك {order}. بلا جواب راح يتلغى.',
}

function isArabicText(text: string): boolean {
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/
  return arabicRegex.test(text)
}

function formatPhoneForWhatsApp(phone: string): string {
  let cleaned = phone.replace(/\s+/g, '').replace(/-/g, '')
  if (cleaned.startsWith('0')) cleaned = '+213' + cleaned.substring(1)
  if (!cleaned.startsWith('+')) cleaned = '+' + cleaned
  return cleaned
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const auth = await authenticateRequest(req, { requireRoles: ['admin', 'confirmateur'] })
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.message }), {
      status: auth.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get WaSender API key from automation_settings first, then env
    let WASENDER_API_KEY = Deno.env.get('WASENDER_API_KEY')
    const { data: wasenderConfig } = await supabase
      .from('automation_settings')
      .select('setting_value')
      .eq('setting_key', 'wasender_config')
      .maybeSingle()
    if (wasenderConfig?.setting_value?.api_key) {
      WASENDER_API_KEY = wasenderConfig.setting_value.api_key
    }
    if (!WASENDER_API_KEY) throw new Error('WASENDER_API_KEY not configured')
    const { orderId, newStatus, trackingNumber } = await req.json()

    if (!orderId || !newStatus) {
      return new Response(JSON.stringify({ success: false, error: 'Missing orderId or newStatus' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if tracking notifications are enabled
    const { data: settings } = await supabase
      .from('automation_settings')
      .select('setting_value')
      .eq('setting_key', 'tracking_notifications')
      .maybeSingle()

    const config = settings?.setting_value as any
    if (!config?.enabled) {
      return new Response(JSON.stringify({ success: true, message: 'Tracking notifications disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if this status is enabled for notifications
    const enabledStatuses = config?.statuses || Object.keys(STATUS_MESSAGES)
    if (!enabledStatuses.includes(newStatus)) {
      return new Response(JSON.stringify({ success: true, message: 'Status not configured for notification' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch order with items
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, order_items(product_name, quantity)')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return new Response(JSON.stringify({ success: false, error: 'Order not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Always prioritize Arabic: use Arabic if any Arabic custom message exists for this status
    const customAr = (config?.custom_messages_ar || {})[newStatus] || ''
    const useArabic = !!customAr
    
    const customTemplates = useArabic ? (config?.custom_messages_ar || {}) : (config?.custom_messages || {})
    const defaultMessages = useArabic ? STATUS_MESSAGES_AR : STATUS_MESSAGES
    const template = customTemplates[newStatus] || defaultMessages[newStatus]

    if (!template) {
      return new Response(JSON.stringify({ success: true, message: 'No template for this status' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const productsList = (order.order_items || []).map((i: any) => `${i.product_name} x${i.quantity}`).join(', ')

    // Parse stop desk bureau info from customer_address
    let bureauName = ''
    let bureauAddress = ''
    let bureauMapsLink = ''
    const stopDeskMatch = (order.customer_address || '').match(/^Stop Desk:\s*(.+?)\s*—\s*(.+?)(?:,\s*(.+))?$/)
    if (stopDeskMatch) {
      bureauName = stopDeskMatch[1]?.trim() || ''
      const bureauCommune = stopDeskMatch[2]?.trim() || ''
      bureauAddress = stopDeskMatch[3]?.trim() || bureauCommune
      const searchQuery = [bureauName, bureauCommune, order.wilaya].filter(Boolean).join(', ')
      const fullMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery)}`
      // Shorten via TinyURL (free, no API key). Fallback to full URL on failure.
      try {
        const shortRes = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(fullMapsUrl)}`)
        if (shortRes.ok) {
          const shortUrl = (await shortRes.text()).trim()
          bureauMapsLink = shortUrl.startsWith('http') ? shortUrl : fullMapsUrl
        } else {
          bureauMapsLink = fullMapsUrl
        }
      } catch (_e) {
        bureauMapsLink = fullMapsUrl
      }
    }

    const replaceVars = (tpl: string) => tpl
      .replace(/{order}/g, order.order_number)
      .replace(/{tracking}/g, trackingNumber || order.tracking_number || 'N/A')
      .replace(/{name}/g, order.customer_name)
      .replace(/{wilaya}/g, order.wilaya)
      .replace(/{commune}/g, order.commune || '')
      .replace(/{address}/g, order.customer_address || '')
      .replace(/{phone}/g, order.customer_phone || '')
      .replace(/{total}/g, String(order.total_price || 0))
      .replace(/{product}/g, productsList)
      .replace(/{delivery_fee}/g, String(order.delivery_fee || 0))
      .replace(/{delivery_company}/g, order.delivery_company || '')
      .replace(/{bureau_name}/g, bureauName)
      .replace(/{bureau_address}/g, bureauAddress)
      .replace(/{bureau_maps_link}/g, bureauMapsLink)

    const message = replaceVars(template)
    const formattedPhone = formatPhoneForWhatsApp(order.customer_phone)

    // Send first WhatsApp message
    const response = await fetch(WASENDER_API_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${WASENDER_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: formattedPhone, text: message }),
    })

    const data = await response.json()

    // Check for second message (for statuses that support it)
    const customTemplates2 = useArabic ? (config?.custom_messages_ar_2 || {}) : (config?.custom_messages_2 || {})
    const template2 = customTemplates2[newStatus] || ''
    let secondMessageResult = null

    if (template2 && response.ok) {
      const message2 = replaceVars(template2)
      // Small delay between messages
      await new Promise(r => setTimeout(r, 2000))
      const response2 = await fetch(WASENDER_API_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${WASENDER_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: formattedPhone, text: message2 }),
      })
      secondMessageResult = await response2.json()
    }

    return new Response(JSON.stringify({
      success: response.ok,
      message: response.ok ? 'Notification sent' : 'Failed to send',
      response: JSON.stringify(data),
      second_message: secondMessageResult ? JSON.stringify(secondMessageResult) : null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Tracking notification error:', error)
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
