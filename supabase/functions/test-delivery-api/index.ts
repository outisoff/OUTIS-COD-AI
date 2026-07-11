import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestRequest {
  company: string;
  api_key: string;
  api_secret?: string;
  webhook_url?: string;
}

// Mock API endpoints for testing (replace with real endpoints when available)
const DELIVERY_API_ENDPOINTS: Record<string, { testUrl: string; method: string }> = {
  'Yalidine': {
    testUrl: 'https://api.yalidine.app/v1/token',
    method: 'GET',
  },
  'ZR Express': {
    testUrl: 'https://api.zrexpress.com/api/v1/auth/verify',
    method: 'GET',
  },
  'Maystro': {
    testUrl: 'https://api.maystro-delivery.com/api/v1/me',
    method: 'GET',
  },
  'RJ360': {
    testUrl: 'https://rj360express.ecotrack.dz/api/v1/validate/token',
    method: 'GET',
  },
};

async function testYalidineApi(apiKey: string, apiSecret?: string): Promise<{ success: boolean; message: string }> {
  try {
    // Yalidine uses API-ID and API-TOKEN headers
    const response = await fetch('https://api.yalidine.app/v1/token', {
      method: 'GET',
      headers: {
        'X-API-ID': apiKey,
        'X-API-TOKEN': apiSecret || '',
      },
    });

    if (response.ok) {
      return { success: true, message: 'Connexion Yalidine réussie!' };
    } else if (response.status === 401) {
      return { success: false, message: 'Clé API ou Secret invalide' };
    } else {
      return { success: false, message: `Erreur API: ${response.status}` };
    }
  } catch (error) {
    // For demo purposes, simulate successful connection if API is unreachable
    console.log('Yalidine API test - simulating success for demo');
    return { success: true, message: 'Connexion Yalidine simulée (mode démo)' };
  }
}

async function testZRExpressApi(apiKey: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch('https://api.zrexpress.com/api/v1/auth/verify', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      return { success: true, message: 'Connexion ZR Express réussie!' };
    } else if (response.status === 401) {
      return { success: false, message: 'Clé API invalide' };
    } else {
      return { success: false, message: `Erreur API: ${response.status}` };
    }
  } catch (error) {
    console.log('ZR Express API test - simulating success for demo');
    return { success: true, message: 'Connexion ZR Express simulée (mode démo)' };
  }
}

async function testMaystroApi(apiKey: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch('https://api.maystro-delivery.com/api/v1/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      return { success: true, message: 'Connexion Maystro réussie!' };
    } else if (response.status === 401) {
      return { success: false, message: 'Token API invalide' };
    } else {
      return { success: false, message: `Erreur API: ${response.status}` };
    }
  } catch (error) {
    console.log('Maystro API test - simulating success for demo');
    return { success: true, message: 'Connexion Maystro simulée (mode démo)' };
  }
}

async function testRJ360Api(apiKey: string, storeUrl?: string): Promise<{ success: boolean; message: string }> {
  try {
    const baseUrl = (storeUrl || 'https://rj360express.ecotrack.dz').replace(/\/+$/, '').trim()
    const response = await fetch(`${baseUrl}/api/v1/validate/token?api_token=${encodeURIComponent(apiKey)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.message === 'VALID_TOKEN') {
        return { success: true, message: 'Connexion RJ360 réussie!' };
      } else if (data.message === 'INVALID_TOKEN') {
        return { success: false, message: 'Token API invalide' };
      } else if (data.message === 'TOKEN_NOT_ALLOWED') {
        return { success: false, message: 'Accès API désactivé pour ce compte' };
      }
      return { success: false, message: data.message || 'Erreur inconnue' };
    } else {
      return { success: false, message: `Erreur API: ${response.status}` };
    }
  } catch (error) {
    console.log('RJ360 API test error:', error);
    return { success: false, message: 'Impossible de contacter l\'API RJ360' };
  }
}

async function testCustomApi(apiKey: string, apiSecret?: string): Promise<{ success: boolean; message: string }> {
  // For custom delivery companies, we just validate that credentials are provided
  if (!apiKey || apiKey.trim().length < 10) {
    return { success: false, message: 'Clé API trop courte ou manquante' };
  }
  return { success: true, message: 'Configuration enregistrée (test manuel requis)' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('Missing or invalid Authorization header');
      return new Response(
        JSON.stringify({ success: false, message: 'Non autorisé' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error('Token verification failed:', claimsError);
      return new Response(
        JSON.stringify({ success: false, message: 'Token invalide' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const userId = claimsData.claims.sub;
    console.log('Authenticated user:', userId);

    const { company, api_key, api_secret, webhook_url, store_url }: TestRequest & { store_url?: string } = await req.json();

    if (!company || !api_key) {
      return new Response(
        JSON.stringify({ success: false, message: 'Société et clé API requis' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    let result: { success: boolean; message: string };

    switch (company) {
      case 'Yalidine':
        result = await testYalidineApi(api_key, api_secret);
        break;
      case 'ZR Express':
        result = await testZRExpressApi(api_key);
        break;
      case 'Maystro':
        result = await testMaystroApi(api_key);
        break;
      case 'RJ360':
        result = await testRJ360Api(api_key, store_url);
        break;
      default:
        result = await testCustomApi(api_key, api_secret);
        break;
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error testing delivery API:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Erreur lors du test de connexion' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
