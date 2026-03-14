import { ensureSupabaseSession, getSupabaseClient } from "../lib/supabase";
import { isBackendConfigured } from "../config/backend";

const getAuthContext = async () => {
  if (!isBackendConfigured()) {
    return { ok: false, reason: "backend_not_configured" };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, reason: "backend_not_configured" };
  }

  const sessionResult = await ensureSupabaseSession();
  if (!sessionResult.ok) {
    return {
      ok: false,
      reason: sessionResult.reason ?? "auth_failed",
      error: sessionResult.error ?? null,
    };
  }

  return { ok: true, supabase };
};

export const fetchMultiplayerNotificationSettings = async () => {
  const authContext = await getAuthContext();
  if (!authContext.ok) {
    return {
      ok: false,
      reason: authContext.reason ?? "auth_failed",
      error: authContext.error ?? null,
      settings: null,
    };
  }

  const { supabase } = authContext;
  const { data, error } = await supabase.rpc(
    "get_multiplayer_notification_settings"
  );

  if (error) {
    return {
      ok: false,
      reason: "rpc_failed",
      error,
      settings: null,
    };
  }

  return {
    ok: true,
    settings: data ?? null,
  };
};

export const saveMultiplayerNotificationSettings = async ({
  turnRemindersEnabled,
  quietHoursStart = null,
  quietHoursEnd = null,
  timezone = null,
}) => {
  const authContext = await getAuthContext();
  if (!authContext.ok) {
    return {
      ok: false,
      reason: authContext.reason ?? "auth_failed",
      error: authContext.error ?? null,
      settings: null,
    };
  }

  const { supabase } = authContext;
  const { data, error } = await supabase.rpc(
    "upsert_multiplayer_notification_settings",
    {
      p_turn_reminders_enabled:
        typeof turnRemindersEnabled === "boolean"
          ? turnRemindersEnabled
          : true,
      p_quiet_hours_start: quietHoursStart,
      p_quiet_hours_end: quietHoursEnd,
      p_timezone: timezone,
    }
  );

  if (error) {
    return {
      ok: false,
      reason: "rpc_failed",
      error,
      settings: null,
    };
  }

  return {
    ok: true,
    settings: data ?? null,
  };
};

export const setSessionReminderMute = async ({ sessionId, mutedUntil }) => {
  const authContext = await getAuthContext();
  if (!authContext.ok) {
    return {
      ok: false,
      reason: authContext.reason ?? "auth_failed",
      error: authContext.error ?? null,
    };
  }

  if (!sessionId) {
    return { ok: false, reason: "invalid_payload" };
  }

  const { supabase } = authContext;
  const { data, error } = await supabase.rpc("set_session_reminder_mute", {
    p_session_id: sessionId,
    p_muted_until: mutedUntil,
  });

  if (error) {
    return {
      ok: false,
      reason: "rpc_failed",
      error,
    };
  }

  return {
    ok: Boolean(data?.ok),
    reason: data?.reason ?? null,
  };
};
