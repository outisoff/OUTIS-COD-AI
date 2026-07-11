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
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe') {
      // Verify against env var first, then fall back to DB
      const envVerifyToken = Deno.env.get('META_WEBHOOK_VERIFY_TOKEN');
      const { data: meta } = await supabase
        .from('meta_integration')
        .select('verify_token')
        .maybeSingle();

      const validToken = envVerifyToken || meta?.verify_token;
      if (validToken && token === validToken) {
        console.log('✅ Webhook verified');
        return new Response(challenge, { status: 200, headers: corsHeaders });
      }
    }

    return new Response('Forbidden', { status: 403, headers: corsHeaders });
  }

  // POST = incoming events - validate X-Hub-Signature-256 (REQUIRED)
  const rawBody = await req.text();
  const metaAppSecret = Deno.env.get('META_APP_SECRET');
  const signature = req.headers.get('x-hub-signature-256');
  if (!metaAppSecret || !signature) {
    console.error('❌ Missing META_APP_SECRET or X-Hub-Signature-256 header');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(metaAppSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
    const expectedHex = 'sha256=' + Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
    if (signature !== expectedHex) {
      console.error('❌ Invalid X-Hub-Signature-256');
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }
  }

  try {
    const body = JSON.parse(rawBody);
    console.log('📩 Meta webhook event:', JSON.stringify(body).substring(0, 500));

    const { object, entry } = body;
    if (!entry || !Array.isArray(entry)) {
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    for (const entryItem of entry) {
      const pageId = entryItem.id;

      // Handle Messenger messages
      if (entryItem.messaging) {
        for (const event of entryItem.messaging) {
          await handleMessage(supabase, event, pageId, object === 'instagram' ? 'instagram' : 'facebook');
        }
      }

      // Handle feed changes (comments)
      if (entryItem.changes) {
        for (const change of entryItem.changes) {
          if (change.field === 'feed' && change.value?.item === 'comment') {
            await handleComment(supabase, change.value, pageId, 'facebook');
          }
          if (change.field === 'comments') {
            await handleComment(supabase, change.value, pageId, 'instagram');
          }
        }
      }
    }

    return new Response('OK', { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('❌ Meta webhook error:', error);
    return new Response('OK', { status: 200, headers: corsHeaders });
  }
});

async function handleMessage(
  supabase: any,
  event: any,
  pageId: string,
  platform: string
) {
  const senderId = event.sender?.id;
  if (!senderId || senderId === pageId) return;

  const messageText = event.message?.text;
  const attachments = event.message?.attachments;
  const messageId = event.message?.mid;

  // Skip echo messages (sent by us)
  if (event.message?.is_echo) {
    // Still store as outgoing
    const recipientId = event.recipient?.id;
    const { data: conv } = await supabase
      .from('meta_conversations')
      .select('id')
      .eq('sender_id', recipientId === pageId ? senderId : recipientId)
      .eq('page_id', pageId)
      .eq('conversation_type', 'message')
      .maybeSingle();

    if (conv) {
      // Check duplicate
      const { data: existing } = await supabase
        .from('meta_messages')
        .select('id')
        .eq('meta_message_id', messageId)
        .maybeSingle();

      if (!existing) {
        await supabase.from('meta_messages').insert({
          conversation_id: conv.id,
          meta_message_id: messageId,
          direction: 'outgoing',
          content: messageText || null,
          media_url: attachments?.[0]?.payload?.url || null,
          media_type: attachments?.[0]?.type || null,
        });
      }
    }
    return;
  }

  // Find or create conversation
  let { data: conversation } = await supabase
    .from('meta_conversations')
    .select('id')
    .eq('sender_id', senderId)
    .eq('page_id', pageId)
    .eq('conversation_type', 'message')
    .maybeSingle();

  if (!conversation) {
    // Try to get sender info from Meta API
    let senderName = senderId;
    let senderPic = null;

    const { data: meta } = await supabase
      .from('meta_integration')
      .select('page_access_token_encrypted')
      .maybeSingle();

    if (meta?.page_access_token_encrypted) {
      try {
        const res = await fetch(
          `https://graph.facebook.com/v19.0/${senderId}?fields=name,profile_pic&access_token=${meta.page_access_token_encrypted}`
        );
        if (res.ok) {
          const userData = await res.json();
          senderName = userData.name || senderId;
          senderPic = userData.profile_pic || null;
        }
      } catch (e) {
        console.log('Could not fetch sender info:', e);
      }
    }

    const { data: newConv, error } = await supabase
      .from('meta_conversations')
      .insert({
        platform,
        conversation_type: 'message',
        sender_id: senderId,
        sender_name: senderName,
        sender_profile_pic: senderPic,
        page_id: pageId,
        last_message_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating conversation:', error);
      return;
    }
    conversation = newConv;
  }

  // Check duplicate message
  if (messageId) {
    const { data: existing } = await supabase
      .from('meta_messages')
      .select('id')
      .eq('meta_message_id', messageId)
      .maybeSingle();

    if (existing) return;
  }

  // Insert message
  await supabase.from('meta_messages').insert({
    conversation_id: conversation.id,
    meta_message_id: messageId,
    direction: 'incoming',
    content: messageText || null,
    media_url: attachments?.[0]?.payload?.url || null,
    media_type: attachments?.[0]?.type || null,
  });

  // Update conversation last_message_at and unread
  await supabase
    .from('meta_conversations')
    .update({ last_message_at: new Date().toISOString(), is_read: false })
    .eq('id', conversation.id);

  console.log(`📨 ${platform} message from ${senderId}: ${messageText?.substring(0, 50)}`);
}

async function handleComment(
  supabase: any,
  value: any,
  pageId: string,
  platform: string
) {
  const senderId = value.from?.id || value.sender_id;
  const senderName = value.from?.name || 'Unknown';
  const commentId = value.comment_id;
  const postId = value.post_id;
  const message = value.message || value.text;
  const parentId = value.parent_id;

  if (!senderId || !commentId) return;
  // Skip page's own comments
  if (senderId === pageId) return;

  // Find or create conversation for this post
  let { data: conversation } = await supabase
    .from('meta_conversations')
    .select('id')
    .eq('post_id', postId)
    .eq('conversation_type', 'comment')
    .maybeSingle();

  if (!conversation) {
    const { data: newConv, error } = await supabase
      .from('meta_conversations')
      .insert({
        platform,
        conversation_type: 'comment',
        sender_id: senderId,
        sender_name: `Commentaires`,
        page_id: pageId,
        post_id: postId,
        last_message_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating comment conversation:', error);
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
    content: `${senderName}: ${message}`,
    is_comment: true,
    parent_comment_id: parentId || null,
  });

  await supabase
    .from('meta_conversations')
    .update({
      last_message_at: new Date().toISOString(),
      is_read: false,
      sender_name: `Commentaires`,
    })
    .eq('id', conversation.id);

  console.log(`💬 ${platform} comment on post ${postId}: ${message?.substring(0, 50)}`);
}
