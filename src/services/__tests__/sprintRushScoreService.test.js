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
  fetchCurrentPlayerRushRank,
  fetchCurrentPlayerSprintRank,
  fetchRushLeaderboard,
  fetchSprintLeaderboard,
  submitRushScore,
  submitSprintScore,
} from "../sprintRushScoreService";
import { ensureSupabaseSession, getSupabaseClient } from "../../lib/supabase";
import { loadOrCreatePlayerProfile } from "../../utils/playerProfile";

const buildLookupBuilder = (existingScore = null) => {
  const lookupBuilder = {
    select: jest.fn(),
    eq: jest.fn(),
    maybeSingle: jest.fn(),
  };
  lookupBuilder.select.mockReturnValue(lookupBuilder);
  lookupBuilder.eq.mockReturnValue(lookupBuilder);
  lookupBuilder.maybeSingle.mockResolvedValue({
    data: existingScore,
    error: null,
  });
  return lookupBuilder;
};

const buildWriteBuilder = () => {
  const writeBuilder = {
    insert: jest.fn(),
    update: jest.fn(),
    eq: jest.fn(),
    select: jest.fn(),
    single: jest.fn(),
  };
  writeBuilder.insert.mockReturnValue(writeBuilder);
  writeBuilder.update.mockReturnValue(writeBuilder);
  writeBuilder.eq.mockReturnValue(writeBuilder);
  writeBuilder.select.mockReturnValue(writeBuilder);
  writeBuilder.single.mockResolvedValue({
    data: { id: "score-1" },
    error: null,
  });
  return writeBuilder;
};

describe("sprintRushScoreService submissions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ensureSupabaseSession.mockResolvedValue({
      ok: true,
      session: { user: { id: "player-1" } },
    });
    loadOrCreatePlayerProfile.mockResolvedValue({ displayName: "Player 1" });
  });

  it("keeps an existing sprint score when the candidate takes more turns", async () => {
    const lookupBuilder = buildLookupBuilder({
      id: "existing-1",
      sprint_score: 110,
      turn_count: 4,
      duration_seconds: 300,
    });
    const writeBuilder = buildWriteBuilder();
    getSupabaseClient.mockReturnValue({
      from: jest
        .fn()
        .mockReturnValueOnce(lookupBuilder)
        .mockReturnValueOnce(writeBuilder),
    });

    const result = await submitSprintScore({
      seed: "123",
      finalScore: 130,
      finalScoreBreakdown: { pointsEarned: 130 },
      turnCount: 5,
      durationSeconds: 200,
    });

    expect(result.reason).toBe("existing_score_kept");
    expect(writeBuilder.update).not.toHaveBeenCalled();
  });

  it("updates sprint score when turns match and candidate is faster", async () => {
    const lookupBuilder = buildLookupBuilder({
      id: "existing-1",
      sprint_score: 110,
      turn_count: 4,
      duration_seconds: 300,
    });
    const writeBuilder = buildWriteBuilder();
    getSupabaseClient.mockReturnValue({
      from: jest
        .fn()
        .mockReturnValueOnce(lookupBuilder)
        .mockReturnValueOnce(writeBuilder),
    });

    const result = await submitSprintScore({
      seed: "123",
      finalScore: 120,
      finalScoreBreakdown: { pointsEarned: 120 },
      turnCount: 4,
      durationSeconds: 250,
    });

    expect(result.ok).toBe(true);
    expect(writeBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        sprint_score: 120,
        turn_count: 4,
        duration_seconds: 250,
      })
    );
  });

  it("keeps rush scores in separate duration buckets", async () => {
    const lookupBuilder = buildLookupBuilder({
      id: "existing-1",
      final_score: 100,
    });
    const writeBuilder = buildWriteBuilder();
    getSupabaseClient.mockReturnValue({
      from: jest
        .fn()
        .mockReturnValueOnce(lookupBuilder)
        .mockReturnValueOnce(writeBuilder),
    });

    const result = await submitRushScore({
      seed: "123",
      durationSeconds: 600,
      finalScore: 120,
      finalScoreBreakdown: { pointsEarned: 130 },
    });

    expect(result.ok).toBe(true);
    expect(lookupBuilder.eq).toHaveBeenCalledWith("duration_seconds", 600);
    expect(writeBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        duration_seconds: 600,
        final_score: 120,
      })
    );
  });
});

describe("sprintRushScoreService fetch ordering", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("orders sprint by turns then duration", async () => {
    const data = [
      {
        player_id: "player-1",
        display_name: "Player 1",
        turn_count: 4,
        duration_seconds: 200,
        completed_at: "2026-06-01T10:00:00.000Z",
      },
      {
        player_id: "player-1",
        display_name: "Player 1 again",
        turn_count: 5,
        duration_seconds: 100,
        completed_at: "2026-06-01T11:00:00.000Z",
      },
      {
        player_id: "player-2",
        display_name: "Player 2",
        turn_count: 6,
        duration_seconds: 300,
        completed_at: "2026-06-01T12:00:00.000Z",
      },
    ];
    const queryBuilder = {
      select: jest.fn(),
      order: jest.fn(),
      limit: jest.fn(),
    };
    queryBuilder.select.mockReturnValue(queryBuilder);
    queryBuilder.order.mockReturnValue(queryBuilder);
    queryBuilder.limit.mockResolvedValue({ data, error: null });
    getSupabaseClient.mockReturnValue({
      from: jest.fn().mockReturnValue(queryBuilder),
    });

    const result = await fetchSprintLeaderboard();

    expect(queryBuilder.order).toHaveBeenNthCalledWith(1, "turn_count", {
      ascending: true,
    });
    expect(queryBuilder.order).toHaveBeenNthCalledWith(2, "duration_seconds", {
      ascending: true,
    });
    expect(result.leaderboard.map((entry) => entry.display_name)).toEqual([
      "Player 1",
      "Player 2",
    ]);
  });

  it("filters rush by duration and orders by score descending", async () => {
    const data = [
      {
        player_id: "player-1",
        display_name: "Player 1",
        final_score: 150,
        completed_at: "2026-06-01T10:00:00.000Z",
      },
      {
        player_id: "player-1",
        display_name: "Player 1 again",
        final_score: 130,
        completed_at: "2026-06-01T11:00:00.000Z",
      },
      {
        player_id: "player-2",
        display_name: "Player 2",
        final_score: 120,
        completed_at: "2026-06-01T12:00:00.000Z",
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

    const result = await fetchRushLeaderboard(300);

    expect(queryBuilder.eq).toHaveBeenCalledWith("duration_seconds", 300);
    expect(queryBuilder.order).toHaveBeenNthCalledWith(1, "final_score", {
      ascending: false,
    });
    expect(result.leaderboard.map((entry) => entry.display_name)).toEqual([
      "Player 1",
      "Player 2",
    ]);
  });
});

describe("sprintRushScoreService rank helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ensureSupabaseSession.mockResolvedValue({
      ok: true,
      session: { user: { id: "player-1" } },
    });
  });

  it("computes sprint rank using turn count then duration ordering", async () => {
    const data = [
      {
        player_id: "player-2",
        turn_count: 3,
        duration_seconds: 260,
        completed_at: "2026-06-01T10:00:00.000Z",
      },
      {
        player_id: "player-1",
        turn_count: 4,
        duration_seconds: 200,
        completed_at: "2026-06-01T11:00:00.000Z",
      },
    ];
    const queryBuilder = {
      select: jest.fn(),
      order: jest.fn(),
      limit: jest.fn(),
    };
    queryBuilder.select.mockReturnValue(queryBuilder);
    queryBuilder.order.mockReturnValue(queryBuilder);
    queryBuilder.limit.mockResolvedValue({ data, error: null });
    getSupabaseClient.mockReturnValue({
      from: jest.fn().mockReturnValue(queryBuilder),
    });

    const result = await fetchCurrentPlayerSprintRank();

    expect(result).toMatchObject({ ok: true, rank: 2 });
    expect(queryBuilder.order).toHaveBeenNthCalledWith(1, "turn_count", {
      ascending: true,
    });
    expect(queryBuilder.order).toHaveBeenNthCalledWith(2, "duration_seconds", {
      ascending: true,
    });
  });

  it("computes rush rank inside the selected duration bucket", async () => {
    const data = [
      {
        player_id: "player-2",
        final_score: 180,
        completed_at: "2026-06-01T10:00:00.000Z",
      },
      {
        player_id: "player-1",
        final_score: 150,
        completed_at: "2026-06-01T11:00:00.000Z",
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

    const result = await fetchCurrentPlayerRushRank(600);

    expect(result).toMatchObject({ ok: true, rank: 2 });
    expect(queryBuilder.eq).toHaveBeenCalledWith("duration_seconds", 600);
  });
});
