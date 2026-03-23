#!/usr/bin/env node
const { parseArgs, writeJsonOutput } = require("./common");
const { getDefaultLexicon } = require("../../src/game/analysis/lexicon");
const { solveSeedGreedy } = require("../../src/game/analysis/replayEngine");

const args = parseArgs(process.argv.slice(2));
if (!args.seeds) {
  process.stderr.write("Usage: node scripts/analysis/mode-parity-report.js --seeds <s1,s2,...>\n");
  process.exit(1);
}

const seeds = String(args.seeds).split(",").map((seed) => seed.trim()).filter(Boolean);
const lexicon = getDefaultLexicon();

const rows = seeds.map((seed) => {
  const classic = solveSeedGreedy({ seed, mode: "classic", lexicon });
  const mini = solveSeedGreedy({ seed, mode: "mini", lexicon });

  return {
    seed,
    classicFinalScore: classic.summary.finalScore,
    miniFinalScore: mini.summary.finalScore,
    parityDelta: Number(((classic.summary.finalScore || 0) - (mini.summary.finalScore || 0)).toFixed(3)),
  };
});

writeJsonOutput({ payload: { rows } });
