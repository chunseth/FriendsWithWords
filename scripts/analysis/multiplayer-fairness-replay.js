#!/usr/bin/env node
const { parseArgs, writeJsonOutput } = require("./common");
const { getDefaultLexicon } = require("../../src/game/analysis/lexicon");
const { solveSeedGreedy } = require("../../src/game/analysis/replayEngine");

const args = parseArgs(process.argv.slice(2));
if (!args.seed) {
  process.stderr.write("Usage: node scripts/analysis/multiplayer-fairness-replay.js --seed <seed>\n");
  process.exit(1);
}

const seed = String(args.seed);
const lexicon = getDefaultLexicon();
const solved = solveSeedGreedy({ seed, mode: "classic", lexicon });

const playerA = { score: 0 };
const playerB = { score: 0 };
solved.bestLine.forEach((turn, index) => {
  if (index % 2 === 0) {
    playerA.score += turn.turnScore || 0;
  } else {
    playerB.score += turn.turnScore || 0;
  }
});

writeJsonOutput({
  payload: {
    seed,
    fairness: {
      playerA,
      playerB,
      firstPlayerAdvantage: Number((playerA.score - playerB.score).toFixed(3)),
    },
  },
});
