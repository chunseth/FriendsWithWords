#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const root = path.resolve(__dirname, "..");
const indexPath = path.join(root, "index.js");
const boardPlayerIndexPath = path.join(root, "index.boardPlayer.js");
const extraArgs = process.argv.slice(2);

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

const metro = spawn("npx", ["react-native", "start", ...extraArgs], {
  cwd: root,
  stdio: "inherit",
  shell: true,
});

metro.on("exit", (code) => {
  restoreIndex();
  process.exit(code ?? 0);
});

metro.on("error", (error) => {
  console.error("Failed to start Metro:", error.message);
  restoreIndex();
  process.exit(1);
});
