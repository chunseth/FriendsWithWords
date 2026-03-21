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
      invalidWordAttempts: 0,
      wordHistory: [
        { turn: 1, score: 20 },
        { turn: 2, score: 20 },
        { turn: 3, score: 20 },
        { turn: 4, score: 20 },
      ],
    });

    expect(breakdown.timeBonus).toBe(15);
    expect(breakdown.perfectionBonus).toBe(50);
    expect(breakdown.consistencyBonusTotal).toBe(6);
    expect(breakdown.skillBonusTotal).toBe(121);
    expect(breakdown.finalScore).toBe(220);
  });

  it("drops perfection bonus after invalid word attempt", () => {
    const breakdown = buildFinalScoreBreakdown({
      wordPointsTotal: 20,
      swapPenaltyTotal: 0,
      scrabbleBonusTotal: 0,
      turnCount: 1,
      rackTiles: [],
      durationMs: 2 * 60 * 60 * 1000,
      invalidWordAttempts: 1,
      wordHistory: [{ turn: 1, score: 20 }],
    });

    expect(breakdown.perfectionBonus).toBe(0);
    expect(breakdown.timeBonus).toBe(0);
    expect(breakdown.consistencyBonusTotal).toBe(0);
  });
});

describe("scoreSubmittedWords", () => {
  it("awards mini scrabble lite bonus (+20) when all 7 tiles are used after turn 1", () => {
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
    expect(scoring.scrabbleBonus).toBe(20);
    expect(scoring.scrabbleBonusType).toBe("lite");
    expect(scoring.turnScore).toBe(20);
  });

  it("does not award mini scrabble lite on the first turn", () => {
    const board = Array.from({ length: 11 }, () => Array(11).fill(null));
    const placedCells = Array.from({ length: 7 }, (_, index) => ({
      row: 5,
      col: index,
    }));

    const scoring = scoreSubmittedWords({
      board,
      newWords: [],
      premiumSquares: {},
      turnCount: 0,
      placedCells,
      bonusMode: "mini",
    });

    expect(scoring.earnedScrabbleBonus).toBe(false);
    expect(scoring.scrabbleBonus).toBe(0);
    expect(scoring.turnScore).toBe(0);
  });
});
