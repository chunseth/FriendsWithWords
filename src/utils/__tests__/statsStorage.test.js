jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  buildUpdatedStats,
  loadStats,
} from "../statsStorage";

describe("statsStorage scoreHistory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("appends valid final scores to scoreHistory", () => {
    const updated = buildUpdatedStats(
      {
        gamesPlayed: 2,
        wordsPlayed: 40,
        highestScore: 120,
        scoreHistory: [90, 120],
      },
      { finalScore: 150, wordCount: 12 }
    );

    expect(updated.gamesPlayed).toBe(3);
    expect(updated.wordsPlayed).toBe(52);
    expect(updated.highestScore).toBe(150);
    expect(updated.scoreHistory).toEqual([90, 120, 150]);
  });

  it("sanitizes invalid persisted scoreHistory entries", async () => {
    AsyncStorage.getItem.mockResolvedValue(
      JSON.stringify({
        gamesPlayed: 4,
        wordsPlayed: 20,
        highestScore: 88,
        scoreHistory: [10, "bad", null, 33, Infinity],
      })
    );

    const stats = await loadStats();
    expect(stats.scoreHistory).toEqual([10, 33]);
  });
});
