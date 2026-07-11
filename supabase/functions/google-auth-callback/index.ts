import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
// Use APP_URL environment variable for flexibility across environments
const APP_URL = Deno.env.get('APP_URL') || 'https://id-preview--ceb2e801-a26d-48a3-ab05-c8be00695eb7.lovable.app';

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    console.log('Callback received - code:', !!code, 'state:', state, 'error:', error);

    if (error) {
      console.error('OAuth error:', error);
      return new Response(`Authentication failed: ${error}`, { status: 400 });
    }

    if (!code) {
      return new Response('No authorization code received', { status: 400 });
    }

    // Parse state to get redirect URL and user ID
    let redirectUrl = '/settings?tab=integrations';
    let userId: string | null = null;
    try {
      if (state) {
        const stateData = JSON.parse(atob(state));
        const candidate = stateData.redirectUrl || '/settings?tab=integrations';
        // Allowlist: only allow relative paths or URLs that resolve to APP_URL's origin.
        // This prevents an open-redirect that would leak the user's email to an attacker domain.
        try {
          const resolved = new URL(candidate, APP_URL);
          const allowedOrigin = new URL(APP_URL).origin;
          redirectUrl = resolved.origin === allowedOrigin ? resolved.pathname + resolved.search + resolved.hash : '/settings?tab=integrations';
        } catch {
          redirectUrl = '/settings?tab=integrations';
        }
        userId = stateData.userId || null;
      }
    } catch (e) {
      console.error('Error parsing state:', e);
    }

    if (!userId) {
      console.error('No user ID in state');
      return new Response('No user ID provided. Please try connecting again while logged in.', { status: 400 });
    }

    // Exchange code for tokens
    const callbackUrl = `${SUPABASE_URL}/functions/v1/google-auth-callback`;
    
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json();
    console.log('Token response status:', tokenResponse.status);

    if (tokens.error) {
      console.error('Token error:', { error: tokens.error, description: tokens.error_description });
      return new Response(`Token exchange failed: ${tokens.error_description || tokens.error}`, { status: 400 });
    }

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoResponse.json();
    console.log('User email:', userInfo.email);

    // Save tokens directly to database using service role (tokens never exposed to client)
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);
    
    const { error: upsertError } = await supabase
      .from('google_tokens')
      .upsert({
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt.toISOString(),
        email: userInfo.email,
        scope: tokens.scope,
        token_type: tokens.token_type || 'Bearer',
      }, {
        onConflict: 'user_id',
      });

    if (upsertError) {
      console.error('Error saving tokens:', upsertError);
      return new Response(`Error saving tokens: ${upsertError.message}`, { status: 500 });
    }

    console.log('Tokens saved successfully for user:', userId);

    // Also enable Google Sheets integration
    await supabase
      .from('integrations')
      .upsert({
        integration_type: 'google_sheets',
        name: 'Google Sheets',
        is_enabled: true,
      }, {
        onConflict: 'integration_type,name',
      });

    // Redirect back to the app with just a success flag (no tokens in URL)
    // Uses APP_URL environment variable for production flexibility
    const appRedirectUrl = new URL(redirectUrl, APP_URL);
    appRedirectUrl.searchParams.set('google_auth_success', 'true');
    appRedirectUrl.searchParams.set('google_email', userInfo.email || '');

    console.log('Redirecting to:', appRedirectUrl.toString());

    return new Response(null, {
      status: 302,
      headers: {
        'Location': appRedirectUrl.toString(),
      },
    });
  } catch (error: unknown) {
    console.error('Callback error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(`Error: ${message}`, { status: 500 });
  }
});
