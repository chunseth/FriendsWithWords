jest.mock("../../config/backend", () => ({
  isBackendConfigured: jest.fn(() => true),
}));

jest.mock("../../lib/supabase", () => ({
  ensureSupabaseSession: jest.fn(),
  getSupabaseClient: jest.fn(),
}));

import {
  commitRemoteMultiplayerTurn,
  subscribeToRemoteMultiplayerSession,
} from "../multiplayerSessionService";
import { ensureSupabaseSession, getSupabaseClient } from "../../lib/supabase";

describe("multiplayerSessionService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns typed revision conflict details from turn commit rpc", async () => {
    const supabase = {
      rpc: jest.fn().mockResolvedValue({
        data: {
          ok: false,
          reason: "revision_conflict",
          current_revision: 8,
          session: { sessionId: "mp-1", boardRevision: 8 },
        },
        error: null,
      }),
    };

    getSupabaseClient.mockReturnValue(supabase);
    ensureSupabaseSession.mockResolvedValue({
      ok: true,
      session: { user: { id: "player-1" } },
    });

    const result = await commitRemoteMultiplayerTurn({
      sessionId: "mp-1",
      expectedRevision: 7,
      action: "play",
      nextSession: { sessionId: "mp-1", boardRevision: 8 },
    });

    expect(result).toEqual({
      ok: false,
      reason: "revision_conflict",
      session: { sessionId: "mp-1", boardRevision: 8 },
      currentRevision: 8,
      status: null,
      activePlayerId: null,
    });
  });

  it("coalesces burst realtime events into a single refetch", async () => {
    jest.useFakeTimers();

    const maybeSingle = jest.fn().mockResolvedValue({
      data: {
        session_payload: { sessionId: "mp-1", boardRevision: 2, savedAt: 2 },
      },
      error: null,
    });
    const selectBuilder = {
      select: jest.fn(),
      eq: jest.fn(),
      maybeSingle,
    };
    selectBuilder.select.mockReturnValue(selectBuilder);
    selectBuilder.eq.mockReturnValue(selectBuilder);

    let postgresHandler = null;
    let statusHandler = null;
    const channel = {
      on: jest.fn((type, filter, handler) => {
        if (type === "postgres_changes") {
          postgresHandler = handler;
        }
        return channel;
      }),
      subscribe: jest.fn((handler) => {
        statusHandler = handler;
        handler("SUBSCRIBED");
        return channel;
      }),
    };

    const supabase = {
      from: jest.fn(() => selectBuilder),
      channel: jest.fn(() => channel),
      removeChannel: jest.fn(),
    };
    getSupabaseClient.mockReturnValue(supabase);
    ensureSupabaseSession.mockResolvedValue({
      ok: true,
      session: { user: { id: "player-1" } },
    });

    const onSession = jest.fn();
    const onStatus = jest.fn();
    await subscribeToRemoteMultiplayerSession("mp-1", onSession, onStatus);

    expect(typeof postgresHandler).toBe("function");
    expect(typeof statusHandler).toBe("function");

    postgresHandler();
    postgresHandler();
    postgresHandler();

    jest.advanceTimersByTime(200);
    await Promise.resolve();
    await Promise.resolve();

    expect(supabase.from).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
