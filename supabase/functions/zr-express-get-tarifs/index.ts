import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// ZR Express tarifs from official Excel pricing sheet
const ZR_TARIFS = [
  { code: '01', name: 'Adrar', home: 1300, desk: 900, retour: 200 },
  { code: '02', name: 'Chlef', home: 800, desk: 450, retour: 150 },
  { code: '03', name: 'Laghouat', home: 900, desk: 550, retour: 150 },
  { code: '04', name: 'Oum El Bouaghi', home: 800, desk: 450, retour: 150 },
  { code: '05', name: 'Batna', home: 800, desk: 450, retour: 150 },
  { code: '06', name: 'Bejaia', home: 800, desk: 450, retour: 150 },
  { code: '07', name: 'Biskra', home: 900, desk: 550, retour: 150 },
  { code: '08', name: 'Bechar', home: 1000, desk: 650, retour: 150 },
  { code: '09', name: 'Blida', home: 600, desk: 400, retour: 150 },
  { code: '10', name: 'Bouira', home: 700, desk: 450, retour: 150 },
  { code: '11', name: 'Tamanrasset', home: 1500, desk: 1050, retour: 250 },
  { code: '12', name: 'Tebessa', home: 800, desk: 450, retour: 150 },
  { code: '13', name: 'Tlemcen', home: 900, desk: 500, retour: 150 },
  { code: '14', name: 'Tiaret', home: 800, desk: 450, retour: 150 },
  { code: '15', name: 'Tizi Ouzou', home: 700, desk: 450, retour: 150 },
  { code: '16', name: 'Alger', home: 500, desk: 350, retour: 150 },
  { code: '17', name: 'Djelfa', home: 900, desk: 500, retour: 150 },
  { code: '18', name: 'Jijel', home: 800, desk: 450, retour: 150 },
  { code: '19', name: 'Setif', home: 750, desk: 450, retour: 150 },
  { code: '20', name: 'Saida', home: 900, desk: 500, retour: 150 },
  { code: '21', name: 'Skikda', home: 800, desk: 450, retour: 150 },
  { code: '22', name: 'Sidi Bel Abbes', home: 800, desk: 450, retour: 150 },
  { code: '23', name: 'Annaba', home: 800, desk: 450, retour: 150 },
  { code: '24', name: 'Guelma', home: 800, desk: 450, retour: 150 },
  { code: '25', name: 'Constantine', home: 800, desk: 450, retour: 150 },
  { code: '26', name: 'Medea', home: 750, desk: 450, retour: 150 },
  { code: '27', name: 'Mostaganem', home: 800, desk: 450, retour: 150 },
  { code: '28', name: 'MSila', home: 800, desk: 500, retour: 150 },
  { code: '29', name: 'Mascara', home: 800, desk: 450, retour: 150 },
  { code: '30', name: 'Ouargla', home: 900, desk: 600, retour: 150 },
  { code: '31', name: 'Oran', home: 700, desk: 450, retour: 150 },
  { code: '32', name: 'El Bayadh', home: 1000, desk: 600, retour: 150 },
  { code: '33', name: 'Illizi', home: 1500, desk: 1050, retour: 250 },
  { code: '34', name: 'Bordj Bou Arreridj', home: 750, desk: 450, retour: 150 },
  { code: '35', name: 'Boumerdes', home: 700, desk: 450, retour: 150 },
  { code: '36', name: 'El Tarf', home: 800, desk: 450, retour: 150 },
  { code: '37', name: 'Tindouf', home: 1500, desk: 1050, retour: 250 },
  { code: '38', name: 'Tissemsilt', home: 850, desk: 520, retour: 150 },
  { code: '39', name: 'El Oued', home: 900, desk: 650, retour: 150 },
  { code: '40', name: 'Khenchela', home: 800, desk: 450, retour: 150 },
  { code: '41', name: 'Souk Ahras', home: 800, desk: 450, retour: 150 },
  { code: '42', name: 'Tipaza', home: 700, desk: 450, retour: 150 },
  { code: '43', name: 'Mila', home: 800, desk: 450, retour: 150 },
  { code: '44', name: 'Ain Defla', home: 850, desk: 450, retour: 150 },
  { code: '45', name: 'Naama', home: 1000, desk: 600, retour: 150 },
  { code: '46', name: 'Ain Temouchent', home: 800, desk: 450, retour: 150 },
  { code: '47', name: 'Ghardaia', home: 900, desk: 550, retour: 150 },
  { code: '48', name: 'Relizane', home: 800, desk: 450, retour: 150 },
  { code: '49', name: 'Timimoun', home: 1300, desk: 900, retour: 150 },
  { code: '51', name: 'Ouled Djellal', home: 900, desk: 550, retour: 150 },
  { code: '52', name: 'Beni Abbes', home: 1000, desk: 900, retour: 150 },
  { code: '53', name: 'In Salah', home: 1400, desk: 1120, retour: 250 },
  { code: '54', name: 'In Guezzam', home: 1400, desk: 0, retour: 250 },
  { code: '55', name: 'Touggourt', home: 900, desk: 600, retour: 150 },
  { code: '57', name: 'El Meghaier', home: 900, desk: 0, retour: 150 },
  { code: '58', name: 'El Menia', home: 900, desk: 0, retour: 150 },
]

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

    // Auth check
    const authHeader = req.headers.get('Authorization')
    const cronHeader = req.headers.get('x-cron-source') === 'pg_cron'

    if (!authHeader?.startsWith('Bearer ') && !cronHeader) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader?.replace('Bearer ', '') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Allow internal cron (x-cron-source header) and service role to bypass admin check
    const isServiceRole = token === supabaseServiceKey
    const isInternalCron = cronHeader
    if (!isServiceRole && !isInternalCron) {
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader! } },
      })
      const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token)
      if (claimsError || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: 'Token invalide' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const userId = claimsData.claims.sub as string
      const { data: roleData } = await supabase.rpc('get_user_role', { _user_id: userId })
      if (roleData !== 'admin') {
        return new Response(JSON.stringify({ error: 'Droits insuffisants' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Build fee records with return fee × 2
    const feeRecords = ZR_TARIFS.map(item => ({
      delivery_company: 'ZR Express',
      wilaya_code: item.code,
      wilaya_name: item.name,
      home_delivery_fee: item.home,
      stop_desk_fee: item.desk,
      return_fee: item.retour,
    }))

    console.log(`Importing ${feeRecords.length} ZR Express tarifs...`)

    // Delete existing ZR Express fees and insert fresh ones
    await supabase
      .from('delivery_company_fees')
      .delete()
      .eq('delivery_company', 'ZR Express')

    const batchSize = 50
    let inserted = 0
    for (let i = 0; i < feeRecords.length; i += batchSize) {
      const batch = feeRecords.slice(i, i + batchSize)
      const { error: insertError } = await supabase
        .from('delivery_company_fees')
        .insert(batch)

      if (insertError) {
        console.error(`Error inserting batch ${i / batchSize + 1}:`, insertError)
      } else {
        inserted += batch.length
      }
    }

    const message = `${inserted} tarif(s) ZR Express importé(s)`
    console.log(message)

    return new Response(JSON.stringify({
      success: true,
      inserted,
      message,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('zr-express-get-tarifs error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
