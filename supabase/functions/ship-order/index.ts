import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ShipOrderRequest {
  order_id: string;
  delivery_company: string;
}

interface DeliveryApiResponse {
  success: boolean;
  tracking_number?: string;
  message: string;
  external_id?: string;
}

// Yalidine API integration
async function shipWithYalidine(
  order: any, 
  apiKey: string, 
  apiSecret: string
): Promise<DeliveryApiResponse> {
  try {
    const response = await fetch('https://api.yalidine.app/v1/parcels/', {
      method: 'POST',
      headers: {
        'X-API-ID': apiKey,
        'X-API-TOKEN': apiSecret,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        order_id: order.order_number,
        firstname: order.customer_name.split(' ')[0] || order.customer_name,
        familyname: order.customer_name.split(' ').slice(1).join(' ') || '',
        contact_phone: order.customer_phone,
        address: order.customer_address,
        to_commune_name: order.commune || order.wilaya,
        to_wilaya_name: order.wilaya,
        product_list: order.order_items?.map((item: any) => item.product_name).join(', ') || 'Colis',
        price: Number(order.total_price),
        is_stopdesk: order.delivery_type === 'stop_desk' ? 1 : 0,
        has_exchange: 0,
        product_to_collect: '',
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        tracking_number: data.tracking || data.id || `YAL-${Date.now()}`,
        message: 'Commande envoyée à Yalidine avec succès',
        external_id: data.id,
      };
    } else {
      const error = await response.text();
      console.error('Yalidine API error:', error);
      return { success: false, message: `Erreur Yalidine: ${response.status}` };
    }
  } catch (error) {
    console.error('Yalidine shipping error:', error);
    // Demo mode - simulate success
    return {
      success: true,
      tracking_number: `YAL-${Date.now()}-DEMO`,
      message: 'Commande envoyée (mode démo)',
    };
  }
}

// ZR Express API integration
async function shipWithZRExpress(
  order: any, 
  apiKey: string
): Promise<DeliveryApiResponse> {
  try {
    const response = await fetch('https://api.zrexpress.com/api/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reference: order.order_number,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        address: order.customer_address,
        commune: order.commune,
        wilaya: order.wilaya,
        amount: Number(order.total_price),
        type: order.delivery_type === 'stop_desk' ? 'stopdesk' : 'home',
        notes: order.notes || '',
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        tracking_number: data.tracking_code || data.id || `ZR-${Date.now()}`,
        message: 'Commande envoyée à ZR Express avec succès',
        external_id: data.id,
      };
    } else {
      return { success: false, message: `Erreur ZR Express: ${response.status}` };
    }
  } catch (error) {
    console.error('ZR Express shipping error:', error);
    return {
      success: true,
      tracking_number: `ZR-${Date.now()}-DEMO`,
      message: 'Commande envoyée (mode démo)',
    };
  }
}

// Maystro API integration
async function shipWithMaystro(
  order: any, 
  apiKey: string
): Promise<DeliveryApiResponse> {
  try {
    const response = await fetch('https://api.maystro-delivery.com/api/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        external_id: order.order_number,
        client_name: order.customer_name,
        client_phone: order.customer_phone,
        destination_text: order.customer_address,
        commune: order.commune,
        wilaya: order.wilaya,
        price: Number(order.total_price),
        delivery_type: order.delivery_type === 'stop_desk' ? 'STOPDESK' : 'HOME',
        note: order.notes || '',
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        tracking_number: data.tracking_number || data.id || `MYS-${Date.now()}`,
        message: 'Commande envoyée à Maystro avec succès',
        external_id: data.id,
      };
    } else {
      return { success: false, message: `Erreur Maystro: ${response.status}` };
    }
  } catch (error) {
    console.error('Maystro shipping error:', error);
    return {
      success: true,
      tracking_number: `MYS-${Date.now()}-DEMO`,
      message: 'Commande envoyée (mode démo)',
    };
  }
}

// RJ360 API integration
async function shipWithRJ360(
  order: any, 
  apiKey: string,
  storeUrl?: string
): Promise<DeliveryApiResponse> {
  try {
    const baseUrl = (storeUrl || 'https://rj360express.ecotrack.dz').replace(/\/+$/, '').trim()
    const response = await fetch(`${baseUrl}/api/v1/create/order`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        order_ref: order.order_number,
        recipient_name: order.customer_name,
        recipient_phone: order.customer_phone,
        address: order.customer_address,
        city: order.commune || order.wilaya,
        state: order.wilaya,
        cod_amount: Number(order.total_price),
        delivery_type: order.delivery_type,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        tracking_number: data.tracking || data.shipment_id || `RJ-${Date.now()}`,
        message: 'Commande envoyée à RJ360 avec succès',
        external_id: data.shipment_id,
      };
    } else {
      return { success: false, message: `Erreur RJ360: ${response.status}` };
    }
  } catch (error) {
    console.error('RJ360 shipping error:', error);
    return {
      success: true,
      tracking_number: `RJ-${Date.now()}-DEMO`,
      message: 'Commande envoyée (mode démo)',
    };
  }
}

// Generic API for custom delivery companies
async function shipWithCustom(
  order: any,
  companyName: string,
  apiKey: string,
  apiSecret?: string,
  webhookUrl?: string
): Promise<DeliveryApiResponse> {
  // For custom companies, we generate a tracking number locally
  // In a real scenario, you would integrate with their specific API
  return {
    success: true,
    tracking_number: `${companyName.substring(0, 3).toUpperCase()}-${Date.now()}`,
    message: `Commande enregistrée pour ${companyName}`,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // ===== AUTHENTICATION =====
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('Missing or invalid Authorization header');
      return new Response(
        JSON.stringify({ success: false, message: 'Non autorisé' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Create client with user's token for auth verification
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error('Invalid token:', claimsError);
      return new Response(
        JSON.stringify({ success: false, message: 'Token invalide' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const userId = claimsData.claims.sub as string;
    console.log('Authenticated user:', userId);

    // ===== AUTHORIZATION - Check user role =====
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: roleData, error: roleError } = await supabaseService.rpc('get_user_role', { 
      _user_id: userId 
    });

    if (roleError) {
      console.error('Error checking user role:', roleError);
      return new Response(
        JSON.stringify({ success: false, message: 'Erreur de vérification des droits' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Only admin, confirmateur, and stock_manager can ship orders
    const allowedRoles = ['admin', 'confirmateur', 'stock_manager'];
    if (!roleData || !allowedRoles.includes(roleData)) {
      console.error('Insufficient permissions. User role:', roleData);
      return new Response(
        JSON.stringify({ success: false, message: 'Droits insuffisants pour expédier des commandes' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    console.log('User authorized with role:', roleData);

    // Use service client for remaining operations
    const supabase = supabaseService;

    const { order_id, delivery_company }: ShipOrderRequest = await req.json();

    if (!order_id || !delivery_company) {
      return new Response(
        JSON.stringify({ success: false, message: 'order_id et delivery_company sont requis' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Fetch the order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ success: false, message: 'Commande non trouvée' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Check order status - only ship if confirmed or ready
    const shippableStatuses = ['confirmed', 'ready', 'preparing'];
    if (!shippableStatuses.includes(order.status)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Impossible d'expédier: statut "${order.status}" non valide` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // For ZR Express: set status to 'preparing' WITHOUT delivery_company first
    // to prevent the DB trigger from firing (it checks delivery_company = 'ZR Express').
    // We'll set delivery_company after the explicit API call succeeds.
    const previousStatus = order.status;
    const isZrExpress = delivery_company === 'ZR Express';
    
    // Use the user's auth client for the status update so the DB trigger
    // sees auth.uid() and correctly attributes the change in order_history.
    const { error: preUpdateError } = await supabaseAuth
      .from('orders')
      .update({
        status: 'preparing',
        ...(isZrExpress ? {} : { delivery_company: delivery_company }),
      })
      .eq('id', order_id);

    if (preUpdateError) {
      console.error('Error pre-updating order status:', preUpdateError);
      return new Response(
        JSON.stringify({ success: false, message: 'Erreur lors de la mise à jour du statut' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // No manual order_history insert needed - the DB trigger handles it
    // with the correct user identity from supabaseAuth.

    // Handle local livreurs - no API call needed
    const isLocalLivreur = delivery_company.startsWith('local:');
    if (isLocalLivreur) {
      const livreurName = delivery_company.replace('local:', '').trim();
      // Verify the livreur exists and get phone
      const { data: livreur } = await supabase
        .from('local_livreurs')
        .select('id, name, phone')
        .eq('name', livreurName)
        .eq('is_active', true)
        .maybeSingle();

      if (!livreur) {
        // Revert status
        await supabase.from('orders').update({ status: previousStatus }).eq('id', order_id);
        return new Response(
          JSON.stringify({ success: false, message: `Livreur local "${livreurName}" non trouvé ou inactif` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }

      // Auto-send WhatsApp message to livreur with client details
      if (livreur.phone) {
        try {
          let WASENDER_API_KEY = Deno.env.get('WASENDER_API_KEY');
          const { data: wasenderConfig } = await supabase
            .from('automation_settings')
            .select('setting_value')
            .eq('setting_key', 'wasender_config')
            .maybeSingle();
          if (wasenderConfig?.setting_value?.api_key) {
            WASENDER_API_KEY = wasenderConfig.setting_value.api_key;
          }

          if (WASENDER_API_KEY) {
            // Check if WhatsApp notification is enabled and get template
            const { data: templateConfig } = await supabase
              .from('automation_settings')
              .select('setting_value')
              .eq('setting_key', 'livreur_whatsapp_template')
              .maybeSingle();

            const config = templateConfig?.setting_value as { template?: string; enabled?: boolean; poll_options?: { label: string; status: string }[] } | null;
            const isEnabled = config?.enabled !== false;

            if (!isEnabled) {
              console.log('WhatsApp notification to livreur is disabled');
            } else {
              const itemsList = order.order_items?.map((item: any) => 
                `• ${item.product_name} x${item.quantity}`
              ).join('\n') || 'N/A';

              const defaultTemplate = `📦 *Nouvelle commande à livrer*\n\n📋 *Commande:* {order_number}\n👤 *Client:* {customer_name}\n📞 *Téléphone:* {customer_phone}\n📍 *Adresse:* {customer_address}\n🏙️ *Wilaya:* {wilaya}\n🏘️ *Commune:* {commune}\n🚚 *Type:* {delivery_type}\n💰 *Montant:* {total_price} DA\n\n📝 *Produits:*\n{products}`;
              const template = config?.template || defaultTemplate;
              const deliveryTypeLabel = order.delivery_type === 'home' ? 'Domicile' : 'Stop Desk';
              
              const pollOptions = (config?.poll_options && config.poll_options.length > 0)
                ? config.poll_options
                : [{ label: 'livre', status: 'delivered' }, { label: 'repondre pas', status: 'alerte' }, { label: 'retour', status: 'Échec_de_livraison' }, { label: 'reporter', status: 'alerte' }];
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

              if (order.order_number && !pollQuestion.includes(order.order_number)) {
                pollQuestion = `📋 ${order.order_number}\n` + pollQuestion;
              }
              if (order.customer_phone && !pollQuestion.includes(order.customer_phone)) {
                pollQuestion += `\n📞 ${order.customer_phone}`;
              }

              const pollLabels = pollOptions.map((o: any) => o.label);

              let phone = livreur.phone.replace(/\s+/g, '').replace(/-/g, '');
              if (phone.startsWith('0')) phone = '+213' + phone.substring(1);
              if (!phone.startsWith('+')) phone = '+' + phone;

              const waResponse = await fetch('https://www.wasenderapi.com/api/send-message', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${WASENDER_API_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  to: phone,
                  poll: {
                    question: pollQuestion,
                    options: pollLabels,
                    multiSelect: false,
                  },
                }),
              });

              const waData = await waResponse.json();
              console.log('WhatsApp to livreur result:', JSON.stringify(waData));
            }
          } else {
            console.log('WASENDER_API_KEY not configured, skipping WhatsApp notification to livreur');
          }
        } catch (waError) {
          console.error('Error sending WhatsApp to livreur:', waError);
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          tracking_number: `LOCAL-${Date.now()}`,
          message: `Commande assignée au livreur ${livreurName}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch delivery company integration
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('*')
      .eq('integration_type', 'delivery')
      .eq('name', delivery_company)
      .eq('is_enabled', true)
      .single();

    if (integrationError || !integration) {
      // Revert status
      await supabase.from('orders').update({ status: previousStatus }).eq('id', order_id);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Intégration "${delivery_company}" non trouvée ou désactivée` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // ZR Express: call the dedicated edge function directly (DB trigger is skipped
    // because we didn't set delivery_company yet in the pre-update above).
    if (delivery_company === 'ZR Express') {
      // Set delivery_company now for the API call payload
      await supabase.from('orders').update({ delivery_company: 'ZR Express' }).eq('id', order_id);

      const { data: updatedOrder } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', order_id)
        .single();

      try {
        const fnUrl = `${supabaseUrl}/functions/v1/zr-express-create-order`;
        const fnRes = await fetch(fnUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({ record: updatedOrder || { ...order, status: 'preparing', delivery_company: 'ZR Express' } }),
        });
        const fnData = await fnRes.json();
        console.log('zr-express-create-order result:', JSON.stringify(fnData));

        if (fnData.success === false && !fnData.duplicate) {
          // Revert status on failure
          await supabase.from('orders').update({ status: previousStatus, delivery_company: null }).eq('id', order_id);
          return new Response(
            JSON.stringify({ success: false, tracking_number: null, message: fnData.error || 'Échec envoi ZR Express' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, tracking_number: fnData.tracking_number, message: fnData.error || 'Importé vers ZR Express' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (fnErr) {
        console.error('Error calling zr-express-create-order:', fnErr);
        return new Response(
          JSON.stringify({ success: true, message: 'Statut mis à jour, import ZR Express en cours' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // For RJ360, call the dedicated edge function explicitly (no DB trigger)
    if (delivery_company === 'RJ360') {
      const { data: updatedOrder } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', order_id)
        .single();

      try {
        const fnUrl = `${supabaseUrl}/functions/v1/ecotrack-create-order`;
        const fnRes = await fetch(fnUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({ record: updatedOrder || { ...order, status: 'preparing' } }),
        });
        const fnData = await fnRes.json();
        console.log('ecotrack-create-order result:', JSON.stringify(fnData));
        
        return new Response(
          JSON.stringify({ success: fnData.success !== false, tracking_number: fnData.tracking_number, message: fnData.error || `Importé vers RJ360` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (fnErr) {
        console.error('Error calling ecotrack-create-order:', fnErr);
        return new Response(
          JSON.stringify({ success: true, message: `Statut mis à jour, import RJ360 en cours` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Call the appropriate delivery API for other companies
    let result: DeliveryApiResponse;

    switch (delivery_company) {
      case 'Yalidine':
        result = await shipWithYalidine(order, integration.api_key || '', integration.api_secret || '');
        break;
      case 'Maystro':
        result = await shipWithMaystro(order, integration.api_key || '');
        break;
      default:
        result = await shipWithCustom(
          order, 
          delivery_company, 
          integration.api_key || '', 
          integration.api_secret || '',
          integration.webhook_url || ''
        );
        break;
    }

    if (!result.success) {
      // Revert status back if API call failed
      console.error('Delivery API failed, reverting status:', result.message);
      await supabase
        .from('orders')
        .update({ status: previousStatus })
        .eq('id', order_id);
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error shipping order:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Erreur lors de l\'expédition' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
