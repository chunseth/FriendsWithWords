import { ensureSupabaseSession, getSupabaseClient } from "../lib/supabase";
import { isBackendConfigured } from "../config/backend";
import { createInitialSession } from "../hooks/useAsyncCoopSession";
import {
  archiveRemoteMultiplayerSession,
} from "./multiplayerSessionService";

const GAME_REQUESTS_TABLE = "multiplayer_game_requests";
const PROFILES_TABLE = "profiles";
const SESSIONS_TABLE = "multiplayer_sessions";
const SESSION_USER_STATE_TABLE = "multiplayer_user_session_state";
const PRESENCE_TABLE = "user_presence";
const FALLBACK_ACTOR_LABEL = "A friend";

const resolveProfileLabelById = async (supabase, playerId) => {
  if (!supabase || !playerId) {
    return FALLBACK_ACTOR_LABEL;
  }

  try {
    const { data, error } = await supabase
      .from(PROFILES_TABLE)
      .select("username, display_name")
      .eq("id", playerId)
      .maybeSingle();
    if (error) {
      return FALLBACK_ACTOR_LABEL;
    }
    return data?.username ?? data?.display_name ?? FALLBACK_ACTOR_LABEL;
  } catch (_error) {
    return FALLBACK_ACTOR_LABEL;
  }
};

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

const buildRequestSummary = ({
  request,
  otherProfile,
  currentUserId,
  sessionRow = null,
  sessionUserStateRow = null,
  presenceRow = null,
}) => ({
  id: request.id,
  direction: request.sender_id === currentUserId ? "outgoing" : "incoming",
  friendId: otherProfile?.id ?? null,
  friendName: otherProfile?.username ?? "Unknown",
  friendDisplayName: otherProfile?.display_name ?? null,
  seed: request.seed,
  gameType: request.game_type,
  status: request.status,
  sessionId: request.session_id ?? null,
  archived:
    request.status === "accepted"
      ? (sessionRow?.status ?? "active") === "archived"
      : false,
  hasUnreadSessionUpdate:
    request.status === "accepted" &&
    typeof sessionRow?.board_revision === "number"
      ? sessionRow.board_revision >
        (sessionUserStateRow?.last_seen_revision ?? 0)
      : false,
  needsAction:
    (request.status === "pending" && request.receiver_id === currentUserId) ||
    (request.status === "accepted" &&
      sessionRow?.active_player_id === currentUserId &&
      (sessionRow?.status ?? "active") === "active"),
  presenceStatus: presenceRow?.status ?? null,
  presenceLastActiveAt: presenceRow?.last_active_at ?? null,
  createdAt: request.created_at,
  updatedAt: request.updated_at,
  completedAt:
    request.status === "accepted" && (sessionRow?.status ?? "active") === "archived"
      ? sessionRow?.saved_at ?? request.updated_at
      : null,
  summary:
    request.status === "pending"
      ? request.sender_id === currentUserId
        ? "Waiting for them to accept."
        : "Sent you a game request."
      : request.status === "accepted"
        ? "Ready to play."
        : "Request closed.",
});

export const loadMultiplayerGameRequests = async () => {
  const authContext = await getAuthContext();
  if (!authContext.ok) {
    return {
      ok: false,
      reason: authContext.reason ?? "auth_failed",
      error: authContext.error ?? null,
      errorMessage: "Could not load multiplayer games right now.",
      requests: [],
    };
  }

  const { supabase, userId } = authContext;

  const { data: requestRows, error: requestError } = await supabase
    .from(GAME_REQUESTS_TABLE)
    .select(
      "id, sender_id, receiver_id, game_type, seed, status, session_id, created_at, updated_at"
    )
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .in("status", ["pending", "accepted"])
    .order("updated_at", { ascending: false });

  if (requestError) {
    return {
      ok: false,
      reason: "fetch_failed",
      error: requestError,
      errorMessage: "Could not load multiplayer games right now.",
      requests: [],
    };
  }

  const otherIds = Array.from(
    new Set(
      (requestRows ?? []).map((request) =>
        request.sender_id === userId ? request.receiver_id : request.sender_id
      )
    )
  ).filter(Boolean);

  const { data: profiles, error: profilesError } = await supabase
    .from(PROFILES_TABLE)
    .select("id, username, display_name")
    .in("id", otherIds);

  if (profilesError) {
    return {
      ok: false,
      reason: "fetch_failed",
      error: profilesError,
      errorMessage: "Could not load multiplayer games right now.",
      requests: [],
    };
  }

  const profileMap = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile])
  );

  const acceptedSessionIds = Array.from(
    new Set(
      (requestRows ?? [])
        .filter((request) => request.status === "accepted" && request.session_id)
        .map((request) => request.session_id)
    )
  );

  let sessionMap = new Map();
  if (acceptedSessionIds.length > 0) {
    const { data: sessions, error: sessionsError } = await supabase
      .from(SESSIONS_TABLE)
      .select("session_id, board_revision, active_player_id, status, saved_at")
      .in("session_id", acceptedSessionIds);

    if (sessionsError) {
      return {
        ok: false,
        reason: "fetch_failed",
        error: sessionsError,
        errorMessage: "Could not load multiplayer games right now.",
        requests: [],
      };
    }

    sessionMap = new Map((sessions ?? []).map((session) => [session.session_id, session]));
  }

  let sessionUserStateMap = new Map();
  if (acceptedSessionIds.length > 0) {
    const { data: sessionStates, error: sessionStatesError } = await supabase
      .from(SESSION_USER_STATE_TABLE)
      .select("session_id, last_seen_revision")
      .eq("user_id", userId)
      .in("session_id", acceptedSessionIds);

    if (sessionStatesError) {
      return {
        ok: false,
        reason: "fetch_failed",
        error: sessionStatesError,
        errorMessage: "Could not load multiplayer games right now.",
        requests: [],
      };
    }

    sessionUserStateMap = new Map(
      (sessionStates ?? []).map((entry) => [entry.session_id, entry])
    );
  }

  let presenceMap = new Map();
  if (otherIds.length > 0) {
    const { data: presenceRows, error: presenceError } = await supabase
      .from(PRESENCE_TABLE)
      .select("user_id, status, last_active_at")
      .in("user_id", otherIds);

    if (!presenceError) {
      presenceMap = new Map(
        (presenceRows ?? []).map((entry) => [entry.user_id, entry])
      );
    }
  }

  return {
    ok: true,
    requests: (requestRows ?? []).map((request) => {
      const otherId =
        request.sender_id === userId ? request.receiver_id : request.sender_id;
      return buildRequestSummary({
        request,
        otherProfile: profileMap.get(otherId),
        currentUserId: userId,
        sessionRow: sessionMap.get(request.session_id ?? ""),
        sessionUserStateRow: sessionUserStateMap.get(request.session_id ?? ""),
        presenceRow: presenceMap.get(otherId) ?? null,
      });
    }),
  };
};

export const sendMultiplayerGameRequest = async ({
  receiverId,
  gameType,
  seed,
}) => {
  const authContext = await getAuthContext();
  if (!authContext.ok) {
    return {
      ok: false,
      reason: authContext.reason ?? "auth_failed",
      error: authContext.error ?? null,
      errorMessage: "Could not send that game request.",
    };
  }

  const { supabase, userId } = authContext;

  if (!receiverId || receiverId === userId || !seed || !gameType) {
    return {
      ok: false,
      reason: "invalid_payload",
      errorMessage: "Could not send that game request.",
    };
  }

  const { data: existingPending, error: lookupError } = await supabase
    .from(GAME_REQUESTS_TABLE)
    .select("id")
    .eq("sender_id", userId)
    .eq("receiver_id", receiverId)
    .eq("status", "pending")
    .eq("seed", seed)
    .eq("game_type", gameType)
    .maybeSingle();

  if (lookupError) {
    return {
      ok: false,
      reason: "lookup_failed",
      error: lookupError,
      errorMessage: "Could not send that game request.",
    };
  }

  if (existingPending?.id) {
    return { ok: true, reason: "already_pending", requestId: existingPending.id };
  }

  const { data, error } = await supabase
    .from(GAME_REQUESTS_TABLE)
    .insert({
      sender_id: userId,
      receiver_id: receiverId,
      game_type: gameType,
      seed,
      status: "pending",
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    return {
      ok: false,
      reason: "write_failed",
      error,
      errorMessage: "Could not send that game request.",
    };
  }

  const requestId = data?.id ?? null;
  const actorLabel = await resolveProfileLabelById(supabase, userId);
  if (supabase?.functions?.invoke && requestId) {
    const notifyResult = await supabase.functions.invoke("notify-multiplayer-event", {
      body: {
        user_id: receiverId,
        type: "game_request",
        entity_id: requestId,
        payload: {
          requestId,
          friendId: userId,
          actorLabel,
          route: "multiplayer-menu",
          version: 1,
        },
        title: "Game request",
        body: `${actorLabel} sent you a game request.`,
        send_push: true,
        skip_enqueue: true,
      },
    });
    if (notifyResult?.error) {
      console.warn("[multiplayer-push] game request notify invoke failed", {
        requestId,
        receiverId,
        error: notifyResult.error?.message ?? "unknown_error",
      });
    }
  }

  return { ok: true, reason: "request_sent", requestId };
};

export const acceptMultiplayerGameRequest = async ({
  requestId,
  senderId,
  senderUsername,
  senderDisplayName,
  receiverUsername,
  receiverDisplayName,
  seed,
  gameType = "seeded",
}) => {
  const authContext = await getAuthContext();
  if (!authContext.ok) {
    return {
      ok: false,
      reason: authContext.reason ?? "auth_failed",
      error: authContext.error ?? null,
      errorMessage: "Could not accept that game request.",
    };
  }

  const { supabase, userId } = authContext;
  const sessionId = `mp_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;

  const participantIds = [senderId, userId].filter(Boolean);
  let profileMap = new Map();
  if (participantIds.length > 0) {
    const { data: profiles } = await supabase
      .from(PROFILES_TABLE)
      .select("id, username, display_name")
      .in("id", participantIds);

    profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  }

  const senderProfile = profileMap.get(senderId);
  const receiverProfile = profileMap.get(userId);

  const session = createInitialSession({
    seed,
    sessionId,
    gameType,
    players: [
      {
        id: senderId,
        username: senderUsername ?? senderProfile?.username ?? null,
        displayName:
          senderDisplayName ?? senderProfile?.display_name ?? "Player 1",
      },
      {
        id: userId,
        username: receiverUsername ?? receiverProfile?.username ?? null,
        displayName:
          receiverDisplayName ?? receiverProfile?.display_name ?? "Player 2",
      },
    ],
  });

  const participantPlayerIds = Array.isArray(session.players)
    ? session.players.map((player) => player.id).filter(Boolean)
    : [];

  const { data, error } = await supabase.rpc("accept_multiplayer_game_request", {
    p_request_id: requestId,
    p_session_id: sessionId,
    p_mode_id: session.modeId,
    p_seed: seed,
    p_game_type: gameType,
    p_active_player_id: session.turn?.activePlayerId ?? senderId ?? null,
    p_participant_player_ids: participantPlayerIds,
    p_session_payload: session,
  });

  if (error) {
    return {
      ok: false,
      reason: "rpc_failed",
      error,
      errorMessage: "Could not accept that game request.",
    };
  }

  if (!data?.ok) {
    return {
      ok: false,
      reason: data?.reason ?? "request_accept_failed",
      error: data ?? null,
      errorMessage: "Could not accept that game request.",
    };
  }

  const acceptedSessionId = data?.session_id ?? sessionId;
  const actorLabel =
    receiverUsername ??
    receiverDisplayName ??
    receiverProfile?.username ??
    receiverProfile?.display_name ??
    "Your friend";
  const pushPayload = {
    requestId,
    sessionId: acceptedSessionId,
    friendId: userId,
    actorLabel,
    route: "multiplayer",
    version: 1,
  };

  if (supabase?.functions?.invoke) {
    const notifyResult = await supabase.functions.invoke("notify-multiplayer-event", {
      body: {
        user_id: senderId,
        type: "request_accepted",
        entity_id: acceptedSessionId,
        payload: pushPayload,
        title: "Game request accepted",
        body: `${actorLabel} accepted your game request.`,
        send_push: true,
        skip_enqueue: true,
      },
    });

    if (notifyResult?.error) {
      console.warn("[multiplayer-push] request accepted notify invoke failed", {
        requestId,
        senderId,
        sessionId: acceptedSessionId,
        error: notifyResult.error?.message ?? "unknown_error",
      });
    }
  }

  return {
    ok: true,
    reason: data?.reason ?? "request_accepted",
    sessionId: acceptedSessionId,
  };
};

export const declineMultiplayerGameRequest = async ({ requestId, senderId }) => {
  const authContext = await getAuthContext();
  if (!authContext.ok) {
    return {
      ok: false,
      reason: authContext.reason ?? "auth_failed",
      error: authContext.error ?? null,
      errorMessage: "Could not decline that game request.",
    };
  }

  const { supabase, userId } = authContext;
  const timestamp = new Date().toISOString();

  const { error } = await supabase
    .from(GAME_REQUESTS_TABLE)
    .update({
      status: "declined",
      responded_at: timestamp,
      updated_at: timestamp,
    })
    .eq("id", requestId)
    .eq("receiver_id", userId)
    .eq("sender_id", senderId)
    .eq("status", "pending");

  if (error) {
    return {
      ok: false,
      reason: "write_failed",
      error,
      errorMessage: "Could not decline that game request.",
    };
  }

  return { ok: true, reason: "request_declined" };
};

export const cancelMultiplayerGameRequest = async ({
  requestId,
  receiverId,
}) => {
  const authContext = await getAuthContext();
  if (!authContext.ok) {
    return {
      ok: false,
      reason: authContext.reason ?? "auth_failed",
      error: authContext.error ?? null,
      errorMessage: "Could not unsend that game request.",
    };
  }

  const { supabase, userId } = authContext;
  const timestamp = new Date().toISOString();

  const { error } = await supabase
    .from(GAME_REQUESTS_TABLE)
    .update({
      status: "canceled",
      responded_at: timestamp,
      updated_at: timestamp,
    })
    .eq("id", requestId)
    .eq("sender_id", userId)
    .eq("receiver_id", receiverId)
    .eq("status", "pending");

  if (error) {
    return {
      ok: false,
      reason: "write_failed",
      error,
      errorMessage: "Could not unsend that game request.",
    };
  }

  return { ok: true, reason: "request_canceled" };
};

export const deleteAcceptedMultiplayerGame = async ({
  requestId,
  sessionId,
}) => {
  const authContext = await getAuthContext();
  if (!authContext.ok) {
    return {
      ok: false,
      reason: authContext.reason ?? "auth_failed",
      error: authContext.error ?? null,
      errorMessage: "Could not delete that multiplayer game.",
    };
  }

  const { supabase, userId } = authContext;
  const timestamp = new Date().toISOString();

  const { error } = await supabase
    .from(GAME_REQUESTS_TABLE)
    .update({
      status: "canceled",
      updated_at: timestamp,
      responded_at: timestamp,
    })
    .eq("id", requestId)
    .eq("session_id", sessionId)
    .eq("status", "accepted")
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

  if (error) {
    return {
      ok: false,
      reason: "write_failed",
      error,
      errorMessage: "Could not delete that multiplayer game.",
    };
  }

  if (sessionId) {
    const archiveResult = await archiveRemoteMultiplayerSession(sessionId);
    if (!archiveResult.ok) {
      return {
        ok: false,
        reason: archiveResult.reason ?? "session_archive_failed",
        error: archiveResult.error ?? null,
        errorMessage: "Could not delete that multiplayer game.",
      };
    }
  }

  return { ok: true, reason: "game_deleted" };
};
