import { ensureSupabaseSession, getSupabaseClient } from "../lib/supabase";
import { isBackendConfigured } from "../config/backend";
import { createInitialSession } from "../hooks/useAsyncCoopSession";
import {
  archiveRemoteMultiplayerSession,
  saveRemoteMultiplayerSession,
} from "./multiplayerSessionService";

const GAME_REQUESTS_TABLE = "multiplayer_game_requests";
const PROFILES_TABLE = "profiles";

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
  createdAt: request.created_at,
  updatedAt: request.updated_at,
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

  return {
    ok: true,
    requests: (requestRows ?? []).map((request) => {
      const otherId =
        request.sender_id === userId ? request.receiver_id : request.sender_id;
      return buildRequestSummary({
        request,
        otherProfile: profileMap.get(otherId),
        currentUserId: userId,
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

  return { ok: true, reason: "request_sent", requestId: data?.id ?? null };
};

export const acceptMultiplayerGameRequest = async ({
  requestId,
  senderId,
  senderUsername,
  senderDisplayName,
  receiverUsername,
  receiverDisplayName,
  seed,
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
  const timestamp = new Date().toISOString();
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

  const saveSessionResult = await saveRemoteMultiplayerSession(session);
  if (!saveSessionResult.ok) {
    return {
      ok: false,
      reason: saveSessionResult.reason ?? "session_write_failed",
      error: saveSessionResult.error ?? null,
      errorMessage: "Could not accept that game request.",
    };
  }

  const { error } = await supabase
    .from(GAME_REQUESTS_TABLE)
    .update({
      status: "accepted",
      session_id: sessionId,
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
      errorMessage: "Could not accept that game request.",
    };
  }

  return { ok: true, reason: "request_accepted", sessionId };
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
