const fs = require("fs");
const path = require("path");

const target = path.join(
  __dirname,
  "..",
  "node_modules",
  "metro",
  "src",
  "node-haste",
  "DependencyGraph",
  "createFileMap.js"
);

if (!fs.existsSync(target)) {
  process.exit(0);
}

const original = fs.readFileSync(target, "utf8");
const before = "watch: options?.watch == null ? !ci.isCI : options.watch,";
const patchedLine = "watch:";
const previousAfter = [
  patchedLine,
  "      options?.watch == null",
  '        ? !(ci.isCI || (process.env.CONFIGURATION === "Release" && process.env.PROJECT_DIR))',
  "        : options.watch,",
].join("\n");
const after = [
  patchedLine,
  "      options?.watch == null",
  "        ? !(ci.isCI || process.env.PROJECT_DIR)",
  "        : options.watch,",
].join("\n");

if (original.includes(after)) {
  process.exit(0);
}

if (original.includes(previousAfter)) {
  fs.writeFileSync(target, original.replace(previousAfter, after));
  console.log("Patched Metro to disable file watching during Xcode bundling.");
  process.exit(0);
}

if (!original.includes(before)) {
  console.warn("Metro Xcode Release watch patch skipped: target line not found.");
  process.exit(0);
}

fs.writeFileSync(target, original.replace(before, after));
console.log("Patched Metro to disable file watching during Xcode bundling.");
