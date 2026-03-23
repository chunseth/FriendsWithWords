#!/usr/bin/env node
const { parseArgs, writeJsonOutput } = require("./common");

const { getDefaultLexicon } = require("../../src/game/analysis/lexicon");
const {
  getBoardLayout,
  mutateBoardLayout,
  registerBoardLayout,
} = require("../../src/game/analysis/boardLayouts");
const { solveSeedGreedy } = require("../../src/game/analysis/replayEngine");
const { aggregateLayoutSimulation } = require("../../src/game/analysis/metrics");

const args = parseArgs(process.argv.slice(2));
if (!args.seeds) {
  process.stderr.write(
    "Usage: node scripts/analysis/search-layouts.js --seeds <seed1,seed2> [--baseLayout classic] [--mutations 8] [--mutationCount 2] [--output result.json]\n"
  );
  process.exit(1);
}

const seeds = String(args.seeds)
  .split(",")
  .map((seed) => seed.trim())
  .filter(Boolean);

const baseLayoutId = args.baseLayout || "classic";
const mode = args.mode === "mini" ? "mini" : "classic";
const mutationLayouts = Number.isFinite(Number(args.mutations)) ? Number(args.mutations) : 8;
const mutationCount = Number.isFinite(Number(args.mutationCount))
  ? Number(args.mutationCount)
  : 2;
const preserveSymmetry = args.symmetric !== "false";

const baseLayout = getBoardLayout({ mode, layoutId: baseLayoutId });
const lexicon = getDefaultLexicon();

const candidateLayoutIds = [baseLayout.id];
for (let index = 0; index < mutationLayouts; index += 1) {
  const candidateId = `${baseLayout.id}-mut-${index + 1}`;
  const premiumSquares = mutateBoardLayout({
    basePremiumSquares: baseLayout.premiumSquares,
    boardSize: baseLayout.boardSize,
    mutationCount,
    preserveSymmetry,
  });

  registerBoardLayout({
    id: candidateId,
    boardSize: baseLayout.boardSize,
    premiumSquares,
  });
  candidateLayoutIds.push(candidateId);
}

const runs = [];
candidateLayoutIds.forEach((layoutId) => {
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
    });
  });
});

const ranked = aggregateLayoutSimulation(runs).sort(
  (left, right) => (right.distributionStats?.mean ?? 0) - (left.distributionStats?.mean ?? 0)
);

writeJsonOutput({
  payload: {
    baseLayoutId: baseLayout.id,
    candidateLayoutIds,
    seeds,
    ranked,
  },
  outputPath: args.output || null,
});
