import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await authenticateRequest(req, { requireRoles: ['admin', 'confirmateur', 'stock_manager'] });
  if (!auth.ok) return new Response(JSON.stringify({ error: auth.message }), { status: auth.status, headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { order_id } = await req.json();
    if (!order_id) {
      return new Response(JSON.stringify({ success: false, message: 'order_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch delivery row with poll info
    const { data: delivery } = await supabase
      .from('deliveries')
      .select('id, livreur_poll_msg_id, livreur_poll_to')
      .eq('order_id', order_id)
      .maybeSingle();

    // Fetch order for fallback message
    const { data: order } = await supabase
      .from('orders')
      .select('order_number')
      .eq('id', order_id)
      .maybeSingle();

    if (!delivery?.livreur_poll_msg_id || !delivery?.livreur_poll_to) {
      return new Response(JSON.stringify({ success: true, message: 'No poll to delete' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Resolve WaSender API key
    let WASENDER_API_KEY = Deno.env.get('WASENDER_API_KEY');
    const { data: wasenderConfig } = await supabase
      .from('automation_settings')
      .select('setting_value')
      .eq('setting_key', 'wasender_config')
      .maybeSingle();
    if ((wasenderConfig?.setting_value as any)?.api_key) {
      WASENDER_API_KEY = (wasenderConfig!.setting_value as any).api_key;
    }
    if (!WASENDER_API_KEY) {
      return new Response(JSON.stringify({ success: false, message: 'WASender not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const msgId = delivery.livreur_poll_msg_id;
    const phone = delivery.livreur_poll_to;

    // Try DELETE on WaSender
    let deleted = false;
    let deleteResp: any = null;
    try {
      const resp = await fetch(`https://www.wasenderapi.com/api/messages/${encodeURIComponent(msgId)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${WASENDER_API_KEY}` },
      });
      deleteResp = await resp.json().catch(() => ({}));
      deleted = resp.ok;
      console.log('WaSender DELETE result:', resp.status, JSON.stringify(deleteResp));
    } catch (e) {
      console.error('DELETE failed:', e);
    }

    // No fallback message — webhook guard will reject any vote on cancelled orders

    // Clear stored msgId so webhook guard can ignore future votes on this poll
    await supabase
      .from('deliveries')
      .update({ livreur_poll_msg_id: null, last_update: new Date().toISOString() })
      .eq('id', delivery.id);

    return new Response(
      JSON.stringify({ success: true, deleted, deleteResp }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('delete-livreur-poll error:', error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
