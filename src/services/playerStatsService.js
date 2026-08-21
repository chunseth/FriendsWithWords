import { isBackendConfigured } from "../config/backend";
import { ensureSupabaseSession, getSupabaseClient } from "../lib/supabase";
import {
  fetchCurrentPlayerGlobalRank,
  LEADERBOARD_SCORE_MODE_MINI,
  LEADERBOARD_SCORE_MODE_MULTIPLAYER,
  LEADERBOARD_SCORE_MODE_SOLO,
} from "./leaderboardService";
import {
  fetchCurrentPlayerRushRank,
  fetchCurrentPlayerSprintRank,
} from "./sprintRushScoreService";

const SCORES_TABLE = "scores";
const SPRINT_SCORES_TABLE = "sprint_scores";
const RUSH_SCORES_TABLE = "rush_scores";
const BOARD_VARIANT_SCORES_TABLE = "board_variant_scores";

export const PLAYER_STATS_MODE_ALL = "all";
export const PLAYER_STATS_MODE_CLASSIC = "classic";
export const PLAYER_STATS_MODE_MINI = "mini";
export const PLAYER_STATS_MODE_MULTIPLAYER = "multiplayer";
export const PLAYER_STATS_MODE_SPRINT = "sprint";
export const PLAYER_STATS_MODE_RUSH = "rush";
export const PLAYER_STATS_MODE_CUSTOM = "custom";

const SCORE_BUCKET_SIZE = 50;
const RECENT_RESULT_LIMIT = 12;
const RECENT_AVERAGE_LIMIT = 10;
const DEFAULT_HISTORY_LIMIT = 2000;
const RUSH_DURATIONS = [300, 600];

const MODE_LABELS = {
  [PLAYER_STATS_MODE_ALL]: "All",
  [PLAYER_STATS_MODE_CLASSIC]: "Classic",
  [PLAYER_STATS_MODE_MINI]: "Mini",
  [PLAYER_STATS_MODE_MULTIPLAYER]: "Multiplayer",
  [PLAYER_STATS_MODE_SPRINT]: "Sprint",
  [PLAYER_STATS_MODE_RUSH]: "Rush",
  [PLAYER_STATS_MODE_CUSTOM]: "Custom",
};

const scoreModeToStatsMode = (scoreMode) => {
  if (scoreMode === LEADERBOARD_SCORE_MODE_MINI) {
    return PLAYER_STATS_MODE_MINI;
  }
  if (scoreMode === LEADERBOARD_SCORE_MODE_MULTIPLAYER) {
    return PLAYER_STATS_MODE_MULTIPLAYER;
  }
  return PLAYER_STATS_MODE_CLASSIC;
};

const isFiniteNumber = (value) =>
  typeof value === "number" && Number.isFinite(value);

const sanitizeLimit = (limit) =>
  isFiniteNumber(limit)
    ? Math.max(1, Math.min(Math.trunc(limit), 5000))
    : DEFAULT_HISTORY_LIMIT;

const toTimestamp = (value) => {
  const time = new Date(value ?? 0).getTime();
  return Number.isFinite(time) ? time : 0;
};

const roundAverage = (value) =>
  isFiniteNumber(value) ? Math.round(value * 10) / 10 : null;

const formatRank = (rank) => (isFiniteNumber(rank) ? `#${rank}` : "Unranked");

const buildEmptyModeBreakdown = (mode) => ({
  mode,
  label: MODE_LABELS[mode],
  gamesPlayed: 0,
  bestScore: null,
  averageScore: null,
  last7Days: 0,
  last30Days: 0,
  bestSprintTurns: null,
  bestSprintDurationSeconds: null,
  rushDurations: [],
});

const compareSprintResults = (a, b) => {
  if (!a) return b ? 1 : 0;
  if (!b) return -1;
  if (a.turnCount !== b.turnCount) {
    return a.turnCount - b.turnCount;
  }
  return (a.durationSeconds ?? 0) - (b.durationSeconds ?? 0);
};

export const normalizeStatsRows = ({
  scores = [],
  sprintScores = [],
  rushScores = [],
  boardVariantScores = [],
} = {}) => {
  const normalizedScores = (scores ?? []).map((entry) => ({
    id: entry?.id ?? null,
    sourceTable: SCORES_TABLE,
    mode: scoreModeToStatsMode(entry?.score_mode),
    seed: entry?.seed ?? null,
    finalScore: isFiniteNumber(entry?.final_score) ? entry.final_score : null,
    pointsEarned: isFiniteNumber(entry?.points_earned) ? entry.points_earned : null,
    swapPenalties: isFiniteNumber(entry?.swap_penalties) ? entry.swap_penalties : 0,
    turnPenalties: isFiniteNumber(entry?.turn_penalties) ? entry.turn_penalties : 0,
    rackPenalty: isFiniteNumber(entry?.rack_penalty) ? entry.rack_penalty : 0,
    scrabbleBonus: isFiniteNumber(entry?.scrabble_bonus) ? entry.scrabble_bonus : 0,
    timeBonus: isFiniteNumber(entry?.time_bonus) ? entry.time_bonus : 0,
    consistencyBonus: isFiniteNumber(entry?.consistency_bonus)
      ? entry.consistency_bonus
      : 0,
    skillBonusTotal: isFiniteNumber(entry?.skill_bonus_total)
      ? entry.skill_bonus_total
      : 0,
    durationSeconds: isFiniteNumber(entry?.duration_seconds)
      ? entry.duration_seconds
      : null,
    completedAt: entry?.completed_at ?? null,
  }));

  const normalizedSprint = (sprintScores ?? []).map((entry) => ({
    id: entry?.id ?? null,
    sourceTable: SPRINT_SCORES_TABLE,
    mode: PLAYER_STATS_MODE_SPRINT,
    seed: entry?.seed ?? null,
    finalScore: isFiniteNumber(entry?.sprint_score) ? entry.sprint_score : null,
    pointsEarned: isFiniteNumber(entry?.points_earned) ? entry.points_earned : null,
    turnCount: isFiniteNumber(entry?.turn_count) ? entry.turn_count : null,
    durationSeconds: isFiniteNumber(entry?.duration_seconds)
      ? entry.duration_seconds
      : null,
    completedAt: entry?.completed_at ?? null,
  }));

  const normalizedRush = (rushScores ?? []).map((entry) => ({
    id: entry?.id ?? null,
    sourceTable: RUSH_SCORES_TABLE,
    mode: PLAYER_STATS_MODE_RUSH,
    seed: entry?.seed ?? null,
    finalScore: isFiniteNumber(entry?.final_score) ? entry.final_score : null,
    pointsEarned: isFiniteNumber(entry?.points_earned) ? entry.points_earned : null,
    durationSeconds: isFiniteNumber(entry?.duration_seconds)
      ? entry.duration_seconds
      : null,
    completedAt: entry?.completed_at ?? null,
  }));

  const normalizedCustom = (boardVariantScores ?? []).map((entry) => ({
    id: entry?.id ?? null,
    sourceTable: BOARD_VARIANT_SCORES_TABLE,
    mode: PLAYER_STATS_MODE_CUSTOM,
    modeId: entry?.mode_id ?? "classic",
    boardVariantId: entry?.board_variant_id ?? null,
    seed: entry?.seed ?? null,
    finalScore: isFiniteNumber(entry?.final_score) ? entry.final_score : null,
    pointsEarned: isFiniteNumber(entry?.points_earned) ? entry.points_earned : null,
    durationSeconds: isFiniteNumber(entry?.duration_seconds)
      ? entry.duration_seconds
      : null,
    completedAt: entry?.completed_at ?? null,
  }));

  return [
    ...normalizedScores,
    ...normalizedSprint,
    ...normalizedRush,
    ...normalizedCustom,
  ].sort((a, b) => toTimestamp(b.completedAt) - toTimestamp(a.completedAt));
};

const buildScoreDistribution = (entries) => {
  const bucketCounts = new Map();
  entries.forEach((entry) => {
    if (!isFiniteNumber(entry?.finalScore)) {
      return;
    }
    const normalizedScore = Math.max(1, Math.trunc(entry.finalScore));
    const bucketEnd =
      Math.ceil(normalizedScore / SCORE_BUCKET_SIZE) * SCORE_BUCKET_SIZE;
    const bucketStart = bucketEnd - (SCORE_BUCKET_SIZE - 1);
    const rangeLabel = `${bucketStart}-${bucketEnd}`;
    bucketCounts.set(rangeLabel, (bucketCounts.get(rangeLabel) ?? 0) + 1);
  });

  return [...bucketCounts.entries()]
    .map(([rangeLabel, count]) => {
      const [startText, endText] = rangeLabel.split("-");
      return {
        rangeLabel,
        rangeStart: Number(startText),
        rangeEnd: Number(endText),
        count,
      };
    })
    .sort((a, b) => a.rangeStart - b.rangeStart);
};

export const buildPlayerStatsViewModel = ({
  entries = [],
  rankSummaries = [],
  source = "database",
  status = "ready",
  message = null,
  now = new Date(),
} = {}) => {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const sevenDaysAgo = nowMs - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = nowMs - 30 * 24 * 60 * 60 * 1000;
  const modes = [
    PLAYER_STATS_MODE_ALL,
    PLAYER_STATS_MODE_CLASSIC,
    PLAYER_STATS_MODE_MINI,
    PLAYER_STATS_MODE_MULTIPLAYER,
    PLAYER_STATS_MODE_SPRINT,
    PLAYER_STATS_MODE_RUSH,
    PLAYER_STATS_MODE_CUSTOM,
  ];

  const modeBreakdowns = modes.reduce((acc, mode) => {
    const modeEntries =
      mode === PLAYER_STATS_MODE_ALL
        ? safeEntries
        : safeEntries.filter((entry) => entry.mode === mode);
    const scoreEntries = modeEntries.filter((entry) => isFiniteNumber(entry.finalScore));
    const scoreTotal = scoreEntries.reduce((total, entry) => total + entry.finalScore, 0);
    const bestScore = scoreEntries.reduce(
      (best, entry) => (best == null ? entry.finalScore : Math.max(best, entry.finalScore)),
      null
    );
    const sprintEntries = modeEntries.filter(
      (entry) =>
        entry.mode === PLAYER_STATS_MODE_SPRINT &&
        isFiniteNumber(entry.turnCount) &&
        isFiniteNumber(entry.durationSeconds)
    );
    const bestSprint = sprintEntries.reduce(
      (best, entry) => (compareSprintResults(best, entry) <= 0 ? best : entry),
      null
    );
    const rushDurations = [
      ...new Set(
        modeEntries
          .filter((entry) => entry.mode === PLAYER_STATS_MODE_RUSH)
          .map((entry) => entry.durationSeconds)
          .filter(isFiniteNumber)
      ),
    ].sort((a, b) => a - b);

    acc[mode] = {
      ...buildEmptyModeBreakdown(mode),
      gamesPlayed: modeEntries.length,
      bestScore,
      averageScore:
        scoreEntries.length > 0 ? roundAverage(scoreTotal / scoreEntries.length) : null,
      last7Days: modeEntries.filter((entry) => toTimestamp(entry.completedAt) >= sevenDaysAgo)
        .length,
      last30Days: modeEntries.filter((entry) => toTimestamp(entry.completedAt) >= thirtyDaysAgo)
        .length,
      bestSprintTurns: bestSprint?.turnCount ?? null,
      bestSprintDurationSeconds: bestSprint?.durationSeconds ?? null,
      rushDurations,
    };
    return acc;
  }, {});

  const scoreComparableEntries = safeEntries.filter(
    (entry) => entry.mode !== PLAYER_STATS_MODE_SPRINT && isFiniteNumber(entry.finalScore)
  );
  const recentAverageEntries = scoreComparableEntries.slice(0, RECENT_AVERAGE_LIMIT);
  const recentAverage =
    recentAverageEntries.length > 0
      ? roundAverage(
          recentAverageEntries.reduce((total, entry) => total + entry.finalScore, 0) /
            recentAverageEntries.length
        )
      : null;
  const bestRank = (rankSummaries ?? [])
    .map((entry) => entry?.rank)
    .filter(isFiniteNumber)
    .sort((a, b) => a - b)[0] ?? null;

  const resolvedStatus =
    status === "ready" && safeEntries.length === 0 && source === "database" ? "empty" : status;

  return {
    status: resolvedStatus,
    source,
    message,
    overview: {
      totalGames: safeEntries.length,
      bestScore: modeBreakdowns[PLAYER_STATS_MODE_ALL].bestScore,
      recentAverage,
      bestRank,
      bestRankLabel: formatRank(bestRank),
      last7Days: modeBreakdowns[PLAYER_STATS_MODE_ALL].last7Days,
      last30Days: modeBreakdowns[PLAYER_STATS_MODE_ALL].last30Days,
    },
    modeBreakdowns,
    recentResults: safeEntries.slice(0, RECENT_RESULT_LIMIT),
    distribution: buildScoreDistribution(scoreComparableEntries),
    rankSummaries: rankSummaries ?? [],
  };
};

export const buildLocalFallbackStatsViewModel = ({
  localStats,
  status = "offline",
  message = "Database history is unavailable. Showing local v1 stats.",
} = {}) => {
  const scoreHistory = Array.isArray(localStats?.scoreHistory)
    ? localStats.scoreHistory.filter(isFiniteNumber)
    : [];
  const highestScore = isFiniteNumber(localStats?.highestScore)
    ? localStats.highestScore
    : scoreHistory.reduce(
        (best, score) => (best == null ? score : Math.max(best, score)),
        null
      );
  const gamesPlayed = isFiniteNumber(localStats?.gamesPlayed)
    ? localStats.gamesPlayed
    : scoreHistory.length;
  const entries = scoreHistory
    .map((score, index) => ({
      id: `local-${index}`,
      sourceTable: "local_stats_v1",
      mode: PLAYER_STATS_MODE_CLASSIC,
      seed: null,
      finalScore: score,
      completedAt: null,
    }))
    .reverse();
  const viewModel = buildPlayerStatsViewModel({
    entries,
    source: "local_fallback",
    status,
    message,
  });

  return {
    ...viewModel,
    overview: {
      ...viewModel.overview,
      totalGames: gamesPlayed,
      bestScore: highestScore,
    },
    modeBreakdowns: {
      ...viewModel.modeBreakdowns,
      [PLAYER_STATS_MODE_ALL]: {
        ...viewModel.modeBreakdowns[PLAYER_STATS_MODE_ALL],
        gamesPlayed,
        bestScore: highestScore,
      },
      [PLAYER_STATS_MODE_CLASSIC]: {
        ...viewModel.modeBreakdowns[PLAYER_STATS_MODE_CLASSIC],
        gamesPlayed,
        bestScore: highestScore,
      },
    },
  };
};

const fetchTableRows = async ({ supabase, table, playerId, select, limit }) => {
  const { data, error } = await supabase
    .from(table)
    .select(select)
    .eq("player_id", playerId)
    .order("completed_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { ok: false, reason: "fetch_failed", error, rows: [] };
  }

  return { ok: true, rows: data ?? [] };
};

const fetchRankSummaries = async () => {
  const [
    classicRank,
    miniRank,
    multiplayerRank,
    sprintRank,
    rush5Rank,
    rush10Rank,
  ] = await Promise.all([
    fetchCurrentPlayerGlobalRank(LEADERBOARD_SCORE_MODE_SOLO),
    fetchCurrentPlayerGlobalRank(LEADERBOARD_SCORE_MODE_MINI),
    fetchCurrentPlayerGlobalRank(LEADERBOARD_SCORE_MODE_MULTIPLAYER),
    fetchCurrentPlayerSprintRank(),
    fetchCurrentPlayerRushRank(300),
    fetchCurrentPlayerRushRank(600),
  ]);

  return [
    { mode: PLAYER_STATS_MODE_CLASSIC, label: "Classic", rank: classicRank.rank ?? null },
    { mode: PLAYER_STATS_MODE_MINI, label: "Mini", rank: miniRank.rank ?? null },
    {
      mode: PLAYER_STATS_MODE_MULTIPLAYER,
      label: "Multiplayer",
      rank: multiplayerRank.rank ?? null,
    },
    { mode: PLAYER_STATS_MODE_SPRINT, label: "Sprint", rank: sprintRank.rank ?? null },
    { mode: PLAYER_STATS_MODE_RUSH, label: "Rush 5", rank: rush5Rank.rank ?? null },
    { mode: PLAYER_STATS_MODE_RUSH, label: "Rush 10", rank: rush10Rank.rank ?? null },
  ];
};

export const fetchPlayerStatsViewModel = async ({
  localStats = null,
  limit = DEFAULT_HISTORY_LIMIT,
  now = new Date(),
} = {}) => {
  if (!isBackendConfigured()) {
    return buildLocalFallbackStatsViewModel({
      localStats,
      status: "offline",
      message: "Supabase is not configured. Showing local v1 stats.",
    });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return buildLocalFallbackStatsViewModel({
      localStats,
      status: "offline",
      message: "Database client is unavailable. Showing local v1 stats.",
    });
  }

  const sessionResult = await ensureSupabaseSession();
  if (!sessionResult.ok || !sessionResult.session?.user?.id) {
    return buildLocalFallbackStatsViewModel({
      localStats,
      status: "offline",
      message: "Sign in could not be confirmed. Showing local v1 stats.",
    });
  }

  const playerId = sessionResult.session.user.id;
  const safeLimit = sanitizeLimit(limit);
  const [scoresResult, sprintResult, rushResult, customResult] = await Promise.all([
    fetchTableRows({
      supabase,
      table: SCORES_TABLE,
      playerId,
      limit: safeLimit,
      select:
        "id, score_mode, seed, final_score, points_earned, swap_penalties, turn_penalties, rack_penalty, scrabble_bonus, time_bonus, consistency_bonus, skill_bonus_total, duration_seconds, completed_at",
    }),
    fetchTableRows({
      supabase,
      table: SPRINT_SCORES_TABLE,
      playerId,
      limit: safeLimit,
      select:
        "id, seed, sprint_score, turn_count, duration_seconds, points_earned, completed_at",
    }),
    fetchTableRows({
      supabase,
      table: RUSH_SCORES_TABLE,
      playerId,
      limit: safeLimit,
      select: "id, seed, duration_seconds, final_score, points_earned, completed_at",
    }),
    fetchTableRows({
      supabase,
      table: BOARD_VARIANT_SCORES_TABLE,
      playerId,
      limit: safeLimit,
      select:
        "id, board_variant_id, mode_id, seed, final_score, points_earned, duration_seconds, completed_at",
    }),
  ]);

  const failedResult = [scoresResult, sprintResult, rushResult, customResult].find(
    (result) => !result.ok
  );
  if (failedResult) {
    return buildLocalFallbackStatsViewModel({
      localStats,
      status: "error",
      message: "Unable to load database history. Showing local v1 stats.",
    });
  }

  const entries = normalizeStatsRows({
    scores: scoresResult.rows,
    sprintScores: sprintResult.rows,
    rushScores: rushResult.rows,
    boardVariantScores: customResult.rows,
  });
  const rankSummaries = await fetchRankSummaries();

  return buildPlayerStatsViewModel({
    entries,
    rankSummaries,
    source: "database",
    status: "ready",
    now,
  });
};

export const PLAYER_STATS_MODE_LABELS = MODE_LABELS;
export const PLAYER_STATS_RUSH_DURATIONS = RUSH_DURATIONS;
