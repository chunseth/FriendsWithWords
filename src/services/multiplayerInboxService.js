import { ensureSupabaseSession, getSupabaseClient } from "../lib/supabase";
import { isBackendConfigured } from "../config/backend";

const NOTIFICATIONS_TABLE = "multiplayer_notifications";
const PRESENCE_TABLE = "user_presence";
const GAME_REQUESTS_TABLE = "multiplayer_game_requests";
const SESSIONS_TABLE = "multiplayer_sessions";
const INBOX_CHANNEL = "multiplayer-inbox";

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

  const userId = sessionResult.session?.user?.id ?? null;
  if (!userId) {
    return { ok: false, reason: "auth_failed" };
  }

  return { ok: true, supabase, userId };
};

export const registerPushToken = async ({
  platform,
  provider,
  token,
  deviceId,
  appBuild = null,
}) => {
  const authContext = await getAuthContext();
  if (!authContext.ok) {
    return {
      ok: false,
      reason: authContext.reason ?? "auth_failed",
      error: authContext.error ?? null,
    };
  }

  if (!platform || !provider || !token || !deviceId) {
    return { ok: false, reason: "invalid_payload" };
  }

  const { supabase } = authContext;
  const { data, error } = await supabase.rpc("register_push_token", {
    p_platform: platform,
    p_provider: provider,
    p_token: token,
    p_device_id: deviceId,
    p_app_build: appBuild,
  });

  if (error) {
    return { ok: false, reason: "rpc_failed", error };
  }

  return {
    ok: Boolean(data?.ok),
    reason: data?.reason ?? "token_registered",
  };
};

export const fetchUnreadMultiplayerNotifications = async (limit = 25) => {
  return fetchMultiplayerNotifications({
    unreadOnly: true,
    limit,
  });
};

export const fetchMultiplayerNotifications = async ({
  unreadOnly = false,
  limit = 25,
  cursor = null,
} = {}) => {
  const authContext = await getAuthContext();
  if (!authContext.ok) {
    return {
      ok: false,
      reason: authContext.reason ?? "auth_failed",
      error: authContext.error ?? null,
      notifications: [],
      nextCursor: null,
    };
  }

  const { supabase, userId } = authContext;
  let query = supabase
    .from(NOTIFICATIONS_TABLE)
    .select("id, type, entity_id, payload, read_at, created_at")
    .eq("recipient_user_id", userId);

  if (unreadOnly) {
    query = query.is("read_at", null);
  }

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  query = query.order("created_at", { ascending: false }).limit(Math.max(1, limit));

  const { data, error } = await query;

  if (error) {
    return {
      ok: false,
      reason: "fetch_failed",
      error,
      notifications: [],
      nextCursor: null,
    };
  }

  const notifications = data ?? [];
  const nextCursor =
    notifications.length >= Math.max(1, limit)
      ? notifications[notifications.length - 1]?.created_at ?? null
      : null;

  return {
    ok: true,
    notifications,
    nextCursor,
  };
};

export const markMultiplayerNotificationsRead = async (ids = []) => {
  const authContext = await getAuthContext();
  if (!authContext.ok) {
    return {
      ok: false,
      reason: authContext.reason ?? "auth_failed",
      error: authContext.error ?? null,
      updatedCount: 0,
    };
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return { ok: true, updatedCount: 0 };
  }

  const { supabase } = authContext;
  const { data, error } = await supabase.rpc(
    "mark_multiplayer_notifications_read",
    {
      p_ids: ids,
    }
  );

  if (error) {
    return {
      ok: false,
      reason: "rpc_failed",
      error,
      updatedCount: 0,
    };
  }

  return {
    ok: Boolean(data?.ok),
    updatedCount: data?.updated_count ?? 0,
  };
};

export const markSessionSeen = async ({ sessionId, seenRevision }) => {
  const authContext = await getAuthContext();
  if (!authContext.ok) {
    return {
      ok: false,
      reason: authContext.reason ?? "auth_failed",
      error: authContext.error ?? null,
    };
  }

  const { supabase } = authContext;
  const { data, error } = await supabase.rpc("mark_session_seen", {
    p_session_id: sessionId,
    p_seen_revision: seenRevision,
  });

  if (error) {
    return { ok: false, reason: "rpc_failed", error };
  }

  return {
    ok: Boolean(data?.ok),
    reason: data?.reason ?? "session_seen_marked",
  };
};

export const upsertPresence = async ({ status, lastSessionId = null }) => {
  const authContext = await getAuthContext();
  if (!authContext.ok) {
    return {
      ok: false,
      reason: authContext.reason ?? "auth_failed",
      error: authContext.error ?? null,
    };
  }

  const { supabase } = authContext;
  const { data, error } = await supabase.rpc("upsert_presence", {
    p_status: status,
    p_last_session_id: lastSessionId,
  });

  if (error) {
    return { ok: false, reason: "rpc_failed", error };
  }

  return {
    ok: Boolean(data?.ok),
    reason: data?.reason ?? "presence_updated",
  };
};

export const createMultiplayerRematch = async ({
  sessionId,
  newSessionId,
  seed,
  gameType = "seeded",
}) => {
  const authContext = await getAuthContext();
  if (!authContext.ok) {
    return {
      ok: false,
      reason: authContext.reason ?? "auth_failed",
      error: authContext.error ?? null,
      sessionId: null,
    };
  }

  const { supabase } = authContext;
  const { data, error } = await supabase.rpc("create_multiplayer_rematch", {
    p_session_id: sessionId,
    p_new_session_id: newSessionId,
    p_seed: seed,
    p_game_type: gameType,
  });

  if (error) {
    return { ok: false, reason: "rpc_failed", error, sessionId: null };
  }

  return {
    ok: Boolean(data?.ok),
    reason: data?.reason ?? null,
    sessionId: data?.session_id ?? null,
  };
};

export const archiveMultiplayerSessionForUser = async ({ sessionId }) => {
  const authContext = await getAuthContext();
  if (!authContext.ok) {
    return {
      ok: false,
      reason: authContext.reason ?? "auth_failed",
      error: authContext.error ?? null,
    };
  }

  const { supabase } = authContext;
  const { data, error } = await supabase.rpc(
    "archive_multiplayer_session_for_user",
    {
      p_session_id: sessionId,
    }
  );

  if (error) {
    return { ok: false, reason: "rpc_failed", error };
  }

  return {
    ok: Boolean(data?.ok),
    reason: data?.reason ?? null,
  };
};

export const loadPresenceByUserIds = async (userIds = []) => {
  const authContext = await getAuthContext();
  if (!authContext.ok) {
    return {
      ok: false,
      reason: authContext.reason ?? "auth_failed",
      error: authContext.error ?? null,
      presenceByUserId: {},
    };
  }

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return { ok: true, presenceByUserId: {} };
  }

  const { supabase } = authContext;
  const { data, error } = await supabase
    .from(PRESENCE_TABLE)
    .select("user_id, status, last_active_at, last_session_id")
    .in("user_id", userIds);

  if (error) {
    return {
      ok: false,
      reason: "fetch_failed",
      error,
      presenceByUserId: {},
    };
  }

  return {
    ok: true,
    presenceByUserId: Object.fromEntries(
      (data ?? []).map((entry) => [entry.user_id, entry])
    ),
  };
};

export const subscribeToMultiplayerInbox = async ({
  onNotification = null,
  onGameRequest = null,
  onSessionChange = null,
  onStatusChange = null,
} = {}) => {
  const authContext = await getAuthContext();
  if (!authContext.ok) {
    return {
      ok: false,
      reason: authContext.reason ?? "auth_failed",
      error: authContext.error ?? null,
      unsubscribe: () => {},
    };
  }

  const { supabase, userId } = authContext;
  const channel = supabase
    .channel(`${INBOX_CHANNEL}:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: NOTIFICATIONS_TABLE,
        filter: `recipient_user_id=eq.${userId}`,
      },
      (payload) => onNotification?.(payload)
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: GAME_REQUESTS_TABLE,
        filter: `receiver_id=eq.${userId}`,
      },
      (payload) => onGameRequest?.(payload)
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: SESSIONS_TABLE,
      },
      (payload) => onSessionChange?.(payload)
    )
    .subscribe((status) => {
      onStatusChange?.(status);
    });

  return {
    ok: true,
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
  };
};
