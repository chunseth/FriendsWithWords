import dictionaryWords from "../../data/dictionaryWords.json";

const TWO_LETTER_WORDS = new Set([
  "aa", "ab", "ad", "ae", "ag", "ah", "ai", "al", "am", "an", "ar", "as", "at", "aw", "ax", "ay",
  "ba", "be", "bi", "bo", "by", "ch", "da", "de", "di", "do", "ea", "ed", "ee", "ef", "eh", "el",
  "em", "en", "er", "es", "et", "ew", "ex", "fa", "fe", "fy", "gi", "go", "gu", "ha", "he", "hi",
  "hm", "ho", "id", "if", "in", "io", "is", "it", "ja", "jo", "ka", "ki", "ko", "ky", "la", "li",
  "lo", "ma", "me", "mi", "mm", "mo", "mu", "my", "na", "ne", "no", "nu", "ob", "od", "oe", "of",
  "oh", "oi", "ok", "om", "on", "oo", "op", "or", "os", "ow", "ox", "oy", "pa", "pe", "pi", "po",
  "qi", "re", "sh", "si", "so", "st", "ta", "te", "ti", "to", "ug", "uh", "um", "un", "up", "ur",
  "us", "ut", "we", "wo", "xi", "xu", "ya", "ye", "yu", "yo", "za", "ze", "zo",
]);

const INVALID_SHORT_WORDS = new Set(["dbe"]);

const createTrieNode = () => ({ children: new Map(), isWord: false });

const addToTrie = (root, word) => {
  let node = root;
  for (let index = 0; index < word.length; index += 1) {
    const letter = word[index];
    if (!node.children.has(letter)) {
      node.children.set(letter, createTrieNode());
    }
    node = node.children.get(letter);
  }
  node.isWord = true;
};

const normalizeWord = (word) => String(word || "").trim().toLowerCase();

export const buildLexicon = (rawWords = []) => {
  const words = new Set();

  rawWords.forEach((entry) => {
    const word = normalizeWord(entry);
    if (!word || word.length < 2) return;
    if (!/^[a-z]+$/.test(word)) return;
    if (word.length === 2 && !TWO_LETTER_WORDS.has(word)) return;
    if (word.length <= 3 && INVALID_SHORT_WORDS.has(word)) return;
    words.add(word);
  });

  TWO_LETTER_WORDS.forEach((word) => words.add(word));

  const trie = createTrieNode();
  const wordsByLength = new Map();
  words.forEach((word) => {
    addToTrie(trie, word);
    const len = word.length;
    if (!wordsByLength.has(len)) {
      wordsByLength.set(len, []);
    }
    wordsByLength.get(len).push(word);
  });

  return {
    words,
    trie,
    wordsByLength,
    isValid: (word) => words.has(normalizeWord(word)),
  };
};

let defaultLexicon = null;

export const getDefaultLexicon = () => {
  if (!defaultLexicon) {
    defaultLexicon = buildLexicon(dictionaryWords);
  }
  return defaultLexicon;
};
