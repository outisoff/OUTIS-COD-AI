# Security deployment checklist

No database migration or RLS change is required by this patch.

Before deploying the updated Edge Functions:

1. Set `OAUTH_STATE_SECRET` to a random value of at least 32 characters in Supabase Edge Function secrets.
2. Set `APP_URL` to the exact production application origin.
3. Confirm that the LightFunnel integration has an API secret and that the WhatsApp integration has a webhook token. These webhooks now fail closed when their secret is missing.
4. Rotate the delivery/e-commerce API keys that previously appeared in `public/database-data-export.sql`, then update the integrations through the private admin interface.
5. Deploy the changed Edge Functions and test Google connection, one manual WhatsApp message, and one delivery create/cancel flow with each role used by the team.

The dashboard optimization is independent from the security hardening commit, so it can be reverted without restoring the removed exports or weakening OAuth/webhook checks.
