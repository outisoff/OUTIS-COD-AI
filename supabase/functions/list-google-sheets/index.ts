import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json();
    if (data.error) {
      console.error('Token refresh error:', data);
      return null;
    }

    return data.access_token;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    // Get user from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid user token');
    }

    console.log('Listing sheets for user:', user.id);

    // Get user's Google tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('google_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (tokenError || !tokenData) {
      throw new Error('Google account not connected. Please connect your Google account first.');
    }

    // Check if token needs refresh
    let accessToken = tokenData.access_token;
    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      console.log('Token expired, refreshing...');
      if (!tokenData.refresh_token) {
        throw new Error('Token expired and no refresh token available. Please reconnect your Google account.');
      }
      
      accessToken = await refreshAccessToken(tokenData.refresh_token);
      if (!accessToken) {
        throw new Error('Failed to refresh token. Please reconnect your Google account.');
      }

      // Update token in database
      await supabase
        .from('google_tokens')
        .update({
          access_token: accessToken,
          expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
        })
        .eq('user_id', user.id);
    }

    // Search for Google Sheets files in Drive
    const searchQuery = "mimeType='application/vnd.google-apps.spreadsheet'";
    const driveResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(searchQuery)}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&pageSize=50`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!driveResponse.ok) {
      const error = await driveResponse.text();
      throw new Error(`Failed to list sheets: ${error}`);
    }

    const driveData = await driveResponse.json();
    const sheets: Array<{ id: string; name: string; modifiedTime: string }> = (driveData.files || []).map((file: GoogleDriveFile) => ({
      id: file.id,
      name: file.name,
      modifiedTime: file.modifiedTime,
    }));

    console.log(`Found ${sheets.length} spreadsheets`);

    return new Response(
      JSON.stringify({
        success: true,
        sheets,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error: unknown) {
    console.error('List sheets error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
