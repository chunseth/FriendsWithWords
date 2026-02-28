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

    this.loaded = true;
    console.log(`Dictionary loaded: ${this.words.size} words`);
  }

  isValid(word) {
    if (!this.loaded) return false;
    const normalizedWord = word.toLowerCase();
    if (normalizedWord.length <= 3 && INVALID_SHORT_WORDS.has(normalizedWord)) {
      return false;
    }
    return this.words.has(normalizedWord);
  }

  getWordCount() {
    return this.words.size;
  }
}

// Export singleton instance
export const dictionary = new Dictionary();
