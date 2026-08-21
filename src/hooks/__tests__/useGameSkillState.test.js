import React from "react";
import renderer, { act } from "react-test-renderer";
import {
  SPRINT_RUSH_MODE_RUSH,
  SPRINT_RUSH_MODE_SPRINT,
  useGame,
} from "../useGame";

const mockIsValid = jest.fn(() => false);

jest.mock("../../utils/dictionary", () => ({
  dictionary: {
    isValid: (...args) => mockIsValid(...args),
  },
}));

const HookHarness = ({ onValue }) => {
  const value = useGame();
  onValue(value);
  return null;
};

const getNonBlankRackIndices = (rack) => {
  const indices = [];
  rack.forEach((tile, index) => {
    const isBlank = tile?.value === 0 && (tile?.letter === " " || tile?.letter === "");
    if (!isBlank) {
      indices.push(index);
    }
  });
  return indices;
};

describe("useGame skill-state snapshot fields", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockIsValid.mockReturnValue(false);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("persists and restores started time and consistency fields", () => {
    let game;
    renderer.create(<HookHarness onValue={(next) => (game = next)} />);

    act(() => {
      game.startNewGame("test-seed-skill");
    });

    const playableIndices = getNonBlankRackIndices(game.tileRack);
    expect(playableIndices.length).toBeGreaterThanOrEqual(2);

    act(() => {
      game.placeTileOnBoard(playableIndices[0], 7, 7);
      game.placeTileOnBoard(playableIndices[1], 7, 8);
    });

    act(() => {
      game.prepareSubmitWord();
    });
    act(() => {
      jest.advanceTimersByTime(120);
    });

    expect(game.message?.title).toBe("Invalid Word");
    expect(typeof game.submitScorePreview).toBe("number");
    expect(game.submitScorePreview).toBeGreaterThan(0);

    act(() => {
      game.clearSelection();
    });

    const snapshot = game.getStableSnapshot();
    expect(snapshot).not.toBeNull();
    expect(typeof snapshot.gameStartedAtMs).toBe("number");
    expect(snapshot.currentConsistencyStreak).toBe(0);
    expect(snapshot.consistencyBonusTotal).toBe(0);

    let resumedGame;
    renderer.create(<HookHarness onValue={(next) => (resumedGame = next)} />);
    act(() => {
      resumedGame.resumeSavedGame(snapshot);
    });

    const resumedSnapshot = resumedGame.getStableSnapshot();
    expect(resumedSnapshot.gameStartedAtMs).toBe(snapshot.gameStartedAtMs);
    expect(resumedSnapshot.currentConsistencyStreak).toBe(0);
    expect(resumedSnapshot.consistencyBonusTotal).toBe(0);
  });

  it("allows rush games to use the classic board and full tile bag", () => {
    let game;
    renderer.create(<HookHarness onValue={(next) => (game = next)} />);

    act(() => {
      game.startNewGame("classic-rush-seed", {
        mode: "classic",
        sprintRushMode: SPRINT_RUSH_MODE_RUSH,
        rushDurationSeconds: 600,
      });
    });

    expect(game.BOARD_SIZE).toBe(15);
    expect(game.board).toHaveLength(15);
    expect(game.board[0]).toHaveLength(15);
    expect(game.tilesRemaining).toBe(93);
    expect(game.boardVariant.mode).toBe("classic");

    act(() => {
      game.startNewGame("mini-rush-seed", {
        mode: "mini",
        sprintRushMode: SPRINT_RUSH_MODE_RUSH,
        rushDurationSeconds: 300,
      });
    });

    expect(game.BOARD_SIZE).toBe(11);
    expect(game.tilesRemaining).toBe(41);
    expect(game.boardVariant.mode).toBe("mini");
  });

  it("keeps sprint on the mini board", () => {
    let game;
    renderer.create(<HookHarness onValue={(next) => (game = next)} />);

    act(() => {
      game.startNewGame("classic-sprint-seed", {
        mode: "classic",
        sprintRushMode: SPRINT_RUSH_MODE_SPRINT,
      });
    });

    expect(game.BOARD_SIZE).toBe(11);
    expect(game.boardVariant.mode).toBe("mini");
  });
});
