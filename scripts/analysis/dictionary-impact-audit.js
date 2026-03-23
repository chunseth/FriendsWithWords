#!/usr/bin/env node
const { parseArgs, writeJsonOutput } = require("./common");
const { getDefaultLexicon } = require("../../src/game/analysis/lexicon");
const { solveSeedGreedy } = require("../../src/game/analysis/replayEngine");

const args = parseArgs(process.argv.slice(2));
if (!args.seeds) {
  process.stderr.write("Usage: node scripts/analysis/dictionary-impact-audit.js --seeds <s1,s2,...>\n");
  process.exit(1);
}

const seeds = String(args.seeds).split(",").map((seed) => seed.trim()).filter(Boolean);
const lexicon = getDefaultLexicon();
const wordStats = new Map();

seeds.forEach((seed) => {
  const solved = solveSeedGreedy({ seed, mode: "classic", lexicon });
  (solved.finalState.wordHistory || []).forEach((entry) => {
    const word = String(entry.word || "").toUpperCase();
    if (!wordStats.has(word)) {
      wordStats.set(word, { word, plays: 0, points: 0 });
    }
    const current = wordStats.get(word);
    current.plays += 1;
    current.points += entry.score || 0;
  });
});

const topWords = [...wordStats.values()]
  .map((entry) => ({ ...entry, averagePoints: Number((entry.points / entry.plays).toFixed(3)) }))
  .sort((a, b) => b.points - a.points)
  .slice(0, 100);

writeJsonOutput({ payload: { seeds, topWords } });
