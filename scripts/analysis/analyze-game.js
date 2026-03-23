#!/usr/bin/env node
const { parseArgs, readJsonFile, writeJsonOutput } = require("./common");

const { getDefaultLexicon } = require("../../src/game/analysis/lexicon");
const { normalizeAnalysisInput } = require("../../src/game/analysis/stateAdapter");
const { generateLegalMoves } = require("../../src/game/analysis/moveGenerator");
const { evaluateMove, rankMoves } = require("../../src/game/analysis/moveEvaluator");
const {
  applyMoveToState,
  replayTurnLog,
  solveSeedGreedy,
} = require("../../src/game/analysis/replayEngine");
const {
  analyzeDrawLuck,
  analyzeEndgameEfficiency,
  analyzePremiumEfficiency,
  buildTurnComparisonMetrics,
  buildDifficultyProfile,
} = require("../../src/game/analysis/metrics");

const args = parseArgs(process.argv.slice(2));
if (!args.input) {
  process.stderr.write(
    "Usage: node scripts/analysis/analyze-game.js --input <snapshot-or-turn-log.json> [--output result.json] [--maxMoves 200]\n"
  );
  process.exit(1);
}

const inputPayload = readJsonFile(args.input);
const normalized = normalizeAnalysisInput(inputPayload);
const lexicon = getDefaultLexicon();
const maxMoves = Number.isFinite(Number(args.maxMoves)) ? Number(args.maxMoves) : 200;

const moveSignature = (move) => {
  const placements = (move?.placements || [])
    .map((placement) => `${placement.row},${placement.col},${placement.letter}`)
    .sort();
  return `${move?.direction || "?"}:${move?.startRow ?? "?"}:${move?.startCol ?? "?"}:${placements.join("|")}`;
};

const analyzeSnapshotOnly = (state) => {
  const ranked = rankMoves({
    moves: generateLegalMoves({
      state,
      lexicon,
      maxMoves,
    }),
    state,
  });

  const bestMove = ranked[0] || null;
  return {
    mode: "snapshot",
    warning:
      "Snapshot input does not include full turn history; turn-level missed-opportunity analytics are limited to current state.",
    bestMove,
    topCandidates: ranked.slice(0, 10),
    premiumStats: analyzePremiumEfficiency(state.moveHistory || []),
  };
};

const analyzeTurnLog = ({ initialState, turns }) => {
  let state = {
    ...initialState,
    board: initialState.board.map((row) => row.map((cell) => (cell == null ? null : { ...cell }))),
    tileRack: (initialState.tileRack || []).map((tile) => ({ ...tile })),
    tileBag: (initialState.tileBag || []).map((tile) => ({ ...tile })),
    premiumSquares: { ...(initialState.premiumSquares || {}) },
    moveHistory: [],
    drawHistory: [],
  };

  const turnComparisons = [];
  const replayedTurns = [];

  turns.forEach((turnEntry, index) => {
    if (turnEntry?.action !== "play") return;

    const rankedCandidates = rankMoves({
      moves: generateLegalMoves({
        state,
        lexicon,
        maxMoves,
      }),
      state,
    });

    const bestCandidate = rankedCandidates[0] || null;

    const { nextState, payload } = applyMoveToState({
      state,
      move: turnEntry.move,
      lexicon,
    });

    const playedBase = {
      ...turnEntry.move,
      turnScore: payload.turnScore,
      baseWordScore: payload.baseWordScore,
      newWords: payload.newWords,
      usedRackIndices: turnEntry.move.usedRackIndices || turnEntry.move.placements.map((placement) => placement.rackIndex),
    };
    const playedEvaluated = evaluateMove({ move: playedBase, state });

    const matchedCandidate = rankedCandidates.find(
      (candidate) => moveSignature(candidate) === moveSignature(turnEntry.move)
    );

    turnComparisons.push({
      turn: index + 1,
      playedTurnScore: payload.turnScore,
      playedEvalScore: matchedCandidate?.evalScore ?? playedEvaluated.evalScore,
      playedWord: playedEvaluated.word,
      bestTurnScore: bestCandidate?.turnScore ?? payload.turnScore,
      bestEvalScore: bestCandidate?.evalScore ?? playedEvaluated.evalScore,
      bestWord: bestCandidate?.word ?? playedEvaluated.word,
      noBetterPlay:
        bestCandidate == null
          ? true
          : Math.abs((bestCandidate.evalScore ?? 0) - (playedEvaluated.evalScore ?? 0)) < 0.0001,
      topCandidates: rankedCandidates.slice(0, 5).map((candidate) => ({
        word: candidate.word,
        turnScore: candidate.turnScore,
        evalScore: candidate.evalScore,
      })),
    });

    replayedTurns.push({
      turn: index + 1,
      payload,
    });

    state = nextState;
  });

  const replayResult = replayTurnLog({ initialState, turns, lexicon });
  const turnMetrics = buildTurnComparisonMetrics(turnComparisons);
  const drawMetrics = analyzeDrawLuck(replayResult.finalState.drawHistory || []);
  const premiumStats = analyzePremiumEfficiency(replayResult.finalState.moveHistory || []);
  const endgame = analyzeEndgameEfficiency(replayResult.finalState);

  const difficultyProfile = buildDifficultyProfile({
    turnScores: turnComparisons.map((entry) => entry.playedTurnScore),
    topCandidateGaps: turnComparisons.map(
      (entry) => (entry.bestEvalScore ?? 0) - (entry.playedEvalScore ?? 0)
    ),
  });

  return {
    mode: "turnLog",
    summary: {
      ...turnMetrics.summary,
      highestScoringMissedMove: turnMetrics.summary.largestMissedOpportunity,
      unluckiestDraw: drawMetrics.unluckiestDraw,
      premiumStats,
      endgame,
    },
    turnAnalyses: turnMetrics.turnAnalyses,
    drawAnalyses: drawMetrics.drawAnalyses,
    replaySummary: {
      finalScore: replayResult.finalState.finalScore,
      totalScore: replayResult.finalState.totalScore,
      turnCount: replayResult.finalState.turnCount,
    },
    difficultyProfile,
    replayedTurns,
  };
};

let analysis;
if (normalized.kind === "turnLog") {
  analysis = analyzeTurnLog(normalized);
} else if (normalized.kind === "snapshot") {
  analysis = analyzeSnapshotOnly(normalized.initialState);
} else {
  analysis = {
    mode: "seed",
    baseline: solveSeedGreedy({
      seed: normalized.initialState.seed,
      mode: normalized.initialState.mode,
      layoutId: normalized.initialState.mode,
      lexicon,
      maxTurns: 200,
    }),
  };
}

writeJsonOutput({
  payload: {
    inputKind: normalized.kind,
    analysis,
  },
  outputPath: args.output || null,
});
