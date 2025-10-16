import { extractSheetId, isValidGoogleSheetsUrl } from '../utils/urlUtils.js';
import { podNameToCode } from '../utils/podUtils.js';

/**
 * Manages interaction with Guru Hub spreadsheets.
 * Loads and caches thread information from the "All Threads" sheet.
 */
export class HubManager {
    /**
     * @param {string} hubLink - The Google Sheets URL or ID of the Guru Hub spreadsheet
     * @param {string} podName - The full pod name (e.g., "Novice I")
     */
    constructor(hubLink, podName) {
        this.hubLink = hubLink;
        this.podCode = podNameToCode(podName);
        
        // Extract sheet ID from URL if a full URL was provided
        if (isValidGoogleSheetsUrl(hubLink)) {
            const sheetId = extractSheetId(hubLink);
            if (!sheetId) {
                throw new Error('Invalid hub link or sheet ID');
            }
            this.hubSheetId = sheetId;
        } else {
            this.hubSheetId = hubLink;
        }
        
        // Cache for the ID# -> Thread mapping
        this.threadsCache = null;
    }

    /**
     * Loads the "All Threads" sheet and filters by pod code.
     * Creates a mapping of ID# (integer) to Thread URL (string).
     * @returns {Promise<Map<number, string>>} Map of ID numbers to Discord thread URLs
     */
    async loadThreads() {
        try {
            console.log(`📥 Loading threads from hub for pod: ${this.podCode}`);

            // Get the spreadsheet data with hyperlinks
            // We need to use spreadsheets.get to access hyperlink formulas
            const response = await gapi.client.sheets.spreadsheets.get({
                spreadsheetId: this.hubSheetId,
                ranges: ["'All Threads'!A:C"],
                fields: 'sheets.data.rowData.values(formattedValue,hyperlink)'
            });

            const sheets = response.result.sheets || [];
            if (sheets.length === 0 || !sheets[0].data || !sheets[0].data[0].rowData) {
                console.warn('⚠️ All Threads sheet is empty');
                this.threadsCache = new Map();
                return this.threadsCache;
            }

            const rowData = sheets[0].data[0].rowData || [];
            
            if (rowData.length === 0) {
                console.warn('⚠️ All Threads sheet is empty');
                this.threadsCache = new Map();
                return this.threadsCache;
            }

            // First row should be headers: Pod, Thread, ID#
            // Find column indices from header row
            const headerRow = rowData[0].values || [];
            const podIndex = headerRow.findIndex(cell => 
                cell?.formattedValue?.toLowerCase().includes('pod')
            );
            const threadIndex = headerRow.findIndex(cell => 
                cell?.formattedValue?.toLowerCase().includes('thread')
            );
            const idIndex = headerRow.findIndex(cell => 
                cell?.formattedValue?.toLowerCase().includes('id')
            );

            if (podIndex === -1 || threadIndex === -1 || idIndex === -1) {
                throw new Error('Required columns not found in All Threads sheet. Expected: Pod, Thread, ID#');
            }

            // Build the mapping from ID# to Thread URL for rows matching our pod code
            const threadsMap = new Map();
            
            for (let i = 1; i < rowData.length; i++) {
                const row = rowData[i];
                if (!row || !row.values || row.values.length === 0) continue;

                const cells = row.values;
                const pod = cells[podIndex]?.formattedValue?.toString().trim();
                const threadUrl = cells[threadIndex]?.hyperlink; // Extract the hyperlink URL
                const idStr = cells[idIndex]?.formattedValue?.toString().trim();

                // Filter by pod code and ensure we have valid data
                if (pod === this.podCode && threadUrl && idStr) {
                    const idNum = parseInt(idStr, 10);
                    if (!isNaN(idNum)) {
                        threadsMap.set(idNum, threadUrl);
                    }
                }
            }

            console.log(`✅ Loaded ${threadsMap.size} threads for pod ${this.podCode}`);

            // Cache the result
            this.threadsCache = threadsMap;
            return threadsMap;

        } catch (error) {
            console.error('❌ Error loading threads from hub:', error);
            throw new Error(`Failed to load threads: ${error.message}`);
        }
    }

    /**
     * Gets the threads mapping, using cache if available or loading if not.
     * @returns {Promise<Map<number, string>>} Map of ID numbers to thread names
     */
    async getThreads() {
        if (this.threadsCache !== null) {
            console.log('📋 Returning cached threads');
            return this.threadsCache;
        }

        return await this.loadThreads();
    }

    /**
     * Clears the cached threads, forcing a reload on next getThreads() call
     */
    clearCache() {
        this.threadsCache = null;
        console.log('🗑️ Threads cache cleared');
    }

    /**
     * Gets a specific Discord thread URL by ID#
     * @param {number} id - The ID number to lookup
     * @returns {Promise<string|null>} The Discord thread URL, or null if not found
     */
    async getThreadById(id) {
        const threads = await this.getThreads();
        return threads.get(id) || null;
    }

    /**
     * Checks if a thread ID exists in the cache
     * @param {number} id - The ID number to check
     * @returns {Promise<boolean>} True if the ID exists
     */
    async hasThread(id) {
        const threads = await this.getThreads();
        return threads.has(id);
    }
}
