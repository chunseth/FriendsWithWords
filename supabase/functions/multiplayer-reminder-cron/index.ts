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

const parseIntegerEnv = (
  value: string | undefined,
  fallback: number,
  min: number,
  max: number
): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.floor(parsed)));
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

const asRecord = (
  value: unknown
): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
};

const resolveActorLabel = (payload: Record<string, unknown>): string =>
  typeof payload.actorLabel === "string" && payload.actorLabel.trim().length > 0
    ? payload.actorLabel.trim()
    : typeof payload.friendName === "string" && payload.friendName.trim().length > 0
      ? payload.friendName.trim()
      : "Your friend";

const buildPushCopy = ({
  type,
  payload,
}: {
  type: string;
  payload: Record<string, unknown>;
}) => {
  const actorLabel = resolveActorLabel(payload);

  switch (type) {
    case "friend_request":
      return {
        title: "New friend request",
        body: `${actorLabel} sent you a friend request.`,
      };
    case "game_request":
      return {
        title: "New game request",
        body: `${actorLabel} challenged you to a game.`,
      };
    case "request_accepted":
      return {
        title: "Game request accepted",
        body: `${actorLabel} accepted your game request.`,
      };
    case "turn_ready":
      return {
        title: "Your turn is ready",
        body: `${actorLabel} just played a turn.`,
      };
    case "session_conflict":
      return {
        title: "Session updated",
        body: "Your multiplayer session was updated elsewhere.",
      };
    case "reminder":
      return {
        title: "Your turn is waiting",
        body: "Your friend is waiting in Words With Real Friends.",
      };
    default:
      return {
        title: "Multiplayer update",
        body: "You have a multiplayer update.",
      };
  }
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
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
    const notificationQueuePushEnabled = parseBooleanEnv(
      Deno.env.get("ENABLE_NOTIFICATION_QUEUE_PUSH"),
      true
    );
    const queueBatchSize = parseIntegerEnv(
      Deno.env.get("NOTIFICATION_QUEUE_BATCH_SIZE"),
      100,
      1,
      200
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

    let reminderResult: Record<string, unknown> = {
      enabled: cronRemindersEnabled,
      skipped: false,
      result: null,
    };
    if (cronRemindersEnabled) {
      const { data, error } = await supabase.rpc("enqueue_turn_reminders");
      if (error) {
        throw error;
      }
      reminderResult = {
        enabled: true,
        skipped: false,
        result: data ?? null,
      };
    } else {
      reminderResult = {
        enabled: false,
        skipped: true,
        reason: "cron_reminders_disabled",
        result: null,
      };
    }

    let claimedCount = 0;
    let sentCount = 0;
    let failedCount = 0;
    let skippedReminderCount = 0;
    let skippedReminderCanaryCount = 0;

    if (notificationQueuePushEnabled) {
      const workerId = `multiplayer-reminder-cron:${crypto.randomUUID()}`;
      const { data: claimedJobs, error: claimError } = await supabase.rpc(
        "claim_push_delivery_jobs",
        {
          p_limit: queueBatchSize,
          p_worker_id: workerId,
        }
      );
      if (claimError) {
        throw claimError;
      }

      for (const job of claimedJobs ?? []) {
        claimedCount += 1;
        const jobRow = asRecord(job);
        const jobId = String(jobRow.id ?? "");
        const notificationId = String(jobRow.notification_id ?? "");
        const recipientUserId = String(jobRow.recipient_user_id ?? "");
        const type = String(jobRow.type ?? "unknown");
        const entityId =
          typeof jobRow.entity_id === "string" ? jobRow.entity_id : null;
        const payload = asRecord(jobRow.payload);

        if (!jobId || !recipientUserId) {
          failedCount += 1;
          if (jobId) {
            await supabase.rpc("complete_push_delivery_job", {
              p_job_id: jobId,
              p_success: false,
              p_error: "invalid_job_payload",
              p_push_result: { job: jobRow },
            });
          }
          continue;
        }

        if (type === "reminder" && !reminderPushEnabled) {
          skippedReminderCount += 1;
          await supabase.rpc("complete_push_delivery_job", {
            p_job_id: jobId,
            p_success: true,
            p_push_result: { skipped_reason: "reminder_push_disabled" },
          });
          continue;
        }
        if (
          type === "reminder" &&
          !isUserInCanary(recipientUserId, reminderPushCanaryPercent)
        ) {
          skippedReminderCanaryCount += 1;
          await supabase.rpc("complete_push_delivery_job", {
            p_job_id: jobId,
            p_success: true,
            p_push_result: { skipped_reason: "reminder_outside_canary" },
          });
          continue;
        }

        const copy = buildPushCopy({ type, payload });
        const pushData = {
          ...payload,
          type,
          notificationId,
          entity_id: entityId,
        };

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
              user_id: recipientUserId,
              title: copy.title,
              body: copy.body,
              data: pushData,
            }),
          }
        );

        if (!sendPushResponse.ok) {
          const responseText = (await sendPushResponse.text()).slice(0, 400);
          failedCount += 1;
          await supabase.rpc("complete_push_delivery_job", {
            p_job_id: jobId,
            p_success: false,
            p_error: `send_push_http_${sendPushResponse.status}`,
            p_push_result: {
              status: sendPushResponse.status,
              response: responseText,
            },
          });
        } else {
          const sendPushBody = (await sendPushResponse.json()) as {
            attempted?: number;
            results?: Array<{ ok?: boolean }>;
          };
          const attemptedCount = Number(sendPushBody.attempted ?? 0);
          const successfulCount = (sendPushBody.results ?? []).filter(
            (item) => item?.ok
          ).length;
          if (successfulCount > 0) {
            sentCount += 1;
            await supabase.rpc("complete_push_delivery_job", {
              p_job_id: jobId,
              p_success: true,
              p_push_result: sendPushBody,
            });
          } else if (attemptedCount === 0) {
            failedCount += 1;
            await supabase.rpc("complete_push_delivery_job", {
              p_job_id: jobId,
              p_success: false,
              p_error: "no_push_tokens",
              p_retry_delay_seconds: 21600,
              p_push_result: sendPushBody,
            });
          } else {
            failedCount += 1;
            await supabase.rpc("complete_push_delivery_job", {
              p_job_id: jobId,
              p_success: false,
              p_error: "send_push_no_successful_tokens",
              p_push_result: sendPushBody,
            });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        reminders: reminderResult,
        push: {
          queue_enabled: notificationQueuePushEnabled,
          queue_batch_size: queueBatchSize,
          reminder_push_enabled: reminderPushEnabled,
          reminder_push_canary_percent: reminderPushCanaryPercent,
          claimed: claimedCount,
          sent: sentCount,
          failed: failedCount,
          skipped_reminder_disabled: skippedReminderCount,
          skipped_reminder_canary: skippedReminderCanaryCount,
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
