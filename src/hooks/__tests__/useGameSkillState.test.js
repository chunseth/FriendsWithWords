import React from "react";
import renderer, { act } from "react-test-renderer";
import { useGame } from "../useGame";

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
});
