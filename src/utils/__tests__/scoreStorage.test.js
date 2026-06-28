jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

import {
  buildUpdatedRushScoreRecords,
  buildUpdatedScoreRecords,
  buildUpdatedSprintScoreRecords,
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

  it("tracks sprint best by turns then duration", () => {
    const initial = getDefaultScoreRecords();
    const first = buildUpdatedSprintScoreRecords(initial, {
      finalScore: 104,
      turnCount: 5,
      durationSeconds: 180,
    });
    const slower = buildUpdatedSprintScoreRecords(first, {
      finalScore: 130,
      turnCount: 5,
      durationSeconds: 220,
    });
    const fewerTurns = buildUpdatedSprintScoreRecords(slower, {
      finalScore: 101,
      turnCount: 4,
      durationSeconds: 300,
    });

    expect(slower.sprintBest).toEqual(first.sprintBest);
    expect(fewerTurns.sprintBest).toEqual({
      finalScore: 101,
      turnCount: 4,
      durationSeconds: 300,
    });
  });

  it("tracks rush high scores per duration bucket", () => {
    const initial = getDefaultScoreRecords();
    const first = buildUpdatedRushScoreRecords(initial, {
      finalScore: 90,
      durationSeconds: 300,
    });
    const lower = buildUpdatedRushScoreRecords(first, {
      finalScore: 80,
      durationSeconds: 300,
    });
    const tenMinute = buildUpdatedRushScoreRecords(lower, {
      finalScore: 140,
      durationSeconds: 600,
    });

    expect(tenMinute.rushHighScores).toEqual({
      300: 90,
      600: 140,
    });
  });
});
