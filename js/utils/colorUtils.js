/**
 * Color utility functions
 */

import { COLORS } from './constants.js';

/**
 * Get color value by name (case-insensitive, matches start of string)
 * @param {string} colorName - The name of the color or string starting with color name
 * @returns {string|null} The hex color value or null if not found
 */
export function getColorByName(colorName) {
    if (!colorName || typeof colorName !== 'string') {
        return null;
    }
    
    const upperName = colorName.toUpperCase().trim();
    
    // Check for exact match first
    if (COLORS[upperName]) {
        return COLORS[upperName];
    }
    
    // Check if any color name is the start of the input string
    for (const [colorKey, colorValue] of Object.entries(COLORS)) {
        if (upperName.startsWith(colorKey)) {
            return colorValue;
        }
    }
    
    return null;
}
