import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Wilaya names by code
const wilayaNames: Record<string, string> = {
  "1":"Adrar","2":"Chlef","3":"Laghouat","4":"Oum El Bouaghi","5":"Batna",
  "6":"Béjaïa","7":"Biskra","8":"Béchar","9":"Blida","10":"Bouira",
  "11":"Tamanrasset","12":"Tébessa","13":"Tlemcen","14":"Tiaret","15":"Tizi Ouzou",
  "16":"Alger","17":"Djelfa","18":"Jijel","19":"Sétif","20":"Saïda",
  "21":"Skikda","22":"Sidi Bel Abbès","23":"Annaba","24":"Guelma","25":"Constantine",
  "26":"Médéa","27":"Mostaganem","28":"M'Sila","29":"Mascara","30":"Ouargla",
  "31":"Oran","32":"El Bayadh","33":"Illizi","34":"Bordj Bou Arréridj","35":"Boumerdès",
  "36":"El Tarf","37":"Tindouf","38":"Tissemsilt","39":"El Oued","40":"Khenchela",
  "41":"Souk Ahras","42":"Tipaza","43":"Mila","44":"Aïn Defla","45":"Naâma",
  "46":"Aïn Témouchent","47":"Ghardaïa","48":"Relizane",
  "49":"El M'Ghair","50":"El Meniaa","51":"Ouled Djellal","52":"Bordj Badji Mokhtar",
  "53":"Béni Abbès","54":"Timimoun","55":"Touggourt","56":"Djanet",
  "57":"In Salah","58":"In Guezzam",
};

// All wilaya names (for quick check)
const allWilayaNames = new Set(Object.values(wilayaNames).map(n => n.toLowerCase()));

// Normalize wilaya string from LightFunnel format like "1 - Adrar - أدرار" to "Adrar"
function normalizeWilayaString(raw: string): string {
  const trimmed = raw.trim();
  // Match pattern: "number - FrenchName - ArabicName" or "number - FrenchName"
  const match = trimmed.match(/^\d+\s*-\s*([^-]+?)(?:\s*-\s*.+)?$/);
  if (match) {
    return match[1].trim();
  }
  return trimmed;
}

// Check if a value is already a valid wilaya name
function isWilayaName(value: string): boolean {
  return allWilayaNames.has(value.trim().toLowerCase());
}

// Resolve wilaya from commune by querying delivery_fees table (has all 58 wilayas)
// or by checking if the value itself is a wilaya name
async function resolveWilaya(
  supabase: any,
  rawWilaya: string,
  rawCommune: string
): Promise<{ wilaya: string; commune: string }> {
  // First normalize LightFunnel format "1 - Adrar - أدرار" → "Adrar"
  const wilayaCandidate = normalizeWilayaString(rawWilaya);
  const communeCandidate = normalizeWilayaString(rawCommune);

  // If province/wilaya field is already a valid wilaya name, use it directly
  if (wilayaCandidate && isWilayaName(wilayaCandidate)) {
    return { wilaya: wilayaCandidate, commune: communeCandidate || wilayaCandidate };
  }

  // If province == city, it means LightFunnel sent the commune as both
  // Try to find the wilaya from delivery_fees by matching commune name
  const searchValue = communeCandidate || wilayaCandidate;
  if (!searchValue) {
    return { wilaya: "Non spécifiée", commune: communeCandidate };
  }

  // Check if searchValue is actually a wilaya name
  if (isWilayaName(searchValue)) {
    return { wilaya: searchValue, commune: communeCandidate };
  }

  // Query delivery_company_fees or use a text search approach
  // Since we don't have a communes table, we'll do a reverse lookup
  // by checking the wilaya_name from delivery_fees
  // But the best approach is to check against known commune lists
  
  // Try to find wilaya by querying the database for any order with this commune
  const { data: existingOrder } = await supabase
    .from("orders")
    .select("wilaya")
    .eq("commune", searchValue)
    .not("wilaya", "eq", searchValue) // exclude orders with same bug
    .not("wilaya", "eq", "Non spécifiée")
    .limit(1)
    .maybeSingle();

  if (existingOrder?.wilaya) {
    console.log(`Resolved wilaya "${existingOrder.wilaya}" from existing orders for commune "${searchValue}"`);
    return { wilaya: existingOrder.wilaya, commune: searchValue };
  }

  // Hardcoded fallback for common Algerian communes
  const communeWilayaMap: Record<string, string> = buildCommuneWilayaMap();
  const normalized = searchValue.toLowerCase().trim();
  if (communeWilayaMap[normalized]) {
    console.log(`Resolved wilaya "${communeWilayaMap[normalized]}" from hardcoded map for commune "${searchValue}"`);
    return { wilaya: communeWilayaMap[normalized], commune: searchValue };
  }

  // Could not resolve - use raw value
  console.log(`Could not resolve wilaya for: "${searchValue}", using as-is`);
  return { wilaya: wilayaCandidate || searchValue, commune: communeCandidate };
}

function buildCommuneWilayaMap(): Record<string, string> {
  const map: Record<string, string> = {};
  const data: Record<string, string[]> = {
    "1": ["Adrar","Timekten","Bouda","Ouled Ahmed Timmi","Fenoughil","In Zghmir","Reggane","Sali","Sebaa","Tsabit","Tamest","Tamantit","Tit","Zaouiet Kounta","Akabli","Aoulef","Talassa"],
    "2": ["Chlef","Zeboudja","El Hadjadj","Ouled Ben Abdelkader","Ain Merane","Breira","Ouled Abbes","Oued Fodda","Beni Rached","Herenfa","Tadjena","El Marsa","Oum Drou","Sendjas","Sidi Abderrahmane","Sidi Akkacha","Tenes","Beni Bouattab","El Karimia","Harchoun","Bouzeghaia","Taougrit","Beni Haoua","Abou El Hassane","Oued Goussine","Chettia","Moussadek","Ouled Fares","Boukadir","Oued Sly","Sobha","Benairia","Labiod Medjadja","Dahra"],
    "3": ["Laghouat","El Beidha","Gueltat Sidi Saad","Brida","Ain Sidi Ali","Tadjemout","Hadj Mechri","Taouiala","El Ghicha","Tadjrouna","Sebgag","Sidi Bouzid","Oued Morra","Oued M'zi","Ksar El Hirane","El Assafia","Sidi Makhlouf","Hassi Delaa","Hassi R'mel","Ain Madhi","El Haouaita","Kheneg","Benacer Benchohra","Aflou"],
    "5": ["Batna","Ain Kercha","El Harmilia","Hanchir Toumghani","Maafa","Gosbat","Timgad","Taxlent","Ouled Si Slimane","Lemcene","Talkhamt","Ras El Aioun","Rahbat","Ouled Sellem","Guigba","Teniet El Abed","Fesdis","Oued Chaaba","Hidoussa","Ksar Bellezma","Merouana","Oued El Ma","Lazrou","Seriana","Zanet El Beida","Menaa","Tigharghar","Ain Yagout","Boumia","Djerma","El Madher","Ouyoun El Assafir","Tazoult","Boumagueur","N Gaous","Sefiane","Arris","Tighanimine","Ain Djasser","El Hassi","Seggana","Tilatou","Foum Toub","Ichemoul","Inoughissen","Bouzina","Larbaa","Boulhilat","Chemora","Barika","Bitam","M Doukal","Azil Abedelkader","Djezzar","Ouled Ammar","Ghassira","Kimmel","T Kout","Ain Touta","Beni Foudhala El Hakania","Ouled Fadel","Ouled Aouf","Chir","Oued Taga"],
    "9": ["Blida","Beni Mered","Ouled Slama","Mouzaia","Hammam Elouane","Bougara","Souhane","Larbaa","Soumaa","Guerrouaou","Boufarik","Meftah","Chiffa","Ain Romana","Oued Djer","El-Affroun","Ouled Yaich","Chrea","Djebabra","Oued El Alleug","Benkhelil","Beni-Tamou","Chebli","Bouinan","Bouarfa"],
    "16": ["Alger","Hussein Dey","Les Eucalyptus","Sidi Moussa","Kouba","Mohamed Belouzdad","Ain Taya","Bab Ezzouar","Bordj El Kiffan","Dar El Beida","El Marsa","Mohammadia","Bir Touta","Ouled Chebel","Tessala El Merdja","Herraoua","Reghaia","Rouiba","Maalma","Rahmania","Souidania","Staoueli","Zeralda","Baba Hassen","Douira","Draria","El Achour","Khraissia","Ain Benian","Cheraga","Dely Ibrahim","Hammamet","Ouled Fayet","Alger Centre","El Madania","El Mouradia","Sidi M'hamed","Sehaoula","Bologhine Ibnou Ziri","Casbah","Oued Koriche","Rais Hamidou","Bir Mourad Rais","Birkhadem","Djasr Kasentina","Hydra","El Magharia","Ben Aknoun","Beni Messous","Bouzareah","El Biar","Bachedjerah","Bourouba","El Harrach","Oued Smar","Baraki","Bordj El Bahri","Bab El Oued"],
    "25": ["Constantine","Didouche Mourad","Hamma Bouziane","Beni Hamidane","Zighoud Youcef","Ain Smara","El Khroub","Ouled Rahmoun","Ain Abid","Ben Badis","Ibn Ziad","Messaoud Boudjeriou"],
    "31": ["Oran","Sidi Chami","Hassi Mefsoukh","Bir El Djir","Hassi Ben Okba","Gdyel","Hassi Bounif","El Kerma","Es Senia","Ben Freha","Arzew","Sidi Ben Yebka","Ain Biya","Bethioua","Marsat El Hadjadj","Ain Turk","El Ancor","Mers El Kebir","Boufatis","El Braya","Oued Tlelat","Ain Kerma","Boutlelis","Messerghin","Bousfer","Tafraoui"],
    "35": ["Boumerdès","El Kharrouba","Dellys","Ben Choud","Afir","Thenia","Beni Amrane","Khemis El Khechna","Ammal","Timezrit","Zemmouri","Larbatache","Isser","Chabet El Ameur","Ouled Aissa","Naciria","Bouzegza Keddara","Souk El Had","Sidi Daoud","Baghlia","Leghata","Djinet","Tidjelabine","Si Mustapha","Ouled Hedadj","Ouled Moussa","Corso","Bordj Menaiel","Boudouaou","Boudouaou El Bahri","Taourga","Hammedi"],
    "42": ["Tipaza","Hadjout","Merad","Menaceur","Aghbal","Nador","Sidi-Amar","Gouraya","Messelmoun","Cherchell","Hadjret Ennous","Sidi Ghiles","Damous","Larhat","Fouka","Ain Tagourait","Bou Haroun","Bou Ismail","Khemisti","Ahmer El Ain","Bourkika","Douaouda","Sidi Rached","Attatba","Chaiba","Kolea","Sidi Semiane","Beni Mileuk"],
    "15": ["Tizi Ouzou","Mizrana","Idjeur","Beni-Douala","Beni-Zikki","Illoula Oumalou","Agouni-Gueghrane","Ait Bouaddou","Ouadhias","Tizi N'tleta","Aghribs","Ait-Chafaa","Akerrou","Azeffoun","Iflissen","Tigzirt","Assi-Youcef","Boghni","Bounouh","Mechtras","Draa-Ben-Khedda","Sidi Namane","Tadmait","Tirmitine","Ait Boumahdi","Ait-Toudert","Beni-Aissi","Ouacif","Ait Khellili","Mekla","Souama","Beni-Yenni","Iboudrarene","Abi-Youcef","Ain-El-Hammam","Ait-Yahia","Akbil","Boudjima","Makouda","Ain-Zaouia","Ait Yahia Moussa","Draa-El-Mizan","Frikat","M'kira","Tizi-Gheniff","Yatafene","Illilten","Imsouhal","Azazga","Freha","Ifigha","Yakourene","Zekri","Ait Aggouacha","Irdjen","Larbaa Nath Irathen","Ait-Oumalou","Tizi-Rached","Ait-Aissa-Mimoun","Ouaguenoun","Timizart","Maatkas","Souk-El-Tenine","Ait-Mahmoud","Beni Zmenzer","Iferhounene","Bouzeguene"],
    "19": ["Sétif","Setif","Rosfa","Oued El Bared","Tizi N'bechar","Mezloug","Guellal","Kasr El Abtal","Ouled Si Ahmed","Ait Naoual Mezada","Ait-Tizi","Bouandas","Bousselam","Hamam Soukhna","Taya","Tella","Ain Oulmene","Boutaleb","Hamma","Ouled Tebben","Amoucha","Salah Bey","Ain Azel","Ain Lahdjar","Beidha Bordj","Bir Haddada","Guenzet","Harbil","Ain-Roua","Beni Oussine","El Ouricia","Bougaa","Draa-Kebila","Hammam Guergour","Ain El Kebira","Dehamcha","Ouled Addouane","Ain-Sebt","Beni-Aziz","Maaouia","Bellaa","Bir-El-Arch","El-Ouldja","Tachouda","Tala-Ifacene","Serdj-El-Ghoul","Guidjel","Ouled Sabor","Bazer-Sakra","El Eulma","Guelta Zerka","Beni Fouda","Djemila","Ain-Legradj","Beni Chebana","Beni Ourtilane","Beni-Mouhli","Ain Abessa","Ain Arnat","Babor","Maouaklane"],
    "23": ["Annaba","Seraidi","Berrahal","Oued El Aneb","El Hadjar","Sidi Amar","El Bouni","Ain El Berda","Cheurfa","El Eulma","Treat","Chetaibi"],
    "6": ["Béjaïa","Bejaia","Sidi Ayad","Barbacha","Leflaye","Kendira","Sidi-Aich","Tifra","Tinebdar","El Kseur","Fenaia Il Maten","Toudja","Dra El Caid","Kherrata","Oued Ghir","Benimaouche","Beni Djellil","Feraoun","Smaoun","Timezrit","Melbou","Souk El Tenine","Tamridjet","Boukhelifa","Tala Hamza","Tichy","Ait R'zine","Ighil-Ali","Ait-Smail","Darguina","Taskriout","Aokas","Tizi-N'berber","Adekar","Beni K'sila","Taourit Ighil","Akbou","Chellata","Ighram","Tamokra","Amalou","Bouhamza","M'cisna","Seddouk","Beni-Mallikeche","Boudjellil","Tazmalt","Akfadou","Chemini","Souk Oufella","Tibane","Ouzellaguen","Amizour"],
  };

  for (const [code, communes] of Object.entries(data)) {
    const wName = wilayaNames[code];
    if (!wName) continue;
    for (const c of communes) {
      map[c.toLowerCase()] = wName;
    }
  }
  return map;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get integration config
    const { data: integration } = await supabase
      .from("integrations")
      .select("api_key, is_enabled")
      .eq("integration_type", "ecommerce")
      .eq("name", "LightFunnel")
      .maybeSingle();

    // If integration is disabled, reject incoming orders
    if (!integration?.is_enabled) {
      console.log("LightFunnel integration is disabled, ignoring webhook");
      return new Response(JSON.stringify({ success: false, reason: "integration_disabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const storedApiKey = integration?.api_key;

    if (!storedApiKey) {
      console.error("LightFunnel API key is not configured; refusing webhook traffic");
      return new Response(JSON.stringify({ error: "Webhook not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const incomingKey = url.searchParams.get("api_key") || req.headers.get("x-api-key");
    if (incomingKey !== storedApiKey) {
      console.error("Invalid or missing API key");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json();
    console.log("LightFunnel webhook received:", JSON.stringify(payload).substring(0, 500));

    const node = payload.node || payload;

    // Extract customer info
    const shippingAddress = node.shipping_address || node.customer?.shipping_address || {};
    const customer = node.customer || {};
    
    const customerName = [
      customer.first_name || shippingAddress.first_name || "",
      customer.last_name || shippingAddress.last_name || "",
    ].filter(Boolean).join(" ") || customer.full_name || node.email || "Client LightFunnel";

    const customerPhone = customer.phone || node.phone || shippingAddress.phone || "";
    const customerAddress = [
      shippingAddress.address1,
      shippingAddress.address2,
    ].filter(Boolean).join(", ") || "";

    const rawWilaya = shippingAddress.province || shippingAddress.state || shippingAddress.city || "";
    const rawCommune = shippingAddress.city || shippingAddress.commune || "";

    // Resolve wilaya correctly (LightFunnel often sends commune name as city/province)
    const { wilaya, commune } = await resolveWilaya(supabase, rawWilaya, rawCommune);
    console.log(`Resolved location: wilaya="${wilaya}", commune="${commune}" (raw: province="${shippingAddress.province}", city="${shippingAddress.city}")`);

    // Extract items and match with local products by SKU or name
    const items = node.items || [];
    const orderItemsMap = new Map<string, { product_name: string; product_id: string | null; variant: string | null; quantity: number; unit_price: number }>();
    let totalFromLocalPrices = 0;
    let allMatched = true;

    for (const item of items) {
      const lfName = item.title || item.name || "Produit LightFunnel";
      const lfSku = item.sku || item.variant?.sku || null;
      const quantity = item.quantity || 1;
      const variant = item.variant_title || item.variant?.title || null;

      // Try to find product in local catalog by SKU first, then by name
      let localProduct = null;
      if (lfSku) {
        const { data } = await supabase
          .from("products")
          .select("id, name, selling_price, sku")
          .eq("sku", lfSku)
          .maybeSingle();
        localProduct = data;
      }
      if (!localProduct) {
        const { data } = await supabase
          .from("products")
          .select("id, name, selling_price, sku")
          .ilike("name", lfName)
          .maybeSingle();
        localProduct = data;
      }

      const unitPrice = localProduct ? localProduct.selling_price : item.price || 0;
      const productId = localProduct ? localProduct.id : null;

      if (!localProduct) {
        allMatched = false;
        console.log(`Product not found in catalog: "${lfName}" (SKU: ${lfSku}), using LF price: ${item.price}`);
      } else {
        console.log(`Matched product "${lfName}" → "${localProduct.name}" (${localProduct.selling_price} DA)`);
      }

      // Aggregate by product_name + variant key
      const key = `${(localProduct ? localProduct.name : lfName)}::${variant || ""}`;
      const existing = orderItemsMap.get(key);
      if (existing) {
        existing.quantity += quantity;
      } else {
        orderItemsMap.set(key, {
          product_name: localProduct ? localProduct.name : lfName,
          product_id: productId,
          variant,
          quantity,
          unit_price: unitPrice,
        });
      }

      totalFromLocalPrices += unitPrice * quantity;
    }

    // Check for applicable packs
    const { data: activePacks } = await supabase
      .from("product_packs")
      .select("*")
      .eq("is_active", true);

    let packDiscount = 0;
    let packFreeDelivery = false;
    const aggregatedItems = Array.from(orderItemsMap.values());
    const giftQuantities = new Map<string, number>();

    const addPackGift = (pack: any) => {
      if (pack.gift_product_id && Number(pack.gift_quantity) > 0) {
        const currentQty = giftQuantities.get(pack.gift_product_id) || 0;
        giftQuantities.set(pack.gift_product_id, currentQty + Number(pack.gift_quantity));
      }
    };

    if (activePacks && activePacks.length > 0) {
      for (const pack of activePacks) {
        // Single product quantity pack
        if (pack.product_id) {
          const matchingItem = aggregatedItems.find(i => i.product_id === pack.product_id);
          if (matchingItem && matchingItem.quantity >= pack.min_quantity) {
            const lineTotal = matchingItem.quantity * matchingItem.unit_price;
            if (pack.discount_type === 'tiered' && pack.price_tiers && Array.isArray(pack.price_tiers) && pack.price_tiers.length > 0) {
              const sortedTiers = [...pack.price_tiers].sort((a: any, b: any) => b.quantity - a.quantity);
              const matchingTier = sortedTiers.find((t: any) => matchingItem.quantity >= t.quantity);
              if (matchingTier) {
                const tierUnitPrice = (matchingTier as any).price / (matchingTier as any).quantity;
                const newTotal = tierUnitPrice * matchingItem.quantity;
                packDiscount += Math.max(0, lineTotal - newTotal);
              }
            } else if (pack.discount_type === 'percentage') {
              packDiscount += lineTotal * (pack.discount_value / 100);
            } else if (pack.discount_type === 'fixed_amount') {
              packDiscount += pack.discount_value;
            } else if (pack.discount_type === 'fixed_price') {
              const packUnitPrice = pack.discount_value / pack.min_quantity;
              const newTotal = packUnitPrice * matchingItem.quantity;
              packDiscount += Math.max(0, lineTotal - newTotal);
            }
            if (pack.free_delivery) packFreeDelivery = true;
            addPackGift(pack);
            console.log(`Pack "${pack.name}" applied: discount=${packDiscount}, freeDelivery=${packFreeDelivery}`);
          }
        }
        // Multi-product pack
        if (pack.required_product_ids && pack.required_product_ids.length > 0) {
          const orderProductIds = aggregatedItems.filter(i => i.product_id).map(i => i.product_id);
          const allPresent = pack.required_product_ids.every((pid: string) => orderProductIds.includes(pid));
          if (allPresent) {
            const matchingTotal = aggregatedItems
              .filter(i => i.product_id && pack.required_product_ids.includes(i.product_id))
              .reduce((sum: number, i) => sum + i.quantity * i.unit_price, 0);
            if (pack.discount_type === 'percentage') {
              packDiscount += matchingTotal * (pack.discount_value / 100);
            } else if (pack.discount_type === 'fixed_amount') {
              packDiscount += pack.discount_value;
            } else if (pack.discount_type === 'fixed_price') {
              packDiscount += Math.max(0, matchingTotal - pack.discount_value);
            }
            if (pack.free_delivery) packFreeDelivery = true;
            addPackGift(pack);
            console.log(`Multi-pack "${pack.name}" applied`);
          }
        }
      }
    }

    // total_price must include delivery fee (matches the rest of the app's convention)
    const deliveryFee = packFreeDelivery ? 0 : (node.shipping || 0);
    const totalPrice = totalFromLocalPrices - packDiscount + deliveryFee;
    console.log(`Price calculation: localTotal=${totalFromLocalPrices}, delivery=${deliveryFee}, discount=${packDiscount}, finalTotal=${totalPrice}`);

    // Check for duplicate by LightFunnel order ID via order_number
    const lightfunnelOrderId = node.name || node._id?.toString() || node.id?.toString();
    if (lightfunnelOrderId) {
      const { data: existingOrder } = await supabase
        .from("orders")
        .select("id")
        .eq("order_number", `LF-${lightfunnelOrderId}`)
        .maybeSingle();

      if (existingOrder) {
        console.log("Duplicate order detected, skipping:", lightfunnelOrderId);
        return new Response(JSON.stringify({ success: true, skipped: true, reason: "duplicate" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Find or create customer
    let customerId: string | null = null;
    if (customerPhone) {
      const normalizedPhone = customerPhone.replace(/\s+/g, "").replace(/^(\+213|00213)/, "0");
      
      const { data: existingCustomer } = await supabase
        .from("customers")
        .select("id")
        .eq("phone", normalizedPhone)
        .maybeSingle();

      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        const { data: newCustomer } = await supabase
          .from("customers")
          .insert({
            name: customerName,
            phone: normalizedPhone,
            wilaya: wilaya || "Non spécifiée",
            commune: commune || null,
            address: customerAddress || null,
            status: "new",
          })
          .select("id")
          .single();

        if (newCustomer) customerId = newCustomer.id;
      }
    }

    // Create the order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        order_number: `LF-${node.name || node._id || Date.now()}`,
        customer_id: customerId,
        customer_name: customerName,
        customer_phone: customerPhone || "Non fourni",
        customer_address: customerAddress || "Non fournie",
        wilaya: wilaya || "Non spécifiée",
        commune: commune || null,
        source: "website" as const,
        status: "new" as const,
        delivery_type: "home" as const,
        total_price: totalPrice,
        delivery_fee: deliveryFee,
        discount: packDiscount,
        notes: null,
        remarks: null,
      })
      .select("id, order_number")
      .single();

    if (orderError) {
      console.error("Error creating order:", orderError);
      throw orderError;
    }

    console.log("Order created:", order.order_number, "wilaya:", wilaya, "commune:", commune);

    // Insert order items (aggregated + gifts)
    if (order) {
      const itemsToInsert = aggregatedItems.map((item) => ({
        order_id: order.id,
        product_name: item.product_name,
        product_id: item.product_id || null,
        variant: item.variant,
        quantity: item.quantity,
        unit_price: item.unit_price,
      }));

      const giftProductIds = Array.from(giftQuantities.keys());
      if (giftProductIds.length > 0) {
        const { data: giftProducts } = await supabase
          .from("products")
          .select("id, name")
          .in("id", giftProductIds);

        const giftNameById = new Map<string, string>();
        for (const p of giftProducts || []) {
          giftNameById.set(p.id, p.name);
        }

        for (const giftProductId of giftProductIds) {
          itemsToInsert.push({
            order_id: order.id,
            product_name: giftNameById.get(giftProductId) || "Cadeau",
            product_id: giftProductId,
            variant: "cadeau",
            quantity: giftQuantities.get(giftProductId) || 1,
            unit_price: 0,
          });
        }
      }

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(itemsToInsert);

      if (itemsError) {
        console.error("Error inserting order items:", itemsError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, order_id: order.id, order_number: order.order_number }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("LightFunnel webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
