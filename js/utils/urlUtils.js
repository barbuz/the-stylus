/**
 * URL utility functions for Google Sheets
 */

/**
 * Validate if a URL is a valid Google Sheets URL
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid Google Sheets URL
 */
export function isValidGoogleSheetsUrl(url) {
    const pattern = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9-_]+/;
    return pattern.test(url);
}

/**
 * Extract spreadsheet ID from a Google Sheets URL or return as-is if already an ID
 * @param {string} urlOrId - Google Sheets URL or spreadsheet ID
 * @returns {string|null} Extracted sheet ID or null if invalid
 */
export function extractSheetId(urlOrId) {
    if (!urlOrId) {
        return null;
    }

    // If it's already just an ID (no slashes), return it
    if (!urlOrId.includes('/')) {
        return urlOrId;
    }

    // Extract from URL patterns:
    // https://docs.google.com/spreadsheets/d/SHEET_ID/edit...
    const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
}
