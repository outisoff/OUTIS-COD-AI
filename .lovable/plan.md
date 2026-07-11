# Migrate to External Supabase Project

Move this project's backend from Lovable Cloud to your own Supabase project (supabase.com), so you get full dashboard access, SQL editor, and direct control over the database.

## Important upfront

- **Lovable Cloud cannot be uninstalled from this project.** Even after migrating, Cloud stays technically "attached." The practical approach is: point the app code at your external Supabase, and stop using the Cloud one.
- **Auth users cannot be exported/re-imported** with passwords (Supabase limitation). All users will need to reset their password on the new project, OR be recreated via admin API with a temporary password.
- **Downtime window required.** During the switchover, WhatsApp webhooks, TikTok webhooks, ZR Express sync, and auto-confirmation triggers will need their URLs updated on the external providers.

## Migration steps

### 1. Create the external Supabase project
- You create the project at supabase.com (choose region close to Algeria, e.g. Frankfurt).
- You give me the new project URL, anon key, and service role key.
- Save the DB password — you'll need it for the data dump.

### 2. Export current schema + data
- Full DB dump from current Cloud project (schema, tables, functions, triggers, RLS policies, sequences).
- Storage buckets (`chat-media`, `database_export_11_07_26`) exported separately as files.

### 3. Restore into external Supabase
- Run the schema dump on the new project (all 36 tables, all 25+ functions, all triggers, all RLS policies).
- Restore GRANTs.
- Load data.
- Recreate storage buckets and re-upload files.
- Recreate secrets on the new project (WASENDER_API_KEY, GOOGLE_CLIENT_ID/SECRET, ECOTRACK_WEBHOOK_SECRET, TIKTOK_WEBHOOK_SECRET, INTERNAL_FUNCTION_SECRET, WASENDER_SESSION_KEY — I'll give you the exact list; values you re-enter yourself in the Supabase dashboard).
- Deploy all edge functions to the new project (WhatsApp webhook, auto-confirm, ZR Express create/cancel/ready, ecotrack, wasender-check, etc.).

### 4. Reconfigure external integrations
- Update webhook URLs in WASender, TikTok, Meta, LightFunnel, and Ecotrack dashboards to point to the new Supabase edge function URLs.
- Reconfigure Google OAuth redirect URI on Google Cloud Console.
- Update ZR Express and Ecotrack API webhook callbacks.

### 5. Switch the app code
- Update `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`) to the external project.
- Update `supabase/config.toml` project_id.
- Rebuild and republish.

### 6. Recreate users
- Either: admin-create each user with a temp password (I write a one-off script using the new service role key).
- Or: send password-reset emails to all existing users.

### 7. Verify
- Login works.
- Orders load.
- WhatsApp webhook receives messages.
- ZR Express sync fires.
- Auto-confirmation runs.
- Then you can stop using the Cloud project.

## What I need from you to start

1. Create the external Supabase project at supabase.com.
2. Send me: project URL, anon key, service_role key, DB password.
3. Confirm you accept: (a) users must reset passwords, (b) short downtime while webhooks are re-pointed, (c) Cloud stays attached but unused.

## Technical notes

- `src/integrations/supabase/client.ts` is auto-generated from `.env` — changing env vars will regenerate the client.
- `supabase/config.toml` project_id must be updated so future edge-function deploys go to the right project.
- `call_internal_function` in the DB hardcodes the Cloud URL as fallback — this must be updated in a migration on the new project.
- The `handle_new_user` trigger on `auth.users` must be re-attached on the new project (auth schema triggers aren't in the public dump).
- pg_cron jobs (tarifs auto-refresh) must be re-scheduled on the new project.
