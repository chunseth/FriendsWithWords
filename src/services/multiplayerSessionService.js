import { ensureSupabaseSession, getSupabaseClient } from "../lib/supabase";
import { isBackendConfigured } from "../config/backend";

const MULTIPLAYER_SESSIONS_TABLE = "multiplayer_sessions";
const getMultiplayerSessionChannelName = (sessionId) =>
  `multiplayer-session:${sessionId}`;
const hasRealtimeBroadcastEncodingSupport = () =>
  typeof globalThis?.TextEncoder === "function" &&
  typeof globalThis?.TextDecoder === "function";

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

  const emitLatestSession = async () => {
    console.log("[multiplayer-realtime] refetching latest session", {
      sessionId,
    });
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
      return;
    }
  };

  console.log("[multiplayer-realtime] starting session subscription", {
    sessionId,
  });
  const channel = supabase
    .channel(getMultiplayerSessionChannelName(sessionId))
    .on(
      "broadcast",
      { event: "session_updated" },
      async (payload) => {
        if (payload?.payload?.sessionId !== sessionId) {
          return;
        }
        console.log("[multiplayer-realtime] broadcast update received", {
          sessionId,
          boardRevision: payload?.payload?.boardRevision ?? null,
        });
        await emitLatestSession();
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: MULTIPLAYER_SESSIONS_TABLE,
        filter: `session_id=eq.${sessionId}`,
      },
      async () => {
        console.log("[multiplayer-realtime] postgres change received", {
          sessionId,
        });
        await emitLatestSession();
      }
    )
    .subscribe((status) => {
      console.log("[multiplayer-realtime] channel status", {
        sessionId,
        status,
      });
      onStatusChange?.(status);
      if (status === "SUBSCRIBED") {
        void emitLatestSession();
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
      supabase.removeChannel(channel);
    },
  };
};

const broadcastRemoteMultiplayerSessionUpdate = async ({
  sessionId,
  boardRevision,
}) => {
  const supabase = getSupabaseClient();
  if (!supabase || !sessionId || !hasRealtimeBroadcastEncodingSupport()) {
    return;
  }

  console.log("[multiplayer-realtime] broadcasting session update", {
    sessionId,
    boardRevision,
  });
  const channel = supabase.channel(getMultiplayerSessionChannelName(sessionId));

  await new Promise((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      supabase.removeChannel(channel);
      resolve();
    };

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        try {
          await channel.send({
            type: "broadcast",
            event: "session_updated",
            payload: {
              sessionId,
              boardRevision,
            },
          });
        } catch (error) {
          console.warn(
            "Failed to broadcast multiplayer session update",
            sessionId,
            error
          );
        }
        finish();
        return;
      }

      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        finish();
      }
    });
  });
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

  await broadcastRemoteMultiplayerSessionUpdate({
    sessionId: session.sessionId,
    boardRevision: session.boardRevision ?? 0,
  });

  return {
    ok: true,
    session: data?.session_payload ?? session,
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
