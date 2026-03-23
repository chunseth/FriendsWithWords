import {
  analyzeDrawLuck,
  buildTurnComparisonMetrics,
  aggregateLayoutSimulation,
} from "../metrics";

describe("analysis metrics", () => {
  it("computes largest missed opportunity and impactful turn", () => {
    const metrics = buildTurnComparisonMetrics([
      {
        turn: 1,
        playedTurnScore: 20,
        bestTurnScore: 22,
        playedEvalScore: 20.2,
        bestEvalScore: 22.5,
      },
      {
        turn: 2,
        playedTurnScore: 8,
        bestTurnScore: 20,
        playedEvalScore: 8.2,
        bestEvalScore: 20.1,
      },
    ]);

    expect(metrics.summary.largestMissedOpportunity.turn).toBe(2);
    expect(metrics.summary.mostImpactfulTurn.turn).toBe(2);
    expect(metrics.summary.averageScoreLoss).toBeCloseTo(7, 5);
  });

  it("identifies unluckiest draw", () => {
    const drawMetrics = analyzeDrawLuck([
      {
        turn: 1,
        drawnTiles: [{ letter: "Q", value: 10 }, { letter: "Z", value: 10 }],
        bagBeforeDraw: [
          { letter: "A", value: 1 },
          { letter: "E", value: 1 },
          { letter: "R", value: 1 },
          { letter: "S", value: 1 },
        ],
      },
    ]);

    expect(drawMetrics.unluckiestDraw.turn).toBe(1);
    expect(typeof drawMetrics.unluckiestDraw.luckDelta).toBe("number");
  });

  it("aggregates layout simulation stats", () => {
    const report = aggregateLayoutSimulation([
      {
        layoutId: "classic",
        summary: { finalScore: 100 },
        premiumStats: { totalPremiumHits: 3 },
        bestLine: [{ turnScore: 20 }, { turnScore: 10 }, { turnScore: 5 }],
      },
      {
        layoutId: "classic",
        summary: { finalScore: 120 },
        premiumStats: { totalPremiumHits: 4 },
        bestLine: [{ turnScore: 24 }, { turnScore: 12 }, { turnScore: 6 }],
      },
    ]);

    expect(report).toHaveLength(1);
    expect(report[0].layoutId).toBe("classic");
    expect(report[0].distributionStats.mean).toBe(110);
  });
});
