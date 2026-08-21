jest.mock("../../config/backend", () => ({
  isBackendConfigured: jest.fn(() => true),
}));

jest.mock("../../lib/supabase", () => ({
  ensureSupabaseSession: jest.fn(),
  getSupabaseClient: jest.fn(),
}));

jest.mock("../leaderboardService", () => ({
  fetchCurrentPlayerGlobalRank: jest.fn(),
  LEADERBOARD_SCORE_MODE_MINI: "mini",
  LEADERBOARD_SCORE_MODE_MULTIPLAYER: "multiplayer",
  LEADERBOARD_SCORE_MODE_SOLO: "solo",
}));

jest.mock("../sprintRushScoreService", () => ({
  fetchCurrentPlayerRushRank: jest.fn(),
  fetchCurrentPlayerSprintRank: jest.fn(),
}));

import { isBackendConfigured } from "../../config/backend";
import { ensureSupabaseSession, getSupabaseClient } from "../../lib/supabase";
import { fetchCurrentPlayerGlobalRank } from "../leaderboardService";
import {
  fetchCurrentPlayerRushRank,
  fetchCurrentPlayerSprintRank,
} from "../sprintRushScoreService";
import {
  PLAYER_STATS_MODE_CLASSIC,
  PLAYER_STATS_MODE_CUSTOM,
  PLAYER_STATS_MODE_RUSH,
  PLAYER_STATS_MODE_SPRINT,
  buildPlayerStatsViewModel,
  fetchPlayerStatsViewModel,
  normalizeStatsRows,
} from "../playerStatsService";

const createQueryBuilder = (rows, error = null) => {
  const queryBuilder = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
  };
  queryBuilder.select.mockReturnValue(queryBuilder);
  queryBuilder.eq.mockReturnValue(queryBuilder);
  queryBuilder.order.mockReturnValue(queryBuilder);
  queryBuilder.limit.mockResolvedValue({ data: rows, error });
  return queryBuilder;
};

describe("player stats aggregation", () => {
  it("normalizes mixed score history and computes mode summaries", () => {
    const entries = normalizeStatsRows({
      scores: [
        {
          id: "classic-1",
          score_mode: "solo",
          seed: "20260701",
          final_score: 200,
          points_earned: 220,
          completed_at: "2026-07-01T12:00:00.000Z",
        },
      ],
      sprintScores: [
        {
          id: "sprint-1",
          seed: "20260702",
          sprint_score: 150,
          turn_count: 9,
          duration_seconds: 280,
          points_earned: 150,
          completed_at: "2026-07-02T12:00:00.000Z",
        },
      ],
      rushScores: [
        {
          id: "rush-1",
          seed: "20260703",
          duration_seconds: 300,
          final_score: 180,
          points_earned: 190,
          completed_at: "2026-07-03T12:00:00.000Z",
        },
      ],
      boardVariantScores: [
        {
          id: "custom-1",
          board_variant_id: "variant-1",
          mode_id: "mini",
          seed: "variant-daily",
          final_score: 240,
          points_earned: 260,
          completed_at: "2026-07-04T12:00:00.000Z",
        },
      ],
    });

    const viewModel = buildPlayerStatsViewModel({
      entries,
      now: new Date("2026-07-05T12:00:00.000Z"),
    });

    expect(viewModel.status).toBe("ready");
    expect(viewModel.overview.totalGames).toBe(4);
    expect(viewModel.overview.bestScore).toBe(240);
    expect(viewModel.modeBreakdowns[PLAYER_STATS_MODE_CLASSIC].gamesPlayed).toBe(1);
    expect(viewModel.modeBreakdowns[PLAYER_STATS_MODE_SPRINT].bestSprintTurns).toBe(9);
    expect(viewModel.modeBreakdowns[PLAYER_STATS_MODE_RUSH].rushDurations).toEqual([300]);
    expect(viewModel.modeBreakdowns[PLAYER_STATS_MODE_CUSTOM].bestScore).toBe(240);
    expect(viewModel.distribution.map((bucket) => bucket.rangeLabel)).toEqual([
      "151-200",
      "201-250",
    ]);
  });

  it("returns empty status for database-ready players with no history", () => {
    const viewModel = buildPlayerStatsViewModel({ entries: [] });

    expect(viewModel.status).toBe("empty");
    expect(viewModel.overview.totalGames).toBe(0);
    expect(viewModel.recentResults).toEqual([]);
  });
});

describe("fetchPlayerStatsViewModel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isBackendConfigured.mockReturnValue(true);
    ensureSupabaseSession.mockResolvedValue({
      ok: true,
      session: { user: { id: "player-1" } },
    });
    fetchCurrentPlayerGlobalRank.mockResolvedValue({ ok: true, rank: 4 });
    fetchCurrentPlayerSprintRank.mockResolvedValue({ ok: true, rank: 2 });
    fetchCurrentPlayerRushRank.mockResolvedValue({ ok: true, rank: 5 });
  });

  it("queries all submitted score tables for the authenticated player", async () => {
    const builders = [
      createQueryBuilder([
        {
          id: "classic-1",
          score_mode: "solo",
          seed: "20260701",
          final_score: 200,
          points_earned: 220,
          completed_at: "2026-07-01T12:00:00.000Z",
        },
      ]),
      createQueryBuilder([]),
      createQueryBuilder([]),
      createQueryBuilder([]),
    ];
    const supabase = {
      from: jest.fn((table) => {
        const tableIndex = [
          "scores",
          "sprint_scores",
          "rush_scores",
          "board_variant_scores",
        ].indexOf(table);
        return builders[tableIndex];
      }),
    };
    getSupabaseClient.mockReturnValue(supabase);

    const viewModel = await fetchPlayerStatsViewModel();

    expect(viewModel.source).toBe("database");
    expect(viewModel.overview.totalGames).toBe(1);
    expect(supabase.from).toHaveBeenCalledWith("scores");
    expect(supabase.from).toHaveBeenCalledWith("sprint_scores");
    expect(supabase.from).toHaveBeenCalledWith("rush_scores");
    expect(supabase.from).toHaveBeenCalledWith("board_variant_scores");
    builders.forEach((builder) => {
      expect(builder.eq).toHaveBeenCalledWith("player_id", "player-1");
    });
  });

  it("uses local fallback when backend is unavailable", async () => {
    isBackendConfigured.mockReturnValue(false);

    const viewModel = await fetchPlayerStatsViewModel({
      localStats: {
        gamesPlayed: 3,
        highestScore: 210,
        scoreHistory: [120, 210],
      },
    });

    expect(viewModel.status).toBe("offline");
    expect(viewModel.source).toBe("local_fallback");
    expect(viewModel.overview.totalGames).toBe(3);
    expect(viewModel.overview.bestScore).toBe(210);
    expect(getSupabaseClient).not.toHaveBeenCalled();
  });

  it("uses local fallback when a table fetch fails", async () => {
    const builders = [
      createQueryBuilder([], { message: "boom" }),
      createQueryBuilder([]),
      createQueryBuilder([]),
      createQueryBuilder([]),
    ];
    getSupabaseClient.mockReturnValue({
      from: jest.fn((table) => {
        const tableIndex = [
          "scores",
          "sprint_scores",
          "rush_scores",
          "board_variant_scores",
        ].indexOf(table);
        return builders[tableIndex];
      }),
    });

    const viewModel = await fetchPlayerStatsViewModel({
      localStats: {
        gamesPlayed: 1,
        highestScore: 99,
        scoreHistory: [99],
      },
    });

    expect(viewModel.status).toBe("error");
    expect(viewModel.source).toBe("local_fallback");
    expect(viewModel.overview.bestScore).toBe(99);
  });
});
