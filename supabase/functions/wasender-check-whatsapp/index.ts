import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { authenticateRequest } from '../_shared/auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const auth = await authenticateRequest(req)
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.message }), {
      status: auth.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const { phone } = await req.json()

    if (!phone) {
      return new Response(JSON.stringify({ error: 'phone required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Get WaSender API key - same logic as send-manual-message
    let apiKey = Deno.env.get('WASENDER_API_KEY')
    const { data: wasenderConfig } = await supabase
      .from('automation_settings')
      .select('setting_value')
      .eq('setting_key', 'wasender_config')
      .maybeSingle()
    if ((wasenderConfig?.setting_value as any)?.api_key) {
      apiKey = (wasenderConfig.setting_value as any).api_key
    }

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'WASENDER_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Convert Algerian number: 0661234567 → 213661234567 (no + prefix for WASender JID format)
    let intlPhone = phone.replace(/\s+/g, '').replace(/-/g, '').replace('+', '')
    if (intlPhone.startsWith('0')) intlPhone = '213' + intlPhone.substring(1)

    console.log(`Checking WhatsApp for: ${intlPhone}`)

    // Use /api/contacts/{phone} endpoint (WASender current API)
    const response = await fetch(
      `https://www.wasenderapi.com/api/contacts/${encodeURIComponent(intlPhone)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    )

    const responseText = await response.text()
    console.log(`WASender response status: ${response.status}, body: ${responseText}`)

    if (!response.ok) {
      // If 404, the contact doesn't exist on WhatsApp
      if (response.status === 404) {
        await supabase.from('whatsapp_contacts').upsert(
          { phone, has_whatsapp: false, updated_at: new Date().toISOString() },
          { onConflict: 'phone' }
        )
        return new Response(JSON.stringify({ exists: false }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ exists: false, error: `API returned ${response.status}`, details: responseText }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let data: any
    try { data = JSON.parse(responseText) } catch { data = {} }
    
    // WASender /api/contacts/{phone} returns { success: true, data: { id, name, ... } }
    // If the contact exists, it means they have WhatsApp
    const exists = data?.success === true && !!data?.data?.id

    // Cache result in whatsapp_contacts
    const contactName = data?.data?.name || data?.data?.notify || null
    await supabase.from('whatsapp_contacts').upsert(
      { phone, has_whatsapp: exists, contact_name: contactName, updated_at: new Date().toISOString() },
      { onConflict: 'phone' }
    )

    return new Response(JSON.stringify({ exists, raw: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('wasender-check-whatsapp error:', error)
    return new Response(JSON.stringify({ exists: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})