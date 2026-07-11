import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function client(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_customers",
  title: "List customers",
  description: "List customers with basic stats. Optionally search by name or phone.",
  inputSchema: {
    search: z.string().optional().describe("Search text matched against name or phone"),
    limit: z.number().int().min(1).max(100).default(20),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    let q = client(ctx).from("customers").select("id, name, phone, wilaya, commune, total_orders, total_spent, status, last_order_date").order("last_order_date", { ascending: false, nullsFirst: false }).limit(limit);
    if (search) q = q.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { customers: data } };
  },
});
