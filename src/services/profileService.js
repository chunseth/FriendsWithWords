import { isBackendConfigured } from "../config/backend";
import { ensureSupabaseSession, getSupabaseClient } from "../lib/supabase";
import { validatePlayerDisplayName } from "../utils/playerProfile";

const PROFILES_TABLE = "profiles";

const USERNAME_TAKEN_MESSAGE = "That username is already taken.";

export const searchProfilesByUsername = async (username) => {
  const trimmedUsername =
    typeof username === "string" ? username.trim() : "";

  const validationError = validatePlayerDisplayName(trimmedUsername);
  if (validationError) {
    return {
      ok: false,
      reason: "invalid_username",
      errorMessage: validationError,
      profiles: [],
    };
  }

  if (!isBackendConfigured()) {
    return {
      ok: false,
      reason: "backend_not_configured",
      errorMessage: "Friend search is unavailable right now.",
      profiles: [],
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      ok: false,
      reason: "backend_not_configured",
      errorMessage: "Friend search is unavailable right now.",
      profiles: [],
    };
  }

  const sessionResult = await ensureSupabaseSession();
  if (!sessionResult.ok) {
    return {
      ok: false,
      reason: sessionResult.reason ?? "auth_failed",
      error: sessionResult.error ?? null,
      errorMessage: "Could not search for users right now.",
      profiles: [],
    };
  }

  const authUserId = sessionResult.session?.user?.id ?? null;

  const { data, error } = await supabase
    .from(PROFILES_TABLE)
    .select("id, username, display_name")
    .ilike("username", trimmedUsername);

  if (error) {
    return {
      ok: false,
      reason: "search_failed",
      error,
      errorMessage: "Could not search for users right now.",
      profiles: [],
    };
  }

  return {
    ok: true,
    profiles: (data ?? [])
      .filter((profile) => profile?.id && profile.id !== authUserId)
      .map((profile) => ({
        id: profile.id,
        username: profile.username,
        displayName: profile.display_name,
      })),
  };
};

export const saveRemotePlayerProfile = async ({ username, displayName }) => {
  const trimmedUsername =
    typeof username === "string" ? username.trim() : "";
  const trimmedDisplayName =
    typeof displayName === "string" ? displayName.trim() : trimmedUsername;

  const validationError = validatePlayerDisplayName(trimmedUsername);
  if (validationError) {
    return {
      ok: false,
      reason: "invalid_username",
      errorMessage: validationError,
    };
  }

  if (!isBackendConfigured()) {
    return { ok: true, reason: "backend_not_configured" };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: true, reason: "backend_not_configured" };
  }

  const sessionResult = await ensureSupabaseSession();
  if (!sessionResult.ok) {
    return {
      ok: false,
      reason: sessionResult.reason ?? "auth_failed",
      error: sessionResult.error ?? null,
      errorMessage: "Could not connect your username to Supabase.",
    };
  }

  const authUserId = sessionResult.session?.user?.id;
  if (!authUserId) {
    return {
      ok: false,
      reason: "auth_failed",
      errorMessage: "Could not connect your username to Supabase.",
    };
  }

  const { data: existingProfiles, error: existingProfilesError } =
    await supabase
      .from(PROFILES_TABLE)
      .select("id, username")
      .ilike("username", trimmedUsername);

  if (existingProfilesError) {
    return {
      ok: false,
      reason: "lookup_failed",
      error: existingProfilesError,
      errorMessage: "Could not verify that username right now.",
    };
  }

  const matchingProfile = (existingProfiles ?? []).find(
    (profile) => profile?.id !== authUserId
  );

  if (matchingProfile) {
    return {
      ok: false,
      reason: "username_taken",
      errorMessage: USERNAME_TAKEN_MESSAGE,
    };
  }

  const { data, error } = await supabase
    .from(PROFILES_TABLE)
    .upsert(
      {
        id: authUserId,
        username: trimmedUsername,
        display_name: trimmedDisplayName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    )
    .select("id, username, display_name")
    .single();

  if (error) {
    const normalizedMessage =
      typeof error.message === "string" ? error.message.toLowerCase() : "";

    return {
      ok: false,
      reason: normalizedMessage.includes("duplicate")
        ? "username_taken"
        : "write_failed",
      error,
      errorMessage: normalizedMessage.includes("duplicate")
        ? USERNAME_TAKEN_MESSAGE
        : "Could not save your username right now.",
    };
  }

  return {
    ok: true,
    reason: "profile_saved",
    profile: {
      id: data?.id ?? authUserId,
      username: data?.username ?? trimmedUsername,
      displayName: data?.display_name ?? trimmedDisplayName,
    },
  };
};
