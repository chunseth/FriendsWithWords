import { ensureSupabaseSession, getSupabaseClient } from "../lib/supabase";
import { isBackendConfigured } from "../config/backend";
import { loadOrCreatePlayerProfile } from "../utils/playerProfile";

const SCORES_TABLE = "scores";
export const LEADERBOARD_SCORE_MODE_SOLO = "solo";
export const LEADERBOARD_SCORE_MODE_MULTIPLAYER = "multiplayer";

const normalizeScoreMode = (scoreMode) =>
  scoreMode === LEADERBOARD_SCORE_MODE_MULTIPLAYER
    ? LEADERBOARD_SCORE_MODE_MULTIPLAYER
    : LEADERBOARD_SCORE_MODE_SOLO;

export const submitCompletedScore = async ({
  seed,
  finalScore,
  finalScoreBreakdown,
  isDailySeed = false,
  scoreMode = LEADERBOARD_SCORE_MODE_SOLO,
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
  const normalizedScoreMode = normalizeScoreMode(scoreMode);

  const submission = {
    player_id: authUserId,
    display_name: playerProfile.displayName,
    seed,
    score_mode: normalizedScoreMode,
    is_daily_seed: isDailySeed,
    final_score: finalScore,
    points_earned: finalScoreBreakdown.pointsEarned,
    swap_penalties: finalScoreBreakdown.swapPenalties ?? 0,
    turn_penalties: finalScoreBreakdown.turnPenalties ?? 0,
    rack_penalty: finalScoreBreakdown.rackPenalty ?? 0,
    scrabble_bonus: finalScoreBreakdown.scrabbleBonus ?? 0,
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
      "display_name, seed, final_score, points_earned, swap_penalties, turn_penalties, rack_penalty, scrabble_bonus, completed_at"
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
      "display_name, seed, final_score, points_earned, swap_penalties, turn_penalties, rack_penalty, scrabble_bonus, completed_at"
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
  const { data, error } = await supabase
    .from(SCORES_TABLE)
    .select(
      "player_id, display_name, seed, is_daily_seed, final_score, points_earned, swap_penalties, turn_penalties, rack_penalty, scrabble_bonus, completed_at"
    )
    .eq("score_mode", normalizedScoreMode)
    .order("final_score", { ascending: false })
    .order("completed_at", { ascending: true })
    .limit(limit);

  if (error) {
    return { ok: false, reason: "fetch_failed", error, leaderboard: [] };
  }

  return { ok: true, leaderboard: data ?? [] };
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
  const { data: bestScore, error: bestScoreError } = await supabase
    .from(SCORES_TABLE)
    .select("final_score, completed_at")
    .eq("player_id", scopedPlayerId)
    .eq("score_mode", normalizedScoreMode)
    .order("final_score", { ascending: false })
    .order("completed_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (bestScoreError) {
    return {
      ok: false,
      reason: "fetch_failed",
      error: bestScoreError,
      position: null,
    };
  }

  if (!bestScore) {
    return { ok: true, position: null };
  }

  const { count: higherScoreCount, error: higherScoreError } = await supabase
    .from(SCORES_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("score_mode", normalizedScoreMode)
    .gt("final_score", bestScore.final_score);

  if (higherScoreError) {
    return {
      ok: false,
      reason: "fetch_failed",
      error: higherScoreError,
      position: null,
    };
  }

  const { count: tiedEarlierCount, error: tiedEarlierError } = await supabase
    .from(SCORES_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("score_mode", normalizedScoreMode)
    .eq("final_score", bestScore.final_score)
    .lt("completed_at", bestScore.completed_at);

  if (tiedEarlierError) {
    return {
      ok: false,
      reason: "fetch_failed",
      error: tiedEarlierError,
      position: null,
    };
  }

  return {
    ok: true,
    position: (higherScoreCount ?? 0) + (tiedEarlierCount ?? 0) + 1,
  };
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
