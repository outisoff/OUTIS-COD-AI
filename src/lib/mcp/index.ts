import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listOrdersTool from "./tools/list-orders";
import getOrderTool from "./tools/get-order";
import listProductsTool from "./tools/list-products";
import listCustomersTool from "./tools/list-customers";
import updateOrderStatusTool from "./tools/update-order-status";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "outis-cod-mcp",
  title: "OUTIS COD",
  version: "0.1.0",
  instructions:
    "Tools for the OUTIS COD e-commerce management app. Use `list_orders` / `get_order` to inspect orders, `list_products` for stock, `list_customers` for CRM, and `update_order_status` to change an order's status. All actions run as the signed-in user and respect app permissions.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listOrdersTool, getOrderTool, listProductsTool, listCustomersTool, updateOrderStatusTool],
});
