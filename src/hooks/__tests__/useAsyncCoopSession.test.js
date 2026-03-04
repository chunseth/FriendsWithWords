jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

import {
  createInitialSession,
  resolveLocalPlayerId,
} from "../useAsyncCoopSession";

describe("resolveLocalPlayerId", () => {
  it("uses the first participant id as the starting active player", () => {
    const session = createInitialSession({
      sessionId: "mp-test",
      players: [
        { id: "sender-123", displayName: "Sender" },
        { id: "receiver-456", displayName: "Receiver" },
      ],
    });

    expect(session.turn.activePlayerId).toBe("sender-123");
  });

  it("prefers the authenticated participant id when it is present", () => {
    const session = createInitialSession({
      sessionId: "mp-test",
      players: [
        { id: "sender-123", displayName: "Sender" },
        { id: "receiver-456", displayName: "Receiver" },
      ],
    });

    expect(
      resolveLocalPlayerId({
        session,
        authenticatedUserId: "receiver-456",
        fallbackPlayerId: "player-1",
      })
    ).toBe("receiver-456");
  });

  it("falls back to the first session player when the default id is absent", () => {
    const session = createInitialSession({
      sessionId: "mp-test",
      players: [
        { id: "sender-123", displayName: "Sender" },
        { id: "receiver-456", displayName: "Receiver" },
      ],
    });

    expect(
      resolveLocalPlayerId({
        session,
        authenticatedUserId: null,
        fallbackPlayerId: "player-1",
      })
    ).toBe("sender-123");
  });
});
