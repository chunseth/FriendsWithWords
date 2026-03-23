import { buildLexicon } from "../lexicon";
import { generateLegalMoves } from "../moveGenerator";
import { createInitialAnalysisState } from "../stateAdapter";

describe("generateLegalMoves", () => {
  it("generates only legal first-turn moves crossing center", () => {
    const lexicon = buildLexicon(["at", "ate", "tea", "eat"]);
    const state = createInitialAnalysisState({ seed: "analysis-move-1", mode: "classic" });
    state.tileRack = [
      { id: 0, letter: "A", value: 1, rackIndex: 0 },
      { id: 1, letter: "T", value: 1, rackIndex: 1 },
      { id: 2, letter: "E", value: 1, rackIndex: 2 },
    ];

    const moves = generateLegalMoves({ state, lexicon, maxMoves: 50 });
    expect(moves.length).toBeGreaterThan(0);

    moves.forEach((move) => {
      const coversCenter = move.placements.some(
        ({ row, col }) => row === 7 && col === 7
      );
      expect(coversCenter).toBe(true);
      expect(move.placements.length).toBeGreaterThan(0);
      expect(move.turnScore).toBeGreaterThan(0);
    });
  });
});
