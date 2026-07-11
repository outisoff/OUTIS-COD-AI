import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { authenticateRequest } from '../_shared/auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Cron / internal-only: require internal secret or admin role
  const auth = await authenticateRequest(req, { requireRoles: ['admin'] })
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.message }), {
      status: auth.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // 1. Check if auto-assignment is enabled
    const { data: settingsData } = await supabase
      .from('assignment_settings')
      .select('setting_key, setting_value')

    const settings: Record<string, any> = {}
    settingsData?.forEach((s: any) => {
      let val = s.setting_value
      if (typeof val === 'string') {
        try { val = JSON.parse(val) } catch {}
      }
      settings[s.setting_key] = val
    })

    const autoEnabled = settings.auto_enabled === true || settings.auto_enabled === 'true'
    if (!autoEnabled) {
      return new Response(JSON.stringify({ skipped: true, reason: 'Auto-assignment disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const mode = settings.mode || 'round_robin'
    const noWhatsappInstant = settings.no_whatsapp_instant_assign === true || settings.no_whatsapp_instant_assign === 'true'
    const staleDelayMinutes = typeof settings.stale_delay === 'number' ? settings.stale_delay : 120

    // Working hours: only assign during agent working hours
    const workingHours = settings.working_hours as { start: number; end: number } | undefined
    const workStart = workingHours?.start ?? 8
    const workEnd = workingHours?.end ?? 20

    const now = new Date()
    const currentHour = now.getUTCHours() + 1 // Algeria is UTC+1
    const normalizedHour = ((currentHour % 24) + 24) % 24

    let isDuringWorkingHours: boolean
    if (workStart < workEnd) {
      isDuringWorkingHours = normalizedHour >= workStart && normalizedHour < workEnd
    } else {
      isDuringWorkingHours = normalizedHour >= workStart || normalizedHour < workEnd
    }

    // Outside working hours: skip entirely, agents don't work at night
    if (!isDuringWorkingHours) {
      return new Response(JSON.stringify({ 
        skipped: true, 
        reason: 'Outside working hours - agents not available',
        currentHour: normalizedHour,
        workingHours: { start: workStart, end: workEnd }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Helper: check if a phone number is mobile (WhatsApp-capable) in Algeria
    const isMobileNumber = (phone: string): boolean => {
      const cleaned = phone.replace(/[\s\-\.]/g, '')
      if (/^0[567]/.test(cleaned)) return true
      if (/^\+?213[567]/.test(cleaned)) return true
      return false
    }

    // 2. Find stale orders: AI didn't confirm after delay
    const staleCutoff = new Date(Date.now() - staleDelayMinutes * 60 * 1000).toISOString()
    const { data: staleOrders, error: staleError } = await supabase
      .from('orders')
      .select('id, order_number, source, customer_phone')
      .eq('status', 'new')
      .is('assigned_agent', null)
      .lt('created_at', staleCutoff)
      .order('created_at', { ascending: true })
    if (staleError) throw staleError

    // Also fetch orders with non-WhatsApp numbers (instant assign during work hours)
    let noWhatsappOrders: any[] = []
    if (noWhatsappInstant) {
      const { data } = await supabase
        .from('orders')
        .select('id, order_number, source, customer_phone')
        .eq('status', 'new')
        .is('assigned_agent', null)
        .order('created_at', { ascending: true })
      noWhatsappOrders = (data || []).filter(o => !isMobileNumber(o.customer_phone))
    }

    // Merge and deduplicate
    const allOrdersMap = new Map<string, any>()
    ;(staleOrders || []).forEach(o => allOrdersMap.set(o.id, o))
    noWhatsappOrders.forEach(o => allOrdersMap.set(o.id, o))
    const allOrders = Array.from(allOrdersMap.values())

    if (allOrders.length === 0) {
      return new Response(JSON.stringify({ 
        skipped: true, 
        reason: 'No stale orders to assign',
        staleDelayMinutes
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`Found ${allOrders.length} orders to auto-assign (stale: ${staleOrders?.length || 0}, no-whatsapp: ${noWhatsappOrders.length})`)

    // 3. Get active confirmateurs
    const { data: confirmateurs } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'confirmateur')

    if (!confirmateurs || confirmateurs.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: 'No confirmateurs available' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get profiles for names
    const userIds = confirmateurs.map(c => c.user_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds)

    const agentNames = profiles?.map(p => p.full_name || p.email || 'Agent') || []
    if (agentNames.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: 'No agent profiles found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Get assignment rules if using rules/combined mode
    let rules: any[] = []
    if (mode === 'rules' || mode === 'combined') {
      const { data: rulesData } = await supabase
        .from('assignment_rules')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: true })
      rules = rulesData || []
    }

    // 5. Assign orders
    let assignedCount = 0
    let roundRobinIndex = 0

    // Get current workload for workload mode
    let workload: Record<string, number> = {}
    if (mode === 'workload' || mode === 'combined') {
      const { data: activeOrders } = await supabase
        .from('orders')
        .select('assigned_agent')
        .in('status', ['new', 'validated', 'callback', 'to_reconfirm', 'no_answer'])
        .not('assigned_agent', 'is', null)

      activeOrders?.forEach((o: any) => {
        workload[o.assigned_agent] = (workload[o.assigned_agent] || 0) + 1
      })
    }

    for (const order of allOrders) {
      let assignedAgent: string | null = null

      // Try rules first (for rules and combined modes)
      if (mode === 'rules' || mode === 'combined') {
        // Source rules
        const sourceRule = rules.find(r => r.rule_type === 'source' && r.match_value === order.source)
        if (sourceRule) {
          assignedAgent = sourceRule.agent_name
        }

        // Schedule rules
        if (!assignedAgent) {
          const now = new Date()
          const currentDay = now.getDay()
          const currentHour = now.getHours()

          const scheduleRule = rules.find(r => 
            r.rule_type === 'schedule' && 
            (r.days_of_week || []).includes(currentDay) &&
            currentHour >= (r.start_hour ?? 0) && 
            currentHour <= (r.end_hour ?? 23)
          )
          if (scheduleRule) {
            assignedAgent = scheduleRule.agent_name
          }
        }
      }

      // Fallback assignment methods
      if (!assignedAgent) {
        if (mode === 'rules') {
          continue
        } else if (mode === 'workload') {
          const leastBusy = agentNames.reduce((min, name) => 
            (workload[name] || 0) < (workload[min] || 0) ? name : min
          , agentNames[0])
          assignedAgent = leastBusy
          workload[leastBusy] = (workload[leastBusy] || 0) + 1
        } else {
          assignedAgent = agentNames[roundRobinIndex % agentNames.length]
          roundRobinIndex++
        }
      }

      if (assignedAgent) {
        const { error: updateError } = await supabase
          .from('orders')
          .update({ assigned_agent: assignedAgent })
          .eq('id', order.id)

        if (!updateError) {
          assignedCount++
          const reason = !isMobileNumber(order.customer_phone) ? '(no WhatsApp)' : '(stale)'
          console.log(`Assigned order #${order.order_number} to ${assignedAgent} ${reason}`)
        } else {
          console.error(`Failed to assign order #${order.order_number}:`, updateError)
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      assigned: assignedCount, 
      total: allOrders.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('auto-assign-stale-orders error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
