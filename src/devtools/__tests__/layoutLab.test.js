import {
  formatDateSeed,
  parseSeedList,
  runLayoutLabExperiment,
  runLayoutLabSeedScoreTest,
} from "../layoutLab";

describe("layoutLab", () => {
  it("formats date seeds as YYYYMMDD", () => {
    const seed = formatDateSeed(new Date("2026-03-21T12:00:00.000Z"));
    expect(seed).toBe("20260321");
  });

  it("parses comma-separated seed input", () => {
    expect(parseSeedList("a, b, ,c")).toEqual(["a", "b", "c"]);
  });

  it("runs experiment and returns ranked layouts", () => {
    const report = runLayoutLabExperiment({
      seeds: ["layout-lab-smoke-seed"],
      mode: "classic",
      mutationLayouts: 1,
      mutationCount: 1,
      preserveSymmetry: true,
    });

    expect(report.mode).toBe("classic");
    expect(report.layoutIds.length).toBe(2);
    expect(report.rankedLayouts.length).toBeGreaterThan(0);
  });

  it("runs custom board seed score test", () => {
    const report = runLayoutLabSeedScoreTest({
      mode: "mini",
      seeds: ["seed-a"],
      premiumSquares: {
        "5,5": "center",
        "0,0": "tw",
      },
    });

    expect(report.mode).toBe("mini");
    expect(report.results).toHaveLength(1);
    expect(typeof report.results[0].score).toBe("number");
  });
});
