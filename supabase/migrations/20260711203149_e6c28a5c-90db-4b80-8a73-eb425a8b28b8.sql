-- Allow the sandbox role to apply the historical migration files, and set up migration tracking
GRANT USAGE, CREATE ON SCHEMA public TO sandbox_exec;
GRANT ALL ON ALL TABLES IN SCHEMA public TO sandbox_exec;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO sandbox_exec;

CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version text PRIMARY KEY,
  statements text[],
  name text
);
GRANT USAGE ON SCHEMA supabase_migrations TO sandbox_exec;
GRANT SELECT, INSERT, UPDATE, DELETE ON supabase_migrations.schema_migrations TO sandbox_exec;