import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://esm.sh/zod@3.22.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Input validation schema
const createUserSchema = z.object({
  email: z.string()
    .email('Adresse email invalide')
    .max(255, 'Email trop long (max 255 caractères)'),
  password: z.string()
    .min(6, 'Le mot de passe doit contenir au moins 6 caractères')
    .max(100, 'Mot de passe trop long (max 100 caractères)'),
  name: z.string()
    .max(100, 'Nom trop long (max 100 caractères)')
    .optional(),
  role: z.enum(['admin', 'confirmateur', 'stock_manager', 'none'])
    .optional()
    .default('none'),
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

    const userId = claimsData.claims.sub as string

    // Create admin client for privileged operations
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Check if user is admin
    const { data: roleData } = await supabase.rpc('get_user_role', { _user_id: userId })
    if (roleData !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Seuls les administrateurs peuvent créer des utilisateurs' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check request size limit (10KB max)
    const contentLength = req.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > 10240) {
      return new Response(
        JSON.stringify({ error: 'Requête trop volumineuse' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse and validate input
    const rawBody = await req.json()
    const validationResult = createUserSchema.safeParse(rawBody)
    
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => e.message).join(', ')
      return new Response(
        JSON.stringify({ error: `Données invalides: ${errors}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { email, password, role, name } = validationResult.data

    // Check if user already exists (Auth)
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers()
    if (listError) throw listError

    const existingUser = existingUsers?.users?.find(
      (u) => (u.email || '').toLowerCase() === email.toLowerCase(),
    )

    const sanitizedName = name?.trim() || email.split('@')[0]

    // If the user already exists, "repair" it:
    // - reset password to the provided one
    // - ensure profile exists + approved
    // - (re)assign role
    if (existingUser) {
      const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
        password,
        email_confirm: true,
        user_metadata: { full_name: sanitizedName },
      })
      if (updateError) throw updateError

      const { error: upsertProfileError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: existingUser.id,
            email,
            full_name: sanitizedName,
            is_approved: true,
          },
          { onConflict: 'id' },
        )
      if (upsertProfileError) throw upsertProfileError

      // Re-assign role
      await supabase.from('user_roles').delete().eq('user_id', existingUser.id)
      if (role && role !== 'none') {
        const { error: roleError } = await supabase.from('user_roles').insert({ user_id: existingUser.id, role })
        if (roleError) throw roleError
      }

      return new Response(
        JSON.stringify({
          message: 'Utilisateur existant mis à jour',
          email,
          userId: existingUser.id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Create the user with email confirmation (no email sent)
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: sanitizedName },
    })

    if (createError) {
      throw createError
    }

    // Ensure profile exists + approved
    const { error: upsertProfileError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: newUser.user.id,
          email,
          full_name: sanitizedName,
          is_approved: true,
        },
        { onConflict: 'id' },
      )
    if (upsertProfileError) throw upsertProfileError

    // Assign role if provided
    if (role && role !== 'none') {
      const { error: roleError } = await supabase.from('user_roles').insert({ user_id: newUser.user.id, role })
      if (roleError) throw roleError
    }

    return new Response(
      JSON.stringify({ 
        message: 'Utilisateur créé avec succès',
        email,
        userId: newUser.user.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('Create user error:', error)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
