
-- 1. Create private schema, locked down
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO postgres, service_role;

-- 2. Recreate the three security-definer helpers inside `private`
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION private.get_user_role(_user_id uuid)
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION private.is_app_user(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND is_approved = true)
$$;

-- Lock execute to trusted roles only
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.get_user_role(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_app_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION private.get_user_role(uuid) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION private.is_app_user(uuid) TO postgres, service_role;

-- 3. Rewrite every policy that referenced the public helpers to use the private ones
DO $rewrite$
DECLARE
  r RECORD;
  new_qual text;
  new_check text;
  roles_str text;
  sql_text text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE (qual ~ '(has_role|get_user_role|is_app_user)'
        OR with_check ~ '(has_role|get_user_role|is_app_user)')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);

    new_qual := regexp_replace(
      COALESCE(r.qual, ''),
      '(^|[^a-zA-Z0-9_.])(has_role|get_user_role|is_app_user)\s*\(',
      '\1private.\2(', 'g'
    );
    new_check := regexp_replace(
      COALESCE(r.with_check, ''),
      '(^|[^a-zA-Z0-9_.])(has_role|get_user_role|is_app_user)\s*\(',
      '\1private.\2(', 'g'
    );

    SELECT string_agg(quote_ident(role_name), ', ')
      INTO roles_str
      FROM unnest(r.roles) AS role_name;
    IF roles_str IS NULL OR roles_str = '' THEN
      roles_str := 'public';
    END IF;

    sql_text := format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',
      r.policyname, r.schemaname, r.tablename,
      r.permissive, r.cmd, roles_str
    );

    IF r.qual IS NOT NULL THEN
      sql_text := sql_text || ' USING (' || new_qual || ')';
    END IF;
    IF r.with_check IS NOT NULL THEN
      sql_text := sql_text || ' WITH CHECK (' || new_check || ')';
    END IF;

    EXECUTE sql_text;
  END LOOP;
END
$rewrite$;

-- 4. Drop the public versions now that nothing references them.
--    Keep a service-role-only compatibility shim for `public.get_user_role` because
--    several edge functions still call it via RPC with the service role key.
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.is_app_user(uuid);

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO service_role;
