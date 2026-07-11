import { createClient } from "npm:@supabase/supabase-js@2";
import { authenticateRequest } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await authenticateRequest(req, { requireRoles: ['admin', 'confirmateur'] });
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.message }), {
      status: auth.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { conversation_id, message, reply_to_comment_id } = await req.json();

    if (!conversation_id || !message) {
      return new Response(JSON.stringify({ error: 'Missing conversation_id or message' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get conversation details
    const { data: conversation, error: convError } = await supabase
      .from('meta_conversations')
      .select('*')
      .eq('id', conversation_id)
      .single();

    if (convError || !conversation) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get page access token
    const { data: meta } = await supabase
      .from('meta_integration')
      .select('page_access_token_encrypted')
      .maybeSingle();

    // Also check meta_pages for page-specific token
    const { data: pageData } = await supabase
      .from('meta_pages')
      .select('page_access_token_encrypted')
      .eq('page_id', conversation.page_id)
      .eq('is_active', true)
      .maybeSingle();

    const accessToken = (pageData as any)?.page_access_token_encrypted || meta?.page_access_token_encrypted;

    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'No access token configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let metaResponse;

    if (conversation.conversation_type === 'comment') {
      // Reply to comment
      const commentId = reply_to_comment_id;
      if (!commentId) {
        return new Response(JSON.stringify({ error: 'reply_to_comment_id required for comment replies' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const res = await fetch(
        `https://graph.facebook.com/v19.0/${commentId}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            access_token: accessToken,
          }),
        }
      );

      metaResponse = await res.json();
      if (!res.ok) {
        console.error('Meta comment reply error:', metaResponse);
        return new Response(JSON.stringify({ error: 'Failed to reply to comment', details: metaResponse }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      // Send message via Messenger/Instagram DM
      const recipientId = conversation.sender_id;

      const endpoint = conversation.platform === 'instagram'
        ? `https://graph.facebook.com/v19.0/me/messages`
        : `https://graph.facebook.com/v19.0/me/messages`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text: message },
          access_token: accessToken,
        }),
      });

      metaResponse = await res.json();
      if (!res.ok) {
        console.error('Meta message send error:', metaResponse);
        return new Response(JSON.stringify({ error: 'Failed to send message', details: metaResponse }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Store outgoing message
    await supabase.from('meta_messages').insert({
      conversation_id,
      meta_message_id: metaResponse.id || metaResponse.message_id || null,
      direction: 'outgoing',
      content: message,
      is_comment: conversation.conversation_type === 'comment',
    });

    // Update conversation
    await supabase
      .from('meta_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversation_id);

    console.log(`✅ Reply sent to ${conversation.platform} ${conversation.conversation_type}`);

    return new Response(JSON.stringify({ success: true, meta_response: metaResponse }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ Meta reply error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
