/**
 * Pod utility functions
 */

/**
 * Convert a pod name to a pod code
 * Takes the first letter of the first word and the entire second word (if present)
 * 
 * Examples:
 *   "Aspirant II" -> "A II"
 *   "Exemplar" -> "E"
 *   "Novice I" -> "N I"
 * 
 * @param {string} podName - The full pod name (e.g., "Aspirant II")
 * @returns {string} The pod code (e.g., "A II")
 * @throws {Error} If the pod name has more than two words
 */
export function podNameToCode(podName) {
    if (!podName || typeof podName !== 'string') {
        throw new Error('Pod name must be a non-empty string');
    }

    const trimmed = podName.trim();
    if (trimmed === '') {
        throw new Error('Pod name cannot be empty');
    }

    const words = trimmed.split(/\s+/);
    
    if (words.length > 2) {
        throw new Error(`Pod name has too many words (${words.length}). Expected 1 or 2 words.`);
    }

    // First letter of first word
    const firstLetter = words[0].charAt(0).toUpperCase();
    
    // If there's a second word, add it with a space
    if (words.length === 2) {
        return `${firstLetter} ${words[1]}`;
    }
    
    // Just one word - return first letter
    return firstLetter;
}
