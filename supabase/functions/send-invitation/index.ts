import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://esm.sh/zod@3.22.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Input validation schema
const invitationSchema = z.object({
  email: z.string()
    .email('Adresse email invalide')
    .max(255, 'Email trop long (max 255 caractères)'),
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
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is admin
    const { data: roleData } = await supabase.rpc('get_user_role', { _user_id: user.id })
    if (roleData !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Seuls les administrateurs peuvent envoyer des invitations' }),
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
    const validationResult = invitationSchema.safeParse(rawBody)
    
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => e.message).join(', ')
      return new Response(
        JSON.stringify({ error: `Données invalides: ${errors}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { email, role, name } = validationResult.data

    // Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === email)

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: 'Un utilisateur avec cet email existe déjà' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate a temporary password
    const tempPassword = crypto.randomUUID().slice(0, 12) + 'A1!'
    const sanitizedName = name?.trim() || email.split('@')[0]

    // Create the user with email confirmation
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: sanitizedName }
    })

    if (createError) {
      throw createError
    }

    // Approve the user and set their role
    await supabase
      .from('profiles')
      .update({ is_approved: true, full_name: sanitizedName })
      .eq('id', newUser.user.id)

    // Assign role if provided
    if (role && role !== 'none') {
      await supabase
        .from('user_roles')
        .insert({ user_id: newUser.user.id, role })
    }

    // Send invitation email if Resend API key is configured
    if (resendApiKey) {
      const appUrl = req.headers.get('origin') || 'https://your-app.lovable.app'
      
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'OUTIS COD <noreply@your-domain.com>',
          to: [email],
          subject: 'Invitation à OUTIS COD',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #333;">Bienvenue sur OUTIS COD</h1>
              <p>Vous avez été invité à rejoindre OUTIS COD.</p>
              <p>Voici vos identifiants de connexion :</p>
              <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Email :</strong> ${email}</p>
                <p><strong>Mot de passe temporaire :</strong> ${tempPassword}</p>
              </div>
              <p>Veuillez vous connecter et changer votre mot de passe dès que possible.</p>
              <a href="${appUrl}/login" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px;">Se connecter</a>
              <p style="color: #666; font-size: 12px; margin-top: 30px;">Si vous n'avez pas demandé cette invitation, veuillez ignorer cet email.</p>
            </div>
          `,
        }),
      })

      if (!emailResponse.ok) {
        console.error('Failed to send email:', await emailResponse.text())
        // Return success but note that email wasn't sent - DO NOT return password
        return new Response(
          JSON.stringify({ 
            message: 'Utilisateur créé mais l\'email n\'a pas pu être envoyé. Veuillez utiliser la réinitialisation de mot de passe.',
            email,
            emailSent: false,
            requiresPasswordReset: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ 
          message: 'Invitation envoyée avec succès',
          email,
          emailSent: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // No Resend API key - DO NOT return credentials, instruct to use password reset
    return new Response(
      JSON.stringify({ 
        message: 'Utilisateur créé. L\'utilisateur devra utiliser "Mot de passe oublié" pour définir son mot de passe.',
        email,
        emailSent: false,
        requiresPasswordReset: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('Invitation error:', error)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})