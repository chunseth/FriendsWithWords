import React from "react";
import renderer, { act } from "react-test-renderer";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import MainMenuScreen from "../MainMenuScreen";
import MultiplayerModeScreen from "../MultiplayerModeScreen";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockSession = {
  seed: "async-seed-001",
  boardRevision: 1,
  sharedBoard: Array.from({ length: 15 }, () => Array(15).fill(null)),
  sharedPremiumSquares: {},
  sharedScore: {
    total: 42,
  },
  turn: {
    number: 3,
    activePlayerId: "player-1",
  },
  bag: {
    remainingCount: 87,
    tiles: [],
    nextTileId: 14,
  },
  players: [
    {
      id: "player-1",
      username: "player_one",
      displayName: "Player 1",
      rack: [
        { id: "p1-a", letter: "V", value: 4, rackIndex: 0 },
        { id: "p1-b", letter: "I", value: 1, rackIndex: 1 },
      ],
    },
    {
      id: "player-2",
      username: "player_two",
      displayName: "Player 2",
      rack: [
        { id: "p2-a", letter: "F", value: 4, rackIndex: 0 },
        { id: "p2-b", letter: "A", value: 1, rackIndex: 1 },
      ],
    },
  ],
  history: [
    {
      id: "turn-1",
      action: "play",
      words: [{ word: "VIBE" }],
      scoreDelta: 24,
    },
  ],
};

const mockLocalPlayer = {
  id: "player-1",
  username: "player_one",
  displayName: "Player 1",
  rack: [
    { id: "p1-a", letter: "V", value: 4, rackIndex: 0 },
    { id: "p1-b", letter: "I", value: 1, rackIndex: 1 },
  ],
};

const mockActivePlayer = {
  id: "player-1",
  username: "player_one",
  displayName: "Player 1",
};

const mockWaitingPlayer = {
  id: "player-2",
  username: "player_two",
  displayName: "Player 2",
  rack: [
    { id: "p2-a", letter: "F", value: 4, rackIndex: 0 },
    { id: "p2-b", letter: "A", value: 1, rackIndex: 1 },
  ],
};

const mockVisibleRackTiles = [
  { id: "p1-a", letter: "V", value: 4, rackIndex: 0, visibleIndex: 0 },
  { id: "p1-b", letter: "I", value: 1, rackIndex: 1, visibleIndex: 1 },
];

const mockSetLocalPlayerId = jest.fn();
const mockSubmitResolvedPlay = jest.fn();
const mockSubmitSwapTurn = jest.fn(() => ({ ok: true }));
const mockRequestFinish = jest.fn();
const mockAcceptFinishRequest = jest.fn();
const mockDeclineFinishRequest = jest.fn();
const mockMarkSessionSeen = jest.fn();
const mockFetchUnreadMultiplayerNotifications = jest.fn();
const mockMarkMultiplayerNotificationsRead = jest.fn();
const mockUpsertPresence = jest.fn();
const mockArchiveMultiplayerSessionForUser = jest.fn();
const mockDeleteAcceptedMultiplayerGame = jest.fn();
const mockTrackMultiplayerEvent = jest.fn();
const mockRefreshContainerWindowPosition = jest.fn();
const mockUpdateRackLayout = jest.fn();
const mockResetController = jest.fn();

jest.mock("../../hooks/useAsyncCoopSession", () => ({
  useAsyncCoopSession: () => ({
    session: mockSession,
    isHydrated: true,
    hydrateError: null,
    localPlayerId: "player-1",
    localPlayer: mockLocalPlayer,
    activePlayer: mockActivePlayer,
    waitingPlayer: mockWaitingPlayer,
    canLocalPlayerAct: true,
    remoteUpdateEvent: null,
    submitResolvedPlay: mockSubmitResolvedPlay,
    submitSwapTurn: mockSubmitSwapTurn,
    requestFinish: mockRequestFinish,
    acceptFinishRequest: mockAcceptFinishRequest,
    declineFinishRequest: mockDeclineFinishRequest,
  }),
}));

jest.mock("../../services/multiplayerInboxService", () => ({
  fetchUnreadMultiplayerNotifications: (...args) =>
    mockFetchUnreadMultiplayerNotifications(...args),
  markMultiplayerNotificationsRead: (...args) =>
    mockMarkMultiplayerNotificationsRead(...args),
  markSessionSeen: (...args) => mockMarkSessionSeen(...args),
  upsertPresence: (...args) => mockUpsertPresence(...args),
  archiveMultiplayerSessionForUser: (...args) =>
    mockArchiveMultiplayerSessionForUser(...args),
}));

jest.mock("../../services/multiplayerGameRequestService", () => ({
  deleteAcceptedMultiplayerGame: (...args) =>
    mockDeleteAcceptedMultiplayerGame(...args),
}));

jest.mock("../../services/analyticsService", () => ({
  trackMultiplayerEvent: (...args) => mockTrackMultiplayerEvent(...args),
}));

jest.mock("../../hooks/useTileDragDropController", () => ({
  useTileDragDropController: () => ({
    visibleRackTiles: mockVisibleRackTiles,
    draggingTile: null,
    settlingTile: null,
    dropTargetRackIndex: null,
    optimisticPlacement: null,
    dragPosition: { x: 0, y: 0 },
    dragScale: 1,
    settlePosition: { x: 0, y: 0 },
    settleScale: 1,
    refreshContainerWindowPosition: mockRefreshContainerWindowPosition,
    updateRackLayout: mockUpdateRackLayout,
    resetController: mockResetController,
    getDraggableTileCell: jest.fn(),
    handleRackDragStart: jest.fn(),
    handleRackDragUpdate: jest.fn(),
    handleTileDrop: jest.fn(),
    handleBoardTilePickup: jest.fn(),
    handleBoardDragUpdate: jest.fn(),
    handleBoardTileDrop: jest.fn(),
    handleBoardTap: jest.fn(),
  }),
}));

jest.mock("../GameBoard", () => {
  const React = require("react");
  const { Text, View } = require("react-native");
  return function MockGameBoard() {
    return (
      <View>
        <Text>Mock Game Board</Text>
      </View>
    );
  };
});

jest.mock("../TileRack", () => {
  const React = require("react");
  const { Text, View } = require("react-native");
  return function MockTileRack({ tiles }) {
    return (
      <View>
        <Text>{`Mock Rack (${tiles.length})`}</Text>
      </View>
    );
  };
});

jest.mock("../MessageOverlay", () => {
  const React = require("react");
  const { View } = require("react-native");
  return function MockMessageOverlay() {
    return <View />;
  };
});

jest.mock("../LetterPickerModal", () => {
  const React = require("react");
  const { View } = require("react-native");
  return function MockLetterPickerModal() {
    return <View />;
  };
});

jest.mock("../InGameMenu", () => {
  const React = require("react");
  const { Text, TouchableOpacity, View } = require("react-native");
  return function MockInGameMenu({
    visible,
    onClose,
    onReturnToMultiplayerMenu,
  }) {
    if (!visible) {
      return <View />;
    }
    return (
      <View>
        <TouchableOpacity onPress={onClose}>
          <Text>Close Menu</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onReturnToMultiplayerMenu}>
          <Text>Return To Multiplayer Menu</Text>
        </TouchableOpacity>
      </View>
    );
  };
});

jest.mock("../../utils/dictionary", () => ({
  dictionary: {
    load: jest.fn().mockResolvedValue(undefined),
  },
}));

describe("multiplayer smoke", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestFinish.mockResolvedValue({ ok: true });
    mockAcceptFinishRequest.mockResolvedValue({ ok: true });
    mockDeclineFinishRequest.mockResolvedValue({ ok: true });
    mockFetchUnreadMultiplayerNotifications.mockResolvedValue({
      ok: true,
      notifications: [],
    });
    mockMarkMultiplayerNotificationsRead.mockResolvedValue({
      ok: true,
      updatedCount: 0,
    });
    mockMarkSessionSeen.mockResolvedValue({ ok: true });
    mockUpsertPresence.mockResolvedValue({ ok: true });
    mockArchiveMultiplayerSessionForUser.mockResolvedValue({ ok: true });
    mockDeleteAcceptedMultiplayerGame.mockResolvedValue({ ok: true });
    mockTrackMultiplayerEvent.mockResolvedValue({ ok: true });
  });

  it("renders the multiplayer screen shell", () => {
    let tree;
    act(() => {
      tree = renderer.create(<MultiplayerModeScreen onBack={jest.fn()} />);
    });

    const flattenText = (value) => {
      if (Array.isArray(value)) {
        return value.map(flattenText).join("");
      }
      if (value == null) {
        return "";
      }
      return String(value);
    };

    const texts = tree.root
      .findAllByType(Text)
      .map((node) => flattenText(node.props.children));
    const rackLabels = texts.filter((text) => text.startsWith("Mock Rack"));

    expect(texts).not.toContain("Async Co-op Multiplayer");
    expect(texts).toContain("@player_one's Turn");
    expect(texts).toContain("Your turn");
    expect(texts).toContain("Turn");
    expect(texts).toContain("Tiles");
    expect(texts).toContain("42");
    expect(texts).toContain("Submit");
    expect(texts).toContain("Score");
    expect(texts).toContain("Mock Game Board");
    expect(rackLabels).toEqual(["Mock Rack (2)", "Mock Rack (2)"]);
  });

  it("does not render a pass turn button", async () => {
    let tree;
    await act(async () => {
      tree = renderer.create(<MultiplayerModeScreen onBack={jest.fn()} />);
    });

    const passButtons = tree.root.findAll(
      (node) =>
        node.type === TouchableOpacity &&
        node.props.accessibilityLabel === "Pass turn"
    );
    expect(passButtons.length).toBe(0);
  });

  it("marks active-session turn notifications read while already in game", async () => {
    const originalSessionState = JSON.parse(JSON.stringify(mockSession));
    Object.assign(mockSession, {
      sessionId: "local-multiplayer-prototype",
      status: "active",
    });

    mockFetchUnreadMultiplayerNotifications.mockResolvedValue({
      ok: true,
      notifications: [
        {
          id: "notif-turn-1",
          type: "turn_ready",
          entity_id: "local-multiplayer-prototype",
          payload: { sessionId: "local-multiplayer-prototype" },
          read_at: null,
        },
        {
          id: "notif-turn-2",
          type: "reminder",
          entity_id: "local-multiplayer-prototype",
          payload: {},
          read_at: null,
        },
        {
          id: "notif-other-1",
          type: "turn_ready",
          entity_id: "another-session",
          payload: { sessionId: "another-session" },
          read_at: null,
        },
      ],
    });

    let tree;
    await act(async () => {
      tree = renderer.create(<MultiplayerModeScreen onBack={jest.fn()} />);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockMarkMultiplayerNotificationsRead).toHaveBeenCalledWith([
      "notif-turn-1",
      "notif-turn-2",
    ]);

    act(() => {
      tree.unmount();
    });

    Object.keys(mockSession).forEach((key) => {
      delete mockSession[key];
    });
    Object.assign(mockSession, originalSessionState);
  });

  it("clears active-session turn notifications when returning to multiplayer menu", async () => {
    const originalSessionState = JSON.parse(JSON.stringify(mockSession));
    Object.assign(mockSession, {
      sessionId: "local-multiplayer-prototype",
      status: "active",
    });

    mockFetchUnreadMultiplayerNotifications.mockResolvedValue({
      ok: true,
      notifications: [
        {
          id: "notif-turn-return-1",
          type: "turn_ready",
          entity_id: "local-multiplayer-prototype",
          payload: { sessionId: "local-multiplayer-prototype" },
          read_at: null,
        },
      ],
    });

    const onReturnToMultiplayerMenu = jest.fn();
    let tree;
    await act(async () => {
      tree = renderer.create(
        <MultiplayerModeScreen
          onBack={jest.fn()}
          onReturnToMultiplayerMenu={onReturnToMultiplayerMenu}
        />
      );
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const menuButton = tree.root.findAll(
      (node) =>
        node.type === TouchableOpacity &&
        node.props.accessibilityLabel === "Open menu"
    )[0];
    expect(menuButton).toBeTruthy();

    await act(async () => {
      menuButton.props.onPress();
    });

    const returnButton = tree.root.findAllByType(TouchableOpacity).find((node) =>
      node.findAllByType(Text).some((textNode) => textNode.props.children === "Return To Multiplayer Menu")
    );

    await act(async () => {
      await returnButton.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockMarkMultiplayerNotificationsRead).toHaveBeenCalledWith([
      "notif-turn-return-1",
    ]);
    expect(onReturnToMultiplayerMenu).toHaveBeenCalledTimes(1);

    act(() => {
      tree.unmount();
    });

    Object.keys(mockSession).forEach((key) => {
      delete mockSession[key];
    });
    Object.assign(mockSession, originalSessionState);
  });

  it("emits multiplayer completion payload with consistency bonus only", () => {
    const originalSessionState = JSON.parse(JSON.stringify(mockSession));
    Object.assign(mockSession, {
      status: "completed",
      sessionId: "mp-complete-1",
      savedAt: 12345,
      isDailySeed: false,
      turn: {
        ...mockSession.turn,
        number: 5,
      },
      sharedScore: {
        total: 136,
        wordPointsTotal: 100,
        swapPenaltyTotal: 0,
        turnPenaltyTotal: 0,
        rackPenaltyTotal: 12,
        scrabbleBonusTotal: 40,
        consistencyBonusTotal: 8,
        finalScore: 136,
      },
    });

    const onSessionCompleted = jest.fn();
    let tree;
    act(() => {
      tree = renderer.create(
        <MultiplayerModeScreen
          onBack={jest.fn()}
          onSessionCompleted={onSessionCompleted}
        />
      );
    });

    expect(onSessionCompleted).toHaveBeenCalledWith({
      sessionId: "mp-complete-1",
      seed: "async-seed-001",
      isDailySeed: false,
      shouldSubmitLeaderboard: true,
      leaderboardDisplayName: "player_one\nplayer_two",
      finalScore: 130,
      finalScoreBreakdown: {
        pointsEarned: 100,
        swapPenalties: 0,
        turnPenalties: 8,
        rackPenalty: 10,
        scrabbleBonus: 40,
        timeBonus: 0,
        consistencyBonusTotal: 8,
        skillBonusTotal: 48,
        finalScore: 130,
      },
    });

    act(() => {
      tree.unmount();
    });

    Object.keys(mockSession).forEach((key) => {
      delete mockSession[key];
    });
    Object.assign(mockSession, originalSessionState);
  });

  it("renders archived multiplayer sessions as read-only board view", () => {
    const originalSessionState = JSON.parse(JSON.stringify(mockSession));
    Object.assign(mockSession, {
      status: "archived",
      sharedScore: {
        ...mockSession.sharedScore,
        total: 137,
        finalScore: 137,
      },
    });

    let tree;
    act(() => {
      tree = renderer.create(<MultiplayerModeScreen onBack={jest.fn()} />);
    });

    const flattenText = (value) => {
      if (Array.isArray(value)) {
        return value.map(flattenText).join("");
      }
      if (value == null) {
        return "";
      }
      return String(value);
    };

    const texts = tree.root
      .findAllByType(Text)
      .map((node) => flattenText(node.props.children));
    const rackLabels = texts.filter((text) => text.startsWith("Mock Rack"));

    expect(texts).toContain("Archived");
    expect(texts).toContain("137");
    expect(rackLabels).toEqual(["Mock Rack (0)", "Mock Rack (0)"]);
    expect(
      tree.root.findAll(
        (node) =>
          node.type === TouchableOpacity &&
          node.props.accessibilityLabel === "Submit turn"
      )
    ).toHaveLength(0);
    expect(
      tree.root.findAll(
        (node) =>
          node.type === TouchableOpacity &&
          node.props.accessibilityLabel === "Swap tiles"
      )
    ).toHaveLength(0);
    expect(
      tree.root.findAll(
        (node) =>
          node.type === TouchableOpacity &&
          node.props.accessibilityLabel === "Shuffle rack"
      )
    ).toHaveLength(0);
    expect(
      tree.root.findAll(
        (node) =>
          node.type === TouchableOpacity &&
          node.props.accessibilityLabel === "Clear selection"
      )
    ).toHaveLength(0);

    act(() => {
      tree.unmount();
    });

    Object.keys(mockSession).forEach((key) => {
      delete mockSession[key];
    });
    Object.assign(mockSession, originalSessionState);
  });

  it("routes multiplayer access through the play button on the main menu", () => {
    const onOpenPlay = jest.fn();
    let tree;

    act(() => {
      tree = renderer.create(
        <MainMenuScreen
          playerName="Player"
          onSavePlayerName={jest.fn()}
          onOpenPlay={onOpenPlay}
          onOpenLeaderboard={jest.fn()}
          onStatsPress={jest.fn()}
          onOpenSettings={jest.fn()}
        />
      );
    });

    const playButton = tree.root.findAll(
      (node) =>
        node.type === TouchableOpacity &&
        node.findAllByType(Text).some((textNode) => textNode.props.children === "Play")
    )[0];

    expect(playButton).toBeTruthy();

    act(() => {
      playButton.props.onPress();
    });

    expect(onOpenPlay).toHaveBeenCalledTimes(1);
  });

  it("opens the username prompt when gated without a chosen username", () => {
    let tree;

    act(() => {
      tree = renderer.create(
        <MainMenuScreen
          playerName="Player AB12"
          hasChosenUsername={false}
          usernamePromptToken={1}
          onSavePlayerName={jest.fn()}
          onOpenPlay={jest.fn()}
          onOpenLeaderboard={jest.fn()}
          onStatsPress={jest.fn()}
          onOpenSettings={jest.fn()}
        />
      );
    });

    const texts = tree.root.findAllByType(Text).map((node) => {
      if (Array.isArray(node.props.children)) {
        return node.props.children.join("");
      }
      return String(node.props.children ?? "");
    });

    expect(texts).toContain("Choose a username to continue.");
    expect(tree.root.findAllByType(TextInput)).toHaveLength(1);
  });

  it("shows the save error returned by the username handler", async () => {
    const onSavePlayerName = jest.fn().mockResolvedValue({
      ok: false,
      errorMessage: "That username is already taken.",
    });
    let tree;

    await act(async () => {
      tree = renderer.create(
        <MainMenuScreen
          playerName="Player AB12"
          hasChosenUsername={false}
          usernamePromptToken={1}
          onSavePlayerName={onSavePlayerName}
          onOpenPlay={jest.fn()}
          onOpenMultiplayer={jest.fn()}
          onOpenLeaderboard={jest.fn()}
          onStatsPress={jest.fn()}
        />
      );
    });

    const input = tree.root.findByType(TextInput);

    await act(async () => {
      input.props.onChangeText("Taken_Name");
    });

    await act(async () => {
      await input.props.onSubmitEditing();
    });

    const texts = tree.root.findAllByType(Text).map((node) => {
      if (Array.isArray(node.props.children)) {
        return node.props.children.join("");
      }
      return String(node.props.children ?? "");
    });

    expect(onSavePlayerName).toHaveBeenCalledWith("Taken_Name");
    expect(texts).toContain("That username is already taken.");
  });
});
