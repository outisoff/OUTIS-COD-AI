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
  name: "get_order",
  title: "Get order",
  description: "Get a single order with its items by order number or order id.",
  inputSchema: {
    order_number: z.string().optional().describe("Order number (e.g. ORD-00123)"),
    order_id: z.string().uuid().optional().describe("Order UUID"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ order_number, order_id }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    if (!order_number && !order_id) return { content: [{ type: "text", text: "Provide order_number or order_id" }], isError: true };
    const sb = client(ctx);
    let q = sb.from("orders").select("*, order_items(*)").limit(1);
    if (order_id) q = q.eq("id", order_id);
    else q = q.eq("order_number", order_number!);
    const { data, error } = await q.maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Order not found" }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { order: data } };
  },
});
