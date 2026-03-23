#!/usr/bin/env node
const { parseArgs, writeJsonOutput } = require("./common");
const { getDefaultLexicon } = require("../../src/game/analysis/lexicon");
const { solveSeedGreedy } = require("../../src/game/analysis/replayEngine");

const args = parseArgs(process.argv.slice(2));
if (!args.seed) {
  process.stderr.write("Usage: node scripts/analysis/penalty-tuner.js --seed <seed> [--turnPenaltyValues 1,2,3]\n");
  process.exit(1);
}

const seed = String(args.seed);
const turnPenaltyValues = String(args.turnPenaltyValues || "1,2,3,4")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value));

const lexicon = getDefaultLexicon();
const solved = solveSeedGreedy({ seed, mode: "classic", lexicon });
const base = solved.summary.totalScore || 0;

const sweeps = turnPenaltyValues.map((turnPenalty) => ({
  turnPenalty,
  tunedScore: base - solved.summary.turnsPlayed * turnPenalty,
}));

writeJsonOutput({ payload: { seed, baseScore: base, sweeps } });
