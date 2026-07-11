import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // GET = webhook verification
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const challenge = url.searchParams.get('challenge');

    if (challenge) {
      console.log('✅ TikTok webhook verified');
      return new Response(challenge, { status: 200, headers: corsHeaders });
    }

    return new Response('OK', { status: 200, headers: corsHeaders });
  }

  // POST = incoming events — require shared secret to prevent forged inbox entries
  const WEBHOOK_SECRET = Deno.env.get('TIKTOK_WEBHOOK_SECRET');
  if (!WEBHOOK_SECRET) {
    console.error('❌ TIKTOK_WEBHOOK_SECRET not configured');
    return new Response('Server misconfigured', { status: 500, headers: corsHeaders });
  }
  const url = new URL(req.url);
  const providedSecret =
    req.headers.get('x-webhook-secret') ||
    req.headers.get('x-tiktok-signature') ||
    url.searchParams.get('secret');
  if (providedSecret !== WEBHOOK_SECRET) {
    console.warn('❌ TikTok webhook rejected — invalid or missing secret');
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('📩 TikTok webhook event:', JSON.stringify(body).substring(0, 500));

    const events = body.event ? [body] : (body.data || []);

    for (const event of events) {
      const eventType = event.event || event.type;

      if (eventType === 'comment.create' || eventType === 'comment') {
        await handleTikTokComment(supabase, event);
      }
    }

    return new Response('OK', { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('❌ TikTok webhook error:', error);
    return new Response('OK', { status: 200, headers: corsHeaders });
  }
});

async function handleTikTokComment(supabase: any, event: any) {
  const data = event.data || event;
  const commentId = data.comment_id || data.id;
  const videoId = data.video_id || data.object_id;
  const userId = data.user?.open_id || data.from_user_id || data.user_id;
  const userName = data.user?.display_name || data.user?.nickname || 'TikTok User';
  const commentText = data.text || data.comment_text || data.content;

  if (!commentId || !videoId) return;

  // Find or create conversation for this video
  let { data: conversation } = await supabase
    .from('meta_conversations')
    .select('id')
    .eq('post_id', videoId)
    .eq('platform', 'tiktok')
    .eq('conversation_type', 'comment')
    .maybeSingle();

  if (!conversation) {
    const { data: newConv, error } = await supabase
      .from('meta_conversations')
      .insert({
        platform: 'tiktok',
        conversation_type: 'comment',
        sender_id: userId || 'unknown',
        sender_name: 'Commentaires TikTok',
        page_id: 'tiktok',
        post_id: videoId,
        last_message_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating TikTok conversation:', error);
      return;
    }
    conversation = newConv;
  }

  // Check duplicate
  const { data: existing } = await supabase
    .from('meta_messages')
    .select('id')
    .eq('meta_message_id', commentId)
    .maybeSingle();

  if (existing) return;

  await supabase.from('meta_messages').insert({
    conversation_id: conversation.id,
    meta_message_id: commentId,
    direction: 'incoming',
    content: `${userName}: ${commentText}`,
    is_comment: true,
  });

  await supabase
    .from('meta_conversations')
    .update({
      last_message_at: new Date().toISOString(),
      is_read: false,
      sender_name: 'Commentaires TikTok',
    })
    .eq('id', conversation.id);

  console.log(`🎵 TikTok comment on video ${videoId}: ${commentText?.substring(0, 50)}`);
}
