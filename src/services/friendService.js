import { isBackendConfigured } from "../config/backend";
import { ensureSupabaseSession, getSupabaseClient } from "../lib/supabase";

const FRIENDS_TABLE = "friends";
const FRIEND_REQUESTS_TABLE = "friend_requests";
const PROFILES_TABLE = "profiles";

const getSupabaseAuthUserId = async () => {
  if (!isBackendConfigured()) {
    return { ok: false, reason: "backend_not_configured", userId: null };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, reason: "backend_not_configured", userId: null };
  }

  const sessionResult = await ensureSupabaseSession();
  if (!sessionResult.ok) {
    return {
      ok: false,
      reason: sessionResult.reason ?? "auth_failed",
      error: sessionResult.error ?? null,
      userId: null,
      supabase,
    };
  }

  return {
    ok: true,
    userId: sessionResult.session?.user?.id ?? null,
    supabase,
  };
};

const buildFriendPair = (leftPlayerId, rightPlayerId) => {
  if (!leftPlayerId || !rightPlayerId) {
    return null;
  }

  return leftPlayerId < rightPlayerId
    ? { player_low_id: leftPlayerId, player_high_id: rightPlayerId }
    : { player_low_id: rightPlayerId, player_high_id: leftPlayerId };
};

const loadProfilesByIds = async (supabase, ids) => {
  if (!ids.length) {
    return new Map();
  }

  const { data, error } = await supabase
    .from(PROFILES_TABLE)
    .select("id, username, display_name")
    .in("id", ids);

  if (error) {
    throw error;
  }

  return new Map(
    (data ?? []).map((profile) => [
      profile.id,
      {
        id: profile.id,
        username: profile.username,
        displayName: profile.display_name,
      },
    ])
  );
};

export const loadFriendState = async () => {
  const authResult = await getSupabaseAuthUserId();
  if (!authResult.ok || !authResult.userId || !authResult.supabase) {
    return {
      ok: false,
      reason: authResult.reason ?? "auth_failed",
      error: authResult.error ?? null,
      errorMessage: "Could not load friends right now.",
      friends: [],
      incomingRequests: [],
      outgoingRequests: [],
    };
  }

  const { supabase, userId } = authResult;

  try {
    const [{ data: friendRows, error: friendError }, { data: requestRows, error: requestError }] =
      await Promise.all([
        supabase
          .from(FRIENDS_TABLE)
          .select("id, player_low_id, player_high_id, created_at")
          .or(`player_low_id.eq.${userId},player_high_id.eq.${userId}`)
          .order("created_at", { ascending: false }),
        supabase
          .from(FRIEND_REQUESTS_TABLE)
          .select("id, sender_id, receiver_id, status, created_at, updated_at")
          .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
          .order("updated_at", { ascending: false }),
      ]);

    if (friendError) {
      throw friendError;
    }

    if (requestError) {
      throw requestError;
    }

    const profileIds = new Set();

    (friendRows ?? []).forEach((row) => {
      const friendId =
        row.player_low_id === userId ? row.player_high_id : row.player_low_id;
      if (friendId) {
        profileIds.add(friendId);
      }
    });

    (requestRows ?? []).forEach((row) => {
      const otherId = row.sender_id === userId ? row.receiver_id : row.sender_id;
      if (otherId) {
        profileIds.add(otherId);
      }
    });

    const profileMap = await loadProfilesByIds(supabase, Array.from(profileIds));

    const friends = (friendRows ?? [])
      .map((row) => {
        const friendId =
          row.player_low_id === userId ? row.player_high_id : row.player_low_id;
        const profile = profileMap.get(friendId);
        if (!profile) {
          return null;
        }
        return {
          id: friendId,
          name: profile.username,
          displayName: profile.displayName,
          friendshipId: row.id,
        };
      })
      .filter(Boolean);

    const incomingRequests = (requestRows ?? [])
      .filter(
        (row) => row.status === "pending" && row.receiver_id === userId
      )
      .map((row) => {
        const profile = profileMap.get(row.sender_id);
        if (!profile) {
          return null;
        }
        return {
          id: row.id,
          senderId: row.sender_id,
          name: profile.username,
          displayName: profile.displayName,
        };
      })
      .filter(Boolean);

    const outgoingRequests = (requestRows ?? [])
      .filter((row) => row.status === "pending" && row.sender_id === userId)
      .map((row) => {
        const profile = profileMap.get(row.receiver_id);
        if (!profile) {
          return null;
        }
        return {
          id: row.id,
          receiverId: row.receiver_id,
          name: profile.username,
          displayName: profile.displayName,
        };
      })
      .filter(Boolean);

    return {
      ok: true,
      friends,
      incomingRequests,
      outgoingRequests,
    };
  } catch (error) {
    return {
      ok: false,
      reason: "load_failed",
      error,
      errorMessage: "Could not load friends right now.",
      friends: [],
      incomingRequests: [],
      outgoingRequests: [],
    };
  }
};

export const sendFriendRequest = async (receiverId) => {
  const authResult = await getSupabaseAuthUserId();
  if (!authResult.ok || !authResult.userId || !authResult.supabase) {
    return {
      ok: false,
      reason: authResult.reason ?? "auth_failed",
      error: authResult.error ?? null,
      errorMessage: "Could not send that friend request.",
    };
  }

  const { supabase, userId } = authResult;
  if (!receiverId || receiverId === userId) {
    return {
      ok: false,
      reason: "invalid_receiver",
      errorMessage: "Could not send that friend request.",
    };
  }

  const pair = buildFriendPair(userId, receiverId);

  const { data: existingFriends, error: existingFriendsError } = await supabase
    .from(FRIENDS_TABLE)
    .select("id")
    .match(pair)
    .maybeSingle();

  if (existingFriendsError) {
    return {
      ok: false,
      reason: "lookup_failed",
      error: existingFriendsError,
      errorMessage: "Could not send that friend request.",
    };
  }

  if (existingFriends?.id) {
    return { ok: true, reason: "already_friends" };
  }

  const { data: existingRequests, error: existingRequestsError } =
    await supabase
      .from(FRIEND_REQUESTS_TABLE)
      .select("id, sender_id, receiver_id, status")
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${userId})`);

  if (existingRequestsError) {
    return {
      ok: false,
      reason: "lookup_failed",
      error: existingRequestsError,
      errorMessage: "Could not send that friend request.",
    };
  }

  const pendingRequest = (existingRequests ?? []).find(
    (request) => request.status === "pending"
  );

  if (pendingRequest?.sender_id === receiverId) {
    return { ok: false, reason: "incoming_request_exists", errorMessage: "This user already sent you a friend request." };
  }

  if (pendingRequest?.sender_id === userId) {
    return { ok: true, reason: "already_pending" };
  }

  const { error } = await supabase.from(FRIEND_REQUESTS_TABLE).insert({
    sender_id: userId,
    receiver_id: receiverId,
    status: "pending",
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return {
      ok: false,
      reason: "write_failed",
      error,
      errorMessage: "Could not send that friend request.",
    };
  }

  return { ok: true, reason: "request_sent" };
};

export const acceptFriendRequest = async (requestId, senderId) => {
  const authResult = await getSupabaseAuthUserId();
  if (!authResult.ok || !authResult.userId || !authResult.supabase) {
    return {
      ok: false,
      reason: authResult.reason ?? "auth_failed",
      error: authResult.error ?? null,
      errorMessage: "Could not accept that friend request.",
    };
  }

  const { supabase, userId } = authResult;
  const pair = buildFriendPair(userId, senderId);
  const timestamp = new Date().toISOString();

  const { error: updateError } = await supabase
    .from(FRIEND_REQUESTS_TABLE)
    .update({
      status: "accepted",
      responded_at: timestamp,
      updated_at: timestamp,
    })
    .eq("id", requestId)
    .eq("receiver_id", userId)
    .eq("sender_id", senderId)
    .eq("status", "pending");

  if (updateError) {
    return {
      ok: false,
      reason: "write_failed",
      error: updateError,
      errorMessage: "Could not accept that friend request.",
    };
  }

  const { error: insertError } = await supabase
    .from(FRIENDS_TABLE)
    .upsert(pair, { onConflict: "player_low_id,player_high_id" });

  if (insertError) {
    return {
      ok: false,
      reason: "write_failed",
      error: insertError,
      errorMessage: "Could not accept that friend request.",
    };
  }

  return { ok: true, reason: "request_accepted" };
};

export const declineFriendRequest = async (requestId, senderId) => {
  const authResult = await getSupabaseAuthUserId();
  if (!authResult.ok || !authResult.userId || !authResult.supabase) {
    return {
      ok: false,
      reason: authResult.reason ?? "auth_failed",
      error: authResult.error ?? null,
      errorMessage: "Could not decline that friend request.",
    };
  }

  const { supabase, userId } = authResult;
  const timestamp = new Date().toISOString();

  const { error } = await supabase
    .from(FRIEND_REQUESTS_TABLE)
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
      errorMessage: "Could not decline that friend request.",
    };
  }

  return { ok: true, reason: "request_declined" };
};

export const removeFriend = async (friendId) => {
  const authResult = await getSupabaseAuthUserId();
  if (!authResult.ok || !authResult.userId || !authResult.supabase) {
    return {
      ok: false,
      reason: authResult.reason ?? "auth_failed",
      error: authResult.error ?? null,
      errorMessage: "Could not remove that friend.",
    };
  }

  const { supabase, userId } = authResult;
  const pair = buildFriendPair(userId, friendId);

  if (!pair) {
    return {
      ok: false,
      reason: "invalid_friend",
      errorMessage: "Could not remove that friend.",
    };
  }

  const { error } = await supabase.from(FRIENDS_TABLE).delete().match(pair);

  if (error) {
    return {
      ok: false,
      reason: "write_failed",
      error,
      errorMessage: "Could not remove that friend.",
    };
  }

  return { ok: true, reason: "friend_removed" };
};
