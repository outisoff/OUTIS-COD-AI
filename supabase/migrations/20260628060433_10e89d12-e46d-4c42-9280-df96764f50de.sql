
-- Recreating a function re-grants EXECUTE to PUBLIC by default; revoke on all of them.
REVOKE EXECUTE ON FUNCTION public.call_internal_function(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_auto_confirm_order() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_check_whatsapp_on_order() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_zr_express_create_order() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_zr_express_cancel_order() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_zr_express_ready() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_ecotrack_cancel_order() FROM PUBLIC, anon, authenticated;
