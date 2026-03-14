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
  fetchUnreadMultiplayerNotifications,
  markSessionSeen,
  subscribeToMultiplayerInbox,
} from "../multiplayerInboxService";
import { ensureSupabaseSession, getSupabaseClient } from "../../lib/supabase";

describe("multiplayerInboxService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ensureSupabaseSession.mockResolvedValue({
      ok: true,
      session: { user: { id: "user-1" } },
    });
  });

  it("loads unread notifications scoped to current recipient", async () => {
    const query = {
      select: jest.fn(),
      eq: jest.fn(),
      is: jest.fn(),
      order: jest.fn(),
      limit: jest.fn(),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.is.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.limit.mockResolvedValue({
      data: [
        { id: "n1", recipient_user_id: "user-1", read_at: null, created_at: "2026-03-14T00:00:00.000Z" },
      ],
      error: null,
    });

    const supabase = {
      from: jest.fn(() => query),
    };
    getSupabaseClient.mockReturnValue(supabase);

    const result = await fetchUnreadMultiplayerNotifications(10);

    expect(result.ok).toBe(true);
    expect(result.notifications).toHaveLength(1);
    expect(query.eq).toHaveBeenCalledWith("recipient_user_id", "user-1");
    expect(query.is).toHaveBeenCalledWith("read_at", null);
    expect(query.limit).toHaveBeenCalledWith(10);
  });

  it("marks session seen through RPC", async () => {
    const supabase = {
      rpc: jest.fn().mockResolvedValue({
        data: { ok: true, reason: "session_seen_marked" },
        error: null,
      }),
    };
    getSupabaseClient.mockReturnValue(supabase);

    const result = await markSessionSeen({
      sessionId: "mp-1",
      seenRevision: 11,
    });

    expect(result).toEqual({
      ok: true,
      reason: "session_seen_marked",
    });
    expect(supabase.rpc).toHaveBeenCalledWith("mark_session_seen", {
      p_session_id: "mp-1",
      p_seen_revision: 11,
    });
  });

  it("creates one inbox realtime channel and returns unsubscribe", async () => {
    let statusHandler = null;
    const channel = {
      on: jest.fn(() => channel),
      subscribe: jest.fn((handler) => {
        statusHandler = handler;
        handler("SUBSCRIBED");
        return channel;
      }),
    };
    const supabase = {
      channel: jest.fn(() => channel),
      removeChannel: jest.fn(),
    };
    getSupabaseClient.mockReturnValue(supabase);

    const onStatusChange = jest.fn();
    const result = await subscribeToMultiplayerInbox({ onStatusChange });

    expect(result.ok).toBe(true);
    expect(supabase.channel).toHaveBeenCalledWith("multiplayer-inbox:user-1");
    expect(onStatusChange).toHaveBeenCalledWith("SUBSCRIBED");

    result.unsubscribe();
    expect(supabase.removeChannel).toHaveBeenCalledWith(channel);
    expect(typeof statusHandler).toBe("function");
  });
});
