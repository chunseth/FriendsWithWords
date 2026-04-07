import { ensureSupabaseSession, getSupabaseClient } from "../lib/supabase";
import { isBackendConfigured } from "../config/backend";
import { loadOrCreatePlayerProfile } from "../utils/playerProfile";

const BOARD_VARIANT_SCORES_TABLE = "board_variant_scores";

const normalizeModeId = (modeId) => (modeId === "mini" ? "mini" : "classic");

export const submitBoardVariantCompletedScore = async ({
  boardVariantId,
  modeId = "classic",
  seed,
  finalScore,
  finalScoreBreakdown,
  isDailySeed = true,
}) => {
  if (!isBackendConfigured()) {
    return { ok: false, reason: "backend_not_configured" };
  }

  if (
    !boardVariantId ||
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
  const normalizedModeId = normalizeModeId(modeId);
  const submission = {
    player_id: authUserId,
    board_variant_id: boardVariantId,
    mode_id: normalizedModeId,
    display_name: playerProfile.displayName,
    seed,
    is_daily_seed: isDailySeed,
    final_score: finalScore,
    points_earned: finalScoreBreakdown.pointsEarned,
    swap_penalties: finalScoreBreakdown.swapPenalties ?? 0,
    turn_penalties: finalScoreBreakdown.turnPenalties ?? 0,
    rack_penalty: finalScoreBreakdown.rackPenalty ?? 0,
    scrabble_bonus: finalScoreBreakdown.scrabbleBonus ?? 0,
    time_bonus: finalScoreBreakdown.timeBonus ?? 0,
    consistency_bonus: finalScoreBreakdown.consistencyBonusTotal ?? 0,
    skill_bonus_total: finalScoreBreakdown.skillBonusTotal ?? 0,
    duration_seconds:
      typeof finalScoreBreakdown.durationSeconds === "number"
        ? finalScoreBreakdown.durationSeconds
        : null,
    completed_at: new Date().toISOString(),
  };

  const { data: existingScore, error: existingScoreError } = await supabase
    .from(BOARD_VARIANT_SCORES_TABLE)
    .select("id, final_score")
    .eq("player_id", authUserId)
    .eq("board_variant_id", boardVariantId)
    .eq("mode_id", normalizedModeId)
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
      .from(BOARD_VARIANT_SCORES_TABLE)
      .update(submission)
      .eq("id", existingScore.id)
      .select("id")
      .single();
  } else {
    result = await supabase
      .from(BOARD_VARIANT_SCORES_TABLE)
      .insert(submission)
      .select("id")
      .single();
  }

  if (result.error) {
    return { ok: false, reason: "write_failed", error: result.error };
  }

  return { ok: true, reason: "score_saved", id: result.data?.id ?? null };
};

export const fetchBoardVariantGlobalHighScores = async ({
  boardVariantIds = [],
  modeId = "classic",
} = {}) => {
  if (!isBackendConfigured()) {
    return { ok: false, reason: "backend_not_configured", scoresByVariant: {} };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, reason: "backend_not_configured", scoresByVariant: {} };
  }

  const variantIds = Array.isArray(boardVariantIds)
    ? boardVariantIds.filter((id) => typeof id === "string" && id.trim().length > 0)
    : [];
  if (variantIds.length === 0) {
    return { ok: true, scoresByVariant: {} };
  }

  const normalizedModeId = normalizeModeId(modeId);
  const { data, error } = await supabase
    .from(BOARD_VARIANT_SCORES_TABLE)
    .select("board_variant_id, final_score")
    .eq("mode_id", normalizedModeId)
    .in("board_variant_id", variantIds)
    .order("final_score", { ascending: false });

  if (error) {
    return { ok: false, reason: "fetch_failed", error, scoresByVariant: {} };
  }

  const scoresByVariant = {};
  for (const entry of data ?? []) {
    const variantId = entry?.board_variant_id;
    const score = entry?.final_score;
    if (
      typeof variantId !== "string" ||
      typeof score !== "number" ||
      scoresByVariant[variantId] != null
    ) {
      continue;
    }
    scoresByVariant[variantId] = score;
  }

  return { ok: true, scoresByVariant };
};
