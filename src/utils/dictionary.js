// Dictionary loader and validator
const VALID_TWO_LETTER_WORDS = new Set([
    'aa', 'ab', 'ad', 'ae', 'ag', 'ah', 'ai', 'al', 'am', 'an', 'ar', 'as', 'at', 'aw', 'ax', 'ay',
    'ba', 'be', 'bi', 'bo', 'by',
    'da', 'de', 'di', 'do',
    'ed', 'ef', 'eh', 'el', 'em', 'en', 'er', 'es', 'et', 'ew', 'ex',
    'fa', 'fe',
    'go',
    'ha', 'he', 'hi', 'hm', 'ho',
    'id', 'if', 'in', 'is', 'it',
    'jo',
    'ka', 'ki',
    'la', 'li', 'lo',
    'ma', 'me', 'mi', 'mm', 'mo', 'mu', 'my',
    'na', 'ne', 'no', 'nu',
    'ob', 'od', 'oe', 'of', 'oh', 'oi', 'om', 'on', 'oo', 'op', 'or', 'os', 'ow', 'ox', 'oy',
    'pa', 'pe', 'pi', 'po',
    'qi',
    're',
    'sh', 'si', 'so',
    'ta', 'te', 'ti', 'to',
    'uh', 'um', 'un', 'up', 'ur', 'us', 'ut',
    'we', 'wo',
    'xi', 'xu',
    'ya', 'ye', 'yo',
    'za',
]);

const INVALID_SHORT_WORDS = new Set([
    'dbe',
]);

class Dictionary {
    constructor() {
        this.words = new Set();
        this.loaded = false;
    }

    async load() {
        if (this.loaded) return;
        
        try {
            // Wordnik's list is a tighter open word-game dictionary than a generic english corpus.
            const response = await fetch('https://raw.githubusercontent.com/wordnik/wordlist/main/wordlist-20210729.txt');
            const text = await response.text();
            const wordList = text.split('\n').map(word => word.trim().toLowerCase()).filter(word => word.length > 0);
            
            // Filter to reasonable word lengths (2-15 letters for Words with Friends)
            wordList.forEach(word => {
                if (word.length === 2 && VALID_TWO_LETTER_WORDS.has(word)) {
                    this.words.add(word);
                } else if (word.length >= 3 && word.length <= 15) {
                    this.words.add(word);
                }
            });
            
            this.loaded = true;
            console.log(`Dictionary loaded: ${this.words.size} words`);
        } catch (error) {
            console.error('Error loading dictionary:', error);
            // Fallback to a basic word set if file fails to load
            this.loadFallback();
        }
    }

    loadFallback() {
        // Basic fallback word list if dictionary file fails to load
        const fallbackWords = Array.from(VALID_TWO_LETTER_WORDS);
        fallbackWords.forEach(word => this.words.add(word));
        this.loaded = true;
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
