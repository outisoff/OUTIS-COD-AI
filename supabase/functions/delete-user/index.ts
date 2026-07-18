import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://esm.sh/zod@3.22.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const deleteUserSchema = z.object({
  userId: z.string().uuid('ID utilisateur invalide'),
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Verify the requesting user's token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create auth client to verify user token
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token)
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const requestingUserId = claimsData.claims.sub as string

    // Create admin client for privileged operations
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Check if user is admin
    const { data: roleData } = await supabase.rpc('get_user_role', { _user_id: requestingUserId })
    if (roleData !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Seuls les administrateurs peuvent supprimer des utilisateurs' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse and validate input
    const rawBody = await req.json()
    const validationResult = deleteUserSchema.safeParse(rawBody)
    
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => e.message).join(', ')
      return new Response(
        JSON.stringify({ error: `Données invalides: ${errors}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { userId } = validationResult.data

    // Prevent self-deletion
    if (userId === requestingUserId) {
      return new Response(
        JSON.stringify({ error: 'Vous ne pouvez pas supprimer votre propre compte' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Delete user role first
    await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)

    // Delete profile
    await supabase
      .from('profiles')
      .delete()
      .eq('id', userId)

    // Delete the user from auth
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId)

    if (deleteError) {
      throw deleteError
    }

    return new Response(
      JSON.stringify({ 
        message: 'Utilisateur supprimé avec succès',
        userId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('Delete user error:', error)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
