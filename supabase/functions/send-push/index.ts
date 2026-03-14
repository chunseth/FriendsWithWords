import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type PushPayload = {
  user_id?: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
};

const sendFcmPush = async ({
  token,
  title,
  body,
  data,
  serverKey,
}: {
  token: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  serverKey: string;
}) => {
  const response = await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      Authorization: `key=${serverKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: token,
      notification: { title, body },
      data,
      priority: "high",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`FCM push failed: ${response.status} ${text}`);
  }
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const fcmServerKey = Deno.env.get("FCM_SERVER_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase environment variables." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const payload = (await request.json()) as PushPayload;
    const userId = payload.user_id;
    const title = payload.title ?? "Words With Real Friends";
    const body = payload.body ?? "You have a multiplayer update.";
    const data = payload.data ?? {};

    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing user_id." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: tokens, error: tokenError } = await supabase
      .from("push_tokens")
      .select("id, provider, token")
      .eq("user_id", userId);

    if (tokenError) {
      throw tokenError;
    }

    const results: Array<{ id: string; provider: string; ok: boolean; error?: string }> = [];

    for (const tokenRow of tokens ?? []) {
      try {
        if (tokenRow.provider === "fcm") {
          if (!fcmServerKey) {
            throw new Error("FCM_SERVER_KEY is not configured");
          }
          await sendFcmPush({
            token: tokenRow.token,
            title,
            body,
            data,
            serverKey: fcmServerKey,
          });
        } else if (tokenRow.provider === "apns") {
          // APNs wiring is environment-specific; keep explicit signal in response for now.
          throw new Error("APNs sender is not configured in this environment");
        }

        results.push({ id: tokenRow.id, provider: tokenRow.provider, ok: true });
      } catch (error) {
        results.push({
          id: tokenRow.id,
          provider: tokenRow.provider,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return new Response(
      JSON.stringify({ ok: true, attempted: results.length, results }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Unexpected send-push failure.",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
