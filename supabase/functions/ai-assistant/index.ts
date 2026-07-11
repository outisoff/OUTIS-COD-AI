// AI Assistant edge function - admin-only platform agent with tool calling
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

// Tools the AI can call
const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_orders",
      description: "Search orders by order number, customer name, or phone. Returns matching orders with id, status, customer info, total.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Order number, name or phone fragment" },
          status: { type: "string", description: "Optional exact status filter" },
          limit: { type: "number", description: "Max results, default 10" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_order",
      description: "Get full details of one order by id or order_number including items.",
      parameters: {
        type: "object",
        properties: { id_or_number: { type: "string" } },
        required: ["id_or_number"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_order_status",
      description: "WRITE: Change the status of an order. Valid statuses include: new, confirmed, preparing, ready, shipped, delivered, delivered_paid, cancelled, returned, erreur.",
      parameters: {
        type: "object",
        properties: {
          id_or_number: { type: "string" },
          status: { type: "string" },
        },
        required: ["id_or_number", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_order",
      description: "WRITE: Update order fields (customer_name, customer_phone, customer_address, wilaya, commune, notes, total_price, delivery_fee, assigned_agent, delivery_company, tracking_number).",
      parameters: {
        type: "object",
        properties: {
          id_or_number: { type: "string" },
          fields: { type: "object", description: "Object of column:value to update" },
        },
        required: ["id_or_number", "fields"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_order",
      description: "WRITE: Permanently delete an order.",
      parameters: {
        type: "object",
        properties: { id_or_number: { type: "string" } },
        required: ["id_or_number"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_products",
      description: "Search products by name or sku.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_product",
      description: "WRITE: Update product fields (name, selling_price, purchase_price, current_stock, reorder_level, description, category).",
      parameters: {
        type: "object",
        properties: {
          id_or_sku: { type: "string" },
          fields: { type: "object" },
        },
        required: ["id_or_sku", "fields"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_product",
      description: "WRITE: Permanently delete a product.",
      parameters: {
        type: "object",
        properties: { id_or_sku: { type: "string" } },
        required: ["id_or_sku"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_whatsapp",
      description: "WRITE: Send a WhatsApp message to a customer phone number.",
      parameters: {
        type: "object",
        properties: {
          phone: { type: "string" },
          message: { type: "string" },
        },
        required: ["phone", "message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "assign_agent",
      description: "WRITE: Assign an order to an agent (by name).",
      parameters: {
        type: "object",
        properties: {
          id_or_number: { type: "string" },
          agent_name: { type: "string" },
        },
        required: ["id_or_number", "agent_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_dashboard_stats",
      description: "Read totals: orders count by status, total revenue, low stock products.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "count_orders",
      description: "Count orders matching filters. Supports date range and date_field. Use this for questions like 'how many orders delivered today', 'shipped this week', etc. Timezone is Africa/Algiers (UTC+1). Period shortcut overrides date_from/date_to.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string" },
          statuses: { type: "array", items: { type: "string" } },
          date_field: { type: "string" },
          period: { type: "string" },
          date_from: { type: "string" },
          date_to: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_tables",
      description: "List all available database tables in the platform.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "query_table",
      description: "READ any table in the database. Supports column selection, equality filters, ordering, limit. Use for any question about platform data not covered by other tools (customers, charges, stock_movements, integrations, automation_settings, profiles, alerts, deliveries, conversations, etc.).",
      parameters: {
        type: "object",
        properties: {
          table: { type: "string", description: "Table name (public schema)" },
          columns: { type: "string", description: "Comma list or '*'", default: "*" },
          filters: { type: "object", description: "Equality filters {column: value}" },
          ilike: { type: "object", description: "Case-insensitive partial match {column: pattern} (use % wildcards)" },
          order_by: { type: "string", description: "Column to order by" },
          ascending: { type: "boolean", default: false },
          limit: { type: "number", default: 25 },
        },
        required: ["table"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "count_table",
      description: "Count rows in any table matching equality filters.",
      parameters: {
        type: "object",
        properties: {
          table: { type: "string" },
          filters: { type: "object" },
        },
        required: ["table"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "insert_row",
      description: "WRITE: Insert a row into ANY table. Provide values as an object. Use for creating customers, charges, products, orders, settings, etc.",
      parameters: {
        type: "object",
        properties: {
          table: { type: "string" },
          values: { type: "object" },
        },
        required: ["table", "values"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_rows",
      description: "WRITE: Update rows in ANY table matching equality filters.",
      parameters: {
        type: "object",
        properties: {
          table: { type: "string" },
          filters: { type: "object", description: "Equality filters identifying rows" },
          values: { type: "object", description: "Columns to update" },
        },
        required: ["table", "filters", "values"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_rows",
      description: "WRITE: Delete rows from ANY table matching equality filters. Use carefully.",
      parameters: {
        type: "object",
        properties: {
          table: { type: "string" },
          filters: { type: "object" },
        },
        required: ["table", "filters"],
      },
    },
  },
];

// Compute Africa/Algiers (UTC+1, no DST) day boundaries as UTC ISO strings
function algiersRange(period?: string, dateFrom?: string, dateTo?: string): { gte?: string; lt?: string } {
  const TZ_OFFSET_MS = 60 * 60 * 1000; // +1h
  const nowAlg = new Date(Date.now() + TZ_OFFSET_MS);
  const y = nowAlg.getUTCFullYear();
  const m = nowAlg.getUTCMonth();
  const d = nowAlg.getUTCDate();
  const dow = nowAlg.getUTCDay(); // 0=Sun
  const mondayOffset = (dow + 6) % 7;
  const algDayStartUtc = (yy: number, mm: number, dd: number) => new Date(Date.UTC(yy, mm, dd) - TZ_OFFSET_MS).toISOString();

  if (period) {
    switch (period) {
      case "today": return { gte: algDayStartUtc(y, m, d), lt: algDayStartUtc(y, m, d + 1) };
      case "yesterday": return { gte: algDayStartUtc(y, m, d - 1), lt: algDayStartUtc(y, m, d) };
      case "this_week": return { gte: algDayStartUtc(y, m, d - mondayOffset), lt: algDayStartUtc(y, m, d - mondayOffset + 7) };
      case "last_week": return { gte: algDayStartUtc(y, m, d - mondayOffset - 7), lt: algDayStartUtc(y, m, d - mondayOffset) };
      case "this_month": return { gte: algDayStartUtc(y, m, 1), lt: algDayStartUtc(y, m + 1, 1) };
      case "last_month": return { gte: algDayStartUtc(y, m - 1, 1), lt: algDayStartUtc(y, m, 1) };
    }
  }
  const r: { gte?: string; lt?: string } = {};
  if (dateFrom) {
    const [yy, mm, dd] = dateFrom.split("-").map(Number);
    r.gte = algDayStartUtc(yy, mm - 1, dd);
  }
  if (dateTo) {
    const [yy, mm, dd] = dateTo.split("-").map(Number);
    r.lt = algDayStartUtc(yy, mm - 1, dd + 1);
  }
  return r;
}

const WRITE_TOOLS = new Set([
  "update_order_status",
  "update_order",
  "delete_order",
  "update_product",
  "delete_product",
  "send_whatsapp",
  "assign_agent",
  "insert_row",
  "update_rows",
  "delete_rows",
]);

const ALLOWED_TABLES = new Set([
  "orders", "order_items", "order_history", "customers", "products", "product_variants",
  "product_packs", "stores", "charges", "charge_categories", "charge_subcategories",
  "deliveries", "delivery_fees", "delivery_company_fees", "delivery_promotions",
  "special_delivery_fees", "special_delivery_fees_2", "local_livreurs",
  "alerts", "stock_movements", "integrations", "automation_settings",
  "assignment_rules", "assignment_settings", "auto_confirmation_logs",
  "meta_conversations", "meta_messages", "meta_pages", "meta_integration",
  "conversation_notes", "profiles", "user_roles",
]);

const RATE_LIMIT_REPLY = "Le service IA est temporairement occupé. Réessayez dans quelques secondes.";

function getModelFallbacks(requestedModel: string) {
  return [...new Set([
    requestedModel,
    "google/gemini-2.5-flash-lite",
    "google/gemini-2.5-flash",
    "openai/gpt-5-mini",
  ])];
}

async function requestAiCompletion(convo: any[], requestedModel: string): Promise<Response | null> {
  for (const candidateModel of getModelFallbacks(requestedModel)) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: candidateModel,
          messages: convo,
          tools: TOOLS,
        }),
      });

      if (res.status !== 429) return res;

      await res.text();
      await new Promise((r) => setTimeout(r, 700 * Math.pow(2, attempt)));
    }
  }

  return null;
}

const SYSTEM_PROMPT = `You are the OUTIS COD platform AI assistant with FULL admin access to the database.

You have specialized tools (orders, products, WhatsApp, stats) AND generic tools (list_tables, query_table, count_table, insert_row, update_rows, delete_rows) to read or modify ANY table.

Available tables: orders, order_items, order_history, customers, products, product_variants, product_packs, stores, charges, charge_categories, charge_subcategories, deliveries, delivery_fees, delivery_company_fees, delivery_promotions, special_delivery_fees, local_livreurs, alerts, stock_movements, integrations, automation_settings, assignment_rules, assignment_settings, auto_confirmation_logs, meta_conversations, meta_messages, profiles, user_roles.

Rules:
- For WRITE actions (update/delete/insert/send), the system will pause and ask confirmation BEFORE executing. Just call the tool; do not ask for confirmation in text.
- Be concise. Reply in the user's language (French, Arabic, or English). Use markdown.
- Show order_number (ORD-00123), not uuid. Treat bare numbers like "106" as ORD-00106.
- For date-filtered counts of orders, use count_orders. Timezone is Africa/Algiers.
- For ANY other data question (customers, charges, stock, agents, settings, livreurs...), use query_table or count_table — never refuse.
- Always confirm what you did with concrete details.`;

async function resolveOrderId(supa: any, idOrNumber: string): Promise<string | null> {
  if (!idOrNumber) return null;
  const raw = String(idOrNumber).trim();
  if (/^[0-9a-f-]{36}$/i.test(raw)) return raw;
  // Normalize: bare number "106" -> "ORD-00106"; "ord-106" -> "ORD-00106"
  let key = raw.toUpperCase();
  const numMatch = key.match(/^(?:ORD-?)?(\d+)$/);
  if (numMatch) key = `ORD-${numMatch[1].padStart(5, "0")}`;
  const { data } = await supa.from("orders").select("id").eq("order_number", key).maybeSingle();
  return data?.id ?? null;
}

async function resolveProductId(supa: any, idOrSku: string): Promise<string | null> {
  if (/^[0-9a-f-]{36}$/i.test(idOrSku)) return idOrSku;
  const { data } = await supa.from("products").select("id").eq("sku", idOrSku).maybeSingle();
  return data?.id ?? null;
}

async function executeTool(name: string, args: any, supa: any, userEmail: string): Promise<any> {
  try {
    switch (name) {
      case "search_orders": {
        const limit = Math.min(args.limit ?? 10, 25);
        let q = supa
          .from("orders")
          .select("id, order_number, customer_name, customer_phone, status, total_price, wilaya, created_at")
          .order("created_at", { ascending: false })
          .limit(limit);
        if (args.status) q = q.eq("status", args.status);
        if (args.query) {
          const s = args.query.replace(/[%,]/g, "");
          q = q.or(`order_number.ilike.%${s}%,customer_name.ilike.%${s}%,customer_phone.ilike.%${s}%`);
        }
        const { data, error } = await q;
        if (error) throw error;
        return { orders: data };
      }
      case "get_order": {
        const id = await resolveOrderId(supa, args.id_or_number);
        if (!id) return { error: "Order not found" };
        const { data, error } = await supa
          .from("orders")
          .select("*, order_items(*)")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        return { order: data };
      }
      case "update_order_status": {
        const id = await resolveOrderId(supa, args.id_or_number);
        if (!id) return { error: "Order not found" };
        const { error } = await supa.rpc("update_order_status_attributed", {
          _order_id: id,
          _status: args.status,
          _changed_by: `AI (${userEmail})`,
        });
        if (error) throw error;
        return { success: true, message: `Status changed to ${args.status}` };
      }
      case "update_order": {
        const id = await resolveOrderId(supa, args.id_or_number);
        if (!id) return { error: "Order not found" };
        const allowed = ["customer_name", "customer_phone", "customer_address", "wilaya", "commune", "notes", "total_price", "delivery_fee", "assigned_agent", "delivery_company", "tracking_number", "remarks"];
        const fields: any = {};
        for (const k of Object.keys(args.fields || {})) {
          if (allowed.includes(k)) fields[k] = args.fields[k];
        }
        if (!Object.keys(fields).length) return { error: "No allowed fields" };
        const { error } = await supa.from("orders").update(fields).eq("id", id);
        if (error) throw error;
        return { success: true, updated: fields };
      }
      case "delete_order": {
        const id = await resolveOrderId(supa, args.id_or_number);
        if (!id) return { error: "Order not found" };
        await supa.from("order_items").delete().eq("order_id", id);
        await supa.from("order_history").delete().eq("order_id", id);
        const { error } = await supa.from("orders").delete().eq("id", id);
        if (error) throw error;
        return { success: true };
      }
      case "search_products": {
        const s = (args.query || "").replace(/[%,]/g, "");
        const { data, error } = await supa
          .from("products")
          .select("id, sku, name, selling_price, current_stock, category")
          .or(`name.ilike.%${s}%,sku.ilike.%${s}%`)
          .limit(20);
        if (error) throw error;
        return { products: data };
      }
      case "update_product": {
        const id = await resolveProductId(supa, args.id_or_sku);
        if (!id) return { error: "Product not found" };
        const allowed = ["name", "selling_price", "purchase_price", "current_stock", "reorder_level", "description", "category"];
        const fields: any = {};
        for (const k of Object.keys(args.fields || {})) {
          if (allowed.includes(k)) fields[k] = args.fields[k];
        }
        if (!Object.keys(fields).length) return { error: "No allowed fields" };
        const { error } = await supa.from("products").update(fields).eq("id", id);
        if (error) throw error;
        return { success: true, updated: fields };
      }
      case "delete_product": {
        const id = await resolveProductId(supa, args.id_or_sku);
        if (!id) return { error: "Product not found" };
        const { error } = await supa.from("products").delete().eq("id", id);
        if (error) throw error;
        return { success: true };
      }
      case "assign_agent": {
        const id = await resolveOrderId(supa, args.id_or_number);
        if (!id) return { error: "Order not found" };
        const { error } = await supa.from("orders").update({ assigned_agent: args.agent_name }).eq("id", id);
        if (error) throw error;
        return { success: true };
      }
      case "send_whatsapp": {
        const res = await supa.functions.invoke("send-manual-message", {
          body: { phone: args.phone, message: args.message },
        });
        if (res.error) throw res.error;
        return res.data;
      }
      case "get_dashboard_stats": {
        const { data: orders } = await supa.from("orders").select("status, total_price");
        const byStatus: Record<string, number> = {};
        let revenue = 0;
        for (const o of orders || []) {
          byStatus[o.status] = (byStatus[o.status] || 0) + 1;
          if (o.status === "delivered" || o.status === "delivered_paid") revenue += Number(o.total_price || 0);
        }
        const { data: low } = await supa
          .from("products")
          .select("name, sku, current_stock, reorder_level")
          .lte("current_stock", 10)
          .limit(20);
        return { total_orders: orders?.length ?? 0, by_status: byStatus, delivered_revenue: revenue, low_stock: low };
      }
      case "count_orders": {
        const dateField = args.date_field || "created_at";
        const range = algiersRange(args.period, args.date_from, args.date_to);
        let q = supa.from("orders").select("id", { count: "exact", head: true });
        if (args.status) q = q.eq("status", args.status);
        if (Array.isArray(args.statuses) && args.statuses.length) q = q.in("status", args.statuses);
        if (range.gte) q = q.gte(dateField, range.gte);
        if (range.lt) q = q.lt(dateField, range.lt);
        const { count, error } = await q;
        if (error) throw error;
        return { count, filters: { status: args.status, statuses: args.statuses, date_field: dateField, period: args.period, range } };
      }
      case "list_tables": {
        return { tables: Array.from(ALLOWED_TABLES).sort() };
      }
      case "query_table": {
        if (!ALLOWED_TABLES.has(args.table)) return { error: `Table not allowed: ${args.table}` };
        const limit = Math.min(args.limit ?? 25, 200);
        let q = supa.from(args.table).select(args.columns || "*").limit(limit);
        for (const [k, v] of Object.entries(args.filters || {})) q = q.eq(k, v as any);
        for (const [k, v] of Object.entries(args.ilike || {})) q = q.ilike(k, String(v));
        if (args.order_by) q = q.order(args.order_by, { ascending: !!args.ascending });
        const { data, error } = await q;
        if (error) throw error;
        return { rows: data, count: data?.length ?? 0 };
      }
      case "count_table": {
        if (!ALLOWED_TABLES.has(args.table)) return { error: `Table not allowed: ${args.table}` };
        let q = supa.from(args.table).select("*", { count: "exact", head: true });
        for (const [k, v] of Object.entries(args.filters || {})) q = q.eq(k, v as any);
        const { count, error } = await q;
        if (error) throw error;
        return { count };
      }
      case "insert_row": {
        if (!ALLOWED_TABLES.has(args.table)) return { error: `Table not allowed: ${args.table}` };
        const { data, error } = await supa.from(args.table).insert(args.values).select().maybeSingle();
        if (error) throw error;
        return { success: true, row: data };
      }
      case "update_rows": {
        if (!ALLOWED_TABLES.has(args.table)) return { error: `Table not allowed: ${args.table}` };
        if (!args.filters || !Object.keys(args.filters).length) return { error: "Filters required to update" };
        let q = supa.from(args.table).update(args.values);
        for (const [k, v] of Object.entries(args.filters)) q = q.eq(k, v as any);
        const { data, error } = await q.select();
        if (error) throw error;
        return { success: true, updated_count: data?.length ?? 0 };
      }
      case "delete_rows": {
        if (!ALLOWED_TABLES.has(args.table)) return { error: `Table not allowed: ${args.table}` };
        if (!args.filters || !Object.keys(args.filters).length) return { error: "Filters required to delete" };
        let q = supa.from(args.table).delete();
        for (const [k, v] of Object.entries(args.filters)) q = q.eq(k, v as any);
        const { data, error } = await q.select();
        if (error) throw error;
        return { success: true, deleted_count: data?.length ?? 0 };
      }
      default:
        return { error: `Unknown tool ${name}` };
    }
  } catch (e: any) {
    return { error: e.message || String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser(token);
    const user = userRes?.user;
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: roleData } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const messages = body.messages || [];
    // approvedToolCallId: when user confirms a write, client resends history with this id allowed
    const approvedToolCallIds: string[] = body.approvedToolCallIds || [];
    const pendingActions = Array.isArray(body.pendingActions) ? body.pendingActions : [];
    const approvedAssistantMessage = body.assistantMessage ?? null;
    const ALLOWED_MODELS = new Set([
      "google/gemini-2.5-flash",
      "google/gemini-2.5-flash-lite",
      "google/gemini-2.5-pro",
      "google/gemini-3-flash-preview",
      "google/gemini-3.1-pro-preview",
      "openai/gpt-5",
      "openai/gpt-5-mini",
      "openai/gpt-5-nano",
      "openai/gpt-5.2",
    ]);
    const model = ALLOWED_MODELS.has(body.model) ? body.model : "google/gemini-2.5-flash";

    // Conversation loop. Up to 6 iterations.
    let convo = [{ role: "system", content: SYSTEM_PROMPT }, ...messages];

    if (approvedToolCallIds.length > 0 && approvedAssistantMessage && pendingActions.length > 0) {
      convo.push(approvedAssistantMessage);
      for (const action of pendingActions) {
        if (!approvedToolCallIds.includes(action.id)) continue;
        const result = await executeTool(action.name, action.args || {}, admin, user.email || "");
        convo.push({
          role: "tool",
          tool_call_id: action.id,
          content: JSON.stringify(result),
        });
      }
    }

    for (let iter = 0; iter < 6; iter++) {
      const aiRes = await requestAiCompletion(convo, model);

      if (!aiRes) {
        return new Response(JSON.stringify({
          reply: RATE_LIMIT_REPLY,
          rateLimited: true,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!aiRes.ok) {
        const txt = await aiRes.text();
        if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Crédits IA épuisés." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        console.error("AI error", aiRes.status, txt);
        return new Response(JSON.stringify({ error: "AI error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const data = await aiRes.json();
      const msg = data.choices?.[0]?.message;
      if (!msg) return new Response(JSON.stringify({ error: "No reply" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const toolCalls = msg.tool_calls || [];

      if (!toolCalls.length) {
        // Final reply
        return new Response(JSON.stringify({ reply: msg.content || "", messages: [...messages, { role: "assistant", content: msg.content || "" }] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if any write tool needs confirmation
      const pendingWrites = toolCalls.filter((tc: any) => WRITE_TOOLS.has(tc.function.name) && !approvedToolCallIds.includes(tc.id));
      if (pendingWrites.length > 0) {
        return new Response(JSON.stringify({
          requiresConfirmation: true,
          pendingActions: pendingWrites.map((tc: any) => ({
            id: tc.id,
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments || "{}"),
          })),
          assistantMessage: msg,
          conversationSoFar: convo.slice(1),
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Execute all tool calls
      convo.push(msg);
      for (const tc of toolCalls) {
        const args = JSON.parse(tc.function.arguments || "{}");
        const result = await executeTool(tc.function.name, args, admin, user.email || "");
        convo.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
    }

    return new Response(JSON.stringify({ error: "Loop limit" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("ai-assistant error", e);
    return new Response(JSON.stringify({ error: e.message || "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
