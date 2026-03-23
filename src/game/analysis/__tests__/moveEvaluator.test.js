import { buildLexicon } from "../lexicon";
import { generateLegalMoves } from "../moveGenerator";
import { rankMoves } from "../moveEvaluator";
import { createInitialAnalysisState } from "../stateAdapter";

describe("moveEvaluator", () => {
  it("ranks moves by eval score and keeps deterministic ordering", () => {
    const lexicon = buildLexicon(["at", "ate", "tea", "eat", "eta"]);
    const state = createInitialAnalysisState({ seed: "analysis-eval-1", mode: "classic" });
    state.tileRack = [
      { id: 0, letter: "A", value: 1, rackIndex: 0 },
      { id: 1, letter: "T", value: 1, rackIndex: 1 },
      { id: 2, letter: "E", value: 1, rackIndex: 2 },
    ];

    const rankedA = rankMoves({ moves: generateLegalMoves({ state, lexicon }), state });
    const rankedB = rankMoves({ moves: generateLegalMoves({ state, lexicon }), state });

    expect(rankedA.length).toBeGreaterThan(0);
    expect(rankedA[0].evalScore).toBeGreaterThanOrEqual(rankedA[rankedA.length - 1].evalScore);
    expect(rankedA[0].word).toBe(rankedB[0].word);
    expect(rankedA[0].evalScore).toBe(rankedB[0].evalScore);
  });
});
