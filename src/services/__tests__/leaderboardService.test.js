jest.mock("../../config/backend", () => ({
  isBackendConfigured: jest.fn(() => true),
}));

jest.mock("../../lib/supabase", () => ({
  ensureSupabaseSession: jest.fn(),
  getSupabaseClient: jest.fn(),
}));

jest.mock("../../utils/playerProfile", () => ({
  loadOrCreatePlayerProfile: jest.fn(),
}));

import {
  fetchPlayerScoreHistory,
  fetchGlobalLeaderboard,
  fetchPlayerHighScorePosition,
  LEADERBOARD_SCORE_MODE_MULTIPLAYER,
  submitCompletedScore,
} from "../leaderboardService";
import { ensureSupabaseSession, getSupabaseClient } from "../../lib/supabase";
import { loadOrCreatePlayerProfile } from "../../utils/playerProfile";

describe("submitCompletedScore multiplayer normalization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("forces multiplayer time and perfection bonuses to zero", async () => {
    const lookupBuilder = {
      select: jest.fn(),
      eq: jest.fn(),
      maybeSingle: jest.fn(),
    };
    lookupBuilder.select.mockReturnValue(lookupBuilder);
    lookupBuilder.eq.mockReturnValue(lookupBuilder);
    lookupBuilder.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    let insertedPayload = null;
    const insertBuilder = {
      insert: jest.fn(),
      select: jest.fn(),
      single: jest.fn(),
    };
    insertBuilder.insert.mockImplementation((payload) => {
      insertedPayload = payload;
      return insertBuilder;
    });
    insertBuilder.select.mockReturnValue(insertBuilder);
    insertBuilder.single.mockResolvedValue({
      data: { id: "score-1" },
      error: null,
    });

    const supabase = {
      from: jest
        .fn()
        .mockReturnValueOnce(lookupBuilder)
        .mockReturnValueOnce(insertBuilder),
    };

    getSupabaseClient.mockReturnValue(supabase);
    ensureSupabaseSession.mockResolvedValue({
      ok: true,
      session: { user: { id: "player-1" } },
    });
    loadOrCreatePlayerProfile.mockResolvedValue({
      displayName: "Player 1",
    });

    const result = await submitCompletedScore({
      seed: "20260307",
      finalScore: 210,
      scoreMode: LEADERBOARD_SCORE_MODE_MULTIPLAYER,
      finalScoreBreakdown: {
        pointsEarned: 180,
        swapPenalties: 3,
        turnPenalties: 20,
        rackPenalty: 10,
        scrabbleBonus: 50,
        timeBonus: 15,
        perfectionBonus: 50,
        consistencyBonusTotal: 6,
        skillBonusTotal: 121,
      },
    });

    expect(result.ok).toBe(true);
    expect(insertedPayload).toMatchObject({
      score_mode: LEADERBOARD_SCORE_MODE_MULTIPLAYER,
      scrabble_bonus: 50,
      time_bonus: 0,
      perfection_bonus: 0,
      consistency_bonus: 6,
      skill_bonus_total: 56,
    });
  });
});

describe("global leaderboard deduping", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("keeps only the highest submitted score per multiplayer pair", async () => {
    const data = [
      {
        player_id: "player-1",
        display_name: "Seth\nMomo",
        final_score: 220,
        completed_at: "2026-03-07T10:00:00.000Z",
      },
      {
        player_id: "player-1",
        display_name: "Momo\nSeth",
        final_score: 215,
        completed_at: "2026-03-06T10:00:00.000Z",
      },
      {
        player_id: "player-1",
        display_name: "Seth\nSeth3",
        final_score: 210,
        completed_at: "2026-03-08T10:00:00.000Z",
      },
      {
        player_id: "player-3",
        display_name: "Alice\nBob",
        final_score: 205,
        completed_at: "2026-03-09T10:00:00.000Z",
      },
    ];

    const queryBuilder = {
      select: jest.fn(),
      eq: jest.fn(),
      order: jest.fn(),
      limit: jest.fn(),
    };
    queryBuilder.select.mockReturnValue(queryBuilder);
    queryBuilder.eq.mockReturnValue(queryBuilder);
    queryBuilder.order.mockReturnValue(queryBuilder);
    queryBuilder.limit.mockResolvedValue({ data, error: null });

    getSupabaseClient.mockReturnValue({
      from: jest.fn().mockReturnValue(queryBuilder),
    });

    const result = await fetchGlobalLeaderboard(
      LEADERBOARD_SCORE_MODE_MULTIPLAYER,
      3
    );

    expect(result.ok).toBe(true);
    expect(result.leaderboard).toHaveLength(3);
    expect(result.leaderboard.map((entry) => entry.display_name)).toEqual([
      "Seth\nMomo",
      "Seth\nSeth3",
      "Alice\nBob",
    ]);
    expect(result.leaderboard[0].final_score).toBe(220);
  });
});

describe("fetchPlayerHighScorePosition", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("computes rank from each player's highest submitted score", async () => {
    const data = [
      {
        player_id: "player-2",
        final_score: 240,
        completed_at: "2026-03-01T08:00:00.000Z",
      },
      {
        player_id: "player-2",
        final_score: 230,
        completed_at: "2026-02-28T08:00:00.000Z",
      },
      {
        player_id: "player-1",
        final_score: 220,
        completed_at: "2026-03-02T08:00:00.000Z",
      },
      {
        player_id: "player-3",
        final_score: 210,
        completed_at: "2026-03-03T08:00:00.000Z",
      },
    ];

    const queryBuilder = {
      select: jest.fn(),
      eq: jest.fn(),
      order: jest.fn(),
      limit: jest.fn(),
    };
    queryBuilder.select.mockReturnValue(queryBuilder);
    queryBuilder.eq.mockReturnValue(queryBuilder);
    queryBuilder.order.mockReturnValue(queryBuilder);
    queryBuilder.limit.mockResolvedValue({ data, error: null });

    getSupabaseClient.mockReturnValue({
      from: jest.fn().mockReturnValue(queryBuilder),
    });
    ensureSupabaseSession.mockResolvedValue({
      ok: true,
      session: { user: { id: "player-1" } },
    });

    const result = await fetchPlayerHighScorePosition("ignored-player-id");

    expect(result).toEqual({ ok: true, position: 2 });
  });
});

describe("fetchPlayerScoreHistory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns numeric final scores for the authenticated player", async () => {
    const queryBuilder = {
      select: jest.fn(),
      eq: jest.fn(),
      order: jest.fn(),
      limit: jest.fn(),
    };
    queryBuilder.select.mockReturnValue(queryBuilder);
    queryBuilder.eq.mockReturnValue(queryBuilder);
    queryBuilder.order.mockReturnValue(queryBuilder);
    queryBuilder.limit.mockResolvedValue({
      data: [
        { final_score: 210 },
        { final_score: 180 },
        { final_score: "bad" },
      ],
      error: null,
    });

    getSupabaseClient.mockReturnValue({
      from: jest.fn().mockReturnValue(queryBuilder),
    });
    ensureSupabaseSession.mockResolvedValue({
      ok: true,
      session: { user: { id: "player-1" } },
    });

    const result = await fetchPlayerScoreHistory();

    expect(result).toEqual({
      ok: true,
      scores: [210, 180],
    });
  });

  it("returns fetch_failed when query errors", async () => {
    const queryBuilder = {
      select: jest.fn(),
      eq: jest.fn(),
      order: jest.fn(),
      limit: jest.fn(),
    };
    queryBuilder.select.mockReturnValue(queryBuilder);
    queryBuilder.eq.mockReturnValue(queryBuilder);
    queryBuilder.order.mockReturnValue(queryBuilder);
    queryBuilder.limit.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });

    getSupabaseClient.mockReturnValue({
      from: jest.fn().mockReturnValue(queryBuilder),
    });
    ensureSupabaseSession.mockResolvedValue({
      ok: true,
      session: { user: { id: "player-1" } },
    });

    const result = await fetchPlayerScoreHistory();

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("fetch_failed");
    expect(result.scores).toEqual([]);
  });
});
