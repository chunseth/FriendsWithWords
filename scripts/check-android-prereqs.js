#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

const checks = [];
const addCheck = (name, ok, detail) => checks.push({ name, ok, detail });

try {
  const pkg = readJson(path.join(root, "package.json"));
  const dep = pkg.dependencies?.["react-native-sfsymbols"];
  addCheck(
    "react-native-sfsymbols dependency",
    Boolean(dep),
    dep ? `Found: ${dep}` : "Missing from package.json dependencies"
  );
} catch (error) {
  addCheck("package.json readable", false, error.message);
}

const symbolIOS = path.join(root, "src/components/SFSymbolIcon.ios.js");
const symbolAndroid = path.join(root, "src/components/SFSymbolIcon.android.js");
addCheck(
  "iOS symbol adapter exists",
  fs.existsSync(symbolIOS),
  symbolIOS
);
addCheck(
  "Android symbol adapter exists",
  fs.existsSync(symbolAndroid),
  symbolAndroid
);

const patchedScripts = [
  "scripts/patch-gesture-handler.js",
  "scripts/patch-reanimated.js",
];

for (const relPath of patchedScripts) {
  const fullPath = path.join(root, relPath);
  addCheck(
    `${relPath} exists`,
    fs.existsSync(fullPath),
    fullPath
  );
}

let hasFailure = false;
for (const check of checks) {
  const prefix = check.ok ? "PASS" : "FAIL";
  console.log(`${prefix} - ${check.name}: ${check.detail}`);
  if (!check.ok) hasFailure = true;
}

if (hasFailure) {
  process.exit(1);
}

console.log("All Android prerequisite checks passed.");
