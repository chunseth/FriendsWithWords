import {
  TUTORIAL_GAME_SEED,
  TUTORIAL_STEPS,
  validateTutorialMove,
} from "../scriptedTutorial";
import { calculateConsistencyBonusTotal } from "../../game/shared/scoring";

const buildPreparedSubmit = (step, override = {}) => ({
  newWords: [{ word: step.word }],
  placedCells: step.placements.map(({ row, col }) => ({ row, col })),
  turnScore: step.expectedScore,
  ...override,
});

describe("scriptedTutorial", () => {
  it("uses the combo-ramp seed and four 20+ point turns", () => {
    expect(TUTORIAL_GAME_SEED).toBe("100187");
    expect(TUTORIAL_STEPS.map((step) => step.word)).toEqual([
      "FISH",
      "TIME",
      "RED",
      "SAW",
    ]);
    expect(TUTORIAL_STEPS.map((step) => step.expectedScore)).toEqual([
      20,
      31,
      26,
      42,
    ]);
    expect(TUTORIAL_STEPS.every((step) => step.expectedScore >= 20)).toBe(true);
  });

  it("validates exact tutorial placements", () => {
    const step = TUTORIAL_STEPS[0];

    expect(validateTutorialMove(step, buildPreparedSubmit(step))).toEqual({
      ok: true,
    });
    expect(
      validateTutorialMove(step, buildPreparedSubmit(step, {
        newWords: [{ word: "HIS" }],
      })).ok
    ).toBe(false);
    expect(
      validateTutorialMove(step, buildPreparedSubmit(step, {
        placedCells: [{ row: 7, col: 7 }],
      })).ok
    ).toBe(false);
    expect(
      validateTutorialMove(step, buildPreparedSubmit(step, {
        placedCells: step.placements.map(({ row, col }) => ({
          row: row + 1,
          col,
        })),
      })).ok
    ).toBe(false);
  });

  it("ramps combo bonuses after the third consecutive 20+ turn", () => {
    const wordHistory = [];
    const totals = [];

    TUTORIAL_STEPS.forEach((step, index) => {
      wordHistory.push({
        word: step.word,
        score: step.expectedScore,
        turn: index + 1,
      });
      totals.push(
        calculateConsistencyBonusTotal({
          wordHistory,
          turnCount: index + 1,
        })
      );
    });

    expect(totals).toEqual([0, 0, 2, 6]);
    expect(totals[2] - totals[1]).toBe(2);
    expect(totals[3] - totals[2]).toBe(4);
  });
});
