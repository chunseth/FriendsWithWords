#!/usr/bin/env node
const { parseArgs, writeJsonOutput } = require("./common");
const { getDefaultLexicon } = require("../../src/game/analysis/lexicon");
const { solveSeedGreedy } = require("../../src/game/analysis/replayEngine");

const args = parseArgs(process.argv.slice(2));
if (!args.seeds) {
  process.stderr.write("Usage: node scripts/analysis/first-3-turn-snowball-analyzer.js --seeds <s1,s2,...>\n");
  process.exit(1);
}

const seeds = String(args.seeds).split(",").map((seed) => seed.trim()).filter(Boolean);
const lexicon = getDefaultLexicon();

const rows = seeds.map((seed) => {
  const solved = solveSeedGreedy({ seed, mode: "classic", lexicon });
  const first3 = solved.bestLine.slice(0, 3).reduce((sum, turn) => sum + (turn.turnScore || 0), 0);
  const total = solved.summary.totalScore || 1;
  return {
    seed,
    first3Points: first3,
    totalPoints: solved.summary.totalScore,
    snowballRatio: Number((first3 / total).toFixed(4)),
  };
});

rows.sort((a, b) => b.snowballRatio - a.snowballRatio);
writeJsonOutput({ payload: { seeds: rows } });
