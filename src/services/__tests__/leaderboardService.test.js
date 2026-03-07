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
