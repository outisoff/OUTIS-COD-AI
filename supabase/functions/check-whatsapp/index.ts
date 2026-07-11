import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { authenticateRequest } from '../_shared/auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

serve(async (req) => {
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
    const { phones } = await req.json()

    if (!phones || !Array.isArray(phones) || phones.length === 0) {
      return new Response(JSON.stringify({ error: 'phones array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Check whatsapp_contacts table
    const { data: contacts } = await supabase
      .from('whatsapp_contacts')
      .select('phone, has_whatsapp')
      .in('phone', phones)

    const results: Record<string, boolean | null> = {}
    const knownPhones = new Set<string>()

    if (contacts) {
      for (const c of contacts) {
        results[c.phone] = c.has_whatsapp
        knownPhones.add(c.phone)
      }
    }

    // Also check auto_confirmation_logs for phones not in contacts table
    const unknownPhones = phones.filter(p => !knownPhones.has(p))
    if (unknownPhones.length > 0) {
      const { data: logs } = await supabase
        .from('auto_confirmation_logs')
        .select('customer_phone, whatsapp_message_sent, conversation_history')
        .in('customer_phone', unknownPhones)

      if (logs) {
        for (const log of logs) {
          if (knownPhones.has(log.customer_phone)) continue
          if (log.whatsapp_message_sent === true) {
            results[log.customer_phone] = true
            knownPhones.add(log.customer_phone)
            // Also save to whatsapp_contacts for future lookups
            await supabase.from('whatsapp_contacts').upsert(
              { phone: log.customer_phone, has_whatsapp: true, updated_at: new Date().toISOString() },
              { onConflict: 'phone' }
            )
            continue
          }
          const history = (log.conversation_history as any[]) || []
          if (history.some((h: any) => h.role === 'customer' || h.role === 'user')) {
            results[log.customer_phone] = true
            knownPhones.add(log.customer_phone)
            await supabase.from('whatsapp_contacts').upsert(
              { phone: log.customer_phone, has_whatsapp: true, updated_at: new Date().toISOString() },
              { onConflict: 'phone' }
            )
          }
        }
      }
    }

    // Any remaining phones = null (unknown, not false)
    for (const phone of phones) {
      if (!(phone in results)) {
        results[phone] = null
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('check-whatsapp error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
