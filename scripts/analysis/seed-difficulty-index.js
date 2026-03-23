#!/usr/bin/env node
const { parseArgs, writeJsonOutput } = require("./common");
const { getDefaultLexicon } = require("../../src/game/analysis/lexicon");
const { solveSeedGreedy } = require("../../src/game/analysis/replayEngine");
const { buildDifficultyProfile } = require("../../src/game/analysis/metrics");

const args = parseArgs(process.argv.slice(2));
if (!args.seeds) {
  process.stderr.write("Usage: node scripts/analysis/seed-difficulty-index.js --seeds <s1,s2,...> [--mode classic|mini]\n");
  process.exit(1);
}

const seeds = String(args.seeds).split(",").map((seed) => seed.trim()).filter(Boolean);
const mode = args.mode === "mini" ? "mini" : "classic";
const lexicon = getDefaultLexicon();

const results = seeds.map((seed) => {
  const solved = solveSeedGreedy({ seed, mode, lexicon });
  const topCandidateGaps = solved.bestLine.map((turn) => {
    if (!turn.topCandidates || turn.topCandidates.length < 2) return 0;
    return (turn.topCandidates[0].evalScore ?? 0) - (turn.topCandidates[1].evalScore ?? 0);
  });
  const difficulty = buildDifficultyProfile({
    turnScores: solved.bestLine.map((turn) => turn.turnScore ?? 0),
    topCandidateGaps,
  });

  return {
    seed,
    turnsPlayed: solved.summary.turnsPlayed,
    expectedFinalScore: solved.summary.finalScore,
    difficultyIndex: Number((difficulty.averageGap * 0.7 + difficulty.volatility * 0.3).toFixed(3)),
    difficulty,
  };
});

results.sort((a, b) => b.difficultyIndex - a.difficultyIndex);
writeJsonOutput({ payload: { mode, seeds: results } });
