// Dictionary loader and validator
class Dictionary {
    constructor() {
        this.words = new Set();
        this.loaded = false;
    }

    async load() {
        if (this.loaded) return;
        
        try {
            // In React Native, load dictionary from a remote source or bundle it
            // For production, you may want to bundle the dictionary as a JS module
            const response = await fetch('https://raw.githubusercontent.com/dwyl/english-words/master/words.txt');
            const text = await response.text();
            const wordList = text.split('\n').map(word => word.trim().toLowerCase()).filter(word => word.length > 0);
            
            // Filter to reasonable word lengths (2-15 letters for Words with Friends)
            wordList.forEach(word => {
                if (word.length >= 2 && word.length <= 15) {
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
        const fallbackWords = [
            'aa', 'ab', 'ad', 'ae', 'ag', 'ah', 'ai', 'al', 'am', 'an', 'ar', 'as', 'at', 'aw', 'ax', 'ay',
            'ba', 'be', 'bi', 'bo', 'by',
            'de', 'do',
            'ed', 'ef', 'eh', 'el', 'em', 'en', 'er', 'es', 'et', 'ex',
            'fa', 'fe', 'fi', 'go',
            'ha', 'he', 'hi', 'hm', 'ho',
            'id', 'if', 'in', 'is', 'it',
            'jo',
            'ka', 'ki',
            'la', 'li', 'lo',
            'ma', 'me', 'mi', 'mm', 'mo', 'mu', 'my',
            'na', 'ne', 'no', 'nu',
            'od', 'oe', 'of', 'oh', 'oi', 'om', 'on', 'op', 'or', 'os', 'ow', 'ox', 'oy',
            'pa', 'pe', 'pi', 'po',
            'qi',
            're',
            'sh', 'si', 'so',
            'ta', 'ti', 'to',
            'uh', 'um', 'un', 'up', 'us', 'ut',
            'we', 'wo',
            'xi', 'xu',
            'ya', 'ye', 'yo',
            'za', 'ze', 'zo'
        ];
        fallbackWords.forEach(word => this.words.add(word));
        this.loaded = true;
    }

    isValid(word) {
        if (!this.loaded) return false;
        return this.words.has(word.toLowerCase());
    }

    getWordCount() {
        return this.words.size;
    }
}

// Export singleton instance
export const dictionary = new Dictionary();
