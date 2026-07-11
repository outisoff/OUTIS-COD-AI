# Connect this project to your own external Supabase

## Why it's blocked right now

The Cloud view only offers **external Supabase** when your Lovable **workspace has a Supabase organization linked**. Yours doesn't, so the only option currently shown is Lovable Cloud. Nothing is wrong with the project — the link just hasn't been made yet.

A second thing to know: this project was **remixed**, so its `.env` still points at the *original* owner's Supabase project (`huzmbmyxrfdciyfivazx`), which you don't control. There is no backend attached to *your* copy yet, so this is a fresh setup + data migration, not a simple reconnect.

## Steps you do (in the Lovable/Supabase UI)

These can't be done from code — they're account/dashboard actions:

1. **Link your Supabase organization to the workspace.**
   Workspace Settings → Integrations → connect Supabase (or the "Connect Supabase" button in the Cloud tab). Authorize your Supabase account.
2. **Create the external Supabase project** at supabase.com. Pick a region close to your users (e.g. Frankfurt for Algeria). Save the **database password**.
3. **Gather credentials** to hand me: project URL, anon/publishable key, service_role key, and the DB password.

## Steps I do (once the org is linked and you've created the project)

Following the existing migration plan in `.lovable/plan.md`:

1. **Point the app at your project** — update `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`) and `supabase/config.toml` `project_id`.
2. **Recreate the schema** — run the existing dumps (`public/database-schema-export.sql`, then `public/database-data-export.sql`) on your project: all tables, functions, triggers, RLS policies, GRANTs, sequences.
3. **Re-attach what the public dump misses** — the `handle_new_user` trigger on `auth.users`, pg_cron jobs (tariff auto-refresh), and the hardcoded Cloud URL fallback inside `call_internal_function`.
4. **Deploy all edge functions** to your project (WhatsApp, TikTok, Ecotrack, ZR Express, auto-confirm, etc.).
5. **Re-enter secrets** in your Supabase dashboard: `WASENDER_API_KEY`, `WASENDER_SESSION_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ECOTRACK_WEBHOOK_SECRET`, `TIKTOK_WEBHOOK_SECRET`, `INTERNAL_FUNCTION_SECRET`.
6. **Recreate storage buckets** (`chat-media`, `database_export_11_07_26`) and re-upload files.
7. **Recreate users** — auth users can't be exported with passwords, so either admin-create each with a temp password or send password-reset emails.

## Steps you finish (external providers)

Re-point webhook/callback URLs to your new edge-function URLs in: WASender, TikTok, Meta, LightFunnel, Ecotrack, ZR Express, and the Google OAuth redirect URI in Google Cloud Console.

## Important caveats

- **Users must reset their passwords** — Supabase can't export/import password hashes.
- **Short downtime** while webhooks are re-pointed.
- **Lovable Cloud stays technically attached** and can't be uninstalled; you simply stop using it once verified.

## Alternative

If full dashboard/SQL control isn't essential, **Lovable Cloud** gets the exact same app running with one click and no external account — no org link, no manual migration. I can go that route instead if you prefer speed over direct Supabase access.

---

**To start:** link your Supabase org (step 1) and create the project (step 2), then send me the URL + keys. Reply once that's done and I'll take over the code and migration.
