import dictionaryWords from "../data/dictionaryWords.json";

// Dictionary loader and validator
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
  "ch",
  "da",
  "de",
  "di",
  "do",
  "ea",
  "ed",
  "ee",
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
  "fy",
  "gi",
  "go",
  "gu",
  "ha",
  "he",
  "hi",
  "hm",
  "ho",
  "id",
  "if",
  "in",
  "io",
  "is",
  "it",
  "ja",
  "jo",
  "ka",
  "ki",
  "ko",
  "ky",
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
  "ok",
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
  "st",
  "ta",
  "te",
  "ti",
  "to",
  "ug",
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
  "yu",
  "yo",
  "za",
  "ze",
  "zo"
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
  "zap"
]);

const VALID_CUSTOM_WORDS = new Set(["fave", "vape", "vibe"]);

// Heuristic suffix handling is useful for missing inflected forms, but some
// common irregular verbs should not accept regularized spellings.
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

class Dictionary {
  constructor() {
    this.words = new Set();
    this.loaded = false;
  }

  async load() {
    if (this.loaded) return;

    dictionaryWords.forEach((word) => {
      if (word.length === 2 && !VALID_TWO_LETTER_WORDS.has(word)) {
        return;
      }

      if (word.length <= 3 && INVALID_SHORT_WORDS.has(word)) {
        return;
      }

      this.words.add(word);
    });

    VALID_TWO_LETTER_WORDS.forEach((word) => {
      this.words.add(word);
    });

    VALID_THREE_LETTER_WORDS.forEach((word) => {
      this.words.add(word);
    });

    VALID_CUSTOM_WORDS.forEach((word) => {
      this.words.add(word);
    });

    this.loaded = true;
    console.log(`Dictionary loaded: ${this.words.size} words`);
  }

  isValid(word) {
    if (!this.loaded) return false;
    const normalizedWord = word.toLowerCase();
    if (
      (normalizedWord.length <= 3 && INVALID_SHORT_WORDS.has(normalizedWord)) ||
      INVALID_IRREGULAR_INFLECTIONS.has(normalizedWord)
    ) {
      return false;
    }
    if (this.words.has(normalizedWord)) {
      return true;
    }

    return this.isLikelyInflectedForm(normalizedWord);
  }

  getWordCount() {
    return this.words.size;
  }

  hasKnownBaseForm(candidates) {
    return candidates.some((candidate) => this.words.has(candidate));
  }

  isLikelyInflectedForm(word) {
    if (word.length < 4) {
      return false;
    }

    if (word.endsWith("ies") && word.length > 4) {
      return this.hasKnownBaseForm([`${word.slice(0, -3)}y`]);
    }

    if (
      word.endsWith("es") &&
      /(s|x|z|ch|sh|o)es$/.test(word) &&
      word.length > 4
    ) {
      return this.hasKnownBaseForm([word.slice(0, -2)]);
    }

    if (word.endsWith("s") && !word.endsWith("ss")) {
      return this.hasKnownBaseForm([word.slice(0, -1)]);
    }

    if (word.endsWith("ing") && word.length > 5) {
      const base = word.slice(0, -3);
      return this.hasKnownBaseForm([
        base,
        `${base}e`,
        base.endsWith("y") ? `${base.slice(0, -1)}ie` : "",
        this.removeDoubledTrailingConsonant(base),
      ]);
    }

    if (word.endsWith("ied") && word.length > 4) {
      return this.hasKnownBaseForm([`${word.slice(0, -3)}y`]);
    }

    if (word.endsWith("ed") && word.length > 4) {
      const base = word.slice(0, -2);
      return this.hasKnownBaseForm([
        base,
        `${base}e`,
        this.removeDoubledTrailingConsonant(base),
      ]);
    }

    if (word.endsWith("en") && word.length > 4) {
      const base = word.slice(0, -2);
      return this.hasKnownBaseForm([
        base,
        `${base}e`,
        this.removeDoubledTrailingConsonant(base),
      ]);
    }

    if (word.endsWith("ier") && word.length > 4) {
      return this.hasKnownBaseForm([`${word.slice(0, -3)}y`]);
    }

    if (word.endsWith("er") && word.length > 4) {
      const base = word.slice(0, -2);
      return this.hasKnownBaseForm([
        base,
        `${base}e`,
        this.removeDoubledTrailingConsonant(base),
      ]);
    }

    return false;
  }

  removeDoubledTrailingConsonant(base) {
    if (base.length < 3) {
      return "";
    }

    const lastChar = base[base.length - 1];
    const secondLastChar = base[base.length - 2];
    if (lastChar === secondLastChar && !/[aeiou]/.test(lastChar)) {
      return base.slice(0, -1);
    }

    return "";
  }
}

// Export singleton instance
export const dictionary = new Dictionary();
