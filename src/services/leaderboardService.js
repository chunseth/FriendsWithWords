import { ensureSupabaseSession, getSupabaseClient } from "../lib/supabase";
import { isBackendConfigured } from "../config/backend";
import { loadOrCreatePlayerProfile } from "../utils/playerProfile";

const SCORES_TABLE = "scores";
export const LEADERBOARD_SCORE_MODE_SOLO = "solo";
export const LEADERBOARD_SCORE_MODE_MULTIPLAYER = "multiplayer";
export const LEADERBOARD_SCORE_MODE_MINI = "mini";

const normalizeScoreMode = (scoreMode) =>
  scoreMode === LEADERBOARD_SCORE_MODE_MULTIPLAYER ||
  scoreMode === LEADERBOARD_SCORE_MODE_MINI
    ? scoreMode
    : LEADERBOARD_SCORE_MODE_SOLO;

const dedupeBestScoresByPlayer = (entries, limit = null) => {
  if (!Array.isArray(entries) || entries.length === 0) {
    return [];
  }

  const uniqueEntries = [];
  const seenPlayerIds = new Set();

  for (const entry of entries) {
    const playerId = entry?.player_id;
    if (!playerId || seenPlayerIds.has(playerId)) {
      continue;
    }

    seenPlayerIds.add(playerId);
    uniqueEntries.push(entry);

    if (typeof limit === "number" && uniqueEntries.length >= limit) {
      break;
    }
  }

  return uniqueEntries;
};

export const submitCompletedScore = async ({
  seed,
  finalScore,
  finalScoreBreakdown,
  isDailySeed = false,
  scoreMode = LEADERBOARD_SCORE_MODE_SOLO,
  displayNameOverride = null,
}) => {
  if (!isBackendConfigured()) {
    return { ok: false, reason: "backend_not_configured" };
  }

  if (
    !seed ||
    typeof finalScore !== "number" ||
    !finalScoreBreakdown ||
    typeof finalScoreBreakdown.pointsEarned !== "number"
  ) {
    return { ok: false, reason: "invalid_payload" };
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

  const authUserId = sessionResult.session?.user?.id;
  if (!authUserId) {
    return { ok: false, reason: "auth_failed" };
  }

  const playerProfile = await loadOrCreatePlayerProfile();
  const resolvedDisplayName =
    typeof displayNameOverride === "string" && displayNameOverride.trim().length > 0
      ? displayNameOverride.trim()
      : playerProfile.displayName;
  const normalizedScoreMode = normalizeScoreMode(scoreMode);
  const scrabbleBonus = finalScoreBreakdown.scrabbleBonus ?? 0;
  const consistencyBonus = finalScoreBreakdown.consistencyBonusTotal ?? 0;
  const timeBonus =
    normalizedScoreMode === LEADERBOARD_SCORE_MODE_MULTIPLAYER
      ? 0
      : finalScoreBreakdown.timeBonus ?? 0;
  const perfectionBonus =
    normalizedScoreMode === LEADERBOARD_SCORE_MODE_MULTIPLAYER
      ? 0
      : finalScoreBreakdown.perfectionBonus ?? 0;
  const skillBonusTotal =
    normalizedScoreMode === LEADERBOARD_SCORE_MODE_MULTIPLAYER
      ? scrabbleBonus + consistencyBonus
      : finalScoreBreakdown.skillBonusTotal ??
        scrabbleBonus + timeBonus + perfectionBonus + consistencyBonus;

  const submission = {
    player_id: authUserId,
    display_name: resolvedDisplayName,
    seed,
    score_mode: normalizedScoreMode,
    is_daily_seed: isDailySeed,
    final_score: finalScore,
    points_earned: finalScoreBreakdown.pointsEarned,
    swap_penalties: finalScoreBreakdown.swapPenalties ?? 0,
    turn_penalties: finalScoreBreakdown.turnPenalties ?? 0,
    rack_penalty: finalScoreBreakdown.rackPenalty ?? 0,
    scrabble_bonus: scrabbleBonus,
    time_bonus: timeBonus,
    perfection_bonus: perfectionBonus,
    consistency_bonus: consistencyBonus,
    skill_bonus_total: skillBonusTotal,
    duration_seconds:
      typeof finalScoreBreakdown.durationSeconds === "number"
        ? finalScoreBreakdown.durationSeconds
        : null,
    invalid_word_attempts: finalScoreBreakdown.invalidWordAttempts ?? 0,
    completed_at: new Date().toISOString(),
  };

  const { data: existingScore, error: existingScoreError } = await supabase
    .from(SCORES_TABLE)
    .select("id, final_score")
    .eq("player_id", authUserId)
    .eq("seed", seed)
    .eq("score_mode", normalizedScoreMode)
    .maybeSingle();

  if (existingScoreError) {
    return { ok: false, reason: "lookup_failed", error: existingScoreError };
  }

  if (
    existingScore &&
    typeof existingScore.final_score === "number" &&
    existingScore.final_score >= finalScore
  ) {
    return { ok: true, reason: "existing_score_kept" };
  }

  let result;
  if (existingScore?.id) {
    result = await supabase
      .from(SCORES_TABLE)
      .update(submission)
      .eq("id", existingScore.id)
      .select("id")
      .single();
  } else {
    result = await supabase
      .from(SCORES_TABLE)
      .insert(submission)
      .select("id")
      .single();
  }

  if (result.error) {
    return { ok: false, reason: "write_failed", error: result.error };
  }

  return { ok: true, reason: "score_saved", id: result.data?.id ?? null };
};

export const fetchSeedLeaderboard = async (seed, limit = 25) => {
  if (!isBackendConfigured()) {
    return { ok: false, reason: "backend_not_configured", leaderboard: [] };
  }

  if (!seed) {
    return { ok: false, reason: "missing_seed", leaderboard: [] };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, reason: "backend_not_configured", leaderboard: [] };
  }

  const { data, error } = await supabase
    .from(SCORES_TABLE)
    .select(
      "display_name, seed, final_score, points_earned, swap_penalties, turn_penalties, rack_penalty, scrabble_bonus, time_bonus, perfection_bonus, consistency_bonus, skill_bonus_total, duration_seconds, invalid_word_attempts, completed_at"
    )
    .eq("seed", seed)
    .eq("score_mode", LEADERBOARD_SCORE_MODE_SOLO)
    .order("final_score", { ascending: false })
    .order("completed_at", { ascending: true })
    .limit(limit);

  if (error) {
    return { ok: false, reason: "fetch_failed", error, leaderboard: [] };
  }

  return { ok: true, leaderboard: data ?? [] };
};

export const fetchSeedLeaderboardByMode = async (
  seed,
  scoreMode = LEADERBOARD_SCORE_MODE_SOLO,
  limit = 25
) => {
  if (!isBackendConfigured()) {
    return { ok: false, reason: "backend_not_configured", leaderboard: [] };
  }

  if (!seed) {
    return { ok: false, reason: "missing_seed", leaderboard: [] };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, reason: "backend_not_configured", leaderboard: [] };
  }

  const normalizedScoreMode = normalizeScoreMode(scoreMode);
  const { data, error } = await supabase
    .from(SCORES_TABLE)
    .select(
      "display_name, seed, final_score, points_earned, swap_penalties, turn_penalties, rack_penalty, scrabble_bonus, time_bonus, perfection_bonus, consistency_bonus, skill_bonus_total, duration_seconds, invalid_word_attempts, completed_at"
    )
    .eq("seed", seed)
    .eq("score_mode", normalizedScoreMode)
    .order("final_score", { ascending: false })
    .order("completed_at", { ascending: true })
    .limit(limit);

  if (error) {
    return { ok: false, reason: "fetch_failed", error, leaderboard: [] };
  }

  return { ok: true, leaderboard: data ?? [] };
};

export const fetchGlobalLeaderboard = async (
  scoreMode = LEADERBOARD_SCORE_MODE_SOLO,
  limit = 100
) => {
  if (!isBackendConfigured()) {
    return { ok: false, reason: "backend_not_configured", leaderboard: [] };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, reason: "backend_not_configured", leaderboard: [] };
  }

  const normalizedScoreMode = normalizeScoreMode(scoreMode);
  const queryLimit = Math.max(limit * 5, 500);
  const { data, error } = await supabase
    .from(SCORES_TABLE)
    .select(
      "player_id, display_name, seed, is_daily_seed, final_score, points_earned, swap_penalties, turn_penalties, rack_penalty, scrabble_bonus, time_bonus, perfection_bonus, consistency_bonus, skill_bonus_total, duration_seconds, invalid_word_attempts, completed_at"
    )
    .eq("score_mode", normalizedScoreMode)
    .order("final_score", { ascending: false })
    .order("completed_at", { ascending: true })
    .limit(queryLimit);

  if (error) {
    return { ok: false, reason: "fetch_failed", error, leaderboard: [] };
  }

  return {
    ok: true,
    leaderboard: dedupeBestScoresByPlayer(data, limit),
  };
};

export const fetchPlayerHighScorePosition = async (
  playerId,
  scoreMode = LEADERBOARD_SCORE_MODE_SOLO
) => {
  if (!isBackendConfigured()) {
    return { ok: false, reason: "backend_not_configured", position: null };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, reason: "backend_not_configured", position: null };
  }

  const sessionResult = await ensureSupabaseSession();
  if (!sessionResult.ok) {
    return {
      ok: false,
      reason: sessionResult.reason ?? "auth_failed",
      error: sessionResult.error ?? null,
      position: null,
    };
  }

  const scopedPlayerId = sessionResult.session?.user?.id ?? playerId;
  if (!scopedPlayerId) {
    return { ok: false, reason: "missing_player_id", position: null };
  }

  const normalizedScoreMode = normalizeScoreMode(scoreMode);
  const { data, error } = await supabase
    .from(SCORES_TABLE)
    .select("player_id, final_score, completed_at")
    .eq("score_mode", normalizedScoreMode)
    .order("final_score", { ascending: false })
    .order("completed_at", { ascending: true })
    .limit(5000);

  if (error) {
    return {
      ok: false,
      reason: "fetch_failed",
      error,
      position: null,
    };
  }

  const rankedPlayers = dedupeBestScoresByPlayer(data);
  const foundIndex = rankedPlayers.findIndex(
    (entry) => entry?.player_id === scopedPlayerId
  );
  if (foundIndex === -1) {
    return { ok: true, position: null };
  }

  return { ok: true, position: foundIndex + 1 };
};

export const fetchPlayerScoreHistory = async ({ playerId, limit = 2000 } = {}) => {
  if (!isBackendConfigured()) {
    return { ok: false, reason: "backend_not_configured", scores: [] };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, reason: "backend_not_configured", scores: [] };
  }

  const sessionResult = await ensureSupabaseSession();
  if (!sessionResult.ok) {
    return {
      ok: false,
      reason: sessionResult.reason ?? "auth_failed",
      error: sessionResult.error ?? null,
      scores: [],
    };
  }

  const scopedPlayerId = sessionResult.session?.user?.id ?? playerId;
  if (!scopedPlayerId) {
    return { ok: false, reason: "missing_player_id", scores: [] };
  }

  const safeLimit =
    typeof limit === "number" && Number.isFinite(limit)
      ? Math.max(1, Math.min(Math.trunc(limit), 5000))
      : 2000;

  const { data, error } = await supabase
    .from(SCORES_TABLE)
    .select("final_score")
    .eq("player_id", scopedPlayerId)
    .order("completed_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    return { ok: false, reason: "fetch_failed", error, scores: [] };
  }

  const scores = (data ?? [])
    .map((entry) => entry?.final_score)
    .filter((value) => typeof value === "number" && Number.isFinite(value));

  return { ok: true, scores };
};

export const fetchAvailableSeeds = async (
  scoreMode = LEADERBOARD_SCORE_MODE_SOLO,
  limit = 200
) => {
  if (!isBackendConfigured()) {
    return { ok: false, reason: "backend_not_configured", seeds: [] };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, reason: "backend_not_configured", seeds: [] };
  }

  const normalizedScoreMode = normalizeScoreMode(scoreMode);
  const { data, error } = await supabase
    .from(SCORES_TABLE)
    .select("seed, is_daily_seed, completed_at")
    .eq("score_mode", normalizedScoreMode)
    .order("completed_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { ok: false, reason: "fetch_failed", error, seeds: [] };
  }

  const uniqueSeeds = [];
  const seenSeeds = new Set();

  (data ?? []).forEach((entry) => {
    if (
      entry &&
      typeof entry.seed === "string" &&
      entry.seed.length > 0 &&
      !seenSeeds.has(entry.seed)
    ) {
      seenSeeds.add(entry.seed);
      uniqueSeeds.push(entry.seed);
    }
  });

  return { ok: true, seeds: uniqueSeeds };
};
