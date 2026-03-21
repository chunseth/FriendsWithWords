jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

import {
  buildUpdatedScoreRecords,
  getDefaultScoreRecords,
} from "../scoreStorage";

describe("scoreStorage", () => {
  it("tracks classic high scores independently", () => {
    const initial = getDefaultScoreRecords();
    const updated = buildUpdatedScoreRecords(initial, 120, {
      dailySeed: "20260320",
      mode: "classic",
    });

    expect(updated.overallHighScore).toBe(120);
    expect(updated.dailySeedScores["20260320"]).toBe(120);
    expect(updated.miniOverallHighScore).toBeNull();
  });

  it("tracks mini high scores independently", () => {
    const initial = getDefaultScoreRecords();
    const updated = buildUpdatedScoreRecords(initial, 88, {
      dailySeed: "20260320",
      mode: "mini",
    });

    expect(updated.miniOverallHighScore).toBe(88);
    expect(updated.miniDailySeedScores["20260320"]).toBe(88);
    expect(updated.overallHighScore).toBeNull();
  });
});
