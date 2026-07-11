import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // ===== AUTHENTICATION =====
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('Missing or invalid Authorization header');
      return new Response(
        JSON.stringify({ connected: false, error: 'Non autorisé' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Verify the user's token
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error('Invalid token:', claimsError);
      return new Response(
        JSON.stringify({ connected: false, error: 'Token invalide' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const userId = claimsData.claims.sub as string;
    console.log('Checking Google connection for user:', userId);

    // Use service role to check tokens (user shouldn't have direct access)
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: tokenData, error: tokenError } = await supabaseService
      .from('google_tokens')
      .select('email, expires_at')
      .eq('user_id', userId)
      .single();

    if (tokenError || !tokenData) {
      console.log('No Google tokens found for user');
      return new Response(
        JSON.stringify({ connected: false, email: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token is expired
    const isExpired = tokenData.expires_at && new Date(tokenData.expires_at) < new Date();
    
    return new Response(
      JSON.stringify({ 
        connected: !isExpired, 
        email: tokenData.email,
        expired: isExpired 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error checking Google connection:', error);
    return new Response(
      JSON.stringify({ connected: false, error: 'Erreur serveur' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
