jest.mock("../../config/backend", () => ({
  isBackendConfigured: jest.fn(() => true),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock("../../lib/supabase", () => ({
  ensureSupabaseSession: jest.fn(),
  getSupabaseClient: jest.fn(),
}));

import { acceptMultiplayerGameRequest } from "../multiplayerGameRequestService";
import { ensureSupabaseSession, getSupabaseClient } from "../../lib/supabase";

const createProfilesBuilder = (profiles) => {
  const builder = {
    select: jest.fn(),
    in: jest.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.in.mockResolvedValue({ data: profiles, error: null });
  return builder;
};

describe("acceptMultiplayerGameRequest", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("accepts via single rpc call and returns session id", async () => {
    const profilesBuilder = createProfilesBuilder([
      { id: "sender-1", username: "sender", display_name: "Sender" },
      { id: "receiver-1", username: "receiver", display_name: "Receiver" },
    ]);

    const supabase = {
      from: jest.fn(() => profilesBuilder),
      rpc: jest.fn().mockResolvedValue({
        data: { ok: true, reason: "request_accepted", session_id: "mp-123" },
        error: null,
      }),
    };

    getSupabaseClient.mockReturnValue(supabase);
    ensureSupabaseSession.mockResolvedValue({
      ok: true,
      session: { user: { id: "receiver-1" } },
    });

    const result = await acceptMultiplayerGameRequest({
      requestId: "req-1",
      senderId: "sender-1",
      seed: "20260314",
      gameType: "seeded",
    });

    expect(result).toEqual({
      ok: true,
      reason: "request_accepted",
      sessionId: "mp-123",
    });
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it("surfaces rpc failures without attempting second write path", async () => {
    const profilesBuilder = createProfilesBuilder([]);
    const supabase = {
      from: jest.fn(() => profilesBuilder),
      rpc: jest.fn().mockResolvedValue({
        data: { ok: false, reason: "request_not_pending" },
        error: null,
      }),
    };

    getSupabaseClient.mockReturnValue(supabase);
    ensureSupabaseSession.mockResolvedValue({
      ok: true,
      session: { user: { id: "receiver-1" } },
    });

    const result = await acceptMultiplayerGameRequest({
      requestId: "req-1",
      senderId: "sender-1",
      seed: "20260314",
      gameType: "seeded",
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("request_not_pending");
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });
});
