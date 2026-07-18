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

interface SheetRow {
  orderNumber?: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  wilaya: string;
  commune?: string;
  products: string;
  totalPrice: number;
  status?: string;
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

async function readSheetData(accessToken: string, spreadsheetId: string, sheetName: string = 'Commandes'): Promise<string[][]> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A:L`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to read spreadsheet: ${error}`);
  }

  const data = await response.json();
  return data.values || [];
}

async function deleteSheetRows(accessToken: string, spreadsheetId: string, sheetName: string, rowIndices: number[]): Promise<void> {
  if (rowIndices.length === 0) return;

  // First, get the sheet ID
  const metaResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!metaResponse.ok) {
    console.error('Failed to get sheet metadata');
    return;
  }

  const metaData = await metaResponse.json();
  const sheet = metaData.sheets?.find((s: any) => s.properties?.title === sheetName);
  const sheetId = sheet?.properties?.sheetId ?? 0;

  // Sort row indices in descending order to delete from bottom to top
  const sortedIndices = [...rowIndices].sort((a, b) => b - a);

  // Create delete requests for each row
  const requests = sortedIndices.map(rowIndex => ({
    deleteDimension: {
      range: {
        sheetId: sheetId,
        dimension: 'ROWS',
        startIndex: rowIndex, // 0-indexed, includes header so add 1 to data index
        endIndex: rowIndex + 1,
      },
    },
  }));

  const deleteResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    }
  );

  if (!deleteResponse.ok) {
    const error = await deleteResponse.text();
    console.error('Failed to delete rows:', error);
  } else {
    console.log(`Deleted ${rowIndices.length} rows from sheet`);
  }
}

// Normalize phone to +213XXXXXXXXX format
function normalizePhone(phone: string): string {
  if (!phone) return '';
  
  // Remove all spaces, dashes, dots, parentheses
  let cleaned = phone.replace(/[\s\-\.\(\)]/g, '');
  
  // Handle different formats:
  // 0541020072 -> +213541020072
  // 541020072 -> +213541020072
  // 213541020072 -> +213541020072
  // +213541020072 -> +213541020072
  // 00213541020072 -> +213541020072
  
  // Remove leading + if present
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  
  // Remove leading 00 if present (international format)
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }
  
  // If starts with 213, keep as is
  if (cleaned.startsWith('213')) {
    return '+' + cleaned;
  }
  
  // If starts with 0, remove it and add 213
  if (cleaned.startsWith('0')) {
    return '+213' + cleaned.substring(1);
  }
  
  // Otherwise just add +213 prefix
  return '+213' + cleaned;
}

interface SheetRowParsed extends SheetRow {
  sku?: string;
  quantity?: number;
}

function parseSheetRow(row: string[], headerRow: string[]): SheetRowParsed | null {
  if (!row || row.length < 4) return null;

  // Find column indices based on headers
  // Expected order: Date, N° Commande, Client, Téléphone, Wilaya, Commune, Adresse, Produits, SKU, Quantité, Prix Subtotal, Type livraison
  const getIndex = (possibleNames: string[]): number => {
    return headerRow.findIndex(h => 
      possibleNames.some(name => h?.toLowerCase().includes(name.toLowerCase()))
    );
  };

  const orderNumIdx = getIndex(['n°', 'numero', 'order', 'commande']);
  const nameIdx = getIndex(['client', 'nom', 'name']);
  const phoneIdx = getIndex(['telephone', 'phone', 'tel', 'téléphone']);
  const wilayaIdx = getIndex(['wilaya']);
  const communeIdx = getIndex(['commune']);
  const addressIdx = getIndex(['adresse', 'address']);
  const productsIdx = getIndex(['produit', 'product']);
  const skuIdx = getIndex(['sku', 'référence', 'ref']);
  const quantityIdx = getIndex(['quantité', 'quantity', 'qty', 'qté']);
  const priceIdx = getIndex(['prix subtotal', 'prix', 'price', 'total', 'subtotal']);
  const statusIdx = getIndex(['statut', 'status']);

  // Use header-based indices or fallback to sync export order:
  // 0: Date, 1: N° Commande, 2: Client, 3: Téléphone, 4: Wilaya, 5: Commune, 6: Adresse, 7: Produits, 8: SKU, 9: Quantité, 10: Prix Subtotal, 11: Type
  const customerName = nameIdx >= 0 ? row[nameIdx] : row[2];
  const rawPhone = phoneIdx >= 0 ? row[phoneIdx] : row[3];
  const customerPhone = normalizePhone(rawPhone);
  const wilaya = wilayaIdx >= 0 ? row[wilayaIdx] : row[4];
  const commune = communeIdx >= 0 ? row[communeIdx] : row[5];
  const customerAddress = addressIdx >= 0 ? row[addressIdx] : row[6];
  const products = productsIdx >= 0 ? row[productsIdx] : row[7] || '';
  const sku = skuIdx >= 0 ? row[skuIdx] : row[8] || '';
  const quantity = parseInt((quantityIdx >= 0 ? row[quantityIdx] : row[9]) || '1') || 1;
  const totalPrice = parseFloat((priceIdx >= 0 ? row[priceIdx] : row[10]) || '0') || 0;

  if (!customerName || !customerPhone || !wilaya) {
    return null;
  }

  return {
    orderNumber: orderNumIdx >= 0 ? row[orderNumIdx] : row[1],
    customerName,
    customerPhone,
    customerAddress: customerAddress || '',
    wilaya,
    commune: commune || undefined,
    products,
    sku: sku || undefined,
    quantity,
    totalPrice,
    status: statusIdx >= 0 ? row[statusIdx] : undefined,
  };
}

// Wilaya mapping: normalized name -> code (1-58) - French + Arabic names
const wilayaNameToCode: Record<string, string> = {
  // French names
  'adrar': '1',
  'chlef': '2',
  'laghouat': '3',
  'oum el bouaghi': '4',
  'batna': '5',
  'béjaïa': '6',
  'bejaia': '6',
  'biskra': '7',
  'béchar': '8',
  'bechar': '8',
  'blida': '9',
  'bouira': '10',
  'tamanrasset': '11',
  'tébessa': '12',
  'tebessa': '12',
  'tlemcen': '13',
  'tiaret': '14',
  'tizi ouzou': '15',
  'alger': '16',
  'djelfa': '17',
  'jijel': '18',
  'sétif': '19',
  'setif': '19',
  'saïda': '20',
  'saida': '20',
  'skikda': '21',
  'sidi bel abbès': '22',
  'sidi bel abbes': '22',
  'annaba': '23',
  'guelma': '24',
  'constantine': '25',
  'médéa': '26',
  'medea': '26',
  'mostaganem': '27',
  "m'sila": '28',
  'msila': '28',
  'mascara': '29',
  'ouargla': '30',
  'oran': '31',
  'el bayadh': '32',
  'illizi': '33',
  'bordj bou arréridj': '34',
  'bordj bou arreridj': '34',
  'boumerdès': '35',
  'boumerdes': '35',
  'el tarf': '36',
  'tindouf': '37',
  'tissemsilt': '38',
  'el oued': '39',
  'khenchela': '40',
  'souk ahras': '41',
  'tipaza': '42',
  'mila': '43',
  'aïn defla': '44',
  'ain defla': '44',
  'naâma': '45',
  'naama': '45',
  'aïn témouchent': '46',
  'ain temouchent': '46',
  'ghardaïa': '47',
  'ghardaia': '47',
  'relizane': '48',
  "el m'ghair": '49',
  'el meghaier': '49',
  'el meniaa': '50',
  'ouled djellal': '51',
  'bordj badji mokhtar': '52',
  'béni abbès': '53',
  'beni abbes': '53',
  'timimoun': '54',
  'touggourt': '55',
  'djanet': '56',
  'in salah': '57',
  'in guezzam': '58',
  // Arabic names
  'أدرار': '1',
  'الشلف': '2',
  'الأغواط': '3',
  'أم البواقي': '4',
  'باتنة': '5',
  'بجاية': '6',
  'بسكرة': '7',
  'بشار': '8',
  'البليدة': '9',
  'البويرة': '10',
  'تمنراست': '11',
  'تبسة': '12',
  'تلمسان': '13',
  'تيارت': '14',
  'تيزي وزو': '15',
  'الجزائر': '16',
  'الجزائر العاصمة': '16',
  'الجلفة': '17',
  'جيجل': '18',
  'سطيف': '19',
  'سعيدة': '20',
  'سكيكدة': '21',
  'سيدي بلعباس': '22',
  'عنابة': '23',
  'قالمة': '24',
  'قسنطينة': '25',
  'المدية': '26',
  'مستغانم': '27',
  'المسيلة': '28',
  'معسكر': '29',
  'ورقلة': '30',
  'وهران': '31',
  'البيض': '32',
  'إليزي': '33',
  'برج بوعريريج': '34',
  'بومرداس': '35',
  'الطارف': '36',
  'تندوف': '37',
  'تيسمسيلت': '38',
  'الوادي': '39',
  'خنشلة': '40',
  'سوق أهراس': '41',
  'تيبازة': '42',
  'ميلة': '43',
  'عين الدفلى': '44',
  'النعامة': '45',
  'عين تموشنت': '46',
  'غرداية': '47',
  'غليزان': '48',
  'المغير': '49',
  'المنيعة': '50',
  'أولاد جلال': '51',
  'برج باجي مختار': '52',
  'بني عباس': '53',
  'تيميمون': '54',
  'تقرت': '55',
  'جانت': '56',
  'عين صالح': '57',
  'عين قزام': '58',
};

const wilayaCodeToName: Record<string, string> = {
  '1': 'Adrar',
  '2': 'Chlef',
  '3': 'Laghouat',
  '4': 'Oum El Bouaghi',
  '5': 'Batna',
  '6': 'Béjaïa',
  '7': 'Biskra',
  '8': 'Béchar',
  '9': 'Blida',
  '10': 'Bouira',
  '11': 'Tamanrasset',
  '12': 'Tébessa',
  '13': 'Tlemcen',
  '14': 'Tiaret',
  '15': 'Tizi Ouzou',
  '16': 'Alger',
  '17': 'Djelfa',
  '18': 'Jijel',
  '19': 'Sétif',
  '20': 'Saïda',
  '21': 'Skikda',
  '22': 'Sidi Bel Abbès',
  '23': 'Annaba',
  '24': 'Guelma',
  '25': 'Constantine',
  '26': 'Médéa',
  '27': 'Mostaganem',
  '28': "M'Sila",
  '29': 'Mascara',
  '30': 'Ouargla',
  '31': 'Oran',
  '32': 'El Bayadh',
  '33': 'Illizi',
  '34': 'Bordj Bou Arréridj',
  '35': 'Boumerdès',
  '36': 'El Tarf',
  '37': 'Tindouf',
  '38': 'Tissemsilt',
  '39': 'El Oued',
  '40': 'Khenchela',
  '41': 'Souk Ahras',
  '42': 'Tipaza',
  '43': 'Mila',
  '44': 'Aïn Defla',
  '45': 'Naâma',
  '46': 'Aïn Témouchent',
  '47': 'Ghardaïa',
  '48': 'Relizane',
  '49': "El M'Ghair",
  '50': 'El Meniaa',
  '51': 'Ouled Djellal',
  '52': 'Bordj Badji Mokhtar',
  '53': 'Béni Abbès',
  '54': 'Timimoun',
  '55': 'Touggourt',
  '56': 'Djanet',
  '57': 'In Salah',
  '58': 'In Guezzam',
};

function normalizeKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[''`]/g, "'");
}


function normalizeWilaya(wilayaInput?: string): string {
  if (!wilayaInput) return '';

  const input = wilayaInput.trim();

  // If it starts with a code like "16 - Alger" or "016 - Alger" or "1 - Adrar - أدرار"
  const codeMatch = input.match(/^(0?\d{1,2})\s*[-–—]\s*(.*)$/);
  if (codeMatch) {
    const code = String(Number(codeMatch[1]));
    if (wilayaCodeToName[code]) {
      return `${code} - ${wilayaCodeToName[code]}`;
    }
  }

  // If it's only a code like "16" or "016" or "1"
  if (/^0?\d{1,2}$/.test(input)) {
    const code = String(Number(input));
    const name = wilayaCodeToName[code];
    return name ? `${code} - ${name}` : code;
  }

  // Try to match by name (French or Arabic)
  // First, try direct lookup for Arabic names
  if (wilayaNameToCode[input]) {
    const code = wilayaNameToCode[input];
    return `${code} - ${wilayaCodeToName[code]}`;
  }

  // Try normalized French name lookup
  const nameCandidate = input.split(' - ')[0].trim();
  const key = normalizeKey(nameCandidate);
  if (wilayaNameToCode[key]) {
    const code = wilayaNameToCode[key];
    return `${code} - ${wilayaCodeToName[code]}`;
  }

  // Try Arabic name directly (without normalization)
  if (wilayaNameToCode[nameCandidate]) {
    const code = wilayaNameToCode[nameCandidate];
    return `${code} - ${wilayaCodeToName[code]}`;
  }

  // Return original if no match found
  return input;
}

function mapStatus(sheetStatus?: string): string {
  if (!sheetStatus) return 'new';
  
  const status = sheetStatus.toLowerCase().trim();
  const statusMap: Record<string, string> = {
    'nouveau': 'new',
    'new': 'new',
    'confirmé': 'confirmed',
    'confirmed': 'confirmed',
    'validé': 'validated',
    'validated': 'validated',
    'expédié': 'shipped',
    'shipped': 'shipped',
    'livré': 'delivered',
    'delivered': 'delivered',
    'annulé': 'cancelled',
    'cancelled': 'cancelled',
    'retourné': 'returned',
    'returned': 'returned',
    'en préparation': 'preparing',
    'preparing': 'preparing',
    'prêt': 'ready',
    'ready': 'ready',
  };

  return statusMap[status] || 'new';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting import from Google Sheets...');
    
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get Google Sheets integration
    const { data: integration, error: intError } = await supabase
      .from('integrations')
      .select('spreadsheet_id')
      .eq('integration_type', 'google_sheets')
      .eq('is_enabled', true)
      .not('spreadsheet_id', 'is', null)
      .maybeSingle();

    if (intError || !integration?.spreadsheet_id) {
      console.log('No active Google Sheets integration found');
      return new Response(
        JSON.stringify({ success: true, message: 'No active integration', imported: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Get first user with Google tokens (for now, single-tenant)
    const { data: tokenData, error: tokenError } = await supabase
      .from('google_tokens')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (tokenError || !tokenData) {
      console.log('No Google tokens found');
      return new Response(
        JSON.stringify({ success: true, message: 'No connected accounts', imported: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Refresh token if needed
    let accessToken = tokenData.access_token;
    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      console.log('Token expired, refreshing...');
      if (!tokenData.refresh_token) {
        throw new Error('Token expired and no refresh token available');
      }
      
      accessToken = await refreshAccessToken(tokenData.refresh_token);
      if (!accessToken) {
        throw new Error('Failed to refresh token');
      }

      await supabase
        .from('google_tokens')
        .update({
          access_token: accessToken,
          expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
        })
        .eq('user_id', tokenData.user_id);
    }

    // Read sheet data
    const sheetData = await readSheetData(accessToken, integration.spreadsheet_id);
    
    if (sheetData.length < 2) {
      console.log('Sheet is empty or has only headers');
      return new Response(
        JSON.stringify({ success: true, message: 'No data in sheet', imported: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const headerRow = sheetData[0];
    const dataRows = sheetData.slice(1);

    // Get existing order numbers to avoid duplicates
    const { data: existingOrders } = await supabase
      .from('orders')
      .select('order_number, customer_phone');

    const existingOrderNumbers = new Set(existingOrders?.map(o => o.order_number) || []);
    const existingPhoneOrders = new Map<string, Set<string>>();
    existingOrders?.forEach(o => {
      if (!existingPhoneOrders.has(o.customer_phone)) {
        existingPhoneOrders.set(o.customer_phone, new Set());
      }
      existingPhoneOrders.get(o.customer_phone)!.add(o.order_number);
    });

    let importedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];
    const importedRowIndices: number[] = []; // Track rows to delete (1-indexed for sheet, 0-indexed in dataRows)

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      
      try {
        const parsed = parseSheetRow(row, headerRow);
        if (!parsed) {
          skippedCount++;
          continue;
        }

        // Skip if order number already exists
        if (parsed.orderNumber && existingOrderNumbers.has(parsed.orderNumber)) {
          console.log(`Skipping existing order: ${parsed.orderNumber}`);
          skippedCount++;
          continue;
        }

        // Normalize wilaya to code format
        const normalizedWilaya = normalizeWilaya(parsed.wilaya);
        
        // Create order - always set status to 'new' for imported orders
        const { data: newOrder, error: orderError } = await supabase
          .from('orders')
          .insert({
            customer_name: parsed.customerName,
            customer_phone: parsed.customerPhone,
            customer_address: parsed.customerAddress,
            wilaya: normalizedWilaya,
            commune: parsed.commune || null,
            total_price: parsed.totalPrice,
            status: 'new', // Always import as new order
            source: 'other',
            delivery_type: 'home',
            delivery_fee: 0,
            discount: 0,
          })
          .select('id, order_number')
          .single();

        if (orderError) {
          console.error(`Error creating order from row ${i + 2}:`, orderError);
          errors.push(`Row ${i + 2}: ${orderError.message}`);
          continue;
        }

        // Parse and create order items - first try to match by SKU
        if (newOrder) {
          let itemCreated = false;
          
          // Try to find product by SKU first
          if (parsed.sku) {
            const { data: productBySku } = await supabase
              .from('products')
              .select('id, name, selling_price, sku')
              .eq('sku', parsed.sku)
              .maybeSingle();
            
            if (productBySku) {
              // Product found by SKU - use its details
              await supabase
                .from('order_items')
                .insert({
                  order_id: newOrder.id,
                  product_id: productBySku.id,
                  product_name: productBySku.name,
                  quantity: parsed.quantity || 1,
                  unit_price: productBySku.selling_price || 0,
                });
              itemCreated = true;
              console.log(`Matched product by SKU: ${parsed.sku} -> ${productBySku.name}`);
            }
          }
          
          // If no SKU match, parse products string
          if (!itemCreated && parsed.products) {
            const productParts = parsed.products.split(',').map(p => p.trim()).filter(Boolean);
            
            for (const productStr of productParts) {
              // Parse "Product Name x2" or "Product Name (variant) x2"
              const match = productStr.match(/^(.+?)(?:\s*\(([^)]+)\))?\s*x(\d+)$/i);
              
              let productName = productStr;
              let variant: string | null = null;
              let quantity = 1;
              
              if (match) {
                productName = match[1].trim();
                variant = match[2]?.trim() || null;
                quantity = parseInt(match[3]) || 1;
              }
              
              // Try to find product by name in database
              const { data: productByName } = await supabase
                .from('products')
                .select('id, name, selling_price, sku')
                .ilike('name', `%${productName}%`)
                .maybeSingle();
              
              if (productByName) {
                // Product found - use its details
                await supabase
                  .from('order_items')
                  .insert({
                    order_id: newOrder.id,
                    product_id: productByName.id,
                    product_name: productByName.name,
                    variant: variant,
                    quantity: quantity,
                    unit_price: productByName.selling_price || 0,
                  });
                console.log(`Matched product by name: ${productName} -> ${productByName.name}`);
              } else {
                // No match - create with provided name
                await supabase
                  .from('order_items')
                  .insert({
                    order_id: newOrder.id,
                    product_name: productName,
                    variant: variant,
                    quantity: quantity,
                    unit_price: 0,
                  });
              }
            }
          }
        }

        existingOrderNumbers.add(newOrder.order_number);
        importedCount++;
        importedRowIndices.push(i + 1); // +1 because row 0 is header
        console.log(`Imported order: ${newOrder.order_number}`);

      } catch (rowError) {
        console.error(`Error processing row ${i + 2}:`, rowError);
        errors.push(`Row ${i + 2}: ${rowError instanceof Error ? rowError.message : 'Unknown error'}`);
      }
    }

    console.log(`Import complete. Imported: ${importedCount}, Skipped: ${skippedCount}, Errors: ${errors.length}`);

    // Delete imported rows from sheet
    if (importedRowIndices.length > 0) {
      try {
        await deleteSheetRows(accessToken, integration.spreadsheet_id, 'Commandes', importedRowIndices);
      } catch (deleteError) {
        console.error('Error deleting rows:', deleteError);
        // Don't fail the whole import if deletion fails
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Importé: ${importedCount} commandes`,
        imported: importedCount,
        skipped: skippedCount,
        errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error: unknown) {
    console.error('Import error:', error);
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
