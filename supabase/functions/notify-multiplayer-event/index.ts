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
  skip_enqueue?: boolean;
};

const parseBooleanEnv = (value: string | undefined, fallback = false): boolean => {
  if (value == null) return fallback;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
};

const parsePercentEnv = (value: string | undefined, fallback = 0): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(100, Math.max(0, parsed));
};

const hashStringToPercentile = (input: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100;
};

const isUserInCanary = (userId: string, percent: number): boolean => {
  if (percent >= 100) return true;
  if (percent <= 0) return false;
  return hashStringToPercentile(userId) < percent;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const eventPushEnabled = parseBooleanEnv(
      Deno.env.get("ENABLE_EVENT_DRIVEN_PUSH"),
      false
    );
    const eventPushCanaryPercent = parsePercentEnv(
      Deno.env.get("EVENT_DRIVEN_PUSH_CANARY_PERCENT"),
      0
    );

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

    let notificationId: string | null = null;
    if (!payload.skip_enqueue) {
      const { data, error: enqueueError } = await supabase.rpc(
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
      notificationId = data ?? null;
    }

    let pushResult: Record<string, unknown> = {
      requested: payload.send_push === true,
      sent: false,
      skipped_reason: null,
    };

    if (payload.send_push) {
      const canSendPush =
        eventPushEnabled && isUserInCanary(userId, eventPushCanaryPercent);
      if (!eventPushEnabled) {
        pushResult = { ...pushResult, skipped_reason: "event_push_disabled" };
      } else if (!canSendPush) {
        pushResult = { ...pushResult, skipped_reason: "outside_canary" };
      } else {
        const sendPushResponse = await fetch(
          `${supabaseUrl}/functions/v1/send-push`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              user_id: userId,
              title: payload.title ?? "Words With Real Friends",
              body: payload.body ?? "You have a multiplayer update.",
              data: {
                ...eventPayload,
                type,
              },
            }),
          }
        );

        if (!sendPushResponse.ok) {
          const text = await sendPushResponse.text();
          pushResult = {
            ...pushResult,
            sent: false,
            skipped_reason: "send_push_invoke_failed",
            error: `send-push returned ${sendPushResponse.status}: ${text.slice(
              0,
              200
            )}`,
          };
        } else {
          const sendPushBody = (await sendPushResponse.json()) as {
            attempted?: number;
            results?: Array<{ ok?: boolean }>;
          };
          const successfulCount = (sendPushBody.results ?? []).filter(
            (item) => item?.ok
          ).length;
          pushResult = {
            ...pushResult,
            sent: successfulCount > 0,
            attempted: sendPushBody.attempted ?? 0,
            successful: successfulCount,
          };
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        notification_id: notificationId ?? null,
        push: pushResult,
      }),
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
