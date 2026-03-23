#!/usr/bin/env node
const { parseArgs, writeJsonOutput } = require("./common");

const { getDefaultLexicon } = require("../../src/game/analysis/lexicon");
const { solveSeedGreedy } = require("../../src/game/analysis/replayEngine");
const {
  analyzePremiumEfficiency,
  buildDifficultyProfile,
} = require("../../src/game/analysis/metrics");

const args = parseArgs(process.argv.slice(2));

const seed = args.seed || args.s;
if (!seed) {
  process.stderr.write(
    "Usage: node scripts/analysis/solve-seed-greedy.js --seed <seed> [--mode classic|mini] [--layout <id>] [--maxTurns 200] [--output file.json]\n"
  );
  process.exit(1);
}

const mode = args.mode === "mini" ? "mini" : "classic";
const layoutId = args.layout || null;
const maxTurns = Number.isFinite(Number(args.maxTurns))
  ? Number(args.maxTurns)
  : 200;

const lexicon = getDefaultLexicon();
const solved = solveSeedGreedy({
  seed,
  mode,
  layoutId,
  maxTurns,
  lexicon,
});

const topCandidateGaps = solved.bestLine.map((turn) => {
  if (!turn.topCandidates || turn.topCandidates.length < 2) return 0;
  return (turn.topCandidates[0].evalScore ?? 0) - (turn.topCandidates[1].evalScore ?? 0);
});

const difficultyProfile = buildDifficultyProfile({
  turnScores: solved.bestLine.map((turn) => turn.turnScore ?? 0),
  topCandidateGaps,
});

const premiumStats = analyzePremiumEfficiency(solved.finalState.moveHistory || []);

writeJsonOutput({
  payload: {
    ...solved,
    difficultyProfile,
    premiumStats,
  },
  outputPath: args.output || null,
});
