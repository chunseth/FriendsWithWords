import { ensureSupabaseSession, getSupabaseClient } from "../lib/supabase";
import { isBackendConfigured } from "../config/backend";

const MULTIPLAYER_SESSIONS_TABLE = "multiplayer_sessions";
const getMultiplayerSessionChannelName = (sessionId) =>
  `multiplayer-session:${sessionId}`;
const SESSION_UPDATE_DEBOUNCE_MS = 150;

const buildSessionRow = (session) => ({
  session_id: session.sessionId,
  mode_id: session.modeId,
  seed: session.seed,
  status: session.status,
  board_revision: session.boardRevision ?? 0,
  active_player_id: session.turn?.activePlayerId ?? null,
  participant_player_ids: Array.isArray(session.players)
    ? session.players.map((player) => player.id)
    : [],
  saved_at: new Date().toISOString(),
  session_payload: session,
});

export const loadRemoteMultiplayerSession = async (sessionId) => {
  if (!isBackendConfigured()) {
    return { ok: false, reason: "backend_not_configured", session: null };
  }

  if (!sessionId || typeof sessionId !== "string") {
    return { ok: false, reason: "missing_session_id", session: null };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, reason: "backend_not_configured", session: null };
  }

  const sessionResult = await ensureSupabaseSession();
  if (!sessionResult.ok) {
    return {
      ok: false,
      reason: sessionResult.reason ?? "auth_failed",
      error: sessionResult.error ?? null,
      session: null,
    };
  }

  const { data, error } = await supabase
    .from(MULTIPLAYER_SESSIONS_TABLE)
    .select("session_payload")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) {
    return { ok: false, reason: "fetch_failed", error, session: null };
  }

  return {
    ok: true,
    session: data?.session_payload ?? null,
  };
};

export const subscribeToRemoteMultiplayerSession = async (
  sessionId,
  onSession,
  onStatusChange = null
) => {
  if (!isBackendConfigured()) {
    return { ok: false, reason: "backend_not_configured", unsubscribe: () => {} };
  }

  if (!sessionId || typeof sessionId !== "string") {
    return { ok: false, reason: "missing_session_id", unsubscribe: () => {} };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, reason: "backend_not_configured", unsubscribe: () => {} };
  }

  const sessionResult = await ensureSupabaseSession();
  if (!sessionResult.ok) {
    return {
      ok: false,
      reason: sessionResult.reason ?? "auth_failed",
      error: sessionResult.error ?? null,
      unsubscribe: () => {},
    };
  }

  let refetchTimeoutId = null;
  let isFetching = false;
  let shouldRefetchAgain = false;

  const emitLatestSession = async () => {
    if (isFetching) {
      shouldRefetchAgain = true;
      return;
    }

    isFetching = true;
    console.log("[multiplayer-realtime] refetching latest session", {
      sessionId,
    });
    try {
      const latestSessionResult = await loadRemoteMultiplayerSession(sessionId);
      if (
        latestSessionResult.ok &&
        latestSessionResult.session &&
        typeof onSession === "function"
      ) {
        console.log("[multiplayer-realtime] received latest session", {
          sessionId,
          boardRevision: latestSessionResult.session.boardRevision ?? 0,
          savedAt: latestSessionResult.session.savedAt ?? null,
        });
        onSession(latestSessionResult.session);
      }
    } finally {
      isFetching = false;
      if (shouldRefetchAgain) {
        shouldRefetchAgain = false;
        void emitLatestSession();
      }
    }
  };

  const scheduleEmitLatestSession = () => {
    if (refetchTimeoutId != null) {
      return;
    }

    refetchTimeoutId = setTimeout(() => {
      refetchTimeoutId = null;
      void emitLatestSession();
    }, SESSION_UPDATE_DEBOUNCE_MS);
  };

  console.log("[multiplayer-realtime] starting session subscription", {
    sessionId,
  });
  const channel = supabase
    .channel(getMultiplayerSessionChannelName(sessionId))
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: MULTIPLAYER_SESSIONS_TABLE,
        filter: `session_id=eq.${sessionId}`,
      },
      () => {
        console.log("[multiplayer-realtime] postgres change received", {
          sessionId,
        });
        scheduleEmitLatestSession();
      }
    )
    .subscribe((status) => {
      console.log("[multiplayer-realtime] channel status", {
        sessionId,
        status,
      });
      onStatusChange?.(status);
      if (status === "SUBSCRIBED") {
        scheduleEmitLatestSession();
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn(
          "Multiplayer session realtime subscription failed",
          sessionId,
          status
        );
      }
    });

  return {
    ok: true,
    unsubscribe: () => {
      console.log("[multiplayer-realtime] removing session subscription", {
        sessionId,
      });
      if (refetchTimeoutId != null) {
        clearTimeout(refetchTimeoutId);
      }
      supabase.removeChannel(channel);
    },
  };
};

const saveRemoteMultiplayerSessionSnapshot = async (session) => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, reason: "backend_not_configured", session: null };
  }

  console.log("[multiplayer-realtime] saving remote session", {
    sessionId: session.sessionId,
    boardRevision: session.boardRevision ?? 0,
    activePlayerId: session.turn?.activePlayerId ?? null,
  });
  const row = buildSessionRow(session);
  const { data, error } = await supabase
    .from(MULTIPLAYER_SESSIONS_TABLE)
    .upsert(row, { onConflict: "session_id" })
    .select("session_payload")
    .single();

  if (error) {
    return { ok: false, reason: "write_failed", error, session: null };
  }

  return {
    ok: true,
    session: data?.session_payload ?? session,
  };
};

export const saveRemoteMultiplayerSession = async (session) => {
  if (!isBackendConfigured()) {
    return { ok: false, reason: "backend_not_configured", session: null };
  }

  if (!session?.sessionId) {
    return { ok: false, reason: "invalid_session", session: null };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, reason: "backend_not_configured", session: null };
  }

  const sessionResult = await ensureSupabaseSession();
  if (!sessionResult.ok) {
    return {
      ok: false,
      reason: sessionResult.reason ?? "auth_failed",
      error: sessionResult.error ?? null,
      session: null,
    };
  }

  return saveRemoteMultiplayerSessionSnapshot(session);
};

export const commitRemoteMultiplayerTurn = async ({
  sessionId,
  expectedRevision,
  action,
  nextSession,
}) => {
  if (!isBackendConfigured()) {
    return { ok: false, reason: "backend_not_configured", session: null };
  }

  if (
    !sessionId ||
    typeof sessionId !== "string" ||
    !Number.isInteger(expectedRevision) ||
    !action ||
    !nextSession
  ) {
    return { ok: false, reason: "invalid_payload", session: null };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, reason: "backend_not_configured", session: null };
  }

  const sessionResult = await ensureSupabaseSession();
  if (!sessionResult.ok) {
    return {
      ok: false,
      reason: sessionResult.reason ?? "auth_failed",
      error: sessionResult.error ?? null,
      session: null,
    };
  }

  const { data, error } = await supabase.rpc("multiplayer_commit_turn", {
    p_session_id: sessionId,
    p_expected_revision: expectedRevision,
    p_action: action,
    p_session_payload: nextSession,
  });

  if (error) {
    return { ok: false, reason: "rpc_failed", error, session: null };
  }

  if (!data?.ok) {
    return {
      ok: false,
      reason: data?.reason ?? "commit_failed",
      session: data?.session ?? null,
      currentRevision:
        typeof data?.current_revision === "number" ? data.current_revision : null,
      status: data?.status ?? null,
      activePlayerId: data?.active_player_id ?? null,
    };
  }

  return {
    ok: true,
    session: data.session ?? null,
  };
};

export const archiveRemoteMultiplayerSession = async (sessionId) => {
  const loadedSession = await loadRemoteMultiplayerSession(sessionId);
  if (!loadedSession.ok) {
    return loadedSession;
  }

  if (!loadedSession.session) {
    return { ok: true, session: null };
  }

  const archivedSession = {
    ...loadedSession.session,
    status: "archived",
    savedAt: Date.now(),
  };

  return saveRemoteMultiplayerSession(archivedSession);
};
