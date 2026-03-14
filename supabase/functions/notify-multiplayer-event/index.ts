import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type EventPayload = {
  user_id?: string;
  type?: string;
  title?: string;
  body?: string;
  entity_id?: string | null;
  payload?: Record<string, unknown>;
  send_push?: boolean;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase environment variables." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const payload = (await request.json()) as EventPayload;
    const userId = payload.user_id;
    const type = payload.type;
    const entityId = payload.entity_id ?? null;
    const eventPayload = payload.payload ?? {};

    if (!userId || !type) {
      return new Response(JSON.stringify({ error: "Missing user_id or type." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: notificationId, error: enqueueError } = await supabase.rpc(
      "enqueue_multiplayer_notification",
      {
        p_recipient_user_id: userId,
        p_type: type,
        p_entity_id: entityId,
        p_payload: eventPayload,
      }
    );

    if (enqueueError) {
      throw enqueueError;
    }

    if (payload.send_push) {
      await supabase.functions.invoke("send-push", {
        body: {
          user_id: userId,
          title: payload.title ?? "Words With Real Friends",
          body: payload.body ?? "You have a multiplayer update.",
          data: eventPayload,
        },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, notification_id: notificationId ?? null }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Unexpected notify-multiplayer-event failure.",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
