import {
  getBoardLayout,
  mutateBoardLayout,
  registerBoardLayout,
} from "../game/analysis/boardLayouts";
import { getDefaultLexicon } from "../game/analysis/lexicon";
import {
  solveSeedGreedy,
  solveSeedGreedyWithProgress,
} from "../game/analysis/replayEngine";
import {
  aggregateLayoutSimulation,
  analyzePremiumEfficiency,
} from "../game/analysis/metrics";

const randomNumericSeed = () => {
  const value = Math.floor(10000000 + Math.random() * 90000000);
  return String(value);
};

export const buildRandomSeedBatch = (count = 5) => {
  const safeCount = Math.max(1, Number(count) || 5);
  const unique = new Set();
  while (unique.size < safeCount) {
    unique.add(randomNumericSeed());
  }
  return [...unique];
};

export const formatDateSeed = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
};

export const parseSeedList = (seedInput = "") => {
  return String(seedInput)
    .split(",")
    .map((seed) => seed.trim())
    .filter(Boolean);
};

const createCandidateLayouts = ({
  mode,
  baseLayoutId,
  mutationLayouts,
  mutationCount,
  preserveSymmetry,
}) => {
  const baseLayout = getBoardLayout({ mode, layoutId: baseLayoutId || mode });
  const layoutIds = [baseLayout.id];

  for (let index = 0; index < mutationLayouts; index += 1) {
    const candidateId = `${baseLayout.id}-lab-${Date.now()}-${index + 1}`;
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
    layoutIds.push(candidateId);
  }

  return layoutIds;
};

export const runLayoutLabExperiment = ({
  seeds = [],
  mode = "classic",
  baseLayoutId = null,
  mutationLayouts = 6,
  mutationCount = 2,
  preserveSymmetry = true,
} = {}) => {
  const normalizedSeeds = Array.isArray(seeds)
    ? seeds.map((seed) => String(seed)).filter(Boolean)
    : [];

  if (normalizedSeeds.length === 0) {
    throw new Error("At least one seed is required.");
  }

  const lexicon = getDefaultLexicon();
  const layoutIds = createCandidateLayouts({
    mode,
    baseLayoutId,
    mutationLayouts,
    mutationCount,
    preserveSymmetry,
  });

  const runs = [];
  layoutIds.forEach((layoutId) => {
    normalizedSeeds.forEach((seed) => {
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

  const rankedLayouts = aggregateLayoutSimulation(runs).sort(
    (left, right) => (right.distributionStats?.mean ?? 0) - (left.distributionStats?.mean ?? 0)
  );

  return {
    mode,
    seeds: normalizedSeeds,
    layoutIds,
    rankedLayouts,
    runs,
  };
};

export const runLayoutLabSeedScoreTest = ({
  mode = "classic",
  premiumSquares = {},
  seeds = null,
  seedCount = 5,
} = {}) => {
  const normalizedMode = mode === "mini" ? "mini" : "classic";
  const boardSize = normalizedMode === "mini" ? 11 : 15;
  const center = Math.floor(boardSize / 2);
  const centerKey = `${center},${center}`;
  const normalizedSeeds =
    Array.isArray(seeds) && seeds.length > 0
      ? seeds.map((seed) => String(seed)).filter(Boolean)
      : buildRandomSeedBatch(seedCount);

  if (normalizedSeeds.length === 0) {
    throw new Error("At least one seed is required.");
  }

  const layoutId = `layout-lab-test-${normalizedMode}-${Date.now()}`;
  registerBoardLayout({
    id: layoutId,
    boardSize,
    premiumSquares: {
      ...premiumSquares,
      [centerKey]: "center",
    },
  });

  const lexicon = getDefaultLexicon();
  const results = normalizedSeeds.map((seed, index) => {
    const solved = solveSeedGreedy({
      seed,
      mode: normalizedMode,
      layoutId,
      lexicon,
    });

    return {
      index: index + 1,
      seed: String(seed),
      score: solved.summary?.finalScore ?? solved.summary?.totalScore ?? 0,
      turnsPlayed: solved.summary?.turnsPlayed ?? 0,
    };
  });

  return {
    mode: normalizedMode,
    layoutId,
    seeds: normalizedSeeds,
    results,
    minScore: Math.min(...results.map((entry) => entry.score)),
    maxScore: Math.max(...results.map((entry) => entry.score)),
  };
};

export const runLayoutLabSeedScoreTestWithProgress = async ({
  mode = "classic",
  premiumSquares = {},
  seeds = null,
  seedCount = 5,
  onProgress = null,
  yieldMs = 0,
} = {}) => {
  const normalizedMode = mode === "mini" ? "mini" : "classic";
  const boardSize = normalizedMode === "mini" ? 11 : 15;
  const center = Math.floor(boardSize / 2);
  const centerKey = `${center},${center}`;
  const normalizedSeeds =
    Array.isArray(seeds) && seeds.length > 0
      ? seeds.map((seed) => String(seed)).filter(Boolean)
      : buildRandomSeedBatch(seedCount);

  if (normalizedSeeds.length === 0) {
    throw new Error("At least one seed is required.");
  }

  const layoutId = `layout-lab-test-${normalizedMode}-${Date.now()}`;
  registerBoardLayout({
    id: layoutId,
    boardSize,
    premiumSquares: {
      ...premiumSquares,
      [centerKey]: "center",
    },
  });

  const lexicon = getDefaultLexicon();
  const totalSeeds = normalizedSeeds.length;
  const results = [];

  for (let index = 0; index < normalizedSeeds.length; index += 1) {
    const seed = normalizedSeeds[index];
    const solved = await solveSeedGreedyWithProgress({
      seed,
      mode: normalizedMode,
      layoutId,
      lexicon,
      yieldMs,
      onProgress: ({ tilesRemaining, initialBagSize }) => {
        if (typeof onProgress !== "function") return;
        const bagProgress =
          initialBagSize > 0 ? 1 - tilesRemaining / initialBagSize : 1;
        const overall = ((index + Math.max(0, Math.min(1, bagProgress))) / totalSeeds) * 100;
        onProgress({
          seedIndex: index + 1,
          totalSeeds,
          percentage: Math.max(0, Math.min(100, Math.round(overall))),
        });
      },
    });

    results.push({
      index: index + 1,
      seed: String(seed),
      score: solved.summary?.finalScore ?? solved.summary?.totalScore ?? 0,
      turnsPlayed: solved.summary?.turnsPlayed ?? 0,
    });

    if (typeof onProgress === "function") {
      onProgress({
        seedIndex: index + 1,
        totalSeeds,
        percentage: Math.round(((index + 1) / totalSeeds) * 100),
      });
    }
  }

  return {
    mode: normalizedMode,
    layoutId,
    seeds: normalizedSeeds,
    results,
    minScore: Math.min(...results.map((entry) => entry.score)),
    maxScore: Math.max(...results.map((entry) => entry.score)),
  };
};
