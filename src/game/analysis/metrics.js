const average = (values = []) => {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const stdDev = (values = []) => {
  if (values.length < 2) return 0;
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
};

const percentile = (values = [], target = 0.95) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * target) - 1));
  return sorted[index];
};

const computeRackQuality = (tiles = []) => {
  const letters = tiles.map((tile) => String(tile?.letter || "").toUpperCase().trim());
  const vowels = new Set(["A", "E", "I", "O", "U"]);
  const vowelCount = letters.filter((letter) => vowels.has(letter)).length;
  const consonantCount = letters.length - vowelCount;
  const valueTotal = tiles.reduce((sum, tile) => sum + (tile?.value ?? 0), 0);
  return Number((10 - valueTotal - Math.abs(vowelCount - consonantCount) * 0.8).toFixed(3));
};

const sampleExpectedDrawQuality = ({ bag = [], drawCount = 0, sampleCount = 64 }) => {
  if (!Array.isArray(bag) || drawCount <= 0 || bag.length === 0) {
    return 0;
  }

  let qualitySum = 0;
  const effectiveSamples = Math.max(1, sampleCount);

  for (let sample = 0; sample < effectiveSamples; sample += 1) {
    const temp = [...bag];
    const drawn = [];

    for (let draw = 0; draw < drawCount && temp.length > 0; draw += 1) {
      const index = Math.floor(Math.random() * temp.length);
      const [picked] = temp.splice(index, 1);
      drawn.push(picked);
    }

    qualitySum += computeRackQuality(drawn);
  }

  return Number((qualitySum / effectiveSamples).toFixed(3));
};

export const buildTurnComparisonMetrics = (turnComparisons = []) => {
  if (!Array.isArray(turnComparisons) || turnComparisons.length === 0) {
    return {
      turnAnalyses: [],
      summary: {
        averageScoreLoss: 0,
        largestMissedOpportunity: null,
        mostImpactfulTurn: null,
      },
    };
  }

  const turnAnalyses = turnComparisons.map((turnEntry) => {
    const scoreLoss = (turnEntry.bestTurnScore ?? 0) - (turnEntry.playedTurnScore ?? 0);
    const evalSwing = (turnEntry.bestEvalScore ?? 0) - (turnEntry.playedEvalScore ?? 0);

    return {
      ...turnEntry,
      scoreLoss,
      evalSwing,
    };
  });

  const averageScoreLoss = average(turnAnalyses.map((entry) => entry.scoreLoss));
  const largestMissedOpportunity = turnAnalyses.reduce((best, entry) => {
    if (!best || entry.scoreLoss > best.scoreLoss) {
      return entry;
    }
    return best;
  }, null);

  const mostImpactfulTurn = turnAnalyses.reduce((best, entry) => {
    if (!best || entry.evalSwing > best.evalSwing) {
      return entry;
    }
    return best;
  }, null);

  return {
    turnAnalyses,
    summary: {
      averageScoreLoss: Number(averageScoreLoss.toFixed(3)),
      largestMissedOpportunity,
      mostImpactfulTurn,
    },
  };
};

export const analyzeDrawLuck = (drawHistory = []) => {
  if (!Array.isArray(drawHistory) || drawHistory.length === 0) {
    return {
      drawAnalyses: [],
      unluckiestDraw: null,
    };
  }

  const drawAnalyses = drawHistory.map((drawEvent) => {
    const drawnTiles = drawEvent?.drawnTiles ?? [];
    const actualQuality = computeRackQuality(drawnTiles);
    const expectedQuality = sampleExpectedDrawQuality({
      bag: drawEvent?.bagBeforeDraw ?? [],
      drawCount: drawnTiles.length,
    });
    const luckDelta = Number((actualQuality - expectedQuality).toFixed(3));

    return {
      turn: drawEvent?.turn,
      drawCount: drawnTiles.length,
      drawnTiles: drawnTiles.map((tile) => tile.letter),
      actualQuality,
      expectedQuality,
      luckDelta,
    };
  });

  const unluckiestDraw = drawAnalyses.reduce((worst, entry) => {
    if (!worst || entry.luckDelta < worst.luckDelta) {
      return entry;
    }
    return worst;
  }, null);

  return {
    drawAnalyses,
    unluckiestDraw,
  };
};

export const analyzePremiumEfficiency = (moveHistory = []) => {
  const premiumUsage = {
    center: 0,
    dw: 0,
    tw: 0,
    dl: 0,
    tl: 0,
  };

  moveHistory.forEach((entry) => {
    (entry?.premiumHits || []).forEach((hit) => {
      if (premiumUsage[hit.premium] != null) {
        premiumUsage[hit.premium] += 1;
      }
    });
  });

  const totalPremiumHits = Object.values(premiumUsage).reduce((sum, value) => sum + value, 0);

  return {
    premiumUsage,
    totalPremiumHits,
  };
};

export const analyzeEndgameEfficiency = (finalState) => {
  const turns = finalState?.moveHistory || [];
  const finalTurns = turns.slice(-4);
  return {
    finalTurnCount: finalTurns.length,
    finalTurnAverage: Number(average(finalTurns.map((entry) => entry.turnScore ?? 0)).toFixed(3)),
  };
};

export const buildDifficultyProfile = ({ turnScores = [], topCandidateGaps = [] } = {}) => {
  const volatility = stdDev(turnScores);
  const averageGap = average(topCandidateGaps);

  const pivotalTurns = topCandidateGaps
    .map((gap, index) => ({ turn: index + 1, gap }))
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 5);

  return {
    volatility: Number(volatility.toFixed(3)),
    averageGap: Number(averageGap.toFixed(3)),
    pivotalTurns,
    varianceContributors: {
      p95TurnScore: percentile(turnScores, 0.95),
      p05TurnScore: percentile(turnScores, 0.05),
    },
  };
};

export const aggregateLayoutSimulation = (layoutRuns = []) => {
  const grouped = new Map();

  layoutRuns.forEach((run) => {
    const layoutId = run.layoutId || "unknown";
    if (!grouped.has(layoutId)) {
      grouped.set(layoutId, []);
    }
    grouped.get(layoutId).push(run);
  });

  return [...grouped.entries()].map(([layoutId, runs]) => {
    const finalScores = runs.map((run) => run.summary?.finalScore ?? 0);
    const premiumHits = runs.map((run) => run.premiumStats?.totalPremiumHits ?? 0);
    const earlySnowballTurns = runs.map((run) => {
      const turnScores = run.bestLine?.slice(0, 3).map((turn) => turn.turnScore ?? 0) ?? [];
      const total = (run.summary?.totalScore ?? 0) || 1;
      return average(turnScores) / total;
    });

    return {
      layoutId,
      samples: runs.length,
      distributionStats: {
        mean: Number(average(finalScores).toFixed(3)),
        median: percentile(finalScores, 0.5),
        p95: percentile(finalScores, 0.95),
        volatility: Number(stdDev(finalScores).toFixed(3)),
      },
      premiumUtilization: {
        averageHits: Number(average(premiumHits).toFixed(3)),
      },
      snowballRisk: Number(average(earlySnowballTurns).toFixed(4)),
    };
  });
};
