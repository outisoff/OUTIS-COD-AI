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

  const auth = await authenticateRequest(req, { requireRoles: ['admin', 'confirmateur', 'stock_manager'] })
  if (!auth.ok) return new Response(JSON.stringify({ error: auth.message }), { status: auth.status, headers: corsHeaders })

  try {
    // Normalize accented characters for matching
    const normalize = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const { wilaya_name } = await req.json()

    const { data: integration } = await supabase
      .from("integrations")
      .select("*")
      .eq("integration_type", "delivery")
      .eq("name", "ZR Express")
      .eq("is_enabled", true)
      .maybeSingle()

    if (!integration) {
      return new Response(JSON.stringify({ error: "ZR Express not configured", pickup_points: [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const tenantId = integration.settings?.tenant_id || integration.api_key || ""
    const apiKey = integration.api_secret || ""

    const searchBody: any = {
      advancedFilter: {
        logic: "and",
        filters: [
          { field: "isPickupPoint", operator: "eq", value: true },
        ],
      },
      pageNumber: 1,
      pageSize: 500,
    }

    if (wilaya_name) {
      // Send normalized (no accents) keyword for better API matching
      const normalizedKeyword = normalize(wilaya_name)
      searchBody.advancedSearch = { fields: ["name", "address.city"], keyword: normalizedKeyword }
    }

    // Retry logic for network issues (IPv6 connection resets)
    let res: Response | null = null;
    let text = "";
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        res = await fetch("https://api.zrexpress.app/api/v1/hubs/search", {
          method: "POST",
          headers: {
            "X-Api-Key": apiKey,
            "X-Tenant": tenantId,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify(searchBody),
        });
        text = await res.text();
        if (res.ok) break;
        console.error(`Hubs search attempt ${attempt + 1} failed:`, res.status, text);
      } catch (fetchErr) {
        console.error(`Hubs search attempt ${attempt + 1} network error:`, fetchErr.message);
        if (attempt < maxRetries - 1) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }

    if (!res || !res.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch pickup points", pickup_points: [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const data = JSON.parse(text)
    const items = data?.items || []

    // Filter items that match the wilaya if provided
    let filtered = items
    if (wilaya_name) {
      const wilayaNorm = normalize(wilaya_name)
      filtered = items.filter((hub: any) => {
        const city = normalize(hub.address?.city || "")
        const name = normalize(hub.name || "")
        return city.includes(wilayaNorm) || name.includes(wilayaNorm)
      })
    }

    const points = (filtered.length > 0 ? filtered : items).map((hub: any) => ({
      id: hub.id,
      name: hub.name || "",
      address: hub.address?.street || "",
      city: hub.address?.city || "",
      commune: hub.address?.district || hub.address?.commune || "",
      type: hub.type || "",
      phone: hub.phone || hub.phoneNumber || hub.contact?.phone || "",
      latitude: hub.address?.coordinates?.lat || null,
      longitude: hub.address?.coordinates?.lng || null,
    }))

    return new Response(JSON.stringify({ pickup_points: points, total: points.length }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("Error:", error)
    return new Response(JSON.stringify({ error: error.message, pickup_points: [] }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
