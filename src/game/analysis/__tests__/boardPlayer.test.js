import {
  buildBoardPlayerScript,
  commitCandidateForPosition,
  getCandidateMovesForPosition,
} from "../boardPlayer";

describe("boardPlayer", () => {
  it("builds start position only", () => {
    const script = buildBoardPlayerScript({
      seed: "board-player-smoke-seed",
      mode: "classic",
      topWordCount: 5,
    });

    expect(script.seed).toBe("board-player-smoke-seed");
    expect(Array.isArray(script.turns)).toBe(true);
    expect(script.turns.length).toBe(1);
    expect(script.turns[0].turnIndex).toBe(0);
    expect(Array.isArray(script.turns[0].board)).toBe(true);
    expect(script.turns[0].positionState).toBeDefined();
  });

  it("commits one selected candidate into next turn", () => {
    const script = buildBoardPlayerScript({
      seed: "board-player-commit-seed",
      mode: "classic",
      topWordCount: 6,
    });

    const candidates = getCandidateMovesForPosition({
      script,
      positionTurnIndex: 0,
    });
    expect(candidates.length).toBeGreaterThan(0);

    const committed = commitCandidateForPosition({
      script,
      positionTurnIndex: 0,
      candidateIndex: 0,
    });

    expect(committed.turns.length).toBe(2);
    expect(committed.turns[1].turnIndex).toBe(1);
    expect(committed.turns[1].playedWord).toBe(candidates[0].word);
    expect(committed.lastCommittedMove.word).toBe(candidates[0].word);
  });
});
