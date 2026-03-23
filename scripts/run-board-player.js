#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const platform = process.argv[2];
const extraArgs = process.argv.slice(3);

if (platform !== "ios" && platform !== "android") {
  console.error(
    "Usage: node scripts/run-board-player.js <ios|android> [react-native run args]"
  );
  process.exit(1);
}

const root = path.resolve(__dirname, "..");
const indexPath = path.join(root, "index.js");
const boardPlayerIndexPath = path.join(root, "index.boardPlayer.js");

if (!fs.existsSync(indexPath) || !fs.existsSync(boardPlayerIndexPath)) {
  console.error("Missing index.js or index.boardPlayer.js");
  process.exit(1);
}

const originalIndexContent = fs.readFileSync(indexPath, "utf8");
const boardPlayerContent = fs.readFileSync(boardPlayerIndexPath, "utf8");
let restored = false;

const restoreIndex = () => {
  if (restored) return;
  restored = true;
  try {
    fs.writeFileSync(indexPath, originalIndexContent, "utf8");
  } catch (error) {
    console.error("Failed to restore index.js:", error.message);
  }
};

process.on("SIGINT", () => {
  restoreIndex();
  process.exit(130);
});

process.on("SIGTERM", () => {
  restoreIndex();
  process.exit(143);
});

process.on("exit", () => {
  restoreIndex();
});

try {
  fs.writeFileSync(indexPath, boardPlayerContent, "utf8");
} catch (error) {
  console.error("Failed to switch to board player entrypoint:", error.message);
  process.exit(1);
}

const runCommand = platform === "ios" ? "run-ios" : "run-android";
const child = spawn(
  "npx",
  ["react-native", runCommand, ...extraArgs],
  {
    cwd: root,
    stdio: "inherit",
    shell: true,
  }
);

child.on("exit", (code) => {
  restoreIndex();
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error(`Failed to launch react-native ${runCommand}:`, error.message);
  restoreIndex();
  process.exit(1);
});
