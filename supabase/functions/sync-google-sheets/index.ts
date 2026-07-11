import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  product_id: string | null;
}

interface ProductData {
  id: string;
  sku: string;
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
  delivery_fee: number;
  delivery_type: string;
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

async function getOrCreateSpreadsheet(accessToken: string, spreadsheetId?: string): Promise<{ id: string; url: string }> {
  // If spreadsheet ID provided, verify it exists
  if (spreadsheetId) {
    try {
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      
      if (response.ok) {
        return { 
          id: spreadsheetId, 
          url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}` 
        };
      }
    } catch (e) {
      console.log('Spreadsheet not found, will create new one');
    }
  }

  // Create new spreadsheet
  const createResponse = await fetch(
    'https://sheets.googleapis.com/v4/spreadsheets',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: `Commandes - ${new Date().toLocaleDateString('fr-FR')}`,
        },
        sheets: [
          {
            properties: {
              title: 'Commandes',
              gridProperties: { frozenRowCount: 1 },
            },
          },
        ],
      }),
    }
  );

  if (!createResponse.ok) {
    const error = await createResponse.text();
    throw new Error(`Failed to create spreadsheet: ${error}`);
  }

  const spreadsheet = await createResponse.json();
  return {
    id: spreadsheet.spreadsheetId,
    url: spreadsheet.spreadsheetUrl,
  };
}

async function syncOrdersToSheet(accessToken: string, spreadsheetId: string, orders: OrderData[], productMap: Map<string, string>, sheetName: string = 'Commandes') {
  // Prepare headers matching the user's sheet format
  const headers = [
    'Date de création',
    'N° Commande',
    'Client',
    'Téléphone',
    'Wilaya',
    'Commune',
    'Adresse',
    'Produits',
    'SKU',
    'Quantité',
    'Prix Subtotal',
    'Type de livraison',
  ];

  // Prepare data rows - one row per order
  const rows = orders.map(order => {
    // Format products: "Product Name x2, Another Product x1"
    const productsText = order.order_items
      .map(item => {
        const variant = item.variant ? ` (${item.variant})` : '';
        return `${item.product_name}${variant}`;
      })
      .join(', ') || '';

    // Get SKUs from product map
    const skuText = order.order_items
      .map(item => item.product_id ? (productMap.get(item.product_id) || '') : '')
      .filter(Boolean)
      .join(', ') || '';

    // Total quantity
    const totalQuantity = order.order_items.reduce((sum, item) => sum + item.quantity, 0);

    // Subtotal (total - delivery fee)
    const subtotal = order.total_price - (order.delivery_fee || 0);

    // Delivery type in French
    const deliveryTypeText = order.delivery_type === 'home' ? 'Domicile' : 'Stop Desk';

    return [
      new Date(order.created_at).toLocaleString('fr-FR'),
      order.order_number,
      order.customer_name,
      order.customer_phone,
      order.wilaya,
      order.commune || '',
      order.customer_address,
      productsText,
      skuText,
      totalQuantity,
      subtotal,
      deliveryTypeText,
    ];
  });

  // Clear and update sheet
  const values = [headers, ...rows];

  // Clear existing data (12 columns: A to L)
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A:L:clear`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  // Write new data
  const updateResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A1:L${values.length}?valueInputOption=USER_ENTERED`,
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

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    // Get user from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid user token');
    }

    console.log('Syncing for user:', user.id);

    // Get user's Google tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('google_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (tokenError || !tokenData) {
      throw new Error('Google account not connected. Please connect your Google account first.');
    }

    // Check if token needs refresh
    let accessToken = tokenData.access_token;
    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      console.log('Token expired, refreshing...');
      if (!tokenData.refresh_token) {
        throw new Error('Token expired and no refresh token available. Please reconnect your Google account.');
      }
      
      accessToken = await refreshAccessToken(tokenData.refresh_token);
      if (!accessToken) {
        throw new Error('Failed to refresh token. Please reconnect your Google account.');
      }

      // Update token in database
      await supabase
        .from('google_tokens')
        .update({
          access_token: accessToken,
          expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
        })
        .eq('user_id', user.id);
    }

    // Get Google Sheets integration settings
    const { data: integration } = await supabase
      .from('integrations')
      .select('spreadsheet_id')
      .eq('integration_type', 'google_sheets')
      .eq('name', 'Google Sheets')
      .eq('is_enabled', true)
      .single();

    // Get or create spreadsheet
    const spreadsheet = await getOrCreateSpreadsheet(accessToken, integration?.spreadsheet_id);

    // If new spreadsheet, save the ID
    if (!integration?.spreadsheet_id) {
      await supabase
        .from('integrations')
        .upsert({
          integration_type: 'google_sheets',
          name: 'Google Sheets',
          spreadsheet_id: spreadsheet.id,
          is_enabled: true,
        }, {
          onConflict: 'integration_type,name',
        });
    }

    // Fetch all products to get SKUs
    const { data: products } = await supabase
      .from('products')
      .select('id, sku');
    
    // Create a map of product_id -> SKU
    const productMap = new Map<string, string>();
    products?.forEach((p: ProductData) => productMap.set(p.id, p.sku));

    // Fetch orders with their items
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
        delivery_fee,
        delivery_type,
        status,
        created_at,
        order_items (
          product_name,
          quantity,
          unit_price,
          variant,
          product_id
        )
      `)
      .order('created_at', { ascending: false });

    if (ordersError) {
      throw new Error(`Failed to fetch orders: ${ordersError.message}`);
    }

    // Sync to Google Sheets
    const result = await syncOrdersToSheet(accessToken, spreadsheet.id, orders as OrderData[] || [], productMap);

    console.log('Sync complete:', result);

    return new Response(
      JSON.stringify({
        success: true,
        message: `${result.updatedRows - 1} commandes synchronisées`,
        spreadsheetUrl: spreadsheet.url,
        spreadsheetId: spreadsheet.id,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error: unknown) {
    console.error('Sync error:', error);
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
