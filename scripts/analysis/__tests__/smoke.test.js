import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";

const runNode = (args) => {
  return execFileSync("node", args, {
    cwd: path.resolve(__dirname, "../../.."),
    encoding: "utf8",
  });
};

describe("analysis CLI smoke", () => {
  it("runs solve-seed-greedy and emits summary", () => {
    const output = runNode([
      "scripts/analysis/solve-seed-greedy.js",
      "--seed",
      "smoke-seed-1",
      "--maxTurns",
      "2",
    ]);

    const payload = JSON.parse(output);
    expect(payload.seed).toBe("smoke-seed-1");
    expect(payload.summary).toBeDefined();
    expect(Array.isArray(payload.bestLine)).toBe(true);
  });

  it("runs analyze-game with snapshot input", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wwrf-analysis-"));
    const inputPath = path.join(tmpDir, "snapshot.json");

    fs.writeFileSync(
      inputPath,
      JSON.stringify({
        currentSeed: "snapshot-seed",
        gameMode: "classic",
        board: Array.from({ length: 15 }, () => Array(15).fill(null)),
        tileRack: [
          { id: 0, letter: "A", value: 1, rackIndex: 0 },
          { id: 1, letter: "T", value: 1, rackIndex: 1 },
        ],
        tileBag: [],
        premiumSquares: {},
        turnCount: 0,
        isFirstTurn: true,
      })
    );

    const output = runNode([
      "scripts/analysis/analyze-game.js",
      "--input",
      inputPath,
      "--maxMoves",
      "20",
    ]);
    const payload = JSON.parse(output);

    expect(payload.inputKind).toBe("snapshot");
    expect(payload.analysis).toBeDefined();
  });

  it("runs simulate-board-layouts", () => {
    const output = runNode([
      "scripts/analysis/simulate-board-layouts.js",
      "--seeds",
      "layout-smoke-1",
      "--layouts",
      "classic",
    ]);

    const payload = JSON.parse(output);
    expect(Array.isArray(payload.layoutComparisons)).toBe(true);
    expect(payload.layoutComparisons.length).toBeGreaterThan(0);
  });
});
