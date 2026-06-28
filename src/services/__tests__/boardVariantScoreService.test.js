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

import { fetchCurrentPlayerBoardVariantRank } from "../boardVariantScoreService";
import { ensureSupabaseSession, getSupabaseClient } from "../../lib/supabase";

describe("fetchCurrentPlayerBoardVariantRank", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ensureSupabaseSession.mockResolvedValue({
      ok: true,
      session: { user: { id: "player-1" } },
    });
  });

  it("computes rank within board variant and mode", async () => {
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
        {
          player_id: "player-2",
          final_score: 250,
          completed_at: "2026-06-01T10:00:00.000Z",
        },
        {
          player_id: "player-1",
          final_score: 220,
          completed_at: "2026-06-01T11:00:00.000Z",
        },
      ],
      error: null,
    });
    getSupabaseClient.mockReturnValue({
      from: jest.fn().mockReturnValue(queryBuilder),
    });

    const result = await fetchCurrentPlayerBoardVariantRank({
      boardVariantId: "variant-1",
      modeId: "mini",
    });

    expect(result).toMatchObject({ ok: true, rank: 2 });
    expect(queryBuilder.eq).toHaveBeenCalledWith(
      "board_variant_id",
      "variant-1"
    );
    expect(queryBuilder.eq).toHaveBeenCalledWith("mode_id", "mini");
  });
});
