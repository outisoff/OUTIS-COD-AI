-- Revoke EXECUTE on SECURITY DEFINER functions that are only invoked by triggers
-- or internally, never by clients via PostgREST. This addresses the Supabase
-- linter warnings about anon/authenticated being able to execute privileged
-- SECURITY DEFINER functions.

-- Trigger functions (only called by Postgres trigger machinery, not by clients)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_order_stock_sync() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.auto_assign_order() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.log_order_status_change() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trigger_update_customer_stats() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trigger_auto_confirm_order() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trigger_check_whatsapp_on_order() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trigger_ecotrack_cancel_order() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trigger_zr_express_cancel_order() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trigger_zr_express_create_order() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trigger_zr_express_ready() FROM anon, authenticated, public;

-- Internal helpers — invoked by other server-side code, not by clients
REVOKE EXECUTE ON FUNCTION public.update_customer_stats(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.set_delivered_at_on_status() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_orders_updated_at_on_status() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.generate_order_number() FROM anon, authenticated, public;

-- Functions we KEEP callable (do not touch):
--   public.get_user_role(uuid)              -- called by client and many edge functions
--   public.update_order_status_attributed(...) -- called by edge functions with user JWT
--   public.has_role(uuid, app_role)         -- used inside RLS policies (needs EXECUTE for invoker)
--   public.is_app_user(uuid)                -- used inside RLS policies (needs EXECUTE for invoker)
