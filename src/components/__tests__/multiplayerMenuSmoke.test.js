import React from "react";
import renderer, { act } from "react-test-renderer";
import { Pressable, Text, TextInput, TouchableOpacity, View } from "react-native";
import MultiplayerMenuScreen from "../MultiplayerMenuScreen";

const mockSearchProfilesByUsername = jest.fn();
const mockLoadFriendState = jest.fn();
const mockSendFriendRequest = jest.fn();
const mockAcceptFriendRequest = jest.fn();
const mockDeclineFriendRequest = jest.fn();
const mockRemoveFriend = jest.fn();
const mockLoadMultiplayerGameRequests = jest.fn();
const mockSendMultiplayerGameRequest = jest.fn();
const mockAcceptMultiplayerGameRequest = jest.fn();
const mockDeclineMultiplayerGameRequest = jest.fn();
const mockCancelMultiplayerGameRequest = jest.fn();
const mockDeleteAcceptedMultiplayerGame = jest.fn();
const mockFetchUnreadMultiplayerNotifications = jest.fn();
const mockMarkMultiplayerNotificationsRead = jest.fn();
const mockCreateMultiplayerRematch = jest.fn();
const mockArchiveMultiplayerSessionForUser = jest.fn();
const mockSubscribeToMultiplayerInbox = jest.fn();
const mockUpsertPresence = jest.fn();
const mockTrackMultiplayerEvent = jest.fn();

jest.mock("../../services/profileService", () => ({
  searchProfilesByUsername: (...args) => mockSearchProfilesByUsername(...args),
}));

jest.mock("../../services/friendService", () => ({
  loadFriendState: (...args) => mockLoadFriendState(...args),
  sendFriendRequest: (...args) => mockSendFriendRequest(...args),
  acceptFriendRequest: (...args) => mockAcceptFriendRequest(...args),
  declineFriendRequest: (...args) => mockDeclineFriendRequest(...args),
  removeFriend: (...args) => mockRemoveFriend(...args),
}));

jest.mock("../../services/multiplayerGameRequestService", () => ({
  loadMultiplayerGameRequests: (...args) =>
    mockLoadMultiplayerGameRequests(...args),
  sendMultiplayerGameRequest: (...args) =>
    mockSendMultiplayerGameRequest(...args),
  acceptMultiplayerGameRequest: (...args) =>
    mockAcceptMultiplayerGameRequest(...args),
  declineMultiplayerGameRequest: (...args) =>
    mockDeclineMultiplayerGameRequest(...args),
  cancelMultiplayerGameRequest: (...args) =>
    mockCancelMultiplayerGameRequest(...args),
  deleteAcceptedMultiplayerGame: (...args) =>
    mockDeleteAcceptedMultiplayerGame(...args),
}));

jest.mock("../../services/multiplayerInboxService", () => ({
  fetchUnreadMultiplayerNotifications: (...args) =>
    mockFetchUnreadMultiplayerNotifications(...args),
  markMultiplayerNotificationsRead: (...args) =>
    mockMarkMultiplayerNotificationsRead(...args),
  createMultiplayerRematch: (...args) =>
    mockCreateMultiplayerRematch(...args),
  archiveMultiplayerSessionForUser: (...args) =>
    mockArchiveMultiplayerSessionForUser(...args),
  subscribeToMultiplayerInbox: (...args) =>
    mockSubscribeToMultiplayerInbox(...args),
  upsertPresence: (...args) => mockUpsertPresence(...args),
}));

jest.mock("../../services/analyticsService", () => ({
  trackMultiplayerEvent: (...args) => mockTrackMultiplayerEvent(...args),
}));

jest.mock("../MultiplayerPlayGamePanel", () => {
  const React = require("react");
  const { Text, TouchableOpacity, View } = require("react-native");
  return function MockMultiplayerPlayGamePanel({
    visible,
    onDailyGame,
    onNewGameRandom,
    onNewGameWithSeed,
  }) {
    if (!visible) {
      return <View />;
    }

    return (
      <View>
        <TouchableOpacity onPress={onDailyGame}>
          <Text>Daily Game</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onNewGameRandom}>
          <Text>New Game</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onNewGameWithSeed?.("123456")}>
          <Text>Play</Text>
        </TouchableOpacity>
      </View>
    );
  };
});

jest.mock("../MessageOverlay", () => {
  const React = require("react");
  const { Text, View } = require("react-native");
  return function MockMessageOverlay({ message }) {
    if (!message) {
      return null;
    }
    return (
      <View>
        <Text>{message.title}</Text>
        <Text>{message.text}</Text>
      </View>
    );
  };
});

jest.mock("../PendingGameRequestModal", () => {
  const React = require("react");
  const { Text, TouchableOpacity, View } = require("react-native");
  return function MockPendingGameRequestModal({
    visible,
    friendName,
    title,
    onConfirm,
  }) {
    if (!visible) {
      return null;
    }
    return (
      <View>
        <Text>{title}</Text>
        <Text>{friendName}</Text>
        <TouchableOpacity onPress={onConfirm}>
          <Text>{title === "Delete Active Game?" ? "Delete Game" : "Unsend Request"}</Text>
        </TouchableOpacity>
      </View>
    );
  };
});

jest.mock("react-native-sfsymbols", () => ({
  SFSymbol: () => null,
}));

describe("multiplayer menu smoke", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchProfilesByUsername.mockResolvedValue({
      ok: true,
      profiles: [],
    });
    mockLoadFriendState.mockResolvedValue({
      ok: true,
      friends: [],
      incomingRequests: [],
      outgoingRequests: [],
    });
    mockSendFriendRequest.mockResolvedValue({
      ok: true,
      reason: "request_sent",
    });
    mockAcceptFriendRequest.mockResolvedValue({
      ok: true,
      reason: "request_accepted",
    });
    mockDeclineFriendRequest.mockResolvedValue({
      ok: true,
      reason: "request_declined",
    });
    mockRemoveFriend.mockResolvedValue({
      ok: true,
      reason: "friend_removed",
    });
    mockLoadMultiplayerGameRequests.mockResolvedValue({
      ok: true,
      requests: [],
    });
    mockSendMultiplayerGameRequest.mockResolvedValue({
      ok: true,
      reason: "request_sent",
    });
    mockAcceptMultiplayerGameRequest.mockResolvedValue({
      ok: true,
      reason: "request_accepted",
      sessionId: "session-1",
    });
    mockDeclineMultiplayerGameRequest.mockResolvedValue({
      ok: true,
      reason: "request_declined",
    });
    mockCancelMultiplayerGameRequest.mockResolvedValue({
      ok: true,
      reason: "request_canceled",
    });
    mockDeleteAcceptedMultiplayerGame.mockResolvedValue({
      ok: true,
      reason: "game_deleted",
    });
    mockFetchUnreadMultiplayerNotifications.mockResolvedValue({
      ok: true,
      notifications: [],
    });
    mockMarkMultiplayerNotificationsRead.mockResolvedValue({
      ok: true,
      updatedCount: 0,
    });
    mockCreateMultiplayerRematch.mockResolvedValue({
      ok: true,
      sessionId: "session-rematch-1",
    });
    mockArchiveMultiplayerSessionForUser.mockResolvedValue({
      ok: true,
      reason: "session_archived",
    });
    mockSubscribeToMultiplayerInbox.mockResolvedValue({
      ok: true,
      unsubscribe: jest.fn(),
    });
    mockUpsertPresence.mockResolvedValue({
      ok: true,
      reason: "presence_updated",
    });
    mockTrackMultiplayerEvent.mockResolvedValue({
      ok: true,
    });
  });

  it("renders active games by default", async () => {
    let tree;
    await act(async () => {
      tree = renderer.create(
        <MultiplayerMenuScreen
          dailySeed="20260301"
          onBack={jest.fn()}
          onOpenActiveGame={jest.fn()}
          onOpenNewMultiplayerGame={jest.fn()}
        />
      );
      await Promise.resolve();
    });

    const texts = tree.root.findAllByType(Text).map((node) => {
      const value = node.props.children;
      return Array.isArray(value) ? value.join("") : String(value);
    });

    expect(texts).toContain("Multiplayer");
    expect(texts).toContain("Active Games");
    expect(texts).toContain("Friends");
    expect(texts).toContain("No Active Games");
    expect(texts).toContain("Start a multiplayer run from the Friends tab.");

    act(() => {
      tree.unmount();
    });
  });

  it("renders an empty friends state", async () => {
    let tree;
    await act(async () => {
      tree = renderer.create(
        <MultiplayerMenuScreen
          dailySeed="20260301"
          onBack={jest.fn()}
          onOpenActiveGame={jest.fn()}
          onOpenNewMultiplayerGame={jest.fn()}
        />
      );
    });

    const buttons = tree.root.findAllByType(TouchableOpacity);
    const friendsTab = buttons.find((node) =>
      node.findAllByType(Text).some((textNode) => textNode.props.children === "Friends")
    );

    await act(async () => {
      friendsTab.props.onPress();
      await Promise.resolve();
    });

    const texts = tree.root.findAllByType(Text).map((node) => {
      const value = node.props.children;
      return Array.isArray(value) ? value.join("") : String(value);
    });

    expect(texts).toContain("No Friends Yet");
    expect(texts).toContain("Search for a friend above to add them.");

    act(() => {
      tree.unmount();
    });
  });

  it("shows a found user as a search result with an add button", async () => {
    mockSearchProfilesByUsername.mockResolvedValue({
      ok: true,
      profiles: [
        {
          id: "friend-123",
          username: "vibe_friend",
          displayName: "Vibe Friend",
        },
      ],
    });

    let tree;
    await act(async () => {
      tree = renderer.create(
        <MultiplayerMenuScreen
          dailySeed="20260301"
          onBack={jest.fn()}
          onOpenActiveGame={jest.fn()}
          onOpenNewMultiplayerGame={jest.fn()}
        />
      );
    });

    const buttons = tree.root.findAllByType(TouchableOpacity);
    const friendsTab = buttons.find((node) =>
      node.findAllByType(Text).some((textNode) => textNode.props.children === "Friends")
    );

    await act(async () => {
      friendsTab.props.onPress();
    });

    const input = tree.root.findByType(TextInput);

    await act(async () => {
      input.props.onChangeText("vibe_friend");
    });

    const searchButton = tree.root.findAllByType(TouchableOpacity).find(
      (node) => node.props.accessibilityLabel === "Search"
    );

    await act(async () => {
      await searchButton.props.onPress();
    });

    const texts = tree.root.findAllByType(Text).map((node) => {
      const value = node.props.children;
      return Array.isArray(value) ? value.join("") : String(value);
    });

    expect(mockSearchProfilesByUsername).toHaveBeenCalledWith("vibe_friend");
    expect(texts).toContain("@vibe_friend");
    expect(texts).toContain("Add");

    act(() => {
      tree.unmount();
    });
  });

  it("shows no users found when search returns no profiles", async () => {
    let tree;
    await act(async () => {
      tree = renderer.create(
        <MultiplayerMenuScreen
          dailySeed="20260301"
          onBack={jest.fn()}
          onOpenActiveGame={jest.fn()}
          onOpenNewMultiplayerGame={jest.fn()}
        />
      );
    });

    const buttons = tree.root.findAllByType(TouchableOpacity);
    const friendsTab = buttons.find((node) =>
      node.findAllByType(Text).some((textNode) => textNode.props.children === "Friends")
    );

    await act(async () => {
      friendsTab.props.onPress();
    });

    const input = tree.root.findByType(TextInput);

    await act(async () => {
      input.props.onChangeText("missing_user");
    });

    const searchButton = tree.root.findAllByType(TouchableOpacity).find(
      (node) => node.props.accessibilityLabel === "Search"
    );

    await act(async () => {
      await searchButton.props.onPress();
    });

    const texts = tree.root.findAllByType(Text).map((node) => {
      const value = node.props.children;
      return Array.isArray(value) ? value.join("") : String(value);
    });

    expect(texts).toContain("No Users Found");
    expect(texts).toContain("No users found with that username.");

    act(() => {
      tree.unmount();
    });
  });

  it("sends a friend request and returns to the friends list", async () => {
    mockSearchProfilesByUsername.mockResolvedValue({
      ok: true,
      profiles: [
        {
          id: "friend-123",
          username: "vibe_friend",
          displayName: "Vibe Friend",
        },
      ],
    });
    mockLoadFriendState
      .mockResolvedValueOnce({
        ok: true,
        friends: [],
        incomingRequests: [],
        outgoingRequests: [],
      })
      .mockResolvedValueOnce({
        ok: true,
        friends: [],
        incomingRequests: [],
        outgoingRequests: [
          {
            id: "request-1",
            receiverId: "friend-123",
            name: "vibe_friend",
            displayName: "Vibe Friend",
          },
        ],
      });

    let tree;
    await act(async () => {
      tree = renderer.create(
        <MultiplayerMenuScreen
          dailySeed="20260301"
          onBack={jest.fn()}
          onOpenActiveGame={jest.fn()}
          onOpenNewMultiplayerGame={jest.fn()}
        />
      );
    });

    const friendsTab = tree.root.findAllByType(TouchableOpacity).find((node) =>
      node.findAllByType(Text).some((textNode) => textNode.props.children === "Friends")
    );

    await act(async () => {
      friendsTab.props.onPress();
    });

    const input = tree.root.findByType(TextInput);

    await act(async () => {
      input.props.onChangeText("vibe_friend");
    });

    const searchButton = tree.root.findAllByType(TouchableOpacity).find(
      (node) => node.props.accessibilityLabel === "Search"
    );

    await act(async () => {
      await searchButton.props.onPress();
    });

    const addButton = tree.root.findAllByType(TouchableOpacity).find((node) =>
      node.findAllByType(Text).some((textNode) => textNode.props.children === "Add")
    );

    await act(async () => {
      await addButton.props.onPress();
    });

    expect(tree.root.findByType(TextInput).props.value).toBe("");
    expect(mockSendFriendRequest).toHaveBeenCalledWith("friend-123");

    const texts = tree.root.findAllByType(Text).map((node) => {
      const value = node.props.children;
      return Array.isArray(value) ? value.join("") : String(value);
    });

    expect(texts).toContain("No Friends Yet");
    expect(texts).not.toContain("No Users Found");
    expect(texts).toContain("Friend Request Sent");
    expect(texts).toContain(
      "Your request to @vibe_friend is waiting for them to accept."
    );

    act(() => {
      tree.unmount();
    });
  });

  it("shows and accepts an incoming friend request", async () => {
    mockLoadFriendState.mockResolvedValue({
      ok: true,
      friends: [],
      incomingRequests: [
        {
          id: "request-22",
          senderId: "friend-22",
          name: "vape_friend",
          displayName: "Vape Friend",
        },
      ],
      outgoingRequests: [],
    });

    let tree;
    await act(async () => {
      tree = renderer.create(
        <MultiplayerMenuScreen
          dailySeed="20260301"
          onBack={jest.fn()}
          onOpenActiveGame={jest.fn()}
          onOpenNewMultiplayerGame={jest.fn()}
        />
      );
    });

    const friendsTab = tree.root.findAllByType(TouchableOpacity).find((node) =>
      node.findAllByType(Text).some((textNode) => textNode.props.children === "Friends")
    );

    await act(async () => {
      friendsTab.props.onPress();
    });

    const textsBefore = tree.root.findAllByType(Text).map((node) => {
      const value = node.props.children;
      return Array.isArray(value) ? value.join("") : String(value);
    });

    expect(textsBefore).toContain("Friend Requests");
    expect(textsBefore).toContain("@vape_friend");

    const acceptButton = tree.root.findAllByType(TouchableOpacity).find((node) =>
      node.findAllByType(Text).some((textNode) => textNode.props.children === "Accept")
    );

    await act(async () => {
      await acceptButton.props.onPress();
    });

    expect(mockAcceptFriendRequest).toHaveBeenCalledWith(
      "request-22",
      "friend-22"
    );

    act(() => {
      tree.unmount();
    });
  });

  it("allows an incoming friend request to be declined", async () => {
    mockLoadFriendState.mockResolvedValue({
      ok: true,
      friends: [],
      incomingRequests: [
        {
          id: "request-30",
          senderId: "friend-30",
          name: "fave_friend",
          displayName: "Fave Friend",
        },
      ],
      outgoingRequests: [],
    });

    let tree;
    await act(async () => {
      tree = renderer.create(
        <MultiplayerMenuScreen
          dailySeed="20260301"
          onBack={jest.fn()}
          onOpenActiveGame={jest.fn()}
          onOpenNewMultiplayerGame={jest.fn()}
        />
      );
    });

    const friendsTab = tree.root.findAllByType(TouchableOpacity).find((node) =>
      node.findAllByType(Text).some((textNode) => textNode.props.children === "Friends")
    );

    await act(async () => {
      friendsTab.props.onPress();
    });

    const declineButton = tree.root.findAllByType(TouchableOpacity).find((node) =>
      node.findAllByType(Text).some((textNode) => textNode.props.children === "Decline")
    );

    await act(async () => {
      await declineButton.props.onPress();
    });

    expect(mockDeclineFriendRequest).toHaveBeenCalledWith(
      "request-30",
      "friend-30"
    );

    act(() => {
      tree.unmount();
    });
  });

  it("allows a friend to be unadded from the friend options panel", async () => {
    mockLoadFriendState.mockResolvedValue({
      ok: true,
      friends: [
        {
          id: "friend-44",
          name: "fave_friend",
          displayName: "Fave Friend",
        },
      ],
      incomingRequests: [],
      outgoingRequests: [],
    });

    let tree;
    await act(async () => {
      tree = renderer.create(
        <MultiplayerMenuScreen
          dailySeed="20260301"
          onBack={jest.fn()}
          onOpenActiveGame={jest.fn()}
          onOpenNewMultiplayerGame={jest.fn()}
        />
      );
    });

    const friendsTab = tree.root.findAllByType(TouchableOpacity).find((node) =>
      node.findAllByType(Text).some((textNode) => textNode.props.children === "Friends")
    );

    await act(async () => {
      friendsTab.props.onPress();
    });

    const friendRow = tree.root.findAllByType(Pressable).find((node) =>
      node.findAllByType(Text).some((textNode) => textNode.props.children === "fave_friend")
    );

    await act(async () => {
      friendRow.props.onPress();
    });

    const unaddButton = tree.root.findAllByType(TouchableOpacity).find((node) =>
      node.findAllByType(Text).some((textNode) => textNode.props.children === "Unadd Friend")
    );

    await act(async () => {
      await unaddButton.props.onPress();
    });

    expect(mockRemoveFriend).toHaveBeenCalledWith("friend-44");

    act(() => {
      tree.unmount();
    });
  });

  it("sends a multiplayer game request instead of opening the game immediately", async () => {
    mockLoadFriendState.mockResolvedValue({
      ok: true,
      friends: [
        {
          id: "friend-77",
          name: "vibe_friend",
          displayName: "Vibe Friend",
        },
      ],
      incomingRequests: [],
      outgoingRequests: [],
    });
    mockLoadMultiplayerGameRequests
      .mockResolvedValueOnce({
        ok: true,
        requests: [],
      })
      .mockResolvedValueOnce({
        ok: true,
        requests: [
          {
            id: "game-request-1",
            direction: "outgoing",
            friendId: "friend-77",
            friendName: "vibe_friend",
            friendDisplayName: "Vibe Friend",
            seed: "20260301",
            gameType: "daily",
            status: "pending",
            summary: "Waiting for them to accept.",
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        requests: [
          {
            id: "game-request-1",
            direction: "outgoing",
            friendId: "friend-77",
            friendName: "vibe_friend",
            friendDisplayName: "Vibe Friend",
            seed: "20260301",
            gameType: "daily",
            status: "pending",
            summary: "Waiting for them to accept.",
          },
        ],
      });

    const onOpenNewMultiplayerGame = jest.fn();
    let tree;
    await act(async () => {
      tree = renderer.create(
        <MultiplayerMenuScreen
          dailySeed="20260301"
          onBack={jest.fn()}
          onOpenActiveGame={jest.fn()}
          onOpenNewMultiplayerGame={onOpenNewMultiplayerGame}
        />
      );
    });

    const friendsTab = tree.root.findAllByType(TouchableOpacity).find((node) =>
      node.findAllByType(Text).some((textNode) => textNode.props.children === "Friends")
    );

    await act(async () => {
      friendsTab.props.onPress();
    });

    const friendRow = tree.root.findAllByType(Pressable).find((node) =>
      node.findAllByType(Text).some((textNode) => textNode.props.children === "vibe_friend")
    );

    await act(async () => {
      friendRow.props.onPress();
    });

    const playGameButton = tree.root.findAllByType(TouchableOpacity).find((node) =>
      node.findAllByType(Text).some((textNode) => textNode.props.children === "Play Game")
    );

    await act(async () => {
      playGameButton.props.onPress();
    });

    const dailyGameButton = tree.root.findAllByType(TouchableOpacity).find((node) =>
      node.findAllByType(Text).some((textNode) => textNode.props.children === "Daily Game")
    );

    await act(async () => {
      dailyGameButton.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockSendMultiplayerGameRequest).toHaveBeenCalledWith({
      receiverId: "friend-77",
      gameType: "daily",
      seed: "20260301",
    });
    expect(onOpenNewMultiplayerGame).not.toHaveBeenCalled();

    const gamesTab = tree.root.findAllByType(TouchableOpacity).find((node) =>
      node.findAllByType(Text).some((textNode) => textNode.props.children === "Active Games")
    );

    await act(async () => {
      gamesTab.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    const texts = tree.root.findAllByType(Text).map((node) => {
      const value = node.props.children;
      return Array.isArray(value) ? value.join("") : String(value);
    });

    expect(texts).toContain("vibe_friend");
    expect(texts).toContain("Pending");
    expect(texts).toContain("Waiting for them to accept.");

    act(() => {
      tree.unmount();
    });
  });

  it("shows incoming multiplayer game requests in the active games tab", async () => {
    mockLoadMultiplayerGameRequests.mockResolvedValue({
      ok: true,
      requests: [
        {
          id: "game-request-9",
          direction: "incoming",
          friendId: "friend-9",
          friendName: "vape_friend",
          friendDisplayName: "Vape Friend",
          seed: "seed-99",
          gameType: "seeded",
          status: "pending",
          summary: "Sent you a game request.",
        },
      ],
    });

    let tree;
    await act(async () => {
      tree = renderer.create(
        <MultiplayerMenuScreen
          dailySeed="20260301"
          onBack={jest.fn()}
          onOpenActiveGame={jest.fn()}
          onOpenNewMultiplayerGame={jest.fn()}
        />
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    const texts = tree.root.findAllByType(Text).map((node) => {
      const value = node.props.children;
      return Array.isArray(value) ? value.join("") : String(value);
    });

    expect(texts).toContain("vape_friend");
    expect(texts).toContain("Request");
    expect(texts).toContain("Accept");
    expect(texts).toContain("Reject");

    act(() => {
      tree.unmount();
    });
  });

  it("accepts an incoming multiplayer game request with its game type", async () => {
    mockLoadMultiplayerGameRequests
      .mockResolvedValueOnce({
        ok: true,
        requests: [
          {
            id: "game-request-9",
            direction: "incoming",
            friendId: "friend-9",
            friendName: "vape_friend",
            friendDisplayName: "Vape Friend",
            seed: "seed-99",
            gameType: "daily",
            status: "pending",
            summary: "Sent you a game request.",
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        requests: [],
      });

    const onOpenActiveGame = jest.fn();

    let tree;
    await act(async () => {
      tree = renderer.create(
        <MultiplayerMenuScreen
          dailySeed="20260301"
          onBack={jest.fn()}
          onOpenActiveGame={onOpenActiveGame}
          onOpenNewMultiplayerGame={jest.fn()}
        />
      );
      await Promise.resolve();
    });

    const acceptButton = tree.root.findAllByType(TouchableOpacity).find((node) =>
      node.findAllByType(Text).some((textNode) => textNode.props.children === "Accept")
    );

    await act(async () => {
      await acceptButton.props.onPress();
    });

    expect(mockAcceptMultiplayerGameRequest).toHaveBeenCalledWith({
      requestId: "game-request-9",
      senderId: "friend-9",
      senderUsername: "vape_friend",
      senderDisplayName: "Vape Friend",
      seed: "seed-99",
      gameType: "daily",
    });
    expect(onOpenActiveGame).toHaveBeenCalled();

    act(() => {
      tree.unmount();
    });
  });

  it("shows an error when accepting a game request throws", async () => {
    mockLoadMultiplayerGameRequests.mockResolvedValue({
      ok: true,
      requests: [
        {
          id: "game-request-19",
          direction: "incoming",
          friendId: "friend-19",
          friendName: "throw_friend",
          friendDisplayName: "Throw Friend",
          seed: "seed-19",
          gameType: "seeded",
          status: "pending",
          summary: "Sent you a game request.",
        },
      ],
    });
    mockAcceptMultiplayerGameRequest.mockRejectedValueOnce(
      new Error("network exploded")
    );

    let tree;
    await act(async () => {
      tree = renderer.create(
        <MultiplayerMenuScreen
          dailySeed="20260301"
          onBack={jest.fn()}
          onOpenActiveGame={jest.fn()}
          onOpenNewMultiplayerGame={jest.fn()}
        />
      );
      await Promise.resolve();
    });

    const acceptButton = tree.root.findAllByType(TouchableOpacity).find((node) =>
      node.findAllByType(Text).some((textNode) => textNode.props.children === "Accept")
    );

    await act(async () => {
      await acceptButton.props.onPress();
      await Promise.resolve();
    });

    const texts = tree.root.findAllByType(Text).map((node) => {
      const value = node.props.children;
      return Array.isArray(value) ? value.join("") : String(value);
    });
    expect(texts).toContain("Could Not Load Games");
    expect(texts).toContain("Could not accept that game request.");

    act(() => {
      tree.unmount();
    });
  });

  it("allows the sender to unsend a pending multiplayer game request", async () => {
    mockLoadMultiplayerGameRequests
      .mockResolvedValueOnce({
        ok: true,
        requests: [
          {
            id: "game-request-12",
            direction: "outgoing",
            friendId: "friend-12",
            friendName: "vibe_friend",
            friendDisplayName: "Vibe Friend",
            seed: "20260301",
            gameType: "daily",
            status: "pending",
            summary: "Waiting for them to accept.",
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        requests: [],
      });

    let tree;
    await act(async () => {
      tree = renderer.create(
        <MultiplayerMenuScreen
          dailySeed="20260301"
          onBack={jest.fn()}
          onOpenActiveGame={jest.fn()}
          onOpenNewMultiplayerGame={jest.fn()}
        />
      );
      await Promise.resolve();
    });

    const outgoingCard = tree.root.findAllByType(Pressable).find((node) =>
      node.findAllByType(Text).some((textNode) => textNode.props.children === "vibe_friend")
    );

    await act(async () => {
      outgoingCard.props.onPress();
    });

    const unsendButton = tree.root.findAllByType(TouchableOpacity).find((node) =>
      node.findAllByType(Text).some((textNode) => textNode.props.children === "Unsend Request")
    );

    await act(async () => {
      await unsendButton.props.onPress();
    });

    expect(mockCancelMultiplayerGameRequest).toHaveBeenCalledWith({
      requestId: "game-request-12",
      receiverId: "friend-12",
    });

    act(() => {
      tree.unmount();
    });
  });

  it("allows deleting an accepted multiplayer game with a long press", async () => {
    mockLoadMultiplayerGameRequests
      .mockResolvedValueOnce({
        ok: true,
        requests: [
          {
            id: "game-request-22",
            direction: "incoming",
            friendId: "friend-22",
            friendName: "vibe_friend",
            friendDisplayName: "Vibe Friend",
            seed: "20260301",
            gameType: "daily",
            status: "accepted",
            sessionId: "mp-session-22",
            summary: "Ready to play.",
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        requests: [],
      });

    let tree;
    await act(async () => {
      tree = renderer.create(
        <MultiplayerMenuScreen
          dailySeed="20260301"
          onBack={jest.fn()}
          onOpenActiveGame={jest.fn()}
          onOpenNewMultiplayerGame={jest.fn()}
        />
      );
      await Promise.resolve();
    });

    const activeGameCard = tree.root.findAllByType(Pressable).find((node) =>
      node.findAllByType(Text).some((textNode) => textNode.props.children === "vibe_friend")
    );

    await act(async () => {
      activeGameCard.props.onLongPress();
    });

    const deleteButton = tree.root.findAllByType(TouchableOpacity).find((node) =>
      node.findAllByType(Text).some((textNode) => textNode.props.children === "Delete Game")
    );

    await act(async () => {
      await deleteButton.props.onPress();
    });

    expect(mockDeleteAcceptedMultiplayerGame).toHaveBeenCalledWith({
      requestId: "game-request-22",
      sessionId: "mp-session-22",
    });

    act(() => {
      tree.unmount();
    });
  });
});
