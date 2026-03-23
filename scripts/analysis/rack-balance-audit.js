#!/usr/bin/env node
const { parseArgs, writeJsonOutput } = require("./common");
const { getDefaultLexicon } = require("../../src/game/analysis/lexicon");
const { solveSeedGreedy } = require("../../src/game/analysis/replayEngine");

const args = parseArgs(process.argv.slice(2));
if (!args.seed) {
  process.stderr.write("Usage: node scripts/analysis/rack-balance-audit.js --seed <seed> [--mode classic|mini]\n");
  process.exit(1);
}

const seed = String(args.seed);
const mode = args.mode === "mini" ? "mini" : "classic";
const lexicon = getDefaultLexicon();
const solved = solveSeedGreedy({ seed, mode, lexicon });

const vowels = new Set(["A", "E", "I", "O", "U"]);
const audit = (solved.finalState.moveHistory || []).map((move, index) => {
  const rack = solved.bestLine[index]?.chosenMove?.placements || [];
  const letters = rack.map((tile) => String(tile.letter || "").toUpperCase());
  const vowelCount = letters.filter((letter) => vowels.has(letter)).length;
  return {
    turn: index + 1,
    turnScore: move.turnScore,
    rackEntropyProxy: Number((new Set(letters).size / Math.max(1, letters.length)).toFixed(3)),
    vowelConsonantDelta: Math.abs(vowelCount - (letters.length - vowelCount)),
  };
});

writeJsonOutput({ payload: { seed, mode, audit } });
