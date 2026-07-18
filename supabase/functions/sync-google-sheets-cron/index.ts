import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

interface OrderItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  variant: string | null;
}

interface OrderData {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  wilaya: string;
  commune: string | null;
  total_price: number;
  status: string;
  created_at: string;
  order_items: OrderItem[];
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json();
    if (data.error) {
      console.error('Token refresh error:', data);
      return null;
    }

    return data.access_token;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}

async function syncOrdersToSheet(accessToken: string, spreadsheetId: string, orders: OrderData[], sheetName: string = 'Commandes') {
  const headers = [
    'N° Commande',
    'Client',
    'Téléphone',
    'Adresse',
    'Wilaya',
    'Commune',
    'Produits',
    'Prix Total',
    'Statut',
    'Date de création',
  ];

  const rows = orders.map(order => {
    const productsText = order.order_items
      .map(item => {
        const variant = item.variant ? ` (${item.variant})` : '';
        return `${item.product_name}${variant} x${item.quantity}`;
      })
      .join(', ') || 'N/A';

    return [
      order.order_number,
      order.customer_name,
      order.customer_phone,
      order.customer_address,
      order.wilaya,
      order.commune || '',
      productsText,
      order.total_price,
      order.status,
      new Date(order.created_at).toLocaleString('fr-FR'),
    ];
  });

  const values = [headers, ...rows];

  // Clear existing data
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A:J:clear`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  // Write new data
  const updateResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A1:J${values.length}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    }
  );

  if (!updateResponse.ok) {
    const error = await updateResponse.text();
    throw new Error(`Failed to update spreadsheet: ${error}`);
  }

  return { updatedRows: values.length };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await authenticateRequest(req, { requireRoles: ['admin'] });
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.message }), {
      status: auth.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    console.log('Starting cron sync job...');
    
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get all users with Google Sheets integration enabled
    const { data: integrations, error: intError } = await supabase
      .from('integrations')
      .select('spreadsheet_id')
      .eq('integration_type', 'google_sheets')
      .eq('is_enabled', true)
      .not('spreadsheet_id', 'is', null);

    if (intError) {
      throw new Error(`Failed to get integrations: ${intError.message}`);
    }

    if (!integrations || integrations.length === 0) {
      console.log('No active Google Sheets integrations found');
      return new Response(
        JSON.stringify({ success: true, message: 'No active integrations' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Get all users with Google tokens
    const { data: tokenRecords, error: tokenError } = await supabase
      .from('google_tokens')
      .select('*');

    if (tokenError) {
      throw new Error(`Failed to get tokens: ${tokenError.message}`);
    }

    if (!tokenRecords || tokenRecords.length === 0) {
      console.log('No Google tokens found');
      return new Response(
        JSON.stringify({ success: true, message: 'No connected accounts' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    let syncedCount = 0;
    let errorCount = 0;

    // Process each user with tokens
    for (const tokenData of tokenRecords) {
      try {
        console.log(`Processing sync for user: ${tokenData.user_id}`);

        // Check if token needs refresh
        let accessToken = tokenData.access_token;
        if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
          console.log('Token expired, refreshing...');
          if (!tokenData.refresh_token) {
            console.error(`No refresh token for user ${tokenData.user_id}`);
            errorCount++;
            continue;
          }
          
          accessToken = await refreshAccessToken(tokenData.refresh_token);
          if (!accessToken) {
            console.error(`Failed to refresh token for user ${tokenData.user_id}`);
            errorCount++;
            continue;
          }

          // Update token in database
          await supabase
            .from('google_tokens')
            .update({
              access_token: accessToken,
              expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
            })
            .eq('user_id', tokenData.user_id);
        }

        // Get integration for this sync (use the first enabled one)
        const spreadsheetId = integrations[0]?.spreadsheet_id;
        if (!spreadsheetId) {
          console.log('No spreadsheet ID configured');
          continue;
        }

        // Fetch orders with items
        const { data: orders, error: ordersError } = await supabase
          .from('orders')
          .select(`
            id,
            order_number,
            customer_name,
            customer_phone,
            customer_address,
            wilaya,
            commune,
            total_price,
            status,
            created_at,
            order_items (
              product_name,
              quantity,
              unit_price,
              variant
            )
          `)
          .order('created_at', { ascending: false });

        if (ordersError) {
          console.error(`Failed to fetch orders: ${ordersError.message}`);
          errorCount++;
          continue;
        }

        // Sync to Google Sheets
        const result = await syncOrdersToSheet(accessToken, spreadsheetId, orders as OrderData[] || []);
        console.log(`Sync complete for user ${tokenData.user_id}:`, result);
        syncedCount++;

        // Only sync once (using first available token)
        break;

      } catch (userError) {
        console.error(`Error syncing for user ${tokenData.user_id}:`, userError);
        errorCount++;
      }
    }

    console.log(`Cron sync complete. Synced: ${syncedCount}, Errors: ${errorCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced: ${syncedCount}, Errors: ${errorCount}`,
        syncedCount,
        errorCount,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error: unknown) {
    console.error('Cron sync error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
