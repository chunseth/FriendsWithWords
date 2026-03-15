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
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  sendFriendRequest,
} from "../friendService";
import { ensureSupabaseSession, getSupabaseClient } from "../../lib/supabase";

describe("friendService.removeFriend", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ensureSupabaseSession.mockResolvedValue({
      ok: true,
      session: { user: { id: "user-1" } },
    });
  });

  it("removes friendship row and returns friend_removed", async () => {
    const query = {
      delete: jest.fn(),
      match: jest.fn(),
      select: jest.fn(),
    };
    query.delete.mockReturnValue(query);
    query.match.mockReturnValue(query);
    query.select.mockResolvedValue({
      data: [{ id: "friendship-1" }],
      error: null,
    });

    getSupabaseClient.mockReturnValue({
      from: jest.fn(() => query),
    });

    const result = await removeFriend("user-2");

    expect(result).toEqual({
      ok: true,
      reason: "friend_removed",
    });
    expect(query.match).toHaveBeenCalledWith({
      player_low_id: "user-1",
      player_high_id: "user-2",
    });
  });

  it("returns friend_not_found when no row is deleted", async () => {
    const query = {
      delete: jest.fn(),
      match: jest.fn(),
      select: jest.fn(),
    };
    query.delete.mockReturnValue(query);
    query.match.mockReturnValue(query);
    query.select.mockResolvedValue({
      data: [],
      error: null,
    });

    getSupabaseClient.mockReturnValue({
      from: jest.fn(() => query),
    });

    const result = await removeFriend("user-2");

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("friend_not_found");
  });
});

describe("friendService friend request transitions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ensureSupabaseSession.mockResolvedValue({
      ok: true,
      session: { user: { id: "user-1" } },
    });
  });

  it("declineFriendRequest returns request_not_found when no row is updated", async () => {
    const query = {
      update: jest.fn(),
      eq: jest.fn(),
      select: jest.fn(),
    };
    query.update.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.select.mockResolvedValue({
      data: [],
      error: null,
    });

    getSupabaseClient.mockReturnValue({
      from: jest.fn(() => query),
    });

    const result = await declineFriendRequest("req-1", "user-2");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("request_not_found");
  });

  it("acceptFriendRequest returns request_not_found when no row is updated", async () => {
    const updateQuery = {
      update: jest.fn(),
      eq: jest.fn(),
      select: jest.fn(),
    };
    updateQuery.update.mockReturnValue(updateQuery);
    updateQuery.eq.mockReturnValue(updateQuery);
    updateQuery.select.mockResolvedValue({
      data: [],
      error: null,
    });

    getSupabaseClient.mockReturnValue({
      from: jest.fn(() => updateQuery),
    });

    const result = await acceptFriendRequest("req-1", "user-2");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("request_not_found");
  });

  it("sendFriendRequest triggers push notification for receiver", async () => {
    const friendshipLookup = {
      select: jest.fn(),
      match: jest.fn(),
      maybeSingle: jest.fn(),
    };
    friendshipLookup.select.mockReturnValue(friendshipLookup);
    friendshipLookup.match.mockReturnValue(friendshipLookup);
    friendshipLookup.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    const requestLookup = {
      select: jest.fn(),
      or: jest.fn(),
    };
    requestLookup.select.mockReturnValue(requestLookup);
    requestLookup.or.mockResolvedValue({
      data: [],
      error: null,
    });

    const requestInsert = {
      insert: jest.fn(),
    };
    requestInsert.insert.mockResolvedValue({
      error: null,
    });
    const profileLookup = {
      select: jest.fn(),
      eq: jest.fn(),
      maybeSingle: jest.fn(),
    };
    profileLookup.select.mockReturnValue(profileLookup);
    profileLookup.eq.mockReturnValue(profileLookup);
    profileLookup.maybeSingle.mockResolvedValue({
      data: { username: "sender_user", display_name: "Sender User" },
      error: null,
    });

    const from = jest
      .fn()
      .mockImplementationOnce(() => friendshipLookup)
      .mockImplementationOnce(() => requestLookup)
      .mockImplementationOnce(() => requestInsert)
      .mockImplementationOnce(() => profileLookup);
    const functions = { invoke: jest.fn().mockResolvedValue({ data: { ok: true } }) };

    getSupabaseClient.mockReturnValue({
      from,
      functions,
    });

    const result = await sendFriendRequest("user-2");

    expect(result).toEqual({ ok: true, reason: "request_sent" });
    expect(functions.invoke).toHaveBeenCalledWith("notify-multiplayer-event", {
      body: expect.objectContaining({
        user_id: "user-2",
        type: "friend_request",
        body: "sender_user sent you a friend request.",
        send_push: true,
        skip_enqueue: true,
      }),
    });
  });

  it("acceptFriendRequest triggers push notification for original sender", async () => {
    const updateQuery = {
      update: jest.fn(),
      eq: jest.fn(),
      select: jest.fn(),
    };
    updateQuery.update.mockReturnValue(updateQuery);
    updateQuery.eq.mockReturnValue(updateQuery);
    updateQuery.select.mockResolvedValue({
      data: [{ id: "req-1" }],
      error: null,
    });

    const friendshipUpsert = {
      upsert: jest.fn(),
    };
    friendshipUpsert.upsert.mockResolvedValue({
      error: null,
    });
    const profileLookup = {
      select: jest.fn(),
      eq: jest.fn(),
      maybeSingle: jest.fn(),
    };
    profileLookup.select.mockReturnValue(profileLookup);
    profileLookup.eq.mockReturnValue(profileLookup);
    profileLookup.maybeSingle.mockResolvedValue({
      data: { username: "acceptor_user", display_name: "Acceptor User" },
      error: null,
    });

    const from = jest
      .fn()
      .mockImplementationOnce(() => updateQuery)
      .mockImplementationOnce(() => friendshipUpsert)
      .mockImplementationOnce(() => profileLookup);
    const functions = { invoke: jest.fn().mockResolvedValue({ data: { ok: true } }) };

    getSupabaseClient.mockReturnValue({
      from,
      functions,
    });

    const result = await acceptFriendRequest("req-1", "user-2");

    expect(result).toEqual({ ok: true, reason: "request_accepted" });
    expect(functions.invoke).toHaveBeenCalledWith("notify-multiplayer-event", {
      body: expect.objectContaining({
        user_id: "user-2",
        type: "friend_request_accepted",
        body: "acceptor_user accepted your friend request.",
        send_push: true,
        skip_enqueue: true,
      }),
    });
  });
});
