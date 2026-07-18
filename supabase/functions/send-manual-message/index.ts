import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const WASENDER_API_URL = 'https://www.wasenderapi.com/api/send-message'

function formatPhoneForWhatsApp(phone: string): string {
  let cleaned = phone.replace(/\s+/g, '').replace(/-/g, '')
  if (cleaned.startsWith('0')) cleaned = '+213' + cleaned.substring(1)
  if (!cleaned.startsWith('+')) cleaned = '+' + cleaned
  return cleaned
}

function getMediaType(mimeType: string): 'image' | 'video' | 'audio' | 'document' | null {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType.startsWith('application/') || mimeType.startsWith('text/')) return 'document'
  return 'document'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Verify auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Not authenticated')

    const supabaseAuth = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) throw new Error('Not authenticated')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get WaSender API key
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

    const { order_id, message, phone, media_url, media_type, file_name } = await req.json()
    if (!order_id || !phone) throw new Error('Missing order_id or phone')
    if (!message && !media_url) throw new Error('Missing message or media')

    // Get sender name
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .maybeSingle()
    const senderName = profile?.full_name || profile?.email || user.email || 'Agent'

    // Build WASender payload
    const waPayload: Record<string, any> = {
      to: formatPhoneForWhatsApp(phone),
    }

    if (media_url && media_type) {
      // Send media message
      if (media_type === 'image') {
        waPayload.imageUrl = media_url
      } else if (media_type === 'video') {
        waPayload.videoUrl = media_url
      } else if (media_type === 'audio') {
        waPayload.audioUrl = media_url
      } else {
        waPayload.documentUrl = media_url
        if (file_name) waPayload.fileName = file_name
      }
      if (message) waPayload.text = message
    } else {
      waPayload.text = message
    }

    // Send via WhatsApp
    const waResponse = await fetch(WASENDER_API_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${WASENDER_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(waPayload),
    })
    const waData = await waResponse.json()
    const sent = waResponse.ok

    // Get order details
    const { data: orderData } = await supabase
      .from('orders')
      .select('order_number, customer_phone')
      .eq('id', order_id)
      .single()

    const customerPhone = orderData?.customer_phone || phone

    // Find existing log by phone number (not order_id) to keep all messages grouped
    const { data: log } = await supabase
      .from('auto_confirmation_logs')
      .select('id, conversation_history, conversation_status')
      .eq('customer_phone', customerPhone)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const historyEntry: Record<string, any> = {
      role: 'assistant',
      content: message || (media_type === 'image' ? '📷 Image' : media_type === 'video' ? '🎥 Vidéo' : '📎 Fichier'),
      timestamp: new Date().toISOString(),
      manual: true,
      sender: senderName,
    }
    if (media_url) {
      historyEntry.media_url = media_url
      historyEntry.media_type = media_type
      historyEntry.file_name = file_name
    }

    const history = (log?.conversation_history as any[]) || []
    history.push(historyEntry)

    // Preserve manual_takeover status
    const currentStatus = log?.conversation_status
    const newStatus = currentStatus === 'manual_takeover' ? 'manual_takeover' : 'awaiting_reply'

    if (log) {
      await supabase
        .from('auto_confirmation_logs')
        .update({
          conversation_history: history,
          last_message_at: new Date().toISOString(),
          conversation_status: newStatus,
        })
        .eq('id', log.id)
    } else {
      await supabase.from('auto_confirmation_logs').insert({
        order_id,
        order_number: orderData?.order_number || 'UNKNOWN',
        customer_phone: customerPhone,
        ai_decision: 'manual',
        conversation_history: history,
        conversation_status: 'awaiting_reply',
        last_message_at: new Date().toISOString(),
        whatsapp_message_sent: sent,
      })
    }

    return new Response(JSON.stringify({ success: sent, whatsapp_response: JSON.stringify(waData) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Send manual message error:', error)
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
