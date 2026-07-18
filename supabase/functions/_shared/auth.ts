import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type AuthOk = { ok: true; userId: string | null; isInternal: boolean; role: string | null };
export type AuthFail = { ok: false; status: number; message: string };

/**
 * Authenticate an edge-function request.
 * Accepts either:
 *  - an `x-internal-secret` header matching the value stored in
 *    automation_settings.internal_trigger_secret (used by DB triggers and
 *    server-to-server edge function calls), OR
 *  - an Authorization Bearer JWT for a user. If `requireRoles` is provided,
 *    the user must have one of those roles in `public.user_roles`.
 */
export async function authenticateRequest(
  req: Request,
  opts: { requireRoles?: string[] } = {},
): Promise<AuthOk | AuthFail> {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // 1) Internal secret short-circuit
  const internalHeader = req.headers.get('x-internal-secret');
  if (internalHeader) {
    const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data } = await svc
      .from('automation_settings')
      .select('setting_value')
      .eq('setting_key', 'internal_trigger_secret')
      .maybeSingle();
    const expected = (data?.setting_value as any)?.value as string | undefined;
    if (expected && internalHeader === expected) {
      return { ok: true, userId: null, isInternal: true, role: 'service' };
    }
  }

  // 2) JWT validation
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, message: 'Unauthorized' };
  }
  const token = authHeader.replace('Bearer ', '');

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claimsData, error: claimsError } = await sb.auth.getClaims(token);
  if (claimsError || !claimsData?.claims?.sub) {
    return { ok: false, status: 401, message: 'Invalid token' };
  }
  const userId = claimsData.claims.sub as string;

  if (opts.requireRoles && opts.requireRoles.length > 0) {
    const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: roles } = await svc
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    const userRoles = (roles || []).map((r: any) => r.role);
    const allowed = userRoles.some((r: string) => opts.requireRoles!.includes(r));
    if (!allowed) {
      return { ok: false, status: 403, message: 'Forbidden' };
    }
    return { ok: true, userId, isInternal: false, role: userRoles[0] || null };
  }

  return { ok: true, userId, isInternal: false, role: null };
}

/**
 * Fetch the shared internal trigger secret from automation_settings.
 * Use this when one edge function needs to call another with internal
 * trust (e.g. webhooks calling notification helpers).
 */
export async function getInternalSecret(): Promise<string | null> {
  const svc = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data } = await svc
    .from('automation_settings')
    .select('setting_value')
    .eq('setting_key', 'internal_trigger_secret')
    .maybeSingle();
  return (data?.setting_value as any)?.value ?? null;
}
