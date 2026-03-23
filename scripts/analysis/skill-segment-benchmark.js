#!/usr/bin/env node
const { parseArgs, writeJsonOutput } = require("./common");
const { getDefaultLexicon } = require("../../src/game/analysis/lexicon");
const { solveSeedGreedy } = require("../../src/game/analysis/replayEngine");

const args = parseArgs(process.argv.slice(2));
if (!args.seed) {
  process.stderr.write("Usage: node scripts/analysis/skill-segment-benchmark.js --seed <seed>\n");
  process.exit(1);
}

const seed = String(args.seed);
const lexicon = getDefaultLexicon();
const greedy = solveSeedGreedy({ seed, mode: "classic", lexicon });

const noviceEstimate = Math.floor((greedy.summary.finalScore || 0) * 0.62);
const intermediateEstimate = Math.floor((greedy.summary.finalScore || 0) * 0.82);

writeJsonOutput({
  payload: {
    seed,
    segments: [
      { label: "novice_estimate", score: noviceEstimate },
      { label: "intermediate_estimate", score: intermediateEstimate },
      { label: "greedy_oracle", score: greedy.summary.finalScore || 0 },
    ],
  },
});
