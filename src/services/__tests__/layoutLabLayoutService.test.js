jest.mock("../../config/backend", () => ({
  isBackendConfigured: jest.fn(() => true),
}));

jest.mock("../../lib/supabase", () => ({
  ensureSupabaseSession: jest.fn(),
  getSupabaseClient: jest.fn(),
}));

import {
  fetchSavedLayoutLabLayouts,
  saveLayoutLabLayout,
} from "../layoutLabLayoutService";
import { ensureSupabaseSession, getSupabaseClient } from "../../lib/supabase";

describe("layoutLabLayoutService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ensureSupabaseSession.mockResolvedValue({
      ok: true,
      session: { user: { id: "user-1" } },
    });
  });

  it("saves a layout row to supabase", async () => {
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
      data: {
        id: "layout-1",
        layout_name: "layout-classic-test",
        saved_at: "2026-03-22T00:00:00.000Z",
      },
      error: null,
    });

    const supabase = {
      from: jest.fn().mockReturnValue(insertBuilder),
    };
    getSupabaseClient.mockReturnValue(supabase);

    const result = await saveLayoutLabLayout({
      mode: "classic",
      layoutName: "layout-classic-test",
      premiumSquares: {
        "7,7": "center",
        "0,0": "tw",
        "0,1": "not-valid",
        foo: "dw",
        "1,3": "dl",
      },
      seed: "20260322",
      metadata: { source: "layout_lab_dev" },
    });

    expect(result.ok).toBe(true);
    expect(supabase.from).toHaveBeenCalledWith("layout_lab_saved_layouts");
    expect(insertedPayload).toMatchObject({
      player_id: "user-1",
      mode_id: "classic",
      layout_name: "layout-classic-test",
      seed: "20260322",
      board_size: 15,
      premium_squares: {
        "0,0": "tw",
        "1,3": "dl",
        "7,7": "center",
      },
      tile_counts: {
        center: 1,
        tw: 1,
        dw: 0,
        tl: 0,
        dl: 1,
      },
    });
  });

  it("fetches saved layouts for the active user and mode", async () => {
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
          id: "layout-2",
          layout_name: "my layout",
          mode_id: "mini",
          saved_at: "2026-03-22T12:00:00.000Z",
          premium_squares: {
            "5,5": "center",
            "0,0": "tw",
            "1,1": "invalid",
          },
        },
      ],
      error: null,
    });

    getSupabaseClient.mockReturnValue({
      from: jest.fn().mockReturnValue(queryBuilder),
    });

    const result = await fetchSavedLayoutLabLayouts({ mode: "mini", limit: 10 });

    expect(result.ok).toBe(true);
    expect(result.layouts).toHaveLength(1);
    expect(result.layouts[0]).toEqual({
      id: "layout-2",
      layoutName: "my layout",
      mode: "mini",
      savedAt: "2026-03-22T12:00:00.000Z",
      premiumSquares: {
        "0,0": "tw",
        "5,5": "center",
      },
    });
  });
});
