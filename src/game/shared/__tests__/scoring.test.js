import {
  buildFinalScoreBreakdown,
  calculateConsistencyBonusTotal,
  calculateTimeBonus,
  scoreSubmittedWords,
  TIME_BONUS_PROFILE_MINI,
} from "../scoring";

describe("calculateTimeBonus", () => {
  it("applies expected thresholds", () => {
    expect(calculateTimeBonus((40 * 60 - 1) * 1000)).toBe(15);
    expect(calculateTimeBonus((60 * 60 - 1) * 1000)).toBe(10);
    expect(calculateTimeBonus((90 * 60 - 1) * 1000)).toBe(5);
    expect(calculateTimeBonus(90 * 60 * 1000)).toBe(0);
  });

  it("applies mini mode thresholds", () => {
    expect(
      calculateTimeBonus((10 * 60 - 1) * 1000, TIME_BONUS_PROFILE_MINI)
    ).toBe(15);
    expect(
      calculateTimeBonus((20 * 60 - 1) * 1000, TIME_BONUS_PROFILE_MINI)
    ).toBe(10);
    expect(
      calculateTimeBonus((30 * 60 - 1) * 1000, TIME_BONUS_PROFILE_MINI)
    ).toBe(5);
    expect(calculateTimeBonus(30 * 60 * 1000, TIME_BONUS_PROFILE_MINI)).toBe(0);
  });
});

describe("calculateConsistencyBonusTotal", () => {
  it("awards combo bonus on 3+ streaks and resets on low turns", () => {
    expect(
      calculateConsistencyBonusTotal({
        turnCount: 4,
        wordHistory: [
          { turn: 1, score: 20 },
          { turn: 2, score: 20 },
          { turn: 3, score: 20 },
          { turn: 4, score: 20 },
        ],
      })
    ).toBe(6);

    expect(
      calculateConsistencyBonusTotal({
        turnCount: 5,
        wordHistory: [
          { turn: 1, score: 20 },
          { turn: 2, score: 20 },
          { turn: 3, score: 19 },
          { turn: 4, score: 20 },
          { turn: 5, score: 20 },
        ],
      })
    ).toBe(0);
  });

  it("treats missing turns as 0-score swap turns", () => {
    expect(
      calculateConsistencyBonusTotal({
        turnCount: 4,
        wordHistory: [
          { turn: 1, score: 20 },
          { turn: 3, score: 20 },
          { turn: 4, score: 20 },
        ],
      })
    ).toBe(0);
  });
});

describe("buildFinalScoreBreakdown", () => {
  it("includes skill bonuses and final score", () => {
    const breakdown = buildFinalScoreBreakdown({
      wordPointsTotal: 120,
      swapPenaltyTotal: 8,
      scrabbleBonusTotal: 50,
      turnCount: 4,
      rackTiles: [{ value: 5 }],
      durationMs: 30 * 60 * 1000,
      wordHistory: [
        { turn: 1, score: 20 },
        { turn: 2, score: 20 },
        { turn: 3, score: 20 },
        { turn: 4, score: 20 },
      ],
    });

    expect(breakdown.timeBonus).toBe(15);
    expect(breakdown.consistencyBonusTotal).toBe(6);
    expect(breakdown.skillBonusTotal).toBe(71);
    expect(breakdown.finalScore).toBe(170);
  });
});

describe("scoreSubmittedWords", () => {
  it("awards mini bonus (+20) when 6 tiles are used after turn 1", () => {
    const board = Array.from({ length: 11 }, () => Array(11).fill(null));
    const placedCells = Array.from({ length: 6 }, (_, index) => ({
      row: 5,
      col: index,
    }));

    const scoring = scoreSubmittedWords({
      board,
      newWords: [],
      premiumSquares: {},
      turnCount: 1,
      placedCells,
      bonusMode: "mini",
    });

    expect(scoring.earnedScrabbleBonus).toBe(true);
    expect(scoring.scrabbleBonus).toBe(20);
    expect(scoring.scrabbleBonusType).toBe("lite");
    expect(scoring.turnScore).toBe(20);
  });

  it("awards normal scrabble bonus (+50) when 7 tiles are used in mini after turn 1", () => {
    const board = Array.from({ length: 11 }, () => Array(11).fill(null));
    const placedCells = Array.from({ length: 7 }, (_, index) => ({
      row: 5,
      col: index,
    }));

    const scoring = scoreSubmittedWords({
      board,
      newWords: [],
      premiumSquares: {},
      turnCount: 1,
      placedCells,
      bonusMode: "mini",
    });

    expect(scoring.earnedScrabbleBonus).toBe(true);
    expect(scoring.scrabbleBonus).toBe(50);
    expect(scoring.scrabbleBonusType).toBe("classic");
    expect(scoring.turnScore).toBe(50);
  });

  it("awards mini bonuses on the first turn", () => {
    const board = Array.from({ length: 11 }, () => Array(11).fill(null));
    const sixTiles = Array.from({ length: 6 }, (_, index) => ({
      row: 5,
      col: index,
    }));
    const sevenTiles = Array.from({ length: 7 }, (_, index) => ({
      row: 6,
      col: index,
    }));

    const sixTileScoring = scoreSubmittedWords({
      board,
      newWords: [],
      premiumSquares: {},
      turnCount: 0,
      placedCells: sixTiles,
      bonusMode: "mini",
    });
    const sevenTileScoring = scoreSubmittedWords({
      board,
      newWords: [],
      premiumSquares: {},
      turnCount: 0,
      placedCells: sevenTiles,
      bonusMode: "mini",
    });

    expect(sixTileScoring.earnedScrabbleBonus).toBe(true);
    expect(sixTileScoring.scrabbleBonus).toBe(20);
    expect(sixTileScoring.turnScore).toBe(20);
    expect(sevenTileScoring.earnedScrabbleBonus).toBe(true);
    expect(sevenTileScoring.scrabbleBonus).toBe(50);
    expect(sevenTileScoring.turnScore).toBe(50);
  });
});
