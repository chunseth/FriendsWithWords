require("@babel/register")({
  extensions: [".js", ".json"],
  ignore: [/node_modules/],
});

const fs = require("fs");
const dictionaryWords = require("../src/data/dictionaryWords.json");
const { INVALID_DICTIONARY_WORDS } = require("../src/data/invalidDictionaryWords");

const parseIntegerArg = (name, fallback) => {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix));
  if (!raw) return fallback;

  const value = Number.parseInt(raw.slice(prefix.length), 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

const hasFlag = (name) => process.argv.includes(`--${name}`);

const start = parseIntegerArg("start", 0);
const size = parseIntegerArg("size", 500);
const end = Math.min(dictionaryWords.length, start + size);
const suspectsOnly = hasFlag("suspects-only");
const localProperNamesPath = "/usr/share/dict/propernames";
const localProperNames = fs.existsSync(localProperNamesPath)
  ? new Set(
      fs
        .readFileSync(localProperNamesPath, "utf8")
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
    )
  : new Set();

const PROPER_NAME_ROOTS = [
  "abyssin",
  "acadia",
  "acadian",
  "acadie",
  "acapulco",
  "achaea",
  "achaean",
  "achaemen",
  "acheron",
  "achernar",
  "achill",
  "achitophel",
];

const TAXONOMIC_PATTERNS = [
  /aceae$/,
  /acean$/,
  /acea$/,
  /ales$/,
  /aria$/,
  /idae$/,
  /inae$/,
  /ineae$/,
  /oidea$/,
  /opteri$/,
  /opterygii$/,
];

const TECHNICAL_PATTERNS = [
  /^aceto/,
  /^acetyl/,
  /^achromo/,
  /benzene$/,
  /chloral$/,
  /cyanide$/,
  /fluoride$/,
  /hydrazine$/,
  /iodide$/,
  /nitrile$/,
  /thymol$/,
  /uria$/,
];

const STALE_SPELLING_REPLACEMENTS = new Map([
  ["lettice", "lettuce"],
]);

const getCandidateReasons = (word) => {
  const reasons = [];

  if (PROPER_NAME_ROOTS.some((root) => word.includes(root))) {
    reasons.push("proper-name/root");
  }

  if (localProperNames.has(word)) {
    reasons.push("proper-name-list");
  }

  if (TAXONOMIC_PATTERNS.some((pattern) => pattern.test(word))) {
    reasons.push("taxonomic-latin");
  }

  if (TECHNICAL_PATTERNS.some((pattern) => pattern.test(word))) {
    reasons.push("technical/chemical");
  }

  return reasons;
};

console.log(`Dictionary batch ${start}-${end - 1} of ${dictionaryWords.length}`);

for (let index = start; index < end; index += 1) {
  const word = dictionaryWords[index];
  const isExcluded = INVALID_DICTIONARY_WORDS.has(word);
  const reasons = getCandidateReasons(word);
  if (STALE_SPELLING_REPLACEMENTS.has(word)) {
    reasons.push(`stale-spelling:${STALE_SPELLING_REPLACEMENTS.get(word)}`);
  }
  const marker = isExcluded ? "x" : reasons.length > 0 ? "?" : " ";
  if (suspectsOnly && marker === " ") {
    continue;
  }
  const suffix = reasons.length > 0 ? `  ${reasons.join(", ")}` : "";
  console.log(`${String(index).padStart(6, "0")} [${marker}] ${word}${suffix}`);
}
