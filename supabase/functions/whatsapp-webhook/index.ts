import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const WASENDER_API_URL = 'https://www.wasenderapi.com/api/send-message'
// External AI providers only

function formatPhoneForWhatsApp(phone: string): string {
  let cleaned = phone.replace(/\s+/g, '').replace(/-/g, '')
  if (cleaned.startsWith('0')) cleaned = '+213' + cleaned.substring(1)
  if (!cleaned.startsWith('+')) cleaned = '+' + cleaned
  return cleaned
}

function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/\s+/g, '').replace(/-/g, '').replace('+', '')
  if (cleaned.startsWith('213')) cleaned = '0' + cleaned.substring(3)
  return cleaned
}

async function sendWhatsApp(apiKey: string, phone: string, message: string) {
  try {
    const response = await fetch(WASENDER_API_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: formatPhoneForWhatsApp(phone), text: message }),
    })
    const data = await response.json()
    return { success: response.ok, response: JSON.stringify(data) }
  } catch (error) {
    return { success: false, response: error instanceof Error ? error.message : 'Unknown error' }
  }
}

function detectReplyLanguage(customerReply: string, conversationHistory: any[]): 'ar' | 'fr' {
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/
  // Check customer reply first
  if (arabicRegex.test(customerReply)) return 'ar'
  // Check conversation history for Arabic
  for (const m of conversationHistory) {
    if (m.role === 'user' && arabicRegex.test(m.content)) return 'ar'
  }
  // French keywords detection
  const frenchWords = /\b(oui|non|bonjour|merci|commande|livraison|annuler|confirmer|salut|ok|d'accord)\b/i
  if (frenchWords.test(customerReply)) return 'fr'
  // Default to French (most Algerian clients write in Franco-Arabic)
  return 'fr'
}

async function generateAIReply(conversationHistory: any[], customerReply: string, order: any, aiProviderConfig: any, lovableAiConfig?: any): Promise<{ message: string; action: 'confirm' | 'cancel' | 'continue' }> {
  const orderStatus = order.status || 'unknown'
  const replyLang = detectReplyLanguage(customerReply, conversationHistory)
  const langInstruction = replyLang === 'ar'
    ? 'IMPORTANT: Le client parle en ARABE. Tu DOIS répondre en arabe dialectal algérien (darija). NE réponds PAS en français.'
    : 'IMPORTANT: Le client parle en FRANÇAIS. Tu DOIS répondre en français. NE réponds PAS en arabe.'

  const systemPrompt = `Tu es un assistant commercial pour OUTIS COD, une plateforme e-commerce algérienne.
Tu gères une conversation WhatsApp avec un client concernant sa commande.

${langInstruction}

Commande: ${order.order_number}
Client: ${order.customer_name}
Total: ${order.total_price} DA
Statut actuel: ${orderStatus}

STATUTS DE LA PLATEFORME (du début à la fin):
- new: Nouvelle commande
- validated: Validée
- confirmed: Confirmée par le client
- preparing: En préparation
- ready: Prête
- to_station: Vers station
- shipped: Expédiée
- at_station: En station (centre de tri)
- au_bureau: Au bureau de livraison
- en_livraison: En cours de livraison
- delivered: Livrée
- delivered_paid: Livrée et payée
- cancelled: Annulée
- failed_1/failed_2/failed_3: Tentatives échouées
- no_answer: Pas de réponse
- wrong_number: Mauvais numéro
- postponed: Reportée
- to_reconfirm: À reconfirmer
- callback: Rappeler
- duplicate: Doublon
- out_of_stock: Rupture de stock
- returned: Retournée
- exchange: Échange
- erreur: Erreur
- Échec_de_livraison: Échec de livraison
- alerte: Alerte

RÈGLES:
- Le statut actuel de la commande est "${orderStatus}". ADAPTE ta réponse en conséquence.
- Si la commande est déjà en statut avancé (preparing, ready, shipped, at_station, au_bureau, en_livraison, delivered, delivered_paid), NE propose PAS de confirmer/annuler. Informe le client sur l'état de sa livraison.
- Si la commande est en phase de confirmation (new, validated, failed_*, no_answer, postponed, to_reconfirm, callback):
  - Si le client dit OUI, confirme, d'accord, ok, نعم, واه, يح → action: "confirm"
  - Si le client dit NON, annule, لا → action: "cancel"
- Si le client pose des questions → action: "continue" et réponds à sa question
- Sois bref, poli et professionnel

Retourne ta réponse UNIQUEMENT sous forme JSON: {"message": "...", "action": "confirm|cancel|continue"}`

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...conversationHistory.map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: customerReply },
  ]

  // Try external AI first
  if (aiProviderConfig?.use_external && aiProviderConfig?.api_key) {
    try {
      const result = await callExternalAIReply(messages, systemPrompt, conversationHistory, customerReply, order, aiProviderConfig)
      if (result) return result
    } catch (error) {
      console.error('External AI reply error:', error)
    }
  }

  // Try Lovable AI fallback ONLY if enabled in settings
  if (lovableAiConfig?.enabled) {
    console.log('Lovable AI is enabled, trying fallback')
    const lovableResult = await callLovableAIReply(messages, lovableAiConfig?.model)
    if (lovableResult) return lovableResult
  } else {
    console.log('Lovable AI is disabled, skipping fallback')
  }

  console.log('All AI providers failed, using static fallback')
  return { message: 'Merci pour votre réponse. Un agent va traiter votre commande.', action: 'continue' }
}

async function callLovableAIReply(messages: any[], model?: string): Promise<{ message: string; action: 'confirm' | 'cancel' | 'continue' } | null> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
  if (!LOVABLE_API_KEY) {
    console.log('LOVABLE_API_KEY not configured, skipping Lovable AI')
    return null
  }
  try {
    const useModel = model || 'google/gemini-3-flash-preview'
    console.log(`Calling Lovable AI for reply (${useModel})`)
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: useModel,
        messages,
        tools: [{
          type: 'function',
          function: {
            name: 'respond_to_customer',
            description: 'Send a response to the customer and decide the action',
            parameters: {
              type: 'object',
              properties: {
                message: { type: 'string', description: 'The WhatsApp message to send back' },
                action: { type: 'string', enum: ['confirm', 'cancel', 'continue'], description: 'What to do with the order' },
              },
              required: ['message', 'action'],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'respond_to_customer' } },
      }),
    })
    if (!response.ok) {
      console.error('Lovable AI reply error:', response.status, await response.text())
      return null
    }
    const data = await response.json()
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0]
    if (toolCall?.function?.arguments) {
      const args = JSON.parse(toolCall.function.arguments)
      return { message: args.message, action: args.action }
    }
    // Try parsing content as JSON fallback
    const content = data.choices?.[0]?.message?.content
    if (content) {
      try {
        const parsed = JSON.parse(content)
        if (parsed.message && parsed.action) return parsed
      } catch {}
      return { message: content, action: 'continue' }
    }
    return null
  } catch (error) {
    console.error('Lovable AI reply call failed:', error)
    return null
  }
}

async function callExternalAIReply(messages: any[], systemPrompt: string, conversationHistory: any[], customerReply: string, order: any, aiProviderConfig: any): Promise<{ message: string; action: 'confirm' | 'cancel' | 'continue' } | null> {
  const isGemini = aiProviderConfig.provider === 'google'
  const aiKey = aiProviderConfig.api_key

  if (isGemini) {
    const model = 'gemini-2.0-flash'
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${aiKey}`

    const geminiMessages = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))
    const systemMsg = geminiMessages.shift()

    console.log(`Calling Gemini ${model} (single attempt, fail-fast)`)
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: systemMsg ? { parts: [{ text: systemMsg.parts[0].text }] } : undefined,
        contents: geminiMessages,
        tools: [{
          function_declarations: [{
            name: 'respond_to_customer',
            description: 'Send a response to the customer and decide the action',
            parameters: {
              type: 'OBJECT',
              properties: {
                message: { type: 'STRING', description: 'The WhatsApp message to send back' },
                action: { type: 'STRING', enum: ['confirm', 'cancel', 'continue'], description: 'What to do with the order' },
              },
              required: ['message', 'action'],
            },
          }],
        }],
        tool_config: { function_calling_config: { mode: 'ANY', allowed_function_names: ['respond_to_customer'] } },
        generationConfig: { temperature: 0.7 },
      }),
    })

    if (response.ok) {
      const data = await response.json()
      const part = data.candidates?.[0]?.content?.parts?.[0]
      if (part?.functionCall?.args) {
        return { message: part.functionCall.args.message, action: part.functionCall.args.action }
      }
      if (part?.text) {
        return { message: part.text, action: 'continue' }
      }
      return { message: "Merci pour votre réponse. Pouvez-vous confirmer avec OUI ou NON ?", action: 'continue' }
    }

    const t = await response.text()
    console.error(`Gemini fail-fast error ${response.status}, falling back immediately`)
    throw new Error(`Gemini error ${response.status}`)
  }

  // OpenAI-compatible path
  if (!aiProviderConfig.base_url) throw new Error('base_url is required')
  const response = await fetch(aiProviderConfig.base_url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${aiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: aiProviderConfig.model || 'gpt-4o',
      messages,
      tools: [{
        type: 'function',
        function: {
          name: 'respond_to_customer',
          description: 'Send a response to the customer and decide the action',
          parameters: {
            type: 'object',
            properties: {
              message: { type: 'string', description: 'The WhatsApp message to send back' },
              action: { type: 'string', enum: ['confirm', 'cancel', 'continue'], description: 'What to do with the order' },
            },
            required: ['message', 'action'],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: 'function', function: { name: 'respond_to_customer' } },
      stream: false,
    }),
  })

  if (!response.ok) throw new Error(`AI error: ${response.status}`)

  const data = await response.json()
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0]
  if (toolCall?.function?.arguments) {
    const args = JSON.parse(toolCall.function.arguments)
    return { message: args.message, action: args.action }
  }
  return { message: "Merci pour votre réponse. Pouvez-vous confirmer avec OUI ou NON ?", action: 'continue' }
}


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Handle GET verification request from WaSender
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const token = url.searchParams.get('token') || url.searchParams.get('verify_token') || url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('challenge') || url.searchParams.get('hub.challenge')
    
    // Check env var first, then fall back to DB
    const envVerifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN')
    
    const supabaseVerify = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: tokenConfig } = await supabaseVerify
      .from('automation_settings')
      .select('setting_value')
      .eq('setting_key', 'webhook_verify_token')
      .maybeSingle()
    
    const storedToken = envVerifyToken || tokenConfig?.setting_value?.token
    if (storedToken && token === storedToken) {
      return new Response(challenge || 'verified', { status: 200, headers: corsHeaders })
    }
    return new Response('Invalid token', { status: 403, headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const rawBody = await req.text()

    // WaSender webhook signature validation
    // WaSender uses X-Webhook-Signature header with a simple secret comparison (NOT HMAC)
    // See: https://wasenderapi.com/api-docs/webhooks/webhook-setup
    const { data: tokenConfig } = await supabase
      .from('automation_settings')
      .select('setting_value')
      .eq('setting_key', 'webhook_verify_token')
      .maybeSingle()
    
    const storedToken = tokenConfig?.setting_value?.token
    const webhookSignature = req.headers.get('x-webhook-signature')
    
    if (!storedToken) {
      console.error('Webhook signature is not configured; refusing webhook traffic')
      return new Response('Webhook not configured', { status: 503, headers: corsHeaders })
    }
    if (!webhookSignature || webhookSignature !== storedToken) {
      console.error('❌ Missing or invalid X-Webhook-Signature')
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    const body = JSON.parse(rawBody)

    console.log('Webhook received:', JSON.stringify(body).substring(0, 1500))

    const eventType = body.event || ''

    // ===== POLL VOTE HANDLER =====
    // WASender sends poll votes as messages.update with pollUpdates in data,
    // or as poll.results event. Handle BOTH before skipping non-message events.
    const isPollEvent = eventType === 'poll.results' || eventType === 'messages.update'
    if (isPollEvent) {
      // Extract ALL poll votes to determine who voted what
      let selectedOption = ''
      let voterPhone = ''
      let allVotes: { option: string; voters: string[] }[] = []
      
      // Structure 1: poll.results event
      if (eventType === 'poll.results') {
        const pollResult = body.data?.pollResult || body.pollResult || body.data || []
        // remoteJid in poll.results key is often a LID, not useful for voter identification
        const keyJid = (body.data?.key?.remoteJid || body.data?.remoteJid || body.remoteJid || '').replace('@s.whatsapp.net', '').replace('@lid', '')
        
        if (Array.isArray(pollResult)) {
          for (const opt of pollResult) {
            const voters = opt.voters || opt.optionVoters || []
            const votersList = voters.map((v: any) => typeof v === 'string' ? v.replace('@s.whatsapp.net', '') : (v?.jid || v?.id || '').replace('@s.whatsapp.net', ''))
            const hasVoters = votersList.length > 0 || opt.votes > 0 || opt.count > 0
            if (hasVoters) {
              allVotes.push({ 
                option: opt.optionName || opt.name || '', 
                voters: votersList
              })
              // Set selectedOption to the option that has voters
              if (votersList.length > 0 && !selectedOption) {
                selectedOption = opt.optionName || opt.name || ''
                // Use the first voter's phone as voterPhone
                voterPhone = votersList[0]
              }
            }
          }
          // Fallback: if no voter details in any option, use last voted option
          if (!selectedOption && allVotes.length > 0) {
            selectedOption = allVotes[allVotes.length - 1].option
            voterPhone = keyJid
          }
        }
        
        // If still no voterPhone, use keyJid
        if (!voterPhone) voterPhone = keyJid
        
        console.log('poll.results parsed: selectedOption=', selectedOption, 'voterPhone=', voterPhone, 'allVotes=', JSON.stringify(allVotes))
      }
      
      // Structure 2: messages.update with pollUpdates (Baileys/WASender format)
      if (!selectedOption && eventType === 'messages.update') {
        const msgData = body.data || {}
        voterPhone = (msgData.remoteJid || msgData.key?.remoteJid || '').replace('@s.whatsapp.net', '')
        
        // Check for pollUpdates array (Baileys native format)
        const pollUpdates = msgData.pollUpdates || msgData.update?.pollUpdates || []
        if (Array.isArray(pollUpdates) && pollUpdates.length > 0) {
          const vote = pollUpdates[0]?.vote || pollUpdates[0]
          const selectedOptions = vote?.selectedOptions || []
          if (selectedOptions.length > 0) {
            selectedOption = selectedOptions[0]?.optionName || selectedOptions[0]?.name || 
                           (typeof selectedOptions[0] === 'string' ? selectedOptions[0] : '')
          }
        }
        
        // Check for pollUpdateMessage in message field
        if (!selectedOption) {
          const pollUpdateMsg = msgData.message?.pollUpdateMessage || msgData.pollUpdate
          if (pollUpdateMsg) {
            const opts = pollUpdateMsg.selectedOptions || pollUpdateMsg.votes || []
            if (opts.length > 0) {
              selectedOption = opts[0]?.optionName || opts[0] || ''
            }
          }
        }
      }
      
      console.log('Poll vote extraction:', selectedOption, 'from:', voterPhone, 'event:', eventType)
      
      // Load poll config from DB
      const { data: pollConfig } = await supabase
        .from('automation_settings')
        .select('setting_value')
        .eq('setting_key', 'livreur_whatsapp_template')
        .maybeSingle()
      
      const pollOptionsConfig = (pollConfig?.setting_value as any)?.poll_options as { label: string; status: string }[] | undefined
      
      // Build status map from config or use defaults
      const statusMap: Record<string, string> = {}
      if (pollOptionsConfig && pollOptionsConfig.length > 0) {
        for (const opt of pollOptionsConfig) {
          statusMap[opt.label.toLowerCase().trim()] = opt.status
        }
      } else {
        // Defaults
        statusMap['livre'] = 'delivered'
        statusMap['livré'] = 'delivered'
        statusMap['repondre pas'] = 'alerte'
        statusMap['retour'] = 'Échec_de_livraison'
        statusMap['reporter'] = 'alerte'
      }
      
      const mappedStatus = statusMap[selectedOption.toLowerCase().trim()]
      if (mappedStatus) {
        let WASENDER_API_KEY = Deno.env.get('WASENDER_API_KEY')
        const { data: wasenderCfg } = await supabase
          .from('automation_settings')
          .select('setting_value')
          .eq('setting_key', 'wasender_config')
          .maybeSingle()
        if (wasenderCfg?.setting_value?.api_key) {
          WASENDER_API_KEY = wasenderCfg.setting_value.api_key
        }
        if (!WASENDER_API_KEY) throw new Error('WASENDER_API_KEY not configured')

        // Include remoteJid in phone check (voterPhone may be "me" for admin votes)
        const remoteJidForLivreur = (body.data?.key?.remoteJid || body.data?.remoteJid || '').replace('@s.whatsapp.net', '').replace('@lid', '')
        const phonesToCheck = [voterPhone, remoteJidForLivreur].filter(p => p && p !== 'me' && p.length >= 9).map(normalizePhone)
        const { data: allLivreurs } = await supabase
          .from('local_livreurs').select('id, name, phone').eq('is_active', true)
        
        const matchedLivreur = allLivreurs?.find((l: any) => phonesToCheck.includes(normalizePhone(l.phone)))
        
        if (matchedLivreur) {
          // Determine admin phone (WASender session owner)
          let adminPhone = ''
          try {
            const sessionsRes = await fetch('https://www.wasenderapi.com/api/whatsapp-sessions', {
              headers: { 'Authorization': `Bearer ${WASENDER_API_KEY}` },
            })
            const sessionsData = await sessionsRes.json()
            const sessions = sessionsData?.data || sessionsData || []
            const activeSession = Array.isArray(sessions) ? sessions.find((s: any) => s.status === 'connected') : null
            if (activeSession?.phone_number) {
              adminPhone = normalizePhone(activeSession.phone_number)
            }
          } catch (e) {
            console.log('Could not fetch admin phone:', e)
          }
          
          // Check if admin voted on this poll (admin vote = priority)
          let finalOption = selectedOption
          let votedBy = 'livreur'
          
          if (allVotes.length > 0) {
            // Look for admin's vote in all votes
            // WASender reports admin voter as "me" string
            let adminVote = ''
            let livreurVote = ''
            for (const v of allVotes) {
              if (v.voters.length === 0) continue
              for (const voter of v.voters) {
                // "me" = admin (WASender session owner)
                if (voter === 'me' || (adminPhone && normalizePhone(voter) === adminPhone)) {
                  adminVote = v.option
                } else if (normalizePhone(voter) === normalizePhone(matchedLivreur.phone)) {
                  livreurVote = v.option
                }
              }
            }
            
            console.log(`Vote analysis: adminVote="${adminVote}", livreurVote="${livreurVote}", adminPhone="${adminPhone}"`)
            
            // Admin vote ALWAYS takes priority
            if (adminVote) {
              finalOption = adminVote
              votedBy = 'admin'
              console.log(`👑 Admin vote detected: ${adminVote} (overrides livreur)`)
            } else if (livreurVote) {
              finalOption = livreurVote
              votedBy = 'livreur'
            }
          }
          
          const finalStatus = statusMap[finalOption.toLowerCase().trim()]
          if (!finalStatus) {
            console.log('No status mapping for option:', finalOption)
            return new Response(JSON.stringify({ success: true, message: 'No mapping for vote' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }
          
          // Extract order info from poll message to find the CORRECT order
          const pollMsgContent = body.data?.pollMsg?.pollCreationMessageV3?.name || body.data?.pollMsg?.name || ''
          const pollOrderNumMatch = pollMsgContent.match(/(ORD-\d+)/i)
          const pollOrderNum = pollOrderNumMatch ? pollOrderNumMatch[1] : ''
          
          // Try multiple regex patterns for phone (encoding of é in Téléphone can vary)
          const phonePatterns = [
            /T[eé]l[eé]phone[:\s]*(\+?[\d\s-]+)/i,
            /📞[^0-9+]*(\+?[\d\s-]{9,})/,
            /\b(0[567]\d{8})\b/,
            /(\+?213[567]\d{8})/,
          ]
          let pollCustomerPhone = ''
          for (const pat of phonePatterns) {
            const m = pollMsgContent.match(pat)
            if (m) {
              pollCustomerPhone = m[1].replace(/\s+/g, '').replace(/-/g, '')
              break
            }
          }
          
          console.log(`Poll content extraction: orderNum="${pollOrderNum}", customerPhone="${pollCustomerPhone}", pollMsgLen=${pollMsgContent.length}, first80="${pollMsgContent.substring(0, 80)}"`)

          
          let targetOrder: any = null
          
          // Strategy 1: Find by order number from poll content
          if (pollOrderNum) {
            const { data: ordersByNum } = await supabase
              .from('orders')
              .select('id, order_number, status')
              .eq('order_number', pollOrderNum)
              .limit(1)
            if (ordersByNum && ordersByNum.length > 0) {
              targetOrder = ordersByNum[0]
              console.log(`Found order by poll order number: ${targetOrder.order_number}`)
            }
          }
          
          // Strategy 2: Find by customer phone from poll content
          if (!targetOrder && pollCustomerPhone) {
            const normalizedPollPhone = normalizePhone(pollCustomerPhone)
            const { data: ordersByPhone } = await supabase
              .from('orders')
              .select('id, order_number, status')
              .eq('customer_phone', normalizedPollPhone)
              .eq('delivery_company', `local:${matchedLivreur.name}`)
              .in('status', ['shipped', 'en_livraison', 'preparing', 'ready', 'to_station', 'at_station', 'au_bureau', 'Échec_de_livraison', 'delivered', 'delivered_paid', 'alerte'])
              .order('updated_at', { ascending: false })
              .limit(1)
            if (ordersByPhone && ordersByPhone.length > 0) {
              targetOrder = ordersByPhone[0]
              console.log(`Found order by poll customer phone: ${targetOrder.order_number}`)
            }
          }
          
          // Strategy 3: Fallback to most recent order for this livreur
          if (!targetOrder) {
            const { data: recentOrders } = await supabase
              .from('orders')
              .select('id, order_number, status')
              .eq('delivery_company', `local:${matchedLivreur.name}`)
              .in('status', ['shipped', 'en_livraison', 'preparing', 'ready', 'to_station', 'at_station', 'au_bureau', 'Échec_de_livraison', 'delivered', 'delivered_paid', 'alerte'])
              .order('updated_at', { ascending: false })
              .limit(1)
            if (recentOrders && recentOrders.length > 0) {
              targetOrder = recentOrders[0]
              console.log(`Fallback: using most recent order for livreur: ${targetOrder.order_number}`)
            }
          }
          
          if (targetOrder) {
            
            // GUARD: refuse "Livre" vote when order hasn't actually left for delivery yet.
            const BLOCKED_FOR_LIVRE = ['preparing', 'ready', 'to_station', 'erreur']
            if (finalStatus === 'delivered' && votedBy !== 'admin' && BLOCKED_FOR_LIVRE.includes(targetOrder.status)) {
              console.log(`⛔ Vote "Livre" refusé: ${targetOrder.order_number} est en "${targetOrder.status}"`)
              await supabase.from('order_history').insert({
                order_id: targetOrder.id,
                old_status: targetOrder.status,
                new_status: targetOrder.status,
                notes: `⛔ Vote "Livre" ignoré (statut actuel: ${targetOrder.status}). La commande doit être au moins "Au bureau" ou "En livraison".`,
                changed_by: `Livreur: ${matchedLivreur.name}`,
              })
              return new Response(JSON.stringify({ success: false, message: 'Order not yet out for delivery' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              })
            }
            
            // Deduplication: check if this order was already updated via poll in the last 60 seconds
            const sixtySecondsAgo = new Date(Date.now() - 60000).toISOString()
            const { data: recentPollUpdates } = await supabase
              .from('order_history')
              .select('id, new_status, notes, created_at')
              .eq('order_id', targetOrder.id)
              .like('notes', '%via sondage WhatsApp%')
              .gte('created_at', sixtySecondsAgo)
              .order('created_at', { ascending: false })
              .limit(1)
            
            if (recentPollUpdates && recentPollUpdates.length > 0) {
              const lastUpdate = recentPollUpdates[0]
              // If same status was already set, skip (pure duplicate)
              if (lastUpdate.new_status === finalStatus) {
                console.log(`⏭️ Duplicate poll vote ignored: ${targetOrder.order_number} already ${finalStatus}`)
                return new Response(JSON.stringify({ success: true, message: 'Duplicate poll vote ignored' }), {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                })
              }
              // If a different status was set recently, only allow admin to override
              if (votedBy !== 'admin') {
                console.log(`⏭️ Order ${targetOrder.order_number} was updated ${Math.round((Date.now() - new Date(lastUpdate.created_at).getTime()) / 1000)}s ago, ignoring duplicate event`)
                return new Response(JSON.stringify({ success: true, message: 'Recent poll update exists, ignoring' }), {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                })
              }
            }
            
            

            await supabase.from('orders').update({ 
              status: finalStatus, updated_at: new Date().toISOString() 
            }).eq('id', targetOrder.id)
            
            // The orders UPDATE trigger auto-inserts a "Système" history row.
            // Remove it so we don't end up with a duplicate alongside our "Livreur: ..." entry.
            const fiveSecondsAgo = new Date(Date.now() - 5000).toISOString()
            await supabase
              .from('order_history')
              .delete()
              .eq('order_id', targetOrder.id)
              .eq('old_status', targetOrder.status)
              .eq('new_status', finalStatus)
              .eq('changed_by', 'Système')
              .gte('created_at', fiveSecondsAgo)
            
            // Record in order_history with voter type (single, manual entry)
            await supabase.from('order_history').insert({
              order_id: targetOrder.id,
              old_status: targetOrder.status,
              new_status: finalStatus,
              notes: `Statut mis à jour via sondage WhatsApp (${votedBy}): ${finalOption}`,
              changed_by: votedBy === 'admin' ? 'Admin' : `Livreur: ${matchedLivreur.name}`,
            })
            
            // Store livreur vote in deliveries table for Situation column display
            const voteLabel = finalOption
            const { data: existingDelivery } = await supabase
              .from('deliveries')
              .select('id')
              .eq('order_id', targetOrder.id)
              .maybeSingle()
            
            if (existingDelivery) {
              await supabase.from('deliveries').update({
                delivery_status: finalStatus,
                delivery_situation: voteLabel,
                last_update: new Date().toISOString(),
              }).eq('id', existingDelivery.id)
            } else {
              await supabase.from('deliveries').insert({
                order_id: targetOrder.id,
                carrier: `local:${matchedLivreur.name}`,
                delivery_status: finalStatus,
                delivery_situation: voteLabel,
                last_update: new Date().toISOString(),
              })
            }
            
            console.log(`✅ Order ${targetOrder.order_number} updated to ${finalStatus} via poll vote (${votedBy})`)
            
            // Notification message to WhatsApp disabled on purpose (user request)
            // We only update order status/history without sending "Commande ... mise à jour" messages.
            
            return new Response(JSON.stringify({ success: true, message: 'Status updated via poll' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }
        }
        
        // No livreur matched - check if this is an admin vote (voterPhone = "me")
        // Extract order info from the poll message content
        const pollMsgName = body.data?.pollMsg?.pollCreationMessageV3?.name || body.data?.pollMsg?.name || body.data?.pollCreationMessage?.name || ''
        console.log('Admin vote fallback - pollMsgName length:', pollMsgName.length, 'first100:', pollMsgName.substring(0, 100))
        
        const orderNumMatch = pollMsgName.match(/(ORD-\d+)/i)
        const extractedOrderNum = orderNumMatch ? orderNumMatch[1] : ''
        
        // Try multiple regex patterns for phone extraction
        const adminPhonePatterns = [
          /T[eé]l[eé]phone[:\s]*(\+?[\d\s-]+)/i,
          /📞[^0-9+]*(\+?[\d\s-]{9,})/,
          /\b(0[567]\d{8})\b/,
          /(\+?213[567]\d{8})/,
        ]
        let extractedPhone = ''
        for (const pat of adminPhonePatterns) {
          const m = pollMsgName.match(pat)
          if (m) {
            extractedPhone = m[1].replace(/\s+/g, '').replace(/-/g, '')
            break
          }
        }
        
        // Also use remoteJid as fallback for finding the order's customer phone
        const remoteJidFallback = (body.data?.key?.remoteJid || body.data?.remoteJid || '').replace('@s.whatsapp.net', '').replace('@lid', '')
        const remoteJidNormalized = remoteJidFallback ? normalizePhone(remoteJidFallback) : ''
        
        console.log('Admin vote fallback - extractedPhone:', extractedPhone, 'extractedOrderNum:', extractedOrderNum, 'remoteJidNormalized:', remoteJidNormalized)
        
        // Try to find the order using: 1) order number, 2) extracted phone, 3) remoteJid as customer phone
        const searchPhones = [extractedPhone, remoteJidNormalized].filter(p => p && p.length >= 9)
        
        if (extractedOrderNum || searchPhones.length > 0) {
          let targetOrder: any = null
          
          if (extractedOrderNum) {
            const { data: ordersByNum } = await supabase.from('orders').select('id, order_number, status, delivery_company')
              .eq('order_number', extractedOrderNum)
              .in('status', ['shipped', 'en_livraison', 'preparing', 'ready', 'to_station', 'at_station', 'au_bureau', 'Échec_de_livraison', 'delivered', 'delivered_paid', 'alerte'])
              .limit(1)
            if (ordersByNum && ordersByNum.length > 0) targetOrder = ordersByNum[0]
          }
          
          if (!targetOrder) {
            for (const phone of searchPhones) {
              const normalizedPhone = normalizePhone(phone)
              // Try matching by customer phone
              const { data: ordersByPhone } = await supabase.from('orders').select('id, order_number, status, delivery_company')
                .eq('customer_phone', normalizedPhone)
                .in('status', ['shipped', 'en_livraison', 'preparing', 'ready', 'to_station', 'at_station', 'au_bureau', 'Échec_de_livraison', 'delivered', 'delivered_paid', 'alerte'])
                .order('updated_at', { ascending: false })
                .limit(1)
              if (ordersByPhone && ordersByPhone.length > 0) {
                targetOrder = ordersByPhone[0]
                break
              }
            }
          }
          
          // Fallback: remoteJid might be the livreur's phone (poll was sent to livreur chat)
          if (!targetOrder && remoteJidNormalized) {
            const { data: livreurByPhone } = await supabase.from('local_livreurs')
              .select('name, phone').eq('is_active', true)
            const matchedByRemoteJid = livreurByPhone?.find((l: any) => normalizePhone(l.phone || '') === remoteJidNormalized)
            if (matchedByRemoteJid) {
              const { data: livreurOrders } = await supabase.from('orders').select('id, order_number, status, delivery_company')
                .eq('delivery_company', `local:${matchedByRemoteJid.name}`)
                .in('status', ['shipped', 'en_livraison', 'preparing', 'ready', 'to_station', 'at_station', 'au_bureau', 'Échec_de_livraison', 'delivered', 'delivered_paid', 'alerte'])
                .order('updated_at', { ascending: false })
                .limit(1)
              if (livreurOrders && livreurOrders.length > 0) {
                targetOrder = livreurOrders[0]
                console.log('Found order via remoteJid→livreur match:', targetOrder.order_number)
              }
            }
          }
          
          if (targetOrder) {
            await supabase.from('orders').update({ 
              status: mappedStatus, updated_at: new Date().toISOString() 
            }).eq('id', targetOrder.id)
            
            await supabase.from('order_history').insert({
              order_id: targetOrder.id,
              old_status: targetOrder.status,
              new_status: mappedStatus,
              notes: `Statut mis à jour via sondage WhatsApp (admin): ${selectedOption}`,
              changed_by: 'Admin',
            })
            
            console.log(`✅ Order ${targetOrder.order_number} updated to ${mappedStatus} via admin poll vote`)
            
            return new Response(JSON.stringify({ success: true, message: 'Status updated via admin poll vote' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }
        }
      }
      
      // ===== CUSTOMER CONFIRMATION / DELIVERY TYPE POLL VOTE =====
      // This runs regardless of livreur status mapping
      // Use voterPhone (from poll voters array) as primary - it's the real phone number
      // remoteJid in poll.results is often a WhatsApp LID (Linked ID), NOT the real phone
      const remoteJidRaw = (body.data?.key?.remoteJid || body.data?.remoteJid || '').replace('@s.whatsapp.net', '').replace('@lid', '')
      // A LID is typically a long number (15+ digits) that doesn't start with a country code
      // Real Algerian phones: 213XXXXXXXXX (12 digits) or 0XXXXXXXXX (10 digits)
      const isLID = remoteJidRaw.length > 13 || (!remoteJidRaw.startsWith('213') && !remoteJidRaw.startsWith('0') && remoteJidRaw.length > 10)
      const remoteJidPhone = isLID ? '' : remoteJidRaw
      // Prefer voterPhone (from poll voters list) over remoteJid which may be a LID
      const realCustomerPhone = voterPhone || remoteJidPhone
      console.log('Checking customer poll vote. voterPhone:', voterPhone, 'remoteJidPhone:', remoteJidRaw, 'isLID:', isLID, 'realCustomerPhone:', realCustomerPhone, 'selectedOption:', selectedOption)
      
      // Load confirmation poll config
      const { data: confirmPollConfig } = await supabase
        .from('automation_settings')
        .select('setting_value')
        .eq('setting_key', 'confirmation')
        .maybeSingle()
      const confirmSettings = confirmPollConfig?.setting_value || {}
      
      // === STOP DESK SELECTION POLL VOTE HANDLER (Poll 3) ===
      {
        const customerPhoneSD = normalizePhone(realCustomerPhone)
        const { data: sdLogs } = await supabase
          .from('auto_confirmation_logs')
          .select('*, orders:order_id(*)')
          .eq('conversation_status', 'awaiting_stop_desk_selection')
          .order('created_at', { ascending: false })
          .limit(10)
        
        const matchingSdLog = sdLogs?.find((log: any) => {
          const orderPhone = log.orders?.customer_phone
          const logPhone = log.customer_phone
          const phonesToMatch = [orderPhone, logPhone].filter(Boolean).map(normalizePhone)
          return phonesToMatch.includes(customerPhoneSD)
        })
        
        if (matchingSdLog && selectedOption && selectedOption.trim().length > 0) {
          // Client selected a stop desk from Poll 3
          const oldStatus = matchingSdLog.orders?.status || 'new'
          const selectedStopDesk = selectedOption.trim()
          
          // Update order: confirmed + stop_desk + address with selected stop desk
          await supabase.from('orders').update({
            status: 'confirmed',
            delivery_type: 'stop_desk',
            customer_address: `Stop Desk: ${selectedStopDesk}`,
            confirmed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('id', matchingSdLog.order_id)
          
          await supabase.from('order_history').insert({
            order_id: matchingSdLog.order_id,
            old_status: oldStatus,
            new_status: 'confirmed',
            changed_by: 'Client (Poll)',
            notes: `Confirmé via sondage WhatsApp. Stop desk choisi: ${selectedStopDesk}`,
          })
          
          const sdHistory = (matchingSdLog.conversation_history as any[]) || []
          await supabase.from('auto_confirmation_logs').update({
            conversation_status: 'completed',
            final_status: 'confirmed',
            conversation_history: [
              ...sdHistory,
              { role: 'user', content: `[Stop desk selected: ${selectedStopDesk}]`, timestamp: new Date().toISOString() },
            ],
            last_message_at: new Date().toISOString(),
          }).eq('id', matchingSdLog.id)
          
          let WS_KEY_SD = Deno.env.get('WASENDER_API_KEY')
          const { data: wsCfgSd } = await supabase
            .from('automation_settings')
            .select('setting_value')
            .eq('setting_key', 'wasender_config')
            .maybeSingle()
          if (wsCfgSd?.setting_value?.api_key) WS_KEY_SD = wsCfgSd.setting_value.api_key
          
          if (WS_KEY_SD) {
            const finalMsg = `✅ شكراً! تم تأكيد طلبك ${matchingSdLog.order_number} بنجاح.\n📦 ستوب ديسك: ${selectedStopDesk}\nسيتم التوصيل قريباً إن شاء الله 🚚\n\nMerci ! Commande ${matchingSdLog.order_number} confirmée.\n📦 Stop desk: ${selectedStopDesk}`
            await sendWhatsApp(WS_KEY_SD, matchingSdLog.customer_phone, finalMsg)
          }
          
          console.log(`📦 Order ${matchingSdLog.order_number} stop desk selected: ${selectedStopDesk}`)
          
          return new Response(JSON.stringify({ success: true, action: 'stop_desk_selected', stopDesk: selectedStopDesk }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }
      
      // === DELIVERY TYPE POLL VOTE HANDLER ===
      const { data: dtCfgCheck } = await supabase
        .from('automation_settings')
        .select('setting_value')
        .eq('setting_key', 'delivery_type_template')
        .maybeSingle()
      const dtCfg = dtCfgCheck?.setting_value || {}
      const dtOptionHome = (dtCfg?.poll_option_home || '🏠 توصيل للدار / Livraison à domicile').toLowerCase().trim()
      const dtOptionStopDesk = (dtCfg?.poll_option_stop_desk || '📦 ستوب ديسك / Stop desk').toLowerCase().trim()
      
      const selectedLower = selectedOption.toLowerCase().trim()
      const isDeliveryHome = selectedLower === dtOptionHome || selectedLower.includes('🏠') || selectedLower.includes('domicile') || selectedLower.includes('للدار') || selectedLower.includes('للبيت')
      const isDeliveryStopDesk = selectedLower === dtOptionStopDesk || selectedLower.includes('📦') || selectedLower.includes('stop desk') || selectedLower.includes('ستوب') || selectedLower.includes('استلام')
      
      if (isDeliveryHome || isDeliveryStopDesk) {
        const customerPhone = normalizePhone(realCustomerPhone)
        
        const { data: dtLogs } = await supabase
          .from('auto_confirmation_logs')
          .select('*, orders:order_id(*)')
          .eq('conversation_status', 'awaiting_delivery_type')
          .order('created_at', { ascending: false })
          .limit(10)
        
        const matchingDtLog = dtLogs?.find((log: any) => {
          const orderPhone = log.orders?.customer_phone
          const logPhone = log.customer_phone
          const phonesToMatch = [orderPhone, logPhone].filter(Boolean).map(normalizePhone)
          return phonesToMatch.includes(customerPhone)
        })
        
        if (matchingDtLog) {
          const currentOrder = matchingDtLog.orders
          const oldStatus = currentOrder?.status || 'new'
          
          // HOME delivery → confirm immediately (same as before)
          if (isDeliveryHome) {
            await supabase.from('orders').update({
              status: 'confirmed',
              delivery_type: 'home',
              confirmed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }).eq('id', matchingDtLog.order_id)
            
            await supabase.from('order_history').insert({
              order_id: matchingDtLog.order_id,
              old_status: oldStatus,
              new_status: 'confirmed',
              changed_by: 'Client (Poll)',
              notes: `Confirmé et type de livraison choisi via sondage WhatsApp: Domicile`,
            })
            
            const dtHistory = (matchingDtLog.conversation_history as any[]) || []
            await supabase.from('auto_confirmation_logs').update({
              conversation_status: 'completed',
              final_status: 'confirmed',
              conversation_history: [
                ...dtHistory,
                { role: 'user', content: `[Delivery type vote: ${selectedOption}]`, timestamp: new Date().toISOString() },
              ],
              last_message_at: new Date().toISOString(),
            }).eq('id', matchingDtLog.id)
            
            let WS_KEY = Deno.env.get('WASENDER_API_KEY')
            const { data: wsCfgDt } = await supabase
              .from('automation_settings')
              .select('setting_value')
              .eq('setting_key', 'wasender_config')
              .maybeSingle()
            if (wsCfgDt?.setting_value?.api_key) WS_KEY = wsCfgDt.setting_value.api_key
            
            if (WS_KEY) {
              const finalMsg = `✅ شكراً! تم تأكيد طلبك ${matchingDtLog.order_number} بنجاح.\n📦 نوع التوصيل: 🏠 توصيل للدار / Livraison à domicile\nسيتم التوصيل قريباً إن شاء الله 🚚\n\nMerci ! Commande ${matchingDtLog.order_number} confirmée.\n🚚 Livraison: À domicile`
              await sendWhatsApp(WS_KEY, matchingDtLog.customer_phone, finalMsg)
            }
            
            console.log(`🚚 Order ${matchingDtLog.order_number} delivery type set to home via poll`)
            
            return new Response(JSON.stringify({ success: true, action: 'delivery_type', deliveryType: 'home' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }
          
          // STOP DESK → Fetch pickup points and send Poll 3
          if (isDeliveryStopDesk) {
            const rawWilaya = currentOrder?.wilaya || ''
            // Strip wilaya code prefix like "16 - " to get just the city name for API search
            const orderWilaya = rawWilaya.replace(/^\d+\s*-\s*/, '').trim()
            console.log(`📦 Stop desk selected for ${matchingDtLog.order_number}, fetching pickup points for wilaya: ${orderWilaya} (raw: ${rawWilaya})`)
            
            // Fetch pickup points from ZR Express
            let pickupPoints: { id: string; name: string; address: string; city: string }[] = []
            try {
              const { data: zrIntegration } = await supabase
                .from('integrations')
                .select('*')
                .eq('integration_type', 'delivery')
                .eq('name', 'ZR Express')
                .eq('is_enabled', true)
                .maybeSingle()
              
              if (zrIntegration) {
                const tenantId = zrIntegration.settings?.tenant_id || zrIntegration.api_key || ''
                const apiKey = zrIntegration.api_secret || ''
                const normalizeStr = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
                
                const searchBody = {
                  advancedFilter: { logic: 'and', filters: [{ field: 'isPickupPoint', operator: 'eq', value: true }] },
                  advancedSearch: orderWilaya ? { fields: ['name', 'address.city'], keyword: normalizeStr(orderWilaya) } : undefined,
                  pageNumber: 1,
                  pageSize: 500,
                }
                
                const hubRes = await fetch('https://api.zrexpress.app/api/v1/hubs/search', {
                  method: 'POST',
                  headers: { 'X-Api-Key': apiKey, 'X-Tenant': tenantId, 'Content-Type': 'application/json', 'Accept': 'application/json' },
                  body: JSON.stringify(searchBody),
                })
                
                if (hubRes.ok) {
                  const hubData = JSON.parse(await hubRes.text())
                  const items = hubData?.items || []
                  
                  // Filter by wilaya
                  let filtered = items
                  if (orderWilaya) {
                    const wilayaNorm = normalizeStr(orderWilaya)
                    filtered = items.filter((hub: any) => {
                      const city = normalizeStr(hub.address?.city || '')
                      const name = normalizeStr(hub.name || '')
                      return city.includes(wilayaNorm) || name.includes(wilayaNorm)
                    })
                  }
                  
                  pickupPoints = (filtered.length > 0 ? filtered : items).map((hub: any) => ({
                    id: hub.id,
                    name: hub.name || '',
                    address: hub.address?.street || '',
                    city: hub.address?.city || '',
                  }))
                } else {
                  console.error('Failed to fetch pickup points:', hubRes.status)
                }
              }
            } catch (ppError) {
              console.error('Pickup points fetch error:', ppError)
            }
            
            let WS_KEY_PP = Deno.env.get('WASENDER_API_KEY')
            const { data: wsCfgPP } = await supabase
              .from('automation_settings')
              .select('setting_value')
              .eq('setting_key', 'wasender_config')
              .maybeSingle()
            if (wsCfgPP?.setting_value?.api_key) WS_KEY_PP = wsCfgPP.setting_value.api_key
            
            if (pickupPoints.length > 0 && WS_KEY_PP) {
              // WhatsApp polls support max 12 options - take the first 12
              const maxOptions = Math.min(pickupPoints.length, 12)
              const pollOptions = pickupPoints.slice(0, maxOptions).map(pp => pp.name)
              
              // Ensure minimum 2 options for WaSender
              if (pollOptions.length < 2) {
                pollOptions.push('📞 Autre / أخرى')
              }
              
              let pollQ = `📦 اختر نقطة الاستلام في ${orderWilaya} 👇\n\nChoisissez votre point Stop Desk à ${orderWilaya} 👇`
              if (pollQ.length > 255) pollQ = pollQ.substring(0, 252) + '...'
              
              const pollRes = await fetch(WASENDER_API_URL, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${WS_KEY_PP}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  to: formatPhoneForWhatsApp(matchingDtLog.customer_phone),
                  poll: { question: pollQ, options: pollOptions, multiSelect: false },
                }),
              })
              const pollData = await pollRes.json()
              console.log(`📋 Stop desk poll sent for ${matchingDtLog.order_number} with ${pollOptions.length} options:`, JSON.stringify(pollData).substring(0, 200))
              
              // Update log to awaiting_stop_desk_selection
              const dtHistory = (matchingDtLog.conversation_history as any[]) || []
              await supabase.from('auto_confirmation_logs').update({
                conversation_status: 'awaiting_stop_desk_selection',
                conversation_history: [
                  ...dtHistory,
                  { role: 'user', content: `[Delivery type vote: Stop desk]`, timestamp: new Date().toISOString() },
                  { role: 'assistant', content: `[Stop desk poll sent with ${pollOptions.length} options]`, timestamp: new Date().toISOString() },
                ],
                last_message_at: new Date().toISOString(),
              }).eq('id', matchingDtLog.id)
              
              // Also set delivery_type on order already (but don't confirm yet)
              await supabase.from('orders').update({
                delivery_type: 'stop_desk',
                updated_at: new Date().toISOString(),
              }).eq('id', matchingDtLog.order_id)
              
            } else {
              // No pickup points found via API → ask client to type their preferred stop desk
              console.log(`⚠️ No pickup points for ${orderWilaya} via API, asking client to type stop desk name`)
              
              // Set delivery_type but don't confirm yet
              await supabase.from('orders').update({
                delivery_type: 'stop_desk',
                updated_at: new Date().toISOString(),
              }).eq('id', matchingDtLog.order_id)
              
              const dtHistory = (matchingDtLog.conversation_history as any[]) || []
              await supabase.from('auto_confirmation_logs').update({
                conversation_status: 'awaiting_stop_desk_selection',
                conversation_history: [
                  ...dtHistory,
                  { role: 'user', content: `[Delivery type vote: Stop desk]`, timestamp: new Date().toISOString() },
                  { role: 'assistant', content: `[No pickup points found, asking client to type stop desk name]`, timestamp: new Date().toISOString() },
                ],
                last_message_at: new Date().toISOString(),
              }).eq('id', matchingDtLog.id)
              
              if (WS_KEY_PP) {
                const askMsg = `📦 لقد اخترت التوصيل عبر Stop Desk.\nمن فضلك أرسل لنا اسم أو عنوان نقطة الاستلام التي تفضلها في ${rawWilaya} 👇\n\nVous avez choisi Stop Desk.\nVeuillez nous envoyer le nom ou l'adresse du point de retrait que vous préférez à ${rawWilaya} 👇`
                await sendWhatsApp(WS_KEY_PP, matchingDtLog.customer_phone, askMsg)
              }
            }
            
            console.log(`🚚 Order ${matchingDtLog.order_number} stop desk flow initiated`)
            
            return new Response(JSON.stringify({ success: true, action: 'delivery_type', deliveryType: 'stop_desk' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }
        }
      }
      
      // === CONFIRMATION POLL VOTE ===
      // SKIP confirmation handler if this is a delivery type option to avoid false positives
      // (e.g. "استلام" contains "لا" which would wrongly trigger isCancel)
      if (isDeliveryHome || isDeliveryStopDesk) {
        console.log('Poll vote is a delivery type option but no matching awaiting_delivery_type log found, skipping confirmation handler')
        return new Response(JSON.stringify({ success: true, message: 'Delivery type vote, no pending log' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      
      const confirmOption = (confirmSettings?.poll_option_confirm || '✅ نعم (لتأكيد الطلب)').toLowerCase().trim()
      const cancelOption = (confirmSettings?.poll_option_cancel || '📞 تواصل مع الوكيل / Contacter un agent').toLowerCase().trim()
      
      const isConfirm = selectedLower === confirmOption || selectedLower.includes('✅') || selectedLower.includes('نعم') || selectedLower.includes('oui') || selectedLower.includes('confirmer')
      const isContactAgent = selectedLower === cancelOption || selectedLower.includes('📞') || selectedLower.includes('تواصل') || selectedLower.includes('وكيل') || selectedLower.includes('contacter') || selectedLower.includes('agent')
      
      if (isConfirm || isContactAgent) {
        const customerPhone = normalizePhone(realCustomerPhone)
        
        const pollMsgContent = body.data?.message?.pollCreationMessageV3?.name || body.data?.pollMsg?.pollCreationMessageV3?.name || ''
        const orderNumFromPoll = pollMsgContent.match(/(ORD-\d+)/i)?.[1] || ''
        
        let logQuery = supabase
          .from('auto_confirmation_logs')
          .select('*, orders:order_id(*)')
          .in('conversation_status', ['awaiting_reply'])
          .order('created_at', { ascending: false })
          .limit(10)
        
        const { data: confirmLogs } = await logQuery
        
        const matchingConfirmLog = confirmLogs?.find((log: any) => {
          const orderPhone = log.orders?.customer_phone
          const logPhone = log.customer_phone
          const phonesToMatch = [orderPhone, logPhone].filter(Boolean).map(normalizePhone)
          return phonesToMatch.includes(customerPhone) || 
                 (orderNumFromPoll && log.order_number === orderNumFromPoll)
        })
        
        if (matchingConfirmLog) {
          const action = isConfirm ? 'confirm' : 'contact_agent'
          const currentOrder = matchingConfirmLog.orders
          const confirmationStatuses = ['new', 'validated', 'failed_1', 'failed_2', 'failed_3', 'no_answer', 'wrong_number', 'postponed', 'to_reconfirm', 'callback', 'duplicate', 'out_of_stock']
          const canUpdateStatus = currentOrder && confirmationStatuses.includes(currentOrder.status)
          
          if (action === 'contact_agent') {
            if (canUpdateStatus) {
              const oldStatus = currentOrder.status
              
              // === Full assignment mode logic (mirrors auto_assign_order trigger) ===
              const { data: agents } = await supabase
                .from('user_roles')
                .select('user_id, profiles!inner(full_name, email, is_approved)')
                .eq('role', 'confirmateur')
              
              const activeAgents = (agents || []).filter((a: any) => a.profiles?.is_approved)
              const agentNames = activeAgents.map((a: any) => a.profiles?.full_name || a.profiles?.email || '').filter(Boolean)
              let assignedAgent = ''
              
              if (agentNames.length > 0) {
                // Get assignment mode
                const { data: modeSetting } = await supabase
                  .from('assignment_settings')
                  .select('setting_value')
                  .eq('setting_key', 'mode')
                  .maybeSingle()
                const mode = (modeSetting?.setting_value as string)?.replace(/"/g, '') || 'round_robin'
                
                // Try rules-based assignment first (for 'rules' or 'combined' modes)
                if (mode === 'rules' || mode === 'combined') {
                  // Rule: source
                  const { data: sourceRule } = await supabase
                    .from('assignment_rules')
                    .select('agent_name')
                    .eq('rule_type', 'source')
                    .eq('match_value', currentOrder.source || 'other')
                    .eq('is_active', true)
                    .limit(1)
                    .maybeSingle()
                  if (sourceRule?.agent_name) assignedAgent = sourceRule.agent_name
                  
                  // Rule: product
                  if (!assignedAgent) {
                    const { data: orderItems } = await supabase
                      .from('order_items')
                      .select('product_name')
                      .eq('order_id', matchingConfirmLog.order_id)
                    const productNames = (orderItems || []).map((i: any) => i.product_name)
                    if (productNames.length > 0) {
                      const { data: productRules } = await supabase
                        .from('assignment_rules')
                        .select('agent_name, match_value')
                        .eq('rule_type', 'product')
                        .eq('is_active', true)
                      const matchedRule = (productRules || []).find((r: any) => productNames.includes(r.match_value))
                      if (matchedRule) assignedAgent = matchedRule.agent_name
                    }
                  }
                  
                  // Rule: schedule
                  if (!assignedAgent) {
                    const now = new Date()
                    const algiersHour = parseInt(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'Africa/Algiers' }).format(now))
                    const algiersDay = parseInt(new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Africa/Algiers' }).format(now).length.toString()) // Use getDay equivalent
                    const dayOfWeek = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Algiers' })).getDay()
                    
                    const { data: scheduleRules } = await supabase
                      .from('assignment_rules')
                      .select('agent_name, days_of_week, start_hour, end_hour')
                      .eq('rule_type', 'schedule')
                      .eq('is_active', true)
                      .order('priority', { ascending: true })
                    
                    const matchedSchedule = (scheduleRules || []).find((r: any) => {
                      const days = r.days_of_week || []
                      const inDay = days.includes(dayOfWeek)
                      const inHour = algiersHour >= (r.start_hour || 0) && algiersHour < (r.end_hour || 23)
                      return inDay && inHour
                    })
                    if (matchedSchedule) assignedAgent = matchedSchedule.agent_name
                  }
                }
                
                // Fallback to workload or round_robin
                if (!assignedAgent) {
                  if (mode === 'workload' || mode === 'combined') {
                    // Workload balancing
                    let minCount = 999999
                    for (const name of agentNames) {
                      const { count } = await supabase
                        .from('orders')
                        .select('id', { count: 'exact', head: true })
                        .eq('assigned_agent', name)
                        .not('status', 'in', '("delivered","delivered_paid","cancelled","returned")')
                      if ((count || 0) < minCount) {
                        minCount = count || 0
                        assignedAgent = name
                      }
                    }
                  } else {
                    // Round robin
                    const { count: totalOrders } = await supabase
                      .from('orders')
                      .select('id', { count: 'exact', head: true })
                    const rrIndex = (totalOrders || 0) % agentNames.length
                    assignedAgent = agentNames[rrIndex]
                  }
                }
              }
              
              const updateData: any = { assigned_agent: assignedAgent || null }
              await supabase.from('orders').update(updateData).eq('id', matchingConfirmLog.order_id)
              
              await supabase.from('order_history').insert({
                order_id: matchingConfirmLog.order_id,
                old_status: oldStatus,
                new_status: oldStatus,
                changed_by: 'Client (Poll)',
                notes: `Client demande contact agent via sondage WhatsApp. Assigné à: ${assignedAgent || 'Aucun agent disponible'}`,
              })
              
              await supabase.from('alerts').insert({
                type: 'contact_request',
                message: `📞 Le client ${currentOrder.customer_name} (${matchingConfirmLog.order_number}) demande à être contacté par un agent.`,
                order_id: matchingConfirmLog.order_id,
              })
              
              console.log(`📞 Order ${matchingConfirmLog.order_number} assigned to ${assignedAgent} via contact agent poll vote`)
            }
            
            const logHistory = (matchingConfirmLog.conversation_history as any[]) || []
            const updatedHistory = [
              ...logHistory,
              { role: 'user', content: `[Poll vote: ${selectedOption}] - Demande contact agent`, timestamp: new Date().toISOString() },
            ]
            
            await supabase.from('auto_confirmation_logs').update({
              conversation_status: 'contact_agent',
              conversation_history: updatedHistory,
              customer_reply: selectedOption,
              final_status: 'contact_agent',
              ai_decision: 'contact_agent',
              last_message_at: new Date().toISOString(),
            }).eq('id', matchingConfirmLog.id)
            
            let WASENDER_KEY_CONFIRM = Deno.env.get('WASENDER_API_KEY')
            const { data: wsCfg } = await supabase
              .from('automation_settings')
              .select('setting_value')
              .eq('setting_key', 'wasender_config')
              .maybeSingle()
            if (wsCfg?.setting_value?.api_key) WASENDER_KEY_CONFIRM = wsCfg.setting_value.api_key
            
            if (WASENDER_KEY_CONFIRM) {
              const replyMsg = `📞 شكراً! سيتصل بك أحد ممثلينا قريباً بخصوص طلبك ${matchingConfirmLog.order_number} 🙏\n\nMerci ! Un agent vous contactera bientôt concernant votre commande ${matchingConfirmLog.order_number} 📞`
              await sendWhatsApp(WASENDER_KEY_CONFIRM, matchingConfirmLog.customer_phone, replyMsg)
            }
            
            return new Response(JSON.stringify({ success: true, action: 'contact_agent' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }
          
          // === CONFIRM only (no cancel in polls) ===
          if (canUpdateStatus) {
            const oldStatus = currentOrder.status
            
            // DO NOT change status to confirmed yet - wait for delivery type selection in Poll 2
            await supabase.from('order_history').insert({
              order_id: matchingConfirmLog.order_id,
              old_status: oldStatus,
              new_status: oldStatus,
              changed_by: 'Client (Poll)',
              notes: `Client a confirmé via sondage WhatsApp, en attente du choix de livraison: ${selectedOption}`,
            })
            
            console.log(`⏳ Order ${matchingConfirmLog.order_number} confirmed by client, awaiting delivery type selection`)
          }
          
          const logHistory = (matchingConfirmLog.conversation_history as any[]) || []
          const updatedHistory = [
            ...logHistory,
            { role: 'user', content: `[Poll vote: ${selectedOption}]`, timestamp: new Date().toISOString() },
          ]
          
          // Set to awaiting_delivery_type (delivery type poll will be sent next)
          const { error: updateLogError, count: updateCount } = await supabase.from('auto_confirmation_logs').update({
            conversation_status: 'awaiting_delivery_type',
            conversation_history: updatedHistory,
            customer_reply: selectedOption,
            final_status: 'confirmed',
            ai_decision: 'auto_confirm',
            last_message_at: new Date().toISOString(),
          }).eq('id', matchingConfirmLog.id)
          
          if (updateLogError) {
            console.error(`❌ Failed to update log to awaiting_delivery_type:`, updateLogError)
          } else {
            console.log(`✅ Log ${matchingConfirmLog.id} updated to awaiting_delivery_type successfully`)
          }
          
          let WASENDER_KEY_CONFIRM2 = Deno.env.get('WASENDER_API_KEY')
          const { data: wsCfg2 } = await supabase
            .from('automation_settings')
            .select('setting_value')
            .eq('setting_key', 'wasender_config')
            .maybeSingle()
          if (wsCfg2?.setting_value?.api_key) WASENDER_KEY_CONFIRM2 = wsCfg2.setting_value.api_key
          
          if (WASENDER_KEY_CONFIRM2) {
              // === STEP 2: Send delivery type poll after confirmation ===
              const { data: deliveryTypeCfg } = await supabase
                .from('automation_settings')
                .select('setting_value')
                .eq('setting_key', 'delivery_type_template')
                .maybeSingle()
              const dtConfig = deliveryTypeCfg?.setting_value || {}
              
              let pollQuestion = (dtConfig?.poll_question || '').trim() || `✅ تم تأكيد طلبك ${matchingConfirmLog.order_number}!\nاختر نوع التوصيل 👇\n\nCommande ${matchingConfirmLog.order_number} confirmée!\nChoisissez le type de livraison 👇`
              
              if (dtConfig?.template || dtConfig?.template_ar) {
                const templateText = dtConfig.template_ar || dtConfig.template || ''
                if (templateText) {
                  // Fetch delivery fees for this order's wilaya, respecting product pricing rules
                  let deliveryHomeFee = '0'
                  let deliveryDeskFee = '0'
                  const orderWilaya = currentOrder?.wilaya || ''
                  const wilayaCode = orderWilaya.includes(' - ') ? orderWilaya.split(' - ')[0].trim() : orderWilaya
                  
                  if (wilayaCode) {
                    let feesFound = false
                    
                    // Priority 1: Check product-specific delivery settings
                    const { data: orderItems } = await supabase
                      .from('order_items')
                      .select('product_id')
                      .eq('order_id', matchingConfirmLog.order_id)
                    
                    let productFreeDelivery = false
                    let productCustomHome: number | null = null
                    let productCustomDesk: number | null = null
                    let productPricingTier = 'standard'
                    
                    if (orderItems && orderItems.length > 0) {
                      const productIds = orderItems.map(i => i.product_id).filter(Boolean)
                      if (productIds.length > 0) {
                        const { data: products } = await supabase
                          .from('products')
                          .select('free_delivery, custom_home_delivery_fee, custom_stop_desk_fee, delivery_pricing_tier')
                          .in('id', productIds)
                        
                        if (products && products.length > 0) {
                          // If ANY product has free_delivery, delivery is free
                          productFreeDelivery = products.some(p => p.free_delivery === true)
                          
                          // Use first product's custom fees and tier (main product)
                          const mainProduct = products[0]
                          productCustomHome = mainProduct.custom_home_delivery_fee
                          productCustomDesk = mainProduct.custom_stop_desk_fee
                          productPricingTier = mainProduct.delivery_pricing_tier || 'standard'
                        }
                      }
                    }
                    
                    // If product has free delivery → 0 DA
                    if (productFreeDelivery) {
                      deliveryHomeFee = '0'
                      deliveryDeskFee = '0'
                      feesFound = true
                    }
                    
                    // If product has custom fees
                    if (!feesFound && (productCustomHome !== null || productCustomDesk !== null)) {
                      deliveryHomeFee = String(productCustomHome ?? 0)
                      deliveryDeskFee = String(productCustomDesk ?? 0)
                      feesFound = true
                    }
                    
                    // Priority 2: Check pricing tier (special_1 or special_2)
                    if (!feesFound && productPricingTier === 'special_1') {
                      const { data: specialFee } = await supabase
                        .from('special_delivery_fees')
                        .select('home_delivery_fee, stop_desk_fee')
                        .eq('wilaya_code', wilayaCode)
                        .maybeSingle()
                      if (specialFee && (specialFee.home_delivery_fee > 0 || specialFee.stop_desk_fee > 0)) {
                        deliveryHomeFee = String(specialFee.home_delivery_fee || 0)
                        deliveryDeskFee = String(specialFee.stop_desk_fee || 0)
                        feesFound = true
                      }
                    }
                    
                    if (!feesFound && productPricingTier === 'special_2') {
                      const { data: special2Fee } = await supabase
                        .from('special_delivery_fees_2')
                        .select('home_delivery_fee, stop_desk_fee')
                        .eq('wilaya_code', wilayaCode)
                        .maybeSingle()
                      if (special2Fee) {
                        deliveryHomeFee = String(special2Fee.home_delivery_fee || 0)
                        deliveryDeskFee = '0' // Special 2 = free stop desk
                        feesFound = true
                      }
                    }
                    
                    // Priority 3: Try order's delivery company
                    if (!feesFound) {
                      const deliveryCompany = currentOrder?.delivery_company
                      if (deliveryCompany) {
                        const { data: companyFee } = await supabase
                          .from('delivery_company_fees')
                          .select('home_delivery_fee, stop_desk_fee')
                          .eq('delivery_company', deliveryCompany)
                          .eq('wilaya_code', wilayaCode)
                          .maybeSingle()
                        if (companyFee && (companyFee.home_delivery_fee > 0 || companyFee.stop_desk_fee > 0)) {
                          deliveryHomeFee = String(companyFee.home_delivery_fee || 0)
                          deliveryDeskFee = String(companyFee.stop_desk_fee || 0)
                          feesFound = true
                        }
                      }
                    }
                    
                    // Priority 4: General delivery_fees table
                    if (!feesFound) {
                      const { data: generalFee } = await supabase
                        .from('delivery_fees')
                        .select('home_delivery_fee, stop_desk_fee')
                        .eq('wilaya_code', wilayaCode)
                        .maybeSingle()
                      if (generalFee && (generalFee.home_delivery_fee > 0 || generalFee.stop_desk_fee > 0)) {
                        deliveryHomeFee = String(generalFee.home_delivery_fee || 0)
                        deliveryDeskFee = String(generalFee.stop_desk_fee || 0)
                        feesFound = true
                      }
                    }
                    
                    // Priority 5: Any company with non-zero fees for this wilaya
                    if (!feesFound) {
                      const { data: anyCompanyFees } = await supabase
                        .from('delivery_company_fees')
                        .select('home_delivery_fee, stop_desk_fee')
                        .eq('wilaya_code', wilayaCode)
                        .or('home_delivery_fee.gt.0,stop_desk_fee.gt.0')
                        .limit(1)
                        .maybeSingle()
                      if (anyCompanyFees) {
                        deliveryHomeFee = String(anyCompanyFees.home_delivery_fee || 0)
                        deliveryDeskFee = String(anyCompanyFees.stop_desk_fee || 0)
                      }
                    }
                  }
                  
                  // Format: show "GRATUIT" instead of "0 DA"
                  const formatFee = (fee: string) => fee === '0' ? 'مجاني' : fee + ' DA'
                  
                  pollQuestion = templateText
                    .replace(/\{name\}/g, currentOrder?.customer_name || '')
                    .replace(/\{order\}/g, matchingConfirmLog.order_number || '')
                    .replace(/\{total\}/g, String(currentOrder?.total_price || ''))
                    .replace(/\{delivery_fee\}/g, String(currentOrder?.delivery_fee || ''))
                    .replace(/\{delivery_home\}/g, formatFee(deliveryHomeFee))
                    .replace(/\{delivery_desk\}/g, formatFee(deliveryDeskFee))
                    .replace(/\{address\}/g, currentOrder?.customer_address || '')
                    .replace(/\{wilaya\}/g, currentOrder?.wilaya || '')
                    .replace(/\{commune\}/g, currentOrder?.commune || '')
                    .replace(/\{phone\}/g, currentOrder?.customer_phone || '')
                }
              }
              
              if (pollQuestion.length > 255) pollQuestion = pollQuestion.substring(0, 252) + '...'
              
              const optionHome = (dtConfig?.poll_option_home || '').trim() || '🏠 توصيل للدار / Livraison à domicile'
              const optionStopDesk = (dtConfig?.poll_option_stop_desk || '').trim() || '📦 ستوب ديسك / Stop desk'
              
              const pollRes = await fetch(WASENDER_API_URL, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${WASENDER_KEY_CONFIRM2}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  to: formatPhoneForWhatsApp(matchingConfirmLog.customer_phone),
                  poll: {
                    question: pollQuestion,
                    options: [optionHome, optionStopDesk],
                    multiSelect: false,
                  },
                }),
              })
              const pollData = await pollRes.json()
              console.log(`📋 Delivery type poll sent for ${matchingConfirmLog.order_number}:`, JSON.stringify(pollData).substring(0, 200))
              
              // conversation_status already set to 'awaiting_delivery_type' above
              await supabase.from('auto_confirmation_logs').update({
                conversation_history: [
                  ...updatedHistory,
                  { role: 'assistant', content: `[Delivery type poll sent]`, timestamp: new Date().toISOString() },
                ],
                last_message_at: new Date().toISOString(),
              }).eq('id', matchingConfirmLog.id)
          }
          
          return new Response(JSON.stringify({ success: true, action }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }
      
      console.log('Poll vote: no matching order found, voterPhone:', voterPhone)
      return new Response(JSON.stringify({ success: true, message: 'Poll vote processed, no matching order' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
      
      // If messages.update but NOT a poll vote, skip it (delivery receipts, etc.)
      if (eventType === 'messages.update') {
        console.log('messages.update without poll vote, skipping')
        return new Response(JSON.stringify({ success: true, message: 'Skipped non-poll update' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Handle contacts.upsert - save WhatsApp contact info
    if (eventType === 'contacts.upsert') {
      console.log('Processing contacts.upsert event')
      const contacts = body.data || body.contacts || []
      if (Array.isArray(contacts) && contacts.length > 0) {
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )
        for (const contact of contacts) {
          const jid = contact.id || contact.jid || ''
          const name = contact.name || contact.notify || contact.pushName || null
          // Extract phone from JID (format: 213XXXXXXXXX@s.whatsapp.net)
          const phoneMatch = jid.match(/^(\d+)@/)
          if (phoneMatch) {
            let phone = phoneMatch[1]
            // Convert 213XXXXXXXXX to 0XXXXXXXXX
            if (phone.startsWith('213')) phone = '0' + phone.substring(3)
            console.log(`Saving WhatsApp contact: ${phone} (${name})`)
            await supabaseAdmin.from('whatsapp_contacts').upsert(
              { phone, has_whatsapp: true, contact_name: name, updated_at: new Date().toISOString() },
              { onConflict: 'phone' }
            )
          }
        }
      }
      return new Response(JSON.stringify({ success: true, message: 'Contacts processed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Skip non-message events - ONLY process messages.upsert to avoid duplicates
    // WaSender sends messages.upsert, messages.received, AND messages-personal.received for the same message
    const allowedEvents = ['messages.upsert', 'message']
    if (eventType && !allowedEvents.includes(eventType)) {
      console.log('Skipping non-message event:', eventType)
      return new Response(JSON.stringify({ success: true, message: `Skipped event: ${eventType}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

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
    
    // WaSender webhook payload - handle nested structure
    let senderPhone = ''
    let messageText = ''
    let messageId = ''
    
    // Handle messages.update event (poll votes come as this)
    const msgData = body.data?.messages || body.data
    if (msgData) {
      const msg = msgData
      
      // Extract message ID for deduplication
      messageId = msg.key?.id || msg.msgId?.toString() || ''
      
      // Extract phone from cleanedSenderPn or remoteJid
      senderPhone = msg.key?.cleanedSenderPn || msg.key?.senderPn?.replace('@s.whatsapp.net', '') || msg.remoteJid?.replace('@s.whatsapp.net', '') || ''
      
      // Poll votes from messages.update are handled above, skip duplicate handling here
      
      // Capture outgoing (agent's own) messages so manual replies sent from WhatsApp directly
      // also appear in the in-app chat panel.
      // Note: messages sent through the app already log themselves; we tag fromMe to mark role.
      const isFromMe = msg.key?.fromMe === true
      // For fromMe, the "phone" is the recipient (remoteJid), not the sender
      if (isFromMe) {
        senderPhone = msg.key?.remoteJid?.replace('@s.whatsapp.net', '')?.replace(/[^\d]/g, '') || senderPhone
      }
      
      // Skip reaction messages (emoji reactions to messages)
      if (msg.message?.reactionMessage || msg.messageType === 'reactionMessage' || msg.type === 'reaction') {
        console.log('Skipping reaction message')
        return new Response(JSON.stringify({ success: true, message: 'Skipped reaction' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      
      // Regular text message
      if (!messageText) {
        messageText = msg.messageBody || msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
      }
    } else {
      // Fallback for other formats
      senderPhone = body.from || body.sender || body.phone || ''
      messageText = body.text || body.message || body.body || ''
    }

    console.log('Parsed - Phone:', senderPhone, 'Message:', messageText)

    // Filter out non-customer messages (auth links, verification URLs, spam)
    const spamPatterns = [
      /lovable\.dev\/auth/i,
      /mode=verifyEmail/i,
      /apiKey=/i,
      /oobCode=/i,
      /supabase\.(co|io)\/auth/i,
      /^https?:\/\/[^\s]+$/i, // Messages that are ONLY a URL with no other text
    ]
    const isSpam = spamPatterns.some(p => p.test(messageText.trim()))
    if (isSpam) {
      console.log('Skipping spam/non-customer message:', messageText.substring(0, 80))
      return new Response(JSON.stringify({ success: true, message: 'Skipped non-customer message' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!senderPhone || !messageText) {
      return new Response(JSON.stringify({ success: false, error: 'Missing phone or message' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Deduplicate: skip if we already processed this exact message ID recently
    if (messageId) {
      const normalizedSender = normalizePhone(senderPhone)
      const { data: recentLogs } = await supabase
        .from('auto_confirmation_logs')
        .select('id, conversation_history')
        .order('updated_at', { ascending: false })
        .limit(10)

      const isDuplicate = recentLogs?.some((log: any) => {
        const history = (log.conversation_history as any[]) || []
        // Check if this exact messageId was already processed in last 60 seconds
        return history.some((m: any) => m.messageId === messageId)
      })

      if (isDuplicate) {
        console.log('Skipping duplicate message:', messageId)
        return new Response(JSON.stringify({ success: true, message: 'Duplicate message skipped' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const normalizedPhone = normalizePhone(senderPhone)

    // Find ALL conversations for this phone number
    const { data: logs } = await supabase
      .from('auto_confirmation_logs')
      .select('*, orders:order_id(*)')
      .in('conversation_status', ['awaiting_reply', 'manual_takeover', 'confirmed', 'cancelled', 'awaiting_stop_desk_selection', 'awaiting_delivery_type', 'completed'])
      .order('created_at', { ascending: false })

    // Match ALL logs by phone - use ORDER's phone (more reliable) with fallback to log phone
    const allMatchingLogs = logs?.filter((log: any) => {
      // Prefer the order's customer_phone (source of truth) over the log's phone
      const orderPhone = log.orders?.customer_phone
      const phonesToCheck = orderPhone 
        ? [normalizePhone(orderPhone), orderPhone, formatPhoneForWhatsApp(orderPhone)]
        : [normalizePhone(log.customer_phone), log.customer_phone, formatPhoneForWhatsApp(log.customer_phone)]
      return phonesToCheck.some(p => p === normalizedPhone || p === senderPhone)
    }) || []

    if (allMatchingLogs.length === 0) {
      // No existing log: try to find an order matching this phone and auto-create a manual log
      // so the incoming message is captured and visible in the chat panel.
      console.log('No existing log, searching for matching order for:', senderPhone)
      const phoneVariants = Array.from(new Set([
        senderPhone,
        normalizedPhone,
        formatPhoneForWhatsApp(senderPhone),
        normalizedPhone.startsWith('0') ? '+213' + normalizedPhone.slice(1) : normalizedPhone,
        normalizedPhone.startsWith('0') ? '213' + normalizedPhone.slice(1) : normalizedPhone,
      ].filter(Boolean)))

      const { data: matchingOrders } = await supabase
        .from('orders')
        .select('id, order_number, customer_phone')
        .in('customer_phone', phoneVariants)
        .order('created_at', { ascending: false })
        .limit(1)

      if (!matchingOrders || matchingOrders.length === 0) {
        console.log('No matching order found for phone:', senderPhone)
        return new Response(JSON.stringify({ success: true, message: 'No matching order' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const targetOrder = matchingOrders[0]
      const initialRole = isFromMe ? 'assistant' : 'user'
      const initialMessage = { role: initialRole, content: messageText, timestamp: new Date().toISOString(), messageId: messageId || undefined }

      const { data: createdLog, error: createErr } = await supabase
        .from('auto_confirmation_logs')
        .insert({
          order_id: targetOrder.id,
          order_number: targetOrder.order_number,
          customer_phone: targetOrder.customer_phone,
          ai_decision: 'manual',
          ai_reason: isFromMe ? 'Auto-created from outgoing agent WhatsApp message' : 'Auto-created from incoming WhatsApp message',
          conversation_status: 'manual_takeover',
          conversation_history: [initialMessage],
          customer_reply: isFromMe ? null : messageText,
          last_message_at: new Date().toISOString(),
          whatsapp_message_sent: isFromMe,
        })
        .select('*, orders:order_id(*)')
        .single()

      if (createErr) {
        console.error('Failed to auto-create log:', createErr)
        return new Response(JSON.stringify({ success: false, error: createErr.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      console.log('Auto-created manual log for order:', targetOrder.order_number)
      return new Response(JSON.stringify({ success: true, message: 'Log auto-created', logId: createdLog?.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if ANY log for this phone is in manual_takeover mode
    const anyManualTakeover = allMatchingLogs.some((l: any) => l.conversation_status === 'manual_takeover')

    // Save incoming/outgoing message to ALL matching logs
    const messageRole = isFromMe ? 'assistant' : 'user'
    const incomingMessage = { role: messageRole, content: messageText, timestamp: new Date().toISOString(), messageId: messageId || undefined }
    for (const log of allMatchingLogs) {
      const logHistory = (log.conversation_history as any[]) || []
      // Skip if this exact messageId already exists (avoids dup with in-app sends)
      if (messageId && logHistory.some((m: any) => m.messageId === messageId)) continue
      await supabase.from('auto_confirmation_logs').update({
        conversation_history: [...logHistory, incomingMessage],
        ...(isFromMe ? {} : { customer_reply: messageText }),
        last_message_at: new Date().toISOString(),
      }).eq('id', log.id)
    }

    // For agent's outgoing messages, just persist and exit — no AI processing
    if (isFromMe) {
      console.log('Saved outgoing agent message to logs')
      return new Response(JSON.stringify({ success: true, message: 'Outgoing message saved' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Handle text reply for awaiting_stop_desk_selection (client typing stop desk name)
    const stopDeskLog = allMatchingLogs.find((l: any) => l.conversation_status === 'awaiting_stop_desk_selection')
    if (stopDeskLog) {
      const selectedStopDesk = messageText.trim()
      const oldStatus = stopDeskLog.orders?.status || 'new'
      
      // Confirm the order with the typed stop desk
      await supabase.from('orders').update({
        status: 'confirmed',
        delivery_type: 'stop_desk',
        customer_address: `Stop Desk: ${selectedStopDesk}`,
        confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', stopDeskLog.order_id)
      
      await supabase.from('order_history').insert({
        order_id: stopDeskLog.order_id,
        old_status: oldStatus,
        new_status: 'confirmed',
        changed_by: 'Client (Message)',
        notes: `Confirmé via WhatsApp. Stop desk choisi: ${selectedStopDesk}`,
      })
      
      const sdHistory = (stopDeskLog.conversation_history as any[]) || []
      await supabase.from('auto_confirmation_logs').update({
        conversation_status: 'completed',
        final_status: 'confirmed',
        customer_reply: selectedStopDesk,
        conversation_history: [
          ...sdHistory,
          { role: 'user', content: `[Stop desk typed: ${selectedStopDesk}]`, timestamp: new Date().toISOString() },
        ],
        last_message_at: new Date().toISOString(),
      }).eq('id', stopDeskLog.id)
      
      let WS_KEY_SD = Deno.env.get('WASENDER_API_KEY')
      const { data: wsCfgSd } = await supabase
        .from('automation_settings')
        .select('setting_value')
        .eq('setting_key', 'wasender_config')
        .maybeSingle()
      if (wsCfgSd?.setting_value?.api_key) WS_KEY_SD = wsCfgSd.setting_value.api_key
      
      if (WS_KEY_SD) {
        const finalMsg = `✅ شكراً! تم تأكيد طلبك ${stopDeskLog.order_number} بنجاح.\n📦 ستوب ديسك: ${selectedStopDesk}\nسيتم التوصيل قريباً إن شاء الله 🚚\n\nMerci ! Commande ${stopDeskLog.order_number} confirmée.\n📦 Stop desk: ${selectedStopDesk}`
        await sendWhatsApp(WS_KEY_SD, stopDeskLog.customer_phone, finalMsg)
      }
      
      console.log(`📦 Order ${stopDeskLog.order_number} stop desk typed by client: ${selectedStopDesk}`)
      
      return new Response(JSON.stringify({ success: true, action: 'stop_desk_typed', stopDesk: selectedStopDesk }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (anyManualTakeover) {
      console.log('Manual takeover active on at least one conversation, skipping AI reply')
      return new Response(JSON.stringify({ success: true, action: 'manual_takeover', message: 'Message saved, AI paused' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if AI confirmation is enabled globally
    const { data: confirmationCfg } = await supabase
      .from('automation_settings')
      .select('setting_value')
      .eq('setting_key', 'confirmation')
      .maybeSingle()
    const confirmationEnabled = confirmationCfg?.setting_value?.enabled === true

    if (!confirmationEnabled) {
      console.log('AI confirmation is disabled globally, skipping AI reply. Message saved only.')
      return new Response(JSON.stringify({ success: true, action: 'ai_disabled', message: 'Message saved, AI confirmation disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Pick the primary log for AI processing (prefer awaiting_reply, then most recent)
    const matchingLog = allMatchingLogs.find((l: any) => l.conversation_status === 'awaiting_reply') || allMatchingLogs[0]
    const conversationHistory = (matchingLog.conversation_history as any[]) || []

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

    // Generate AI reply
    const aiReply = await generateAIReply(conversationHistory, messageText, matchingLog.orders || matchingLog, aiProviderConfig, lovableAiConfig)

    // Update conversation history (incoming message already saved to matchingLog earlier)
    // Re-fetch the latest history since it was updated
    const { data: refreshedLog } = await supabase.from('auto_confirmation_logs').select('conversation_history').eq('id', matchingLog.id).single()
    const latestHistory = (refreshedLog?.conversation_history as any[]) || []
    const updatedHistory = [
      ...latestHistory,
      { role: 'assistant', content: aiReply.message, timestamp: new Date().toISOString() },
    ]

    // Send WhatsApp reply
    const waResult = await sendWhatsApp(WASENDER_API_KEY, matchingLog.customer_phone, aiReply.message)

    // Only update order status if it's still in a confirmation-stage status
    const currentOrder = matchingLog.orders
    const confirmationStatuses = ['new', 'validated', 'failed_1', 'failed_2', 'failed_3', 'no_answer', 'wrong_number', 'postponed', 'to_reconfirm', 'callback', 'duplicate', 'out_of_stock']
    const canUpdateStatus = currentOrder && confirmationStatuses.includes(currentOrder.status)

    // Update log based on action
    let newConversationStatus = 'awaiting_reply'
    let newFinalStatus = 'pending'

    if (aiReply.action === 'confirm') {
      newConversationStatus = 'confirmed'
      newFinalStatus = 'confirmed'
      if (canUpdateStatus) {
        const oldStatus = currentOrder.status
        await supabase.from('orders').update({
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
        }).eq('id', matchingLog.order_id)
        // Log status change in order_history
        await supabase.from('order_history').insert({
          order_id: matchingLog.order_id,
          old_status: oldStatus,
          new_status: 'confirmed',
          changed_by: 'IA (Auto-confirmation)',
          notes: 'Confirmé automatiquement par IA suite à la réponse du client',
        })
      } else {
        console.log('Skipping order status update - order already in advanced status:', currentOrder?.status)
      }
    } else if (aiReply.action === 'cancel') {
      newConversationStatus = 'cancelled'
      newFinalStatus = 'cancelled'
      if (canUpdateStatus) {
        const oldStatus = currentOrder.status
        await supabase.from('orders').update({ status: 'cancelled' }).eq('id', matchingLog.order_id)
        // Log status change in order_history
        await supabase.from('order_history').insert({
          order_id: matchingLog.order_id,
          old_status: oldStatus,
          new_status: 'cancelled',
          changed_by: 'IA (Auto-confirmation)',
          notes: 'Annulé automatiquement par IA suite à la réponse du client',
        })
      } else {
        console.log('Skipping order status update - order already in advanced status:', currentOrder?.status)
      }
    }

    // Update the matching log
    await supabase.from('auto_confirmation_logs').update({
      conversation_status: newConversationStatus,
      conversation_history: updatedHistory,
      customer_reply: messageText,
      final_status: newFinalStatus,
      ai_decision: aiReply.action === 'confirm' ? 'auto_confirm' : aiReply.action === 'cancel' ? 'reject' : 'ask_customer',
      last_message_at: new Date().toISOString(),
    }).eq('id', matchingLog.id)

    // Sync AI reply to ALL other logs for the same phone number
    const aiMessage = { role: 'assistant', content: aiReply.message, timestamp: new Date().toISOString() }
    for (const log of allMatchingLogs) {
      if (log.id === matchingLog.id) continue
      // Re-fetch latest history (incoming message was already added earlier)
      const { data: refreshedOther } = await supabase.from('auto_confirmation_logs').select('conversation_history').eq('id', log.id).single()
      const otherHistory = (refreshedOther?.conversation_history as any[]) || []
      await supabase.from('auto_confirmation_logs').update({
        conversation_history: [...otherHistory, aiMessage],
        last_message_at: new Date().toISOString(),
      }).eq('id', log.id)
    }

    return new Response(JSON.stringify({
      success: true,
      action: aiReply.action,
      whatsapp_sent: waResult.success,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
