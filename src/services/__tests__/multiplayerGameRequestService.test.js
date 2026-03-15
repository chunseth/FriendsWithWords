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

import {
  acceptMultiplayerGameRequest,
  loadMultiplayerGameRequests,
  sendMultiplayerGameRequest,
} from "../multiplayerGameRequestService";
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
      functions: {
        invoke: jest.fn().mockResolvedValue({ data: { ok: true } }),
      },
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
    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      "notify-multiplayer-event",
      {
        body: expect.objectContaining({
          user_id: "sender-1",
          type: "request_accepted",
          entity_id: "mp-123",
          send_push: true,
          skip_enqueue: true,
        }),
      }
    );
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

describe("loadMultiplayerGameRequests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("derives needsAction and unread state from session + seen revision rows", async () => {
    const requestRows = [
      {
        id: "req-accepted-incoming",
        sender_id: "user-2",
        receiver_id: "user-1",
        game_type: "seeded",
        seed: "20260314",
        status: "accepted",
        session_id: "mp-1",
        created_at: "2026-03-10T00:00:00.000Z",
        updated_at: "2026-03-10T01:00:00.000Z",
      },
      {
        id: "req-pending-incoming",
        sender_id: "user-3",
        receiver_id: "user-1",
        game_type: "daily",
        seed: "20260315",
        status: "pending",
        session_id: null,
        created_at: "2026-03-11T00:00:00.000Z",
        updated_at: "2026-03-11T01:00:00.000Z",
      },
    ];

    const requestsBuilder = {
      select: jest.fn(),
      or: jest.fn(),
      in: jest.fn(),
      order: jest.fn(),
    };
    requestsBuilder.select.mockReturnValue(requestsBuilder);
    requestsBuilder.or.mockReturnValue(requestsBuilder);
    requestsBuilder.in.mockReturnValue(requestsBuilder);
    requestsBuilder.order.mockResolvedValue({ data: requestRows, error: null });

    const profilesBuilder = {
      select: jest.fn(),
      in: jest.fn(),
    };
    profilesBuilder.select.mockReturnValue(profilesBuilder);
    profilesBuilder.in.mockResolvedValue({
      data: [
        { id: "user-2", username: "friend2", display_name: "Friend Two" },
        { id: "user-3", username: "friend3", display_name: "Friend Three" },
      ],
      error: null,
    });

    const sessionsBuilder = {
      select: jest.fn(),
      in: jest.fn(),
    };
    sessionsBuilder.select.mockReturnValue(sessionsBuilder);
    sessionsBuilder.in.mockResolvedValue({
      data: [
        {
          session_id: "mp-1",
          board_revision: 9,
          active_player_id: "user-1",
          status: "active",
        },
      ],
      error: null,
    });

    const sessionStateBuilder = {
      select: jest.fn(),
      eq: jest.fn(),
      in: jest.fn(),
    };
    sessionStateBuilder.select.mockReturnValue(sessionStateBuilder);
    sessionStateBuilder.eq.mockReturnValue(sessionStateBuilder);
    sessionStateBuilder.in.mockResolvedValue({
      data: [{ session_id: "mp-1", last_seen_revision: 7 }],
      error: null,
    });

    const presenceBuilder = {
      select: jest.fn(),
      in: jest.fn(),
    };
    presenceBuilder.select.mockReturnValue(presenceBuilder);
    presenceBuilder.in.mockResolvedValue({
      data: [{ user_id: "user-2", status: "online", last_active_at: "2026-03-11T02:00:00.000Z" }],
      error: null,
    });

    const supabase = {
      from: jest.fn((table) => {
        if (table === "multiplayer_game_requests") return requestsBuilder;
        if (table === "profiles") return profilesBuilder;
        if (table === "multiplayer_sessions") return sessionsBuilder;
        if (table === "multiplayer_user_session_state") return sessionStateBuilder;
        if (table === "user_presence") return presenceBuilder;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    getSupabaseClient.mockReturnValue(supabase);
    ensureSupabaseSession.mockResolvedValue({
      ok: true,
      session: { user: { id: "user-1" } },
    });

    const result = await loadMultiplayerGameRequests();

    expect(result.ok).toBe(true);
    expect(result.requests).toHaveLength(2);

    const accepted = result.requests.find((entry) => entry.id === "req-accepted-incoming");
    const pending = result.requests.find((entry) => entry.id === "req-pending-incoming");

    expect(accepted).toMatchObject({
      sessionId: "mp-1",
      status: "accepted",
      needsAction: true,
      hasUnreadSessionUpdate: true,
      archived: false,
      presenceStatus: "online",
    });
    expect(pending).toMatchObject({
      status: "pending",
      needsAction: true,
      hasUnreadSessionUpdate: false,
    });
  });
});

describe("sendMultiplayerGameRequest", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends request and invokes game_request notification push", async () => {
    const pendingLookupBuilder = {
      select: jest.fn(),
      eq: jest.fn(),
      maybeSingle: jest.fn(),
    };
    pendingLookupBuilder.select.mockReturnValue(pendingLookupBuilder);
    pendingLookupBuilder.eq.mockReturnValue(pendingLookupBuilder);
    pendingLookupBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });

    const insertBuilder = {
      insert: jest.fn(),
      select: jest.fn(),
      single: jest.fn(),
    };
    insertBuilder.insert.mockReturnValue(insertBuilder);
    insertBuilder.select.mockReturnValue(insertBuilder);
    insertBuilder.single.mockResolvedValue({ data: { id: "req-123" }, error: null });

    const profileBuilder = {
      select: jest.fn(),
      eq: jest.fn(),
      maybeSingle: jest.fn(),
    };
    profileBuilder.select.mockReturnValue(profileBuilder);
    profileBuilder.eq.mockReturnValue(profileBuilder);
    profileBuilder.maybeSingle.mockResolvedValue({
      data: { username: "sender_name", display_name: "Sender Name" },
      error: null,
    });

    const supabase = {
      from: jest
        .fn()
        .mockReturnValueOnce(pendingLookupBuilder)
        .mockReturnValueOnce(insertBuilder)
        .mockReturnValueOnce(profileBuilder),
      functions: {
        invoke: jest.fn().mockResolvedValue({ data: { ok: true }, error: null }),
      },
    };

    getSupabaseClient.mockReturnValue(supabase);
    ensureSupabaseSession.mockResolvedValue({
      ok: true,
      session: { user: { id: "sender-1" } },
    });

    const result = await sendMultiplayerGameRequest({
      receiverId: "receiver-1",
      gameType: "seeded",
      seed: "20260314",
    });

    expect(result).toEqual({
      ok: true,
      reason: "request_sent",
      requestId: "req-123",
    });
    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      "notify-multiplayer-event",
      {
        body: expect.objectContaining({
          user_id: "receiver-1",
          type: "game_request",
          entity_id: "req-123",
          send_push: true,
          skip_enqueue: true,
        }),
      }
    );
  });

  it("returns already_pending without invoking notification when request exists", async () => {
    const pendingLookupBuilder = {
      select: jest.fn(),
      eq: jest.fn(),
      maybeSingle: jest.fn(),
    };
    pendingLookupBuilder.select.mockReturnValue(pendingLookupBuilder);
    pendingLookupBuilder.eq.mockReturnValue(pendingLookupBuilder);
    pendingLookupBuilder.maybeSingle.mockResolvedValue({
      data: { id: "req-existing" },
      error: null,
    });

    const supabase = {
      from: jest.fn().mockReturnValueOnce(pendingLookupBuilder),
      functions: {
        invoke: jest.fn(),
      },
    };

    getSupabaseClient.mockReturnValue(supabase);
    ensureSupabaseSession.mockResolvedValue({
      ok: true,
      session: { user: { id: "sender-1" } },
    });

    const result = await sendMultiplayerGameRequest({
      receiverId: "receiver-1",
      gameType: "seeded",
      seed: "20260314",
    });

    expect(result).toEqual({
      ok: true,
      reason: "already_pending",
      requestId: "req-existing",
    });
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });
});
