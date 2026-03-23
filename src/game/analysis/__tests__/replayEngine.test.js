import { buildLexicon } from "../lexicon";
import { generateLegalMoves } from "../moveGenerator";
import { replayTurnLog } from "../replayEngine";
import { createInitialAnalysisState } from "../stateAdapter";

describe("replayEngine", () => {
  it("replays the same turn log deterministically", () => {
    const lexicon = buildLexicon(["at"]);
    const initialState = createInitialAnalysisState({ seed: "analysis-replay-1", mode: "classic" });
    initialState.tileRack = [
      { id: 0, letter: "A", value: 1, rackIndex: 0 },
      { id: 1, letter: "T", value: 1, rackIndex: 1 },
    ];

    const moves = generateLegalMoves({ state: initialState, lexicon, maxMoves: 1 });
    expect(moves.length).toBe(1);

    const turns = [{ action: "play", move: moves[0] }];

    const replayA = replayTurnLog({ initialState, turns, lexicon });
    const replayB = replayTurnLog({ initialState, turns, lexicon });

    expect(replayA.finalState.totalScore).toBe(replayB.finalState.totalScore);
    expect(replayA.finalState.turnCount).toBe(replayB.finalState.turnCount);
    expect(replayA.finalState.wordHistory).toEqual(replayB.finalState.wordHistory);
  });
});
