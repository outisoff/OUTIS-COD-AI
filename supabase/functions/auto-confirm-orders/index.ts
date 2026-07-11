import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { authenticateRequest } from '../_shared/auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const WASENDER_API_URL = 'https://www.wasenderapi.com/api/send-message'
// External AI providers only (no Lovable AI)

function formatPhoneForWhatsApp(phone: string): string {
  let cleaned = phone.replace(/\s+/g, '').replace(/-/g, '')
  if (cleaned.startsWith('0')) cleaned = '+213' + cleaned.substring(1)
  if (!cleaned.startsWith('+')) cleaned = '+' + cleaned
  return cleaned
}

function validatePhone(phone: string): boolean {
  const cleaned = phone.replace(/\s+/g, '').replace(/-/g, '')
  return /^(\+213|0)[5-7]\d{8}$/.test(cleaned)
}

async function sendWhatsApp(apiKey: string, phone: string, message: string, pollConfig?: { question: string; options: string[] }): Promise<{ success: boolean; response: string }> {
  try {
    const formattedPhone = formatPhoneForWhatsApp(phone)
    const pollOptions = pollConfig?.options || ['✅ نعم (لتأكيد الطلب)', '❌ لا (لإلغاء الطلب)']
    
    // Truncate message to 255 chars (WaSender poll question limit)
    const pollQuestion = message.length > 255 ? message.substring(0, 252) + '...' : message

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 20000) // 20s timeout

    const response = await fetch(WASENDER_API_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: formattedPhone,
        poll: {
          question: pollQuestion,
          options: pollOptions,
          multiSelect: false,
        },
      }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    const data = await response.json()
    if (!response.ok) return { success: false, response: JSON.stringify(data) }

    console.log('Poll message sent successfully to', formattedPhone)
    return { success: true, response: JSON.stringify(data) }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { success: false, response: 'WaSender timeout (20s)' }
    }
    return { success: false, response: error instanceof Error ? error.message : 'Unknown error' }
  }
}
function isArabicText(text: string): boolean {
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/
  return arabicRegex.test(text)
}

function detectLanguage(order: any): 'ar' | 'fr' {
  const textToCheck = `${order.customer_name} ${order.customer_address}`
  return isArabicText(textToCheck) ? 'ar' : 'fr'
}

function buildMessageFromTemplate(template: string, order: any, items: any[], customer: any): string {
  const lang = detectLanguage(order)
  const deliveryLabel = lang === 'ar'
    ? (order.delivery_type === 'home' ? 'توصيل للدار' : 'ستوب ديسك')
    : (order.delivery_type === 'home' ? 'Livraison à domicile' : 'Stop desk')
  const itemsList = items.map((i: any) => `• ${i.product_name} x${i.quantity}: ${i.unit_price * i.quantity} DA`).join('\n')
  return template
    .replace(/\{name\}/g, order.customer_name)
    .replace(/\{phone\}/g, order.customer_phone)
    .replace(/\{order\}/g, order.order_number)
    .replace(/\{products\}/g, itemsList)
    .replace(/\{total\}/g, String(order.total_price))
    .replace(/\{delivery_fee\}/g, String(order.delivery_fee))
    .replace(/\{address\}/g, order.customer_address)
    .replace(/\{wilaya\}/g, order.wilaya)
    .replace(/\{commune\}/g, order.commune || '')
    .replace(/\{delivery_type\}/g, deliveryLabel)
}

async function callGemini(apiKey: string, systemPrompt: string, userPrompt: string, supabase?: any): Promise<string> {
  const model = 'gemini-2.0-flash'
  
  console.log(`Calling Gemini ${model} (single attempt, fail-fast)`)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.7 },
    }),
  })
  if (response.ok) {
    const data = await response.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  }
  const t = await response.text()
  console.error(`Gemini fail-fast error ${response.status}, falling back immediately`)
  throw new Error(`Gemini error ${response.status}`)
}

async function generateAIMessage(order: any, items: any[], customer: any, config: any, aiProviderConfig: any, supabase?: any, lovableAiConfig?: any): Promise<string> {
  const lang = detectLanguage(order)

  // Priority: Arabic template first, then French fallback
  const messageTemplate = config?.message_template_ar?.trim()
    ? config.message_template_ar
    : (config?.message_template || '')

  // Build the filled template
  const filledTemplate = messageTemplate?.trim() ? buildMessageFromTemplate(messageTemplate, order, items, customer) : ''

  // FAST PATH: If template exists, use it directly — no AI needed
  if (filledTemplate) {
    console.log('Template found, using directly (no AI call)')
    return filledTemplate
  }

  // NO TEMPLATE: Fall back to AI generation
  const itemsList = items.map((i: any) => `- ${i.product_name} (x${i.quantity}) : ${i.unit_price * i.quantity} DA`).join('\n')

  const systemPrompt = config?.system_prompt || `Tu es un assistant commercial pour une plateforme e-commerce algérienne.
IMPORTANT: Le message DOIT faire MAXIMUM 250 caractères (limite technique WhatsApp poll).
Détecte la langue du nom du client. Nom arabe → arabe dialectal algérien. Nom français → français.
Sois court et direct. Inclus: nom client, produits, total, wilaya. Pas de HTML.`

  const userPrompt = `Génère un message WhatsApp pour confirmer cette commande:

Client: ${order.customer_name}
Téléphone: ${order.customer_phone}
Adresse: ${order.customer_address}, ${order.wilaya}${order.commune ? ', ' + order.commune : ''}
Type de livraison: ${order.delivery_type === 'home' ? 'À domicile' : 'Stop desk'}

Produits commandés:
${itemsList}

Sous-total produits: ${order.total_price - order.delivery_fee} DA
Frais de livraison: ${order.delivery_fee} DA
Total à payer: ${order.total_price} DA

Numéro de commande: ${order.order_number}
${customer ? `Statut client: ${customer.status}, ${customer.total_orders} commandes précédentes` : 'Nouveau client'}

Génère UNIQUEMENT le message WhatsApp, rien d'autre.`

  const staticFallback = getFallbackMessage(order, items)

  if (!aiProviderConfig?.use_external || !aiProviderConfig?.api_key) {
    if (lovableAiConfig?.enabled) {
      console.log('No external AI, using Lovable AI (enabled)')
      return await callLovableAI(systemPrompt, userPrompt, lovableAiConfig?.model) || staticFallback
    }
    console.log('No external AI and Lovable AI disabled, using static fallback')
    return staticFallback
  }

  const isGemini = aiProviderConfig.provider === 'google'

  try {
    if (isGemini) {
      console.log('Using Gemini (single attempt, fail-fast)')
      const result = await callGemini(aiProviderConfig.api_key, systemPrompt, userPrompt, supabase)
      return result || staticFallback
    }

    // OpenAI-compatible path (OpenAI, Groq, etc.)
    if (!aiProviderConfig.base_url) {
      throw new Error('base_url is required for non-Google providers')
    }
    const aiUrl = aiProviderConfig.base_url
    const aiKey = aiProviderConfig.api_key
    const model = aiProviderConfig.model || 'gpt-4o'

    const response = await fetch(aiUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${aiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: false,
      }),
    })

    if (response.status === 429) throw new Error('AI rate limit exceeded')
    if (response.status === 402) throw new Error('AI credits exhausted')
    if (!response.ok) {
      const t = await response.text()
      throw new Error(`AI error ${response.status}: ${t}`)
    }

    const data = await response.json()
    return data.choices?.[0]?.message?.content || staticFallback
  } catch (error) {
    console.error('External AI error:', error)
    if (lovableAiConfig?.enabled) {
      console.log('Trying Lovable AI fallback (enabled)')
      const lovableResult = await callLovableAI(systemPrompt, userPrompt, lovableAiConfig?.model)
      return lovableResult || staticFallback
    }
    console.log('Lovable AI disabled, using static fallback')
    return staticFallback
  }
}

async function callLovableAI(systemPrompt: string, userPrompt: string, model?: string): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
  if (!LOVABLE_API_KEY) {
    console.log('LOVABLE_API_KEY not configured, skipping Lovable AI')
    return null
  }
  try {
    const useModel = model || 'google/gemini-3-flash-preview'
    console.log(`Calling Lovable AI (${useModel}) with 15s timeout`)
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: useModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: controller.signal,
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      console.error('Lovable AI error:', response.status, await response.text())
      return null
    }
    const data = await response.json()
    return data.choices?.[0]?.message?.content || null
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.error('Lovable AI timed out after 15s, using fallback')
    } else {
      console.error('Lovable AI call failed:', error)
    }
    return null
  }
}

function getFallbackMessage(order: any, items: any[]): string {
  const lang = detectLanguage(order)
  const firstItem = items[0]
  const itemText = firstItem ? `${firstItem.product_name} x${firstItem.quantity}` : ''
  const moreText = items.length > 1 ? (lang === 'ar' ? ` +${items.length - 1}` : ` +${items.length - 1}`) : ''
  
  if (lang === 'ar') {
    return `${order.customer_name}، طلبك ${order.order_number}\n${itemText}${moreText}\n💰 ${order.total_price} دج\n📍 ${order.wilaya}\nاختر 👇`
  }
  
  return `${order.customer_name}, commande ${order.order_number}\n${itemText}${moreText}\n💰 ${order.total_price} DA\n📍 ${order.wilaya}\nChoisissez 👇`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  // Require either internal trigger secret OR an authenticated admin/confirmateur user
  const auth = await authenticateRequest(req, { requireRoles: ['admin', 'confirmateur'] })
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.message }), {
      status: auth.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    // External AI provider only - no Lovable AI dependency

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
    if (!WASENDER_API_KEY) throw new Error('WASENDER_API_KEY is not configured')

    // Load confirmation config (prompts, model, template)
    const { data: confirmConfig } = await supabase
      .from('automation_settings')
      .select('setting_value')
      .eq('setting_key', 'confirmation')
      .maybeSingle()
    const aiConfig = confirmConfig?.setting_value || {}

    // Load external AI provider config
    const { data: aiProviderData } = await supabase
      .from('automation_settings')
      .select('setting_value')
      .eq('setting_key', 'ai_provider')
      .maybeSingle()
    const aiProviderConfig = aiProviderData?.setting_value || {}

    // Load Lovable AI config
    const { data: lovableAiData } = await supabase
      .from('automation_settings')
      .select('setting_value')
      .eq('setting_key', 'lovable_ai')
      .maybeSingle()
    const lovableAiConfig = lovableAiData?.setting_value || {}

    const { orderIds, mode } = await req.json()

    // Fetch orders
    let query = supabase.from('orders').select('*, order_items(*)').eq('status', 'new').order('created_at', { ascending: true })
    if (mode === 'manual' && orderIds?.length) {
      query = supabase.from('orders').select('*, order_items(*)').in('id', orderIds).eq('status', 'new')
    }
    const { data: orders, error: ordersError } = await query.limit(30)
    if (ordersError) throw ordersError

    if (!orders?.length) {
      return new Response(JSON.stringify({ success: true, message: 'Aucune commande à traiter', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const results = []

    for (const order of orders) {
      try {
        // Check phone validity
        if (!validatePhone(order.customer_phone)) {
          await logResult(supabase, order, 'reject', 'Numéro de téléphone invalide', false, '', 'pending', [])
          results.push({ order_number: order.order_number, decision: 'reject', reason: 'Numéro invalide', whatsapp_sent: false })
          continue
        }

        // Check stock and ai_confirmation flag
        let stockOk = true
        let aiConfirmationBlocked = false
        for (const item of order.order_items) {
          if (item.product_id) {
            const { data: product } = await supabase.from('products').select('current_stock, reserved_stock, ai_confirmation').eq('id', item.product_id).single()
            if (product) {
              if ((product.current_stock - product.reserved_stock) < item.quantity) {
                stockOk = false
                break
              }
              if (product.ai_confirmation === false) {
                aiConfirmationBlocked = true
                break
              }
            }
          }
        }
        if (!stockOk) {
          await logResult(supabase, order, 'reject', 'Stock insuffisant', false, '', 'pending', [])
          results.push({ order_number: order.order_number, decision: 'reject', reason: 'Stock insuffisant', whatsapp_sent: false })
          continue
        }
        if (aiConfirmationBlocked) {
          await logResult(supabase, order, 'skip', 'Produit exclu de la confirmation IA', false, '', 'pending', [])
          results.push({ order_number: order.order_number, decision: 'skip', reason: 'Produit exclu de la confirmation IA', whatsapp_sent: false })
          continue
        }

        // Check if customer is blacklisted
        let customer = null
        if (order.customer_id) {
          const { data } = await supabase.from('customers').select('status, total_orders').eq('id', order.customer_id).single()
          customer = data
        } else {
          const { data } = await supabase.from('customers').select('status, total_orders').eq('phone', order.customer_phone).maybeSingle()
          customer = data
        }

        if (customer?.status === 'blacklisted') {
          await logResult(supabase, order, 'reject', 'Client blacklisté', false, '', 'pending', [])
          results.push({ order_number: order.order_number, decision: 'reject', reason: 'Client blacklisté', whatsapp_sent: false })
          continue
        }

        // Generate AI message
        const aiMessage = await generateAIMessage(order, order.order_items, customer, aiConfig, aiProviderConfig, supabase, lovableAiConfig)

        // Build poll config from settings
        const confirmOpt = (aiConfig?.poll_option_confirm || '').trim() || '✅ نعم (لتأكيد الطلب)'
        const cancelOpt = (aiConfig?.poll_option_cancel || '').trim() || '📞 تواصل مع الوكيل / Contacter un agent'
        const pollOptions = [confirmOpt, cancelOpt]
        const pollConfig = {
          question: (aiConfig?.poll_question || '').trim() || 'يرجى الرد بـ:',
          options: pollOptions,
        }

        // Send WhatsApp message
        const waResult = await sendWhatsApp(WASENDER_API_KEY, order.customer_phone, aiMessage, pollConfig)

        const conversationHistory = [{ role: 'assistant', content: aiMessage, timestamp: new Date().toISOString() }]

        await logResult(
          supabase, order, 'ask_customer',
          'Message IA envoyé au client pour confirmation',
          waResult.success, waResult.response,
          'awaiting_reply', conversationHistory
        )

        results.push({
          order_number: order.order_number,
          decision: 'ask_customer',
          reason: 'Message WhatsApp IA envoyé',
          whatsapp_sent: waResult.success,
        })
      } catch (orderError) {
        console.error(`Error processing order ${order.order_number}:`, orderError)
        results.push({
          order_number: order.order_number,
          decision: 'error',
          reason: orderError instanceof Error ? orderError.message : 'Unknown error',
          whatsapp_sent: false,
        })
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Auto-confirm error:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    const status = msg.includes('rate limit') ? 429 : msg.includes('credits') ? 402 : 500
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function logResult(
  supabase: any, order: any, decision: string, reason: string,
  whatsappSent: boolean, whatsappResponse: string,
  conversationStatus: string, conversationHistory: any[]
) {
  await supabase.from('auto_confirmation_logs').insert({
    order_id: order.id,
    order_number: order.order_number,
    customer_phone: order.customer_phone,
    ai_decision: decision,
    ai_reason: reason,
    checks_result: { phone_valid: true, stock_available: true },
    whatsapp_message_sent: whatsappSent,
    whatsapp_response: whatsappResponse,
    final_status: decision === 'reject' ? 'rejected' : 'pending',
    conversation_status: conversationStatus,
    conversation_history: conversationHistory,
    last_message_at: new Date().toISOString(),
  })
}
