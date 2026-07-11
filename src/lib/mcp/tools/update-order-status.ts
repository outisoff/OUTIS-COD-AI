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
  name: "update_order_status",
  title: "Update order status",
  description: "Update the status of an order by its UUID. Respects the app's status transition rules.",
  inputSchema: {
    order_id: z.string().uuid(),
    status: z.string().describe("Target status (e.g. 'confirmed', 'cancelled', 'no_answer', 'callback')"),
    notes: z.string().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ order_id, status, notes }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const update: Record<string, unknown> = { status };
    if (notes !== undefined) update.notes = notes;
    const { data, error } = await client(ctx).from("orders").update(update).eq("id", order_id).select().maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: `Order updated to ${status}` }], structuredContent: { order: data } };
  },
});
