import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple token generation/verification using HMAC
async function generateToken(orderId: string, action: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${orderId}:${action}`));
  return btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/[+/=]/g, '').substring(0, 16);
}

const STATUS_MAP: Record<string, { status: string; label: string }> = {
  'livre': { status: 'delivered', label: 'Livré' },
  'no_answer': { status: 'no_answer', label: 'Ne répond pas' },
  'reporter': { status: 'postponed', label: 'Reporté' },
  'retour': { status: 'returned', label: 'Retour' },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const orderId = url.searchParams.get('order_id');
    const action = url.searchParams.get('action');
    const token = url.searchParams.get('token');

    if (!orderId || !action || !token) {
      return new Response(renderHTML('❌ Lien invalide', 'Paramètres manquants.', 'error'), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        status: 400,
      });
    }

    const actionInfo = STATUS_MAP[action];
    if (!actionInfo) {
      return new Response(renderHTML('❌ Action inconnue', `L'action "${action}" n'est pas reconnue.`, 'error'), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        status: 400,
      });
    }

    // Verify token
    const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const expectedToken = await generateToken(orderId, action, secret);
    if (token !== expectedToken) {
      return new Response(renderHTML('❌ Lien expiré ou invalide', 'Ce lien n\'est plus valide.', 'error'), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        status: 403,
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, secret);

    // Get the order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, status, customer_name')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return new Response(renderHTML('❌ Commande introuvable', 'Cette commande n\'existe pas.', 'error'), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        status: 404,
      });
    }

    // Check if already in a final status
    const finalStatuses = ['delivered', 'delivered_paid', 'returned', 'cancelled'];
    if (finalStatuses.includes(order.status)) {
      return new Response(renderHTML(
        '⚠️ Déjà traité',
        `La commande ${order.order_number} est déjà au statut "${order.status}".`,
        'warning'
      ), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Update the order status
    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: actionInfo.status, updated_at: new Date().toISOString() })
      .eq('id', orderId);

    if (updateError) {
      console.error('Error updating order:', updateError);
      return new Response(renderHTML('❌ Erreur', 'Impossible de mettre à jour la commande.', 'error'), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        status: 500,
      });
    }

    return new Response(renderHTML(
      '✅ Mise à jour réussie',
      `La commande *${order.order_number}* (${order.customer_name}) a été marquée comme *${actionInfo.label}*.`,
      'success'
    ), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(renderHTML('❌ Erreur serveur', 'Une erreur inattendue est survenue.', 'error'), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      status: 500,
    });
  }
});

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

function renderHTML(title: string, message: string, type: 'success' | 'error' | 'warning'): string {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message).replace(/\*(.*?)\*/g, '<strong>$1</strong>');
  const colors = {
    success: { bg: '#dcfce7', border: '#22c55e', text: '#166534', icon: '✅' },
    error: { bg: '#fef2f2', border: '#ef4444', text: '#991b1b', icon: '❌' },
    warning: { bg: '#fefce8', border: '#eab308', text: '#854d0e', icon: '⚠️' },
  };
  const c = colors[type];
  
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: #f8fafc; padding: 20px;
    }
    .card {
      background: white; border-radius: 16px; padding: 32px; max-width: 420px; width: 100%;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08); text-align: center;
      border-top: 4px solid ${c.border};
    }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 20px; color: ${c.text}; margin-bottom: 12px; }
    p { font-size: 15px; color: #64748b; line-height: 1.6; }
    p strong { color: #334155; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${c.icon}</div>
    <h1>${safeTitle}</h1>
    <p>${safeMessage}</p>
  </div>
</body>
</html>`;
}

// Export generateToken for use by other functions
export { generateToken };
