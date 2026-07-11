import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function formatPhoneForWhatsApp(phone: string): string {
  let cleaned = phone.replace(/\s+/g, '').replace(/-/g, '');
  if (cleaned.startsWith('0')) cleaned = '+213' + cleaned.substring(1);
  if (!cleaned.startsWith('+')) cleaned = '+' + cleaned;
  return cleaned;
}

const DEFAULT_TEMPLATE = `📦 *Nouvelle commande à livrer*

📋 *Commande:* {order_number}
👤 *Client:* {customer_name}
📞 *Téléphone:* {customer_phone}
📍 *Adresse:* {customer_address}
🏙️ *Wilaya:* {wilaya}
🏘️ *Commune:* {commune}
🚚 *Type:* {delivery_type}
💰 *Montant:* {total_price} DA

📝 *Produits:*
{products}`;

const DEFAULT_POLL_OPTIONS = [
  { label: 'livre', status: 'delivered' },
  { label: 'repondre pas', status: 'alerte' },
  { label: 'retour', status: 'Échec_de_livraison' },
  { label: 'reporter', status: 'alerte' },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await authenticateRequest(req, { requireRoles: ['admin', 'confirmateur'] });
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.message }), {
      status: auth.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { record, old_record } = await req.json();
    if (!record) {
      return new Response(JSON.stringify({ success: false, message: 'No record' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const order = record;
    const oldStatus = old_record?.status;
    const newStatus = order.status;

    // Skip if status didn't change
    if (oldStatus === newStatus) {
      return new Response(JSON.stringify({ success: true, message: 'No status change' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only for local livreurs
    if (!order.delivery_company || !order.delivery_company.startsWith('local:')) {
      return new Response(JSON.stringify({ success: true, message: 'Not a local livreur' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check config
    const { data: templateConfig } = await supabase
      .from('automation_settings')
      .select('setting_value')
      .eq('setting_key', 'livreur_whatsapp_template')
      .maybeSingle();

    const config = templateConfig?.setting_value as {
      template?: string;
      enabled?: boolean;
      trigger_statuses?: string[];
      poll_options?: { label: string; status: string }[];
    } | null;

    if (config?.enabled === false) {
      return new Response(JSON.stringify({ success: true, message: 'WhatsApp disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const triggerStatuses = config?.trigger_statuses || ['preparing'];
    if (!triggerStatuses.includes(newStatus)) {
      return new Response(JSON.stringify({ success: true, message: `Status ${newStatus} not in triggers` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get livreur phone
    const livreurName = order.delivery_company.replace('local:', '').trim();
    const { data: livreur } = await supabase
      .from('local_livreurs')
      .select('id, name, phone')
      .eq('name', livreurName)
      .eq('is_active', true)
      .maybeSingle();

    if (!livreur?.phone) {
      console.log('Livreur not found or no phone:', livreurName);
      return new Response(JSON.stringify({ success: false, message: 'Livreur not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get WASender API key
    let WASENDER_API_KEY = Deno.env.get('WASENDER_API_KEY');
    const { data: wasenderConfig } = await supabase
      .from('automation_settings')
      .select('setting_value')
      .eq('setting_key', 'wasender_config')
      .maybeSingle();
    if (wasenderConfig?.setting_value?.api_key) {
      WASENDER_API_KEY = wasenderConfig.setting_value.api_key;
    }
    if (!WASENDER_API_KEY) {
      console.log('WASENDER_API_KEY not configured');
      return new Response(JSON.stringify({ success: false, message: 'WASender not configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get order items
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('product_name, quantity')
      .eq('order_id', order.id);

    const itemsList = (orderItems || []).map((item: any) => `• ${item.product_name} x${item.quantity}`).join('\n');

    // Build message from template
    const template = config?.template || DEFAULT_TEMPLATE;
    const deliveryTypeLabel = order.delivery_type === 'home' ? 'Domicile' : 'Stop Desk';
    const pollOptions = (config?.poll_options && config.poll_options.length > 0)
      ? config.poll_options
      : DEFAULT_POLL_OPTIONS;
    const actionButtons = pollOptions.map((o: any) => `• ${o.label}`).join('\n');

    let pollQuestion = template
      .replace(/\{order_number\}/g, order.order_number || '')
      .replace(/\{customer_name\}/g, order.customer_name || '')
      .replace(/\{customer_phone\}/g, order.customer_phone || '')
      .replace(/\{customer_address\}/g, order.customer_address || '')
      .replace(/\{wilaya\}/g, order.wilaya || '')
      .replace(/\{commune\}/g, order.commune || '')
      .replace(/\{delivery_type\}/g, deliveryTypeLabel)
      .replace(/\{total_price\}/g, Number(order.total_price).toLocaleString('fr-DZ'))
      .replace(/\{products\}/g, itemsList)
      .replace(/\{notes\}/g, order.notes || '')
      .replace(/\{action_buttons\}/g, actionButtons);

    // Always ensure order number and phone are present for webhook order identification
    if (order.order_number && !pollQuestion.includes(order.order_number)) {
      pollQuestion = `📋 ${order.order_number}\n` + pollQuestion;
    }
    if (order.customer_phone && !pollQuestion.includes(order.customer_phone)) {
      pollQuestion += `\n📞 ${order.customer_phone}`;
    }

    const phone = formatPhoneForWhatsApp(livreur.phone);

    // Send poll with template message as question
    const waResponse = await fetch('https://www.wasenderapi.com/api/send-message', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${WASENDER_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: phone,
        poll: {
          question: pollQuestion,
          options: pollOptions.map((o: any) => o.label),
          multiSelect: false,
        },
      }),
    });

    const waData = await waResponse.json();
    console.log('WhatsApp to livreur result:', JSON.stringify(waData));

    // Persist poll msgId so we can delete it later if the order is cancelled
    if (waResponse.ok) {
      const msgId = waData?.data?.msgId ?? waData?.data?.messageId ?? waData?.msgId ?? waData?.messageId ?? null;
      if (msgId) {
        try {
          const { data: existing } = await supabase
            .from('deliveries')
            .select('id')
            .eq('order_id', order.id)
            .maybeSingle();
          if (existing?.id) {
            await supabase
              .from('deliveries')
              .update({ livreur_poll_msg_id: String(msgId), livreur_poll_to: phone, last_update: new Date().toISOString() })
              .eq('id', existing.id);
          } else {
            await supabase
              .from('deliveries')
              .insert({ order_id: order.id, livreur_poll_msg_id: String(msgId), livreur_poll_to: phone, carrier: 'local', delivery_status: 'preparing' });
          }
        } catch (e) {
          console.error('Failed to persist poll msgId:', e);
        }
      }
    }

    return new Response(JSON.stringify({ success: waResponse.ok, data: waData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in notify-livreur:', error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
