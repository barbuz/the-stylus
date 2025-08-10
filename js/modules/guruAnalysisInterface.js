/**
 * Guru Analysis Interface
 * Handles the single-row analysis interface for guru decisions
 */
import { ScryfallAPI } from './scryfallAPI.js';
import { CONFIG } from '../config.js';

export class GuruAnalysisInterface {
    constructor(sheetsAPI, uiController, authManager = null) {
        this.sheetsAPI = sheetsAPI;
        this.uiController = uiController;
        this.authManager = authManager;
        this.scryfallAPI = new ScryfallAPI();
        this.currentData = null;
        this.allRows = [];
        this.currentRowIndex = 0;
        this.currentSheetIndex = 0;
        this.bindEvents();
        
        // Handle window resize for mobile/desktop layout changes
        this.handleResize = this.handleResize.bind(this);
        window.addEventListener('resize', this.handleResize);
    }

    bindEvents() {
        // Analysis buttons
        document.getElementById('win-btn').addEventListener('click', () => this.setAnalysis(1.0));
        document.getElementById('tie-btn').addEventListener('click', () => this.setAnalysis(0.5));
        document.getElementById('loss-btn').addEventListener('click', () => this.setAnalysis(0.0));

        // Navigation buttons
        document.getElementById('prev-btn').addEventListener('click', () => this.previousRow());
        document.getElementById('next-btn').addEventListener('click', () => this.nextRow());
        document.getElementById('skip-btn').addEventListener('click', () => this.skipToNextIncomplete());
        document.getElementById('restart-analysis-btn').addEventListener('click', () => this.restartAnalysis());
    }

    handleResize() {
        // Re-position deck info when window is resized (e.g., device rotation)
        if (this.allRows.length > 0 && this.currentRowIndex < this.allRows.length) {
            const currentRow = this.allRows[this.currentRowIndex];
            // Re-display deck info for both players to update positioning
            this.displayDeckInfo('player1', currentRow.player1);
            this.displayDeckInfo('player2', currentRow.player2);
        }
    }

    async loadData(sheetData) {
        this.currentData = sheetData;
        
        this.allRows = [];
        this.currentRowIndex = 0;
        this.currentSheetIndex = 0;

        // Process deck notes for reference
        this.deckNotesMap = this.processDeckNotes(sheetData);
        console.log('Loaded deck notes:', this.deckNotesMap.size, 'entries');

        // Process all sheets and collect rows that need analysis
        if (sheetData.sheets && Array.isArray(sheetData.sheets)) {
            sheetData.sheets.forEach((sheet, sheetIndex) => {
                if (sheet.values && sheet.values.length > 1) {
                    this.processSheet(sheet, sheetIndex);
                }
            });
        }

        if (this.allRows.length === 0) {
            this.showNoDataMessage();
        } else {
            // Check if all analysis is already complete
            if (this.isAnalysisComplete()) {
                // Even if complete, show the first row so user can see the data
                this.currentRowIndex = 0;
                await this.showCurrentRow();
                this.showCompletionMessage();
            } else {
                // Find the first row with empty Guru Analysis or discrepancy
                this.currentRowIndex = this.findFirstEmptyAnalysis();
                await this.showCurrentRow();
            }
        }
    }

    processDeckNotes(sheetData) {
        const deckNotesMap = new Map();
        
        if (!sheetData.sheets) {
            console.log('No sheets found in sheetData');
            return deckNotesMap;
        }
        
        // Find the "Deck Notes" sheet
        const deckNotesSheet = sheetData.sheets.find(sheet => 
            sheet.sheetTitle && sheet.sheetTitle.toLowerCase().includes('deck notes')
        );
        
        if (!deckNotesSheet) {
            console.log('No "Deck Notes" sheet found. Available sheets:', 
                sheetData.sheets.map(s => s.sheetTitle));
            return deckNotesMap;
        }
        
        console.log('Found Deck Notes sheet:', deckNotesSheet.sheetTitle);
        
        if (!deckNotesSheet.values || deckNotesSheet.values.length < 2) {
            console.log('Deck Notes sheet has no data or insufficient rows');
            return deckNotesMap;
        }
        
        const headerRow = deckNotesSheet.values[0];
        console.log('Deck Notes headers:', headerRow);
        
        const decklistsColIndex = this.findColumnIndex(headerRow, ['Decklists', 'Decklist']);
        const goldfishClockColIndex = this.findColumnIndex(headerRow, ['Goldfish Clock', 'Clock']);
        const notesColIndex = this.findColumnIndex(headerRow, ['Notes']);
        const additionalNotesColIndex = this.findColumnIndex(headerRow, ['Additional Notes', 'Add Notes']);
        
        console.log('Column indices:', {
            decklists: decklistsColIndex,
            goldfishClock: goldfishClockColIndex,
            notes: notesColIndex,
            additionalNotes: additionalNotesColIndex
        });
        
        if (decklistsColIndex === -1) {
            console.log('Decklists column not found');
            return deckNotesMap;
        }
        
        // Process each row
        for (let i = 1; i < deckNotesSheet.values.length; i++) {
            const row = deckNotesSheet.values[i];
            const decklist = row[decklistsColIndex];
            
            if (decklist && decklist.trim()) {
                const deckInfo = {};
                
                if (goldfishClockColIndex !== -1 && row[goldfishClockColIndex]) {
                    deckInfo.goldfishClock = row[goldfishClockColIndex].toString().trim();
                }
                
                if (notesColIndex !== -1 && row[notesColIndex]) {
                    const notes = row[notesColIndex].toString().trim();
                    if (notes) deckInfo.notes = notes;
                }
                
                if (additionalNotesColIndex !== -1 && row[additionalNotesColIndex]) {
                    const additionalNotes = row[additionalNotesColIndex].toString().trim();
                    if (additionalNotes) deckInfo.additionalNotes = additionalNotes;
                }
                
                if (Object.keys(deckInfo).length > 0) {
                    console.log('Adding deck info:', decklist.trim(), deckInfo);
                    deckNotesMap.set(decklist.trim(), deckInfo);
                }
            }
        }
        
        console.log('Total deck notes processed:', deckNotesMap.size);
        return deckNotesMap;
    }

    processSheet(sheet, sheetIndex) {
        const headerRow = sheet.values[0];
        
        // Find required columns
        const player1ColIndex = this.findColumnIndex(headerRow, ['Player 1 (On the Play)', 'Player 1', 'Player1']);
        const player2ColIndex = this.findColumnIndex(headerRow, ['Player 2 (On the Draw)', 'Player 2', 'Player2']);
        const guruAnalysisColIndex = this.findColumnIndex(headerRow, ['Guru Analysis', 'Analysis', 'Guru']);
        const outcomeColIndex = this.findColumnIndex(headerRow, ['Outcome']);
        const guruSignatureColIndex = this.findColumnIndex(headerRow, ['Guru Signature', 'Signature', 'Guru']);
        
        // Find other guru analysis columns (Red, Blue, Green Analysis)
        const redAnalysisColIndex = this.findColumnIndex(headerRow, ['Red Analysis']);
        const blueAnalysisColIndex = this.findColumnIndex(headerRow, ['Blue Analysis']);
        const greenAnalysisColIndex = this.findColumnIndex(headerRow, ['Green Analysis']);

        if (player1ColIndex === -1 || player2ColIndex === -1 || guruAnalysisColIndex === -1) {
            console.log(`Skipping sheet "${sheet.sheetTitle}" - not a guru analysis sheet (missing required columns)`);
            return;
        }

        // Process data rows (skip header)
        for (let rowIndex = 1; rowIndex < sheet.values.length; rowIndex++) {
            const row = sheet.values[rowIndex];
            
            // Get the original row index from the backend filtering
            const originalRowIndex = sheet.originalRowIndices ? sheet.originalRowIndices[rowIndex] : rowIndex;

            const player1 = row[player1ColIndex] || '';
            const player2 = row[player2ColIndex] || '';
            const currentAnalysis = row[guruAnalysisColIndex] || '';
            const outcomeValue = outcomeColIndex !== -1 ? row[outcomeColIndex] || '' : '';
            const redAnalysis = redAnalysisColIndex !== -1 ? row[redAnalysisColIndex] || '' : '';
            const blueAnalysis = blueAnalysisColIndex !== -1 ? row[blueAnalysisColIndex] || '' : '';
            const greenAnalysis = greenAnalysisColIndex !== -1 ? row[greenAnalysisColIndex] || '' : '';

            // Only include rows that have player data
            if (player1.trim() || player2.trim()) {
                this.allRows.push({
                    sheetIndex,
                    sheetTitle: sheet.sheetTitle,
                    sheetId: sheet.sheetId,
                    rowIndex,
                    player1: player1.trim(),
                    player2: player2.trim(),
                    currentAnalysis: currentAnalysis.toString().trim(),
                    outcomeValue: outcomeValue.toString().trim(),
                    redAnalysis: redAnalysis.toString().trim(),
                    blueAnalysis: blueAnalysis.toString().trim(),
                    greenAnalysis: greenAnalysis.toString().trim(),
                    guruAnalysisColIndex,
                    outcomeColIndex,
                    originalRowIndex: originalRowIndex // Use the original row index from unfiltered data
                });
            }
        }
    }

    findColumnIndex(headerRow, possibleNames) {
        for (const name of possibleNames) {
            const index = headerRow.findIndex(header => 
                header && header.toLowerCase().includes(name.toLowerCase())
            );
            if (index !== -1) return index;
        }
        return -1;
    }

    isAnalysisComplete() {
        // Check if all rows have analysis and no discrepancies
        for (let i = 0; i < this.allRows.length; i++) {
            const row = this.allRows[i];
            
            // Check for empty analysis
            if (!row.currentAnalysis || row.currentAnalysis.trim() === '') {
                return false;
            }
            
            // Check for discrepancies
            if (row.outcomeValue && row.outcomeValue.toLowerCase().trim() === 'discrepancy') {
                return false;
            }
        }
        
        return this.allRows.length > 0; // Only complete if we have rows to analyze
    }

    findFirstEmptyAnalysis(startFromIndex = 0) {
        // First, find the first row where currentAnalysis is empty or whitespace, starting from the given index
        for (let i = startFromIndex; i < this.allRows.length; i++) {
            const row = this.allRows[i];
            if (!row.currentAnalysis || row.currentAnalysis.trim() === '') {
                return i;
            }
        }
        
        // If no empty analysis found from startFromIndex to end, loop back and search from beginning to startFromIndex
        if (startFromIndex > 0) {
            for (let i = 0; i < startFromIndex; i++) {
                const row = this.allRows[i];
                if (!row.currentAnalysis || row.currentAnalysis.trim() === '') {
                    return i;
                }
            }
        }
        
        // If no empty analysis found, look for the first discrepancy starting from the given index
        for (let i = startFromIndex; i < this.allRows.length; i++) {
            const row = this.allRows[i];
            if (row.outcomeValue && row.outcomeValue.toLowerCase().trim() === 'discrepancy') {
                return i;
            }
        }
        
        // If no discrepancy found from startFromIndex to end, loop back and search from beginning to startFromIndex
        if (startFromIndex > 0) {
            for (let i = 0; i < startFromIndex; i++) {
                const row = this.allRows[i];
                if (row.outcomeValue && row.outcomeValue.toLowerCase().trim() === 'discrepancy') {
                    return i;
                }
            }
        }
        
        // If no empty analysis or discrepancies found, return the start index or 0
        return startFromIndex === 0 ? 0 : startFromIndex;
    }

    async showCurrentRow() {
        if (this.currentRowIndex >= this.allRows.length) {
            this.showCompletionMessage();
            return;
        }

        const currentRow = this.allRows[this.currentRowIndex];
        
        // Update progress info
        document.getElementById('current-row-info').textContent = 
            `Row ${this.currentRowIndex + 1} of ${this.allRows.length}`;
        document.getElementById('sheet-name-info').textContent = 
            `Sheet: ${currentRow.sheetTitle}`;

        // Load card images for both players
        await this.loadPlayerCards('player1', currentRow.player1);
        await this.loadPlayerCards('player2', currentRow.player2);

        // Update current outcome display
        const analysisElement = document.getElementById('current-analysis-value');
        let analysisValue = null;
        
        if (currentRow.outcomeValue) {
            const outcomeValue = currentRow.outcomeValue.toLowerCase().trim();
            
            // Handle discrepancy values specially
            if (outcomeValue === 'discrepancy') {
                analysisElement.innerHTML = this.buildDiscrepancyDisplay(currentRow);
                analysisElement.className = 'scoring-value discrepancy';
                // Don't highlight any button for discrepancy
            } else if (outcomeValue === 'incomplete') {
                analysisElement.textContent = 'Incomplete';
                analysisElement.className = 'scoring-value';
                // Don't highlight any button for incomplete
            } else {
                // Try to parse as numeric value
                const numValue = parseFloat(currentRow.outcomeValue);
                if (!isNaN(numValue)) {
                    analysisValue = numValue;
                    analysisElement.className = 'scoring-value';
                    if (numValue === 1.0) {
                        analysisElement.textContent = 'Win (1.0)';
                    } else if (numValue === 0.5) {
                        analysisElement.textContent = 'Tie (0.5)';
                    } else if (numValue === 0.0) {
                        analysisElement.textContent = 'Loss (0.0)';
                    } else {
                        analysisElement.textContent = `Custom (${numValue})`;
                    }
                } else {
                    // Show raw outcome value for any other text
                    analysisElement.textContent = currentRow.outcomeValue;
                    analysisElement.className = 'scoring-value';
                }
            }
        } else {
            analysisElement.textContent = 'Not set';
            analysisElement.className = 'scoring-value';
        }

        // Highlight the appropriate button based on current guru analysis value
        const currentAnalysisValue = currentRow.currentAnalysis ? parseFloat(currentRow.currentAnalysis) : null;
        this.highlightCurrentAnalysisButton(currentAnalysisValue);

        // Update navigation buttons
        document.getElementById('prev-btn').disabled = this.currentRowIndex === 0;
        document.getElementById('next-btn').disabled = this.currentRowIndex >= this.allRows.length - 1;
        
        // Update skip button - disable if there are no more incomplete rows after current
        const nextIncompleteIndex = this.findFirstEmptyAnalysis(this.currentRowIndex + 1);
        const hasMoreIncomplete = nextIncompleteIndex !== this.currentRowIndex && nextIncompleteIndex < this.allRows.length;
        document.getElementById('skip-btn').disabled = !hasMoreIncomplete;

        // Hide completion message
        document.getElementById('completion-message').style.display = 'none';

        // Preload next match's card images in the background
        this.preloadNextMatchCards();
    }

    /**
     * Preload card images for the next match that will be evaluated
     * This improves user experience by having images ready when user navigates
     */
    preloadNextMatchCards() {
        // Find the next row that actually needs analysis (empty analysis or discrepancy)
        // starting from after the current row
        let nextRowIndex = this.findFirstEmptyAnalysis(this.currentRowIndex + 1);
        
        // If findFirstEmptyAnalysis returned the same or earlier index, it means we've wrapped around
        // or there are no more rows to analyze, so don't preload
        if (nextRowIndex <= this.currentRowIndex || nextRowIndex >= this.allRows.length) {
            console.log('🎯 No next match to preload (analysis complete or wrapped around)');
            return;
        }
        
        const nextRow = this.allRows[nextRowIndex];
        
        // Combine both players' deck strings for preloading
        const decksToPreload = [];
        
        if (nextRow.player1 && nextRow.player1.trim()) {
            decksToPreload.push(nextRow.player1.trim());
        }
        
        if (nextRow.player2 && nextRow.player2.trim()) {
            decksToPreload.push(nextRow.player2.trim());
        }
        
        if (decksToPreload.length > 0) {
            // Start preloading in the background with slower pace to not interfere
            this.scryfallAPI.preloadCards(decksToPreload, {
                delay: 300,  // Slower preloading to be less aggressive
                silent: false // Don't spam console logs
            });
            
            console.log(`🔄 Started preloading cards for next evaluation target (row ${nextRowIndex + 1}): ${nextRow.player1} vs ${nextRow.player2}`);
        }
    }

    async loadPlayerCards(playerId, deckString) {
        const cardsContainer = document.getElementById(`${playerId}-cards`);
        const cardSlots = cardsContainer.querySelectorAll('.card-slot');

        // Parse deck string to get card names for loading state
        const cardNames = this.scryfallAPI.parseDeckString(deckString);

        // Reset all slots to loading state with card names
        cardSlots.forEach((slot, index) => {
            if (index < cardNames.length) {
                slot.innerHTML = `<div class="card-loading">${cardNames[index]}</div>`;
            } else {
                slot.innerHTML = '<div class="card-loading">Loading...</div>';
            }
        });

        // Add deck information if available
        this.displayDeckInfo(playerId, deckString);

        try {
            const deckImages = await this.scryfallAPI.getDeckImages(deckString);
            
            // Display cards in slots
            for (let i = 0; i < Math.min(deckImages.length, cardSlots.length); i++) {
                const cardData = deckImages[i];
                const slot = cardSlots[i];
                
                if (cardData.image) {
                    // Create Scryfall search URL with quoted card name for exact match
                    const scryfallUrl = `https://scryfall.com/search?q=!${encodeURIComponent('"' + cardData.cardName + '"')}`;
                    
                    // Use the loaded Image object directly - wrap in link to Scryfall
                    const link = document.createElement('a');
                    link.href = scryfallUrl;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.className = 'card-link';
                    link.title = `Click to view ${cardData.cardName} on Scryfall`;
                    
                    // Clone the cached image to avoid moving it from cache
                    const displayImage = cardData.image.cloneNode();
                    displayImage.alt = cardData.cardName;
                    
                    link.appendChild(displayImage);
                    slot.innerHTML = '';
                    slot.appendChild(link);
                } else {
                    // Show card name as fallback - also linkable, but with non-exact matching
                    const scryfallUrl = `https://scryfall.com/search?q=${encodeURIComponent(cardData.cardName)}`;
                    slot.innerHTML = `<a href="${scryfallUrl}" target="_blank" rel="noopener noreferrer" class="card-link">
                        <div class="card-error">${cardData.cardName}</div>
                    </a>`;
                }
            }

            // Clear any remaining slots
            for (let i = deckImages.length; i < cardSlots.length; i++) {
                cardSlots[i].innerHTML = '<div class="card-loading">-</div>';
            }

        } catch (error) {
            console.error(`Error loading cards for ${playerId}:`, error);
            
            // Show error in all slots
            cardSlots.forEach(slot => {
                slot.innerHTML = '<div class="card-error">Failed to load</div>';
            });
        }
    }

    async setAnalysis(value) {
        if (this.currentRowIndex >= this.allRows.length) return;

        const currentRow = this.allRows[this.currentRowIndex];
        
        try {
            this.uiController.showStatus('Saving guru analysis...', 'loading');

            console.log('🎯 Updating cell:', {
                sheetTitle: currentRow.sheetTitle,
                originalRowIndex: currentRow.originalRowIndex,
                filteredRowIndex: currentRow.rowIndex,
                guruAnalysisColumn: currentRow.guruAnalysisColIndex,
                value: value
            });

            // Update the sheet with the analysis value
            const updates = {
                updates: [{
                    sheetId: currentRow.sheetId,
                    row: currentRow.originalRowIndex + 1, // +1 because sheets are 1-indexed
                    col: currentRow.guruAnalysisColIndex + 1, // +1 because sheets are 1-indexed
                    value: value.toString(),
                    valueType: 'number' // Explicitly specify this is a number
                }]
            };

            await this.sheetsAPI.updateSheetData(this.currentData.sheetId, updates);
            
            // Update local data - no need to reload everything for just one analysis
            currentRow.currentAnalysis = value.toString();
            
            // Calculate and update the outcome value based on all guru analyses
            const newOutcome = this.calculateOutcome(currentRow);
            currentRow.outcomeValue = newOutcome;
            
            // Update button highlighting immediately based on the new analysis value
            this.highlightCurrentAnalysisButton(value);
            
            this.uiController.showStatus(`Analysis saved: ${this.getAnalysisLabel(value)}`, 'success');
            
            // Check if analysis is now complete
            if (this.isAnalysisComplete()) {
                this.showCompletionMessage();
                return;
            }
            
            // Move to next row automatically if not complete
            setTimeout(async () => {
                await this.moveToNextIncompleteRow();
                
                // After moving to the next row, reload data in the background to get fresh updates
                this.reloadAllDataInBackground();
            }, 500);
            
        } catch (error) {
            console.error('Error saving analysis:', error);
            this.uiController.showStatus(`Error saving analysis: ${error.message}`, 'error');
        }
    }

    calculateOutcome(row) {
        // Collect all guru analyses
        const analyses = [];
        
        // Add current guru's analysis (the one we just set)
        if (row.currentAnalysis && row.currentAnalysis.trim() !== '') {
            analyses.push(row.currentAnalysis.trim());
        }
        
        // Add other guru analyses if they exist
        if (row.redAnalysis && row.redAnalysis.trim() !== '') {
            analyses.push(row.redAnalysis.trim());
        }
        if (row.blueAnalysis && row.blueAnalysis.trim() !== '') {
            analyses.push(row.blueAnalysis.trim());
        }
        if (row.greenAnalysis && row.greenAnalysis.trim() !== '') {
            analyses.push(row.greenAnalysis.trim());
        }
        
        // If any guru's analysis is missing, it's incomplete
        const expectedAnalyses = 3; // Assuming we expect Red, Blue, Green analyses
        if (analyses.length < expectedAnalyses) {
            return 'Incomplete';
        }
        
        // Check if all analyses are the same
        const uniqueAnalyses = [...new Set(analyses)];
        if (uniqueAnalyses.length === 1) {
            // All analyses are the same, return that value
            return uniqueAnalyses[0];
        } else {
            // There are differences, it's a discrepancy
            return 'Discrepancy';
        }
    }

    getAnalysisLabel(value) {
        if (value === 1.0) return 'Win';
        if (value === 0.5) return 'Tie';
        if (value === 0.0) return 'Loss';
        return value.toString();
    }

    async reloadAllData() {
        try {
            // Get fresh data for the entire sheet
            // Get the guru signature from localStorage as a fallback since we don't have direct access to GuruSignature instance
            const guruSignature = localStorage.getItem(CONFIG.STORAGE_KEYS.GURU_SIGNATURE);
            const freshSheetData = await this.sheetsAPI.getSheetData(this.currentData.sheetId, guruSignature);
            
            // Store the current row index to restore position
            const currentRowIndex = this.currentRowIndex;
            
            // Reload all data (this will rebuild this.allRows with fresh data)
            await this.loadData(freshSheetData);
            
            // Restore position to the same row (or closest valid row)
            this.currentRowIndex = Math.min(currentRowIndex, this.allRows.length - 1);
            
            console.log('🔄 Reloaded all data, restored to row:', this.currentRowIndex + 1);
            
        } catch (error) {
            console.warn('Error reloading all data:', error);
            // Don't throw - this is a nice-to-have feature
        }
    }

    async reloadAllDataInBackground() {
        // Run the reload in the background without blocking the UI
        try {
            console.log('🔄 Starting background data refresh...');
            
            // Get fresh data for the entire sheet
            // Get the guru signature from localStorage as a fallback since we don't have direct access to GuruSignature instance
            const guruSignature = localStorage.getItem(CONFIG.STORAGE_KEYS.GURU_SIGNATURE);
            const freshSheetData = await this.sheetsAPI.getSheetData(this.currentData.sheetId, guruSignature);
            
            // Store the current row info to find it again after reload
            const currentRow = this.allRows[this.currentRowIndex];
            const currentRowIdentifier = {
                sheetId: currentRow.sheetId,
                originalRowIndex: currentRow.originalRowIndex,
                player1: currentRow.player1,
                player2: currentRow.player2
            };
            
            // Rebuild data with fresh information
            this.currentData = freshSheetData;
            this.allRows = [];
            
            // Process all sheets and collect rows that need analysis
            if (freshSheetData.sheets && Array.isArray(freshSheetData.sheets)) {
                freshSheetData.sheets.forEach((sheet, sheetIndex) => {
                    if (sheet.values && sheet.values.length > 1) {
                        this.processSheet(sheet, sheetIndex);
                    }
                });
            }
            
            // Find the current row in the fresh data
            let newRowIndex = 0;
            for (let i = 0; i < this.allRows.length; i++) {
                const row = this.allRows[i];
                if (row.sheetId === currentRowIdentifier.sheetId &&
                    row.originalRowIndex === currentRowIdentifier.originalRowIndex &&
                    row.player1 === currentRowIdentifier.player1 &&
                    row.player2 === currentRowIdentifier.player2) {
                    newRowIndex = i;
                    break;
                }
            }
            
            // Update current position to the refreshed row
            this.currentRowIndex = newRowIndex;
            
            // Silently update the current row display with fresh data
            await this.showCurrentRow();
            
            console.log('🔄 Background data refresh completed successfully');
            
        } catch (error) {
            console.warn('Background data refresh failed:', error);
            // Don't show error to user since this is background operation
        }
    }

    buildDiscrepancyDisplay(currentRow) {
        // Determine which sheet we're on based on sheet title or current guru signature
        const sheetTitle = currentRow.sheetTitle.toLowerCase();
        
        // Get the current guru signature safely
        let currentGuru = '';
        if (this.authManager && this.authManager.guruSignature) {
            currentGuru = this.authManager.guruSignature.toLowerCase();
        }
        
        // Collect other guru analyses (exclude the current guru's analysis)
        const otherAnalyses = [];
        
        if (currentRow.redAnalysis && !currentGuru.includes('red')) {
            otherAnalyses.push({ name: 'Red', value: currentRow.redAnalysis });
        }
        if (currentRow.blueAnalysis && !currentGuru.includes('blue')) {
            otherAnalyses.push({ name: 'Blue', value: currentRow.blueAnalysis });
        }
        if (currentRow.greenAnalysis && !currentGuru.includes('green')) {
            otherAnalyses.push({ name: 'Green', value: currentRow.greenAnalysis });
        }
        
        // Build the display HTML with proper structure
        let html = '<div class="discrepancy-content">';
        html += '<div class="discrepancy-header">Discrepancy</div>';
        html += '</div>';
        
        if (otherAnalyses.length > 0) {
            html += '<div class="other-analyses">';
            otherAnalyses.forEach(analysis => {
                const displayValue = this.formatAnalysisValue(analysis.value);
                const cssClass = this.getAnalysisClass(analysis.value);
                html += `<div class="other-analysis ${cssClass}">
                    <div class="guru-name">${analysis.name}</div>
                    <div class="analysis-value">${displayValue}</div>
                </div>`;
            });
            html += '</div>';
        }
        
        return html;
    }
    
    getAnalysisClass(value) {
        if (!value || value.trim() === '') return 'other';
        
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
            if (numValue === 1.0) return 'win';
            if (numValue === 0.5) return 'tie';
            if (numValue === 0.0) return 'loss';
        }
        
        return 'other';
    }
    
    formatAnalysisValue(value) {
        if (!value || value.trim() === '') return 'Not set';
        
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
            if (numValue === 1.0) return 'Win (1.0)';
            if (numValue === 0.5) return 'Tie (0.5)';
            if (numValue === 0.0) return 'Loss (0.0)';
            return `Custom (${numValue})`;
        }
        
        return value.toString();
    }

    highlightCurrentAnalysisButton(outcomeValue) {
        // Remove current-analysis class from all buttons
        const allButtons = document.querySelectorAll('.scoring-btn');
        allButtons.forEach(btn => btn.classList.remove('current-analysis'));

        // Only highlight buttons for numeric outcome values
        if (typeof outcomeValue === 'number') {
            if (outcomeValue === 1.0) {
                document.getElementById('win-btn').classList.add('current-analysis');
            } else if (outcomeValue === 0.5) {
                document.getElementById('tie-btn').classList.add('current-analysis');
            } else if (outcomeValue === 0.0) {
                document.getElementById('loss-btn').classList.add('current-analysis');
            }
        }
        // For text values like 'discrepancy' or 'incomplete', no button gets highlighted
    }

    async nextRow() {
        if (this.currentRowIndex < this.allRows.length - 1) {
            this.currentRowIndex++;
            await this.showCurrentRow();
        }
    }

    async moveToNextIncompleteRow() {
        // Check if analysis is complete first
        if (this.isAnalysisComplete()) {
            this.showCompletionMessage();
            return;
        }
        
        // Find the next empty/discrepancy starting from after current row
        this.currentRowIndex = this.findFirstEmptyAnalysis(this.currentRowIndex + 1);
        await this.showCurrentRow();
    }

    async previousRow() {
        if (this.currentRowIndex > 0) {
            this.currentRowIndex--;
            await this.showCurrentRow();
        }
    }

    async skipToNextIncomplete() {
        // Find the next empty/discrepancy starting from after current row
        const nextIncompleteIndex = this.findFirstEmptyAnalysis(this.currentRowIndex + 1);
        
        // Check if we found a row after the current one
        if (nextIncompleteIndex != this.currentRowIndex) {
            this.currentRowIndex = nextIncompleteIndex;
            await this.showCurrentRow();
        } else {
            // No more incomplete rows found after current, show completion message
            this.showCompletionMessage();
        }
    }

    async restartAnalysis() {
        // Trigger the main refresh functionality by dispatching a custom event
        window.dispatchEvent(new CustomEvent('refreshAnalysis'));
    }

    showCompletionMessage() {
        document.getElementById('completion-message').style.display = 'block';
        this.uiController.showStatus('All rows analyzed! Great work!', 'success');
    }

    showNoDataMessage() {
        const analysisInterface = document.getElementById('guru-analysis-interface');
        analysisInterface.innerHTML = `
            <div class="empty-state">
                <h3>No Analysis Data Found</h3>
                <p>No rows found that match your guru signature and have the required columns:</p>
                <ul>
                    <li>Player 1 (On the Play)</li>
                    <li>Player 2 (On the Draw)</li>
                    <li>Guru Analysis</li>
                </ul>
                <p>Please check that your sheets have the correct column headers and data.</p>
            </div>
        `;
    }

    getTotalRows() {
        return this.allRows.length;
    }

    getCurrentProgress() {
        return {
            current: this.currentRowIndex + 1,
            total: this.allRows.length
        };
    }

    displayDeckInfo(playerId, deckString) {
        console.log('displayDeckInfo called with:', playerId, deckString);
        
        const cardsContainer = document.getElementById(`${playerId}-cards`);
        if (!cardsContainer) {
            console.log('Cards container not found:', `${playerId}-cards`);
            return;
        }
        
        const existingInfo = cardsContainer.querySelector('.deck-info');
        
        // Remove existing deck info if present
        if (existingInfo) {
            existingInfo.remove();
        }

        // Check if we have deck notes for this deck
        if (!this.deckNotesMap) {
            console.log('No deckNotesMap available');
            return;
        }
        
        console.log('Available deck notes:', Array.from(this.deckNotesMap.keys()));
        
        if (!this.deckNotesMap.has(deckString)) {
            console.log('No deck notes found for:', deckString);
            return;
        }

        const deckInfo = this.deckNotesMap.get(deckString);
        console.log('Found deck info:', deckInfo);
        
        const infoElements = [];

        // Add goldfish clock if available
        if (deckInfo.goldfishClock) {
            infoElements.push(`<span class="deck-clock">Clock: ${deckInfo.goldfishClock}</span>`);
        }

        // Add notes if available
        if (deckInfo.notes) {
            infoElements.push(`<span class="deck-notes">${deckInfo.notes}</span>`);
        }

        // Add horizontal line if both notes and additional notes exist
        if (deckInfo.notes && deckInfo.additionalNotes) {
            infoElements.push(`<hr class="deck-separator">`);
        }

        // Add additional notes if available
        if (deckInfo.additionalNotes) {
            infoElements.push(`<span class="deck-additional">${deckInfo.additionalNotes}</span>`);
        }

        if (infoElements.length > 0) {
            const deckInfoDiv = document.createElement('div');
            deckInfoDiv.className = 'deck-info';
            deckInfoDiv.innerHTML = infoElements.join(' ');
            
            // On mobile (768px and below), place deck info after the cards
            // On desktop, place it before the cards (current behavior)
            const isMobile = window.innerWidth <= 768;
            
            if (isMobile) {
                // Append after cards on mobile
                cardsContainer.appendChild(deckInfoDiv);
            } else {
                // Insert before cards on desktop
                cardsContainer.insertBefore(deckInfoDiv, cardsContainer.firstChild);
            }
            
            console.log('Deck info displayed successfully');
        } else {
            console.log('No info elements to display');
        }
    }
}
