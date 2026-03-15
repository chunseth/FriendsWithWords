import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
    const forwardAuthorization = request.headers.get("authorization");
    const forwardApiKey = request.headers.get("apikey");
    const cronRemindersEnabled = parseBooleanEnv(
      Deno.env.get("ENABLE_CRON_REMINDERS"),
      false
    );
    const reminderPushEnabled = parseBooleanEnv(
      Deno.env.get("ENABLE_REMINDER_PUSH"),
      false
    );
    const reminderPushCanaryPercent = parsePercentEnv(
      Deno.env.get("REMINDER_PUSH_CANARY_PERCENT"),
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

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (!cronRemindersEnabled) {
      return new Response(
        JSON.stringify({
          ok: true,
          skipped: true,
          reason: "cron_reminders_disabled",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const runStartedAtIso = new Date().toISOString();
    const { data, error } = await supabase.rpc("enqueue_turn_reminders");
    if (error) {
      throw error;
    }

    let attemptedPushCount = 0;
    let sentPushCount = 0;
    let skippedCanaryCount = 0;
    let failedPushCount = 0;

    if (reminderPushEnabled) {
      const { data: freshReminders, error: reminderQueryError } = await supabase
        .from("multiplayer_notifications")
        .select("id, recipient_user_id, entity_id, payload, created_at")
        .eq("type", "reminder")
        .gte("created_at", runStartedAtIso)
        .order("created_at", { ascending: true })
        .limit(250);

      if (reminderQueryError) {
        throw reminderQueryError;
      }

      for (const reminder of freshReminders ?? []) {
        const recipientUserId = String(reminder.recipient_user_id ?? "");
        if (!recipientUserId) {
          continue;
        }

        if (!isUserInCanary(recipientUserId, reminderPushCanaryPercent)) {
          skippedCanaryCount += 1;
          continue;
        }

        attemptedPushCount += 1;
        const sendPushResponse = await fetch(
          `${supabaseUrl}/functions/v1/send-push`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(forwardApiKey ? { apikey: forwardApiKey } : {}),
              ...(forwardAuthorization
                ? { Authorization: forwardAuthorization }
                : {}),
            },
            body: JSON.stringify({
              user_id: recipientUserId,
              title: "Your turn is waiting",
              body: "Your friend is waiting in Words With Real Friends.",
              data: {
                ...(reminder.payload ?? {}),
                type: "reminder",
                route: "multiplayer-game",
                sessionId: reminder.entity_id,
              },
            }),
          }
        );

        if (!sendPushResponse.ok) {
          failedPushCount += 1;
        } else {
          const sendPushBody = (await sendPushResponse.json()) as {
            results?: Array<{ ok?: boolean }>;
          };
          const successfulCount = (sendPushBody.results ?? []).filter(
            (item) => item?.ok
          ).length;
          if (successfulCount > 0) {
            sentPushCount += 1;
          } else {
            failedPushCount += 1;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        result: data ?? null,
        push: {
          enabled: reminderPushEnabled,
          attempted: attemptedPushCount,
          sent: sentPushCount,
          failed: failedPushCount,
          skipped_canary: skippedCanaryCount,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Unexpected multiplayer-reminder-cron failure.",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
