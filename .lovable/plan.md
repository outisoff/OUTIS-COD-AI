# Connect this app to YOUR own Supabase

Goal: get your remixed app running on a Supabase project **you** own and control, with the full database, all 53 edge functions, secrets, and storage recreated.

Your project: `fgndqoadnsbespjzkyhj` (`https://fgndqoadnsbespjzkyhj.supabase.co`). It exists but is empty — the `profiles` table returns 404, so no schema is loaded yet.

---

## Step 1 — You: gather 2 missing credentials

I already have your project URL and publishable key. I still need:

1. **Database password** — the one you set when creating the project. Your connection string still shows the placeholder `[YOUR-PASSWORD]`. If you forgot it: Supabase dashboard → **Project Settings → Database → Reset database password**.
2. **`service_role` key** — Supabase dashboard → **Project Settings → API → Project API keys → `service_role`** (the secret one, not the publishable key). Send it via the secure secret form (I'll open it), never pasted in plain chat.

---

## Step 2 — Me: load the database schema

I generate one complete SQL file from your existing migrations (all tables, RLS policies, GRANTs, functions, triggers, sequences) and either:
- run it for you via CLI (if you give the DB password), **or**
- hand it to you to paste into the Supabase **SQL Editor** and run.

Result: every table, policy, and database function is live on your project.

## Step 3 — Me: re-attach what the plain dump misses

- The `handle_new_user` trigger on `auth.users` (creates a profile row on signup).
- The pg_cron job that auto-refreshes ZR Express tariffs daily.
- The internal-function URL fallback used by DB-triggered edge calls.

## Step 4 — Me: deploy all 53 edge functions

Deploy everything in `supabase/functions/` to your project (WhatsApp, TikTok, Ecotrack, ZR Express, Google auth, auto-confirm, etc.) via the Supabase CLI.

## Step 5 — Me + You: re-enter secrets

These 7+ secrets must be set on **your** Supabase project (they don't transfer with a remix):
`WASENDER_API_KEY`, `WASENDER_SESSION_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ECOTRACK_WEBHOOK_SECRET`, `TIKTOK_WEBHOOK_SECRET`, `INTERNAL_FUNCTION_SECRET`.
I'll open secure forms; you provide the values.

## Step 6 — Me: recreate storage buckets

Recreate `chat-media` and `database_export_11_07_26` buckets with their access policies. (Existing files from the original project can't be copied — those you'd re-upload if needed.)

## Step 7 — You: create your admin user + re-point webhooks

- **Users don't transfer** (Supabase can't export password hashes). I'll run the `create-admin-user` function so you get one admin login, then you add the rest.
- Re-point external webhook/callback URLs to your new function URLs: WASender, TikTok, Meta, LightFunnel, Ecotrack, ZR Express, and the Google OAuth redirect URI in Google Cloud Console.

---

## Config already handled

`.env` and `supabase/config.toml` already point at your project ref, so the frontend is wired up. Nothing else needed there.

## Important caveats

- **No data/users are copied from the original** — this is a fresh backend from the schema. You start with empty tables.
- **Short setup, no downtime concern** since nothing is live yet.

---

## What I need from you to start

Reply with the **DB password** + **`service_role` key** (via the secure form I open), and tell me whether you want me to **run the SQL via CLI** or **give you the SQL to paste into the SQL Editor** yourself.
