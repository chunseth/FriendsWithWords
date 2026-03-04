const dictionaryWords = require("../src/data/dictionaryWords.json");

const VALID_TWO_LETTER_WORDS = new Set([
  "aa",
  "ab",
  "ad",
  "ae",
  "ag",
  "ah",
  "ai",
  "al",
  "am",
  "an",
  "ar",
  "as",
  "at",
  "aw",
  "ax",
  "ay",
  "ba",
  "be",
  "bi",
  "bo",
  "by",
  "da",
  "de",
  "di",
  "do",
  "ed",
  "ef",
  "eh",
  "el",
  "em",
  "en",
  "er",
  "es",
  "et",
  "ew",
  "ex",
  "fa",
  "fe",
  "go",
  "ha",
  "he",
  "hi",
  "hm",
  "ho",
  "id",
  "if",
  "in",
  "is",
  "it",
  "jo",
  "ka",
  "ki",
  "la",
  "li",
  "lo",
  "ma",
  "me",
  "mi",
  "mm",
  "mo",
  "mu",
  "my",
  "na",
  "ne",
  "no",
  "nu",
  "ob",
  "od",
  "oe",
  "of",
  "oh",
  "oi",
  "om",
  "on",
  "oo",
  "op",
  "or",
  "os",
  "ow",
  "ox",
  "oy",
  "pa",
  "pe",
  "pi",
  "po",
  "qi",
  "re",
  "sh",
  "si",
  "so",
  "ta",
  "te",
  "ti",
  "to",
  "uh",
  "um",
  "un",
  "up",
  "ur",
  "us",
  "ut",
  "we",
  "wo",
  "xi",
  "xu",
  "ya",
  "ye",
  "yo",
  "za",
]);

const VALID_THREE_LETTER_WORDS = new Set([
  "box",
  "fax",
  "oxo",
  "qat",
  "qis",
  "xis",
  "zek",
  "zit",
]);

const INVALID_IRREGULAR_INFLECTIONS = new Set([
  "ate",
  "beated",
  "begined",
  "breaked",
  "bringed",
  "buyed",
  "catched",
  "choosed",
  "comed",
  "digged",
  "doed",
  "drawed",
  "drinked",
  "drived",
  "eated",
  "falled",
  "feeded",
  "finded",
  "flyed",
  "forgeted",
  "freezed",
  "gived",
  "goed",
  "growed",
  "holded",
  "keeped",
  "knowed",
  "rided",
  "ringed",
  "rised",
  "runned",
  "seed",
  "selled",
  "shaked",
  "singed",
  "sinked",
  "sitted",
  "slided",
  "sleeped",
  "speaked",
  "stealed",
  "swimmed",
  "taked",
  "throwed",
  "writed",
]);

const INVALID_SHORT_WORDS = new Set(["dbe"]);

const words = new Set();
dictionaryWords.forEach((word) => {
  if (word.length === 2 && !VALID_TWO_LETTER_WORDS.has(word)) {
    return;
  }

  if (word.length <= 3 && INVALID_SHORT_WORDS.has(word)) {
    return;
  }

  words.add(word);
});

VALID_TWO_LETTER_WORDS.forEach((word) => {
  words.add(word);
});

VALID_THREE_LETTER_WORDS.forEach((word) => {
  words.add(word);
});

const hasKnownBaseForm = (candidates) =>
  candidates.some((candidate) => candidate && words.has(candidate));

const removeDoubledTrailingConsonant = (base) => {
  if (base.length < 3) {
    return "";
  }

  const lastChar = base[base.length - 1];
  const secondLastChar = base[base.length - 2];
  if (lastChar === secondLastChar && !/[aeiou]/.test(lastChar)) {
    return base.slice(0, -1);
  }

  return "";
};

const isLikelyInflectedForm = (word) => {
  if (word.length < 4) {
    return false;
  }

  if (word.endsWith("ies") && word.length > 4) {
    return hasKnownBaseForm([`${word.slice(0, -3)}y`]);
  }

  if (
    word.endsWith("es") &&
    /(s|x|z|ch|sh|o)es$/.test(word) &&
    word.length > 4
  ) {
    return hasKnownBaseForm([word.slice(0, -2)]);
  }

  if (word.endsWith("s") && !word.endsWith("ss")) {
    return hasKnownBaseForm([word.slice(0, -1)]);
  }

  if (word.endsWith("ing") && word.length > 5) {
    const base = word.slice(0, -3);
    return hasKnownBaseForm([
      base,
      `${base}e`,
      base.endsWith("y") ? `${base.slice(0, -1)}ie` : "",
      removeDoubledTrailingConsonant(base),
    ]);
  }

  if (word.endsWith("ied") && word.length > 4) {
    return hasKnownBaseForm([`${word.slice(0, -3)}y`]);
  }

  if (word.endsWith("ed") && word.length > 4) {
    const base = word.slice(0, -2);
    return hasKnownBaseForm([
      base,
      `${base}e`,
      removeDoubledTrailingConsonant(base),
    ]);
  }

  if (word.endsWith("en") && word.length > 4) {
    const base = word.slice(0, -2);
    return hasKnownBaseForm([
      base,
      `${base}e`,
      removeDoubledTrailingConsonant(base),
    ]);
  }

  if (word.endsWith("ier") && word.length > 4) {
    return hasKnownBaseForm([`${word.slice(0, -3)}y`]);
  }

  if (word.endsWith("er") && word.length > 4) {
    const base = word.slice(0, -2);
    return hasKnownBaseForm([
      base,
      `${base}e`,
      removeDoubledTrailingConsonant(base),
    ]);
  }

  return false;
};

const isValid = (word) => {
  const normalizedWord = word.toLowerCase();
  if (
    (normalizedWord.length <= 3 && INVALID_SHORT_WORDS.has(normalizedWord)) ||
    INVALID_IRREGULAR_INFLECTIONS.has(normalizedWord)
  ) {
    return false;
  }

  if (words.has(normalizedWord)) {
    return true;
  }

  return isLikelyInflectedForm(normalizedWord);
};

const examples = [
  { word: "jib", expected: true, note: "common 3-letter j word" },
  { word: "jin", expected: true, note: "common 3-letter j word" },
  { word: "jow", expected: true, note: "common 3-letter j word" },
  { word: "jug", expected: true, note: "common 3-letter j word" },
  { word: "qat", expected: true, note: "common 3-letter q word" },
  { word: "qis", expected: true, note: "common 3-letter q word" },
  { word: "qua", expected: true, note: "common 3-letter q word" },
  { word: "xis", expected: true, note: "common 3-letter x word" },
  { word: "oxo", expected: true, note: "common 3-letter x word" },
  { word: "box", expected: true, note: "common 3-letter x word" },
  { word: "fax", expected: true, note: "common 3-letter x word" },
  { word: "zax", expected: true, note: "common 3-letter z word" },
  { word: "zek", expected: true, note: "common 3-letter z word" },
  { word: "zig", expected: true, note: "common 3-letter z word" },
  { word: "zit", expected: true, note: "common 3-letter z word" },
  { word: "wings", expected: true, note: "plural -s" },
  { word: "wishes", expected: true, note: "plural -es" },
  { word: "stories", expected: true, note: "plural -ies" },
  { word: "running", expected: true, note: "double consonant + -ing" },
  { word: "making", expected: true, note: "silent-e drop + -ing" },
  { word: "carried", expected: true, note: "y -> ied" },
  { word: "baked", expected: true, note: "silent-e drop + -ed" },
  { word: "broken", expected: true, note: "verb + -en" },
  { word: "runner", expected: true, note: "agent noun + doubled consonant" },
  { word: "carrier", expected: true, note: "y -> ier" },
  { word: "outeating", expected: true, note: "compound verb + -ing" },
  { word: "outeaten", expected: true, note: "compound verb + -en" },
  { word: "outeater", expected: true, note: "compound verb + -er" },
  { word: "written", expected: true, note: "direct dictionary entry" },
  { word: "eaten", expected: true, note: "direct dictionary entry" },
  {
    word: "slided",
    expected: false,
    note: "irregular past tense should be slid",
  },
  {
    word: "rided",
    expected: false,
    note: "irregular past tense should be rode",
  },
  {
    word: "writed",
    expected: false,
    note: "irregular past tense should be wrote",
  },
  {
    word: "boxes",
    expected: true,
    note: "plural now covered via curated base word",
  },
];

let mismatchCount = 0;

console.log("Dictionary inflection check");
console.log("==========================");

examples.forEach(({ word, expected, note }) => {
  const actual = isValid(word);
  const matches = actual === expected;
  if (!matches) {
    mismatchCount += 1;
  }

  const status = matches ? "PASS" : "FAIL";
  console.log(
    `${status}  ${word.padEnd(10)} expected=${String(expected).padEnd(
      5
    )} actual=${String(actual).padEnd(5)} ${note}`
  );
});

if (mismatchCount > 0) {
  console.error(`\n${mismatchCount} validation expectation(s) failed.`);
  process.exit(1);
}

console.log("\nAll inflection expectations matched.");
