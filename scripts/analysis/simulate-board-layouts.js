#!/usr/bin/env node
const { parseArgs, readJsonFile, writeJsonOutput } = require("./common");

const { getDefaultLexicon } = require("../../src/game/analysis/lexicon");
const {
  registerBoardLayout,
  exportBoardLayoutRegistry,
} = require("../../src/game/analysis/boardLayouts");
const { solveSeedGreedy } = require("../../src/game/analysis/replayEngine");
const {
  aggregateLayoutSimulation,
  analyzePremiumEfficiency,
} = require("../../src/game/analysis/metrics");

const args = parseArgs(process.argv.slice(2));

if (!args.seeds && !args.input) {
  process.stderr.write(
    "Usage: node scripts/analysis/simulate-board-layouts.js --seeds <seed1,seed2> [--layouts classic,mini] [--input layouts.json] [--mode classic|mini] [--output result.json]\n"
  );
  process.exit(1);
}

const mode = args.mode === "mini" ? "mini" : "classic";
const lexicon = getDefaultLexicon();

const parsedSeeds = args.seeds
  ? String(args.seeds)
      .split(",")
      .map((seed) => seed.trim())
      .filter(Boolean)
  : [];

let layoutIds = args.layouts
  ? String(args.layouts)
      .split(",")
      .map((layoutId) => layoutId.trim())
      .filter(Boolean)
  : [mode];

if (args.input) {
  const inputPayload = readJsonFile(args.input);
  const seedListFromFile = Array.isArray(inputPayload?.seeds)
    ? inputPayload.seeds.map((seed) => String(seed))
    : [];

  if (seedListFromFile.length > 0) {
    parsedSeeds.push(...seedListFromFile);
  }

  if (Array.isArray(inputPayload?.layouts)) {
    inputPayload.layouts.forEach((layout) => {
      if (!layout?.id || !layout?.premiumSquares || !layout?.boardSize) return;
      registerBoardLayout({
        id: layout.id,
        boardSize: layout.boardSize,
        premiumSquares: layout.premiumSquares,
      });
      layoutIds.push(layout.id);
    });
  }
}

const seeds = [...new Set(parsedSeeds)];
layoutIds = [...new Set(layoutIds)];

if (seeds.length === 0) {
  process.stderr.write("No seeds provided.\n");
  process.exit(1);
}

const runs = [];
layoutIds.forEach((layoutId) => {
  seeds.forEach((seed) => {
    const solved = solveSeedGreedy({
      seed,
      mode,
      layoutId,
      lexicon,
    });

    runs.push({
      layoutId,
      seed,
      summary: solved.summary,
      bestLine: solved.bestLine,
      premiumStats: analyzePremiumEfficiency(solved.finalState.moveHistory || []),
    });
  });
});

const layoutComparisons = aggregateLayoutSimulation(runs);

writeJsonOutput({
  payload: {
    mode,
    seeds,
    layoutIds,
    availableLayouts: exportBoardLayoutRegistry().map((layout) => layout.id),
    layoutComparisons,
    runs,
  },
  outputPath: args.output || null,
});
