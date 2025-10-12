/**
 * Guru Analysis Interface
 * Handles the single-row analysis interface for guru decisions
*/
import { ScryfallAPI } from './scryfallAPI.js';
import { DeckNotesEditor } from './deckNotesEditor.js';
import { CONFIG } from '../config.js';

export class GuruAnalysisInterface {
    constructor(sheetsAPI, uiController, authManager = null) {
        this.sheetsAPI = sheetsAPI;
        this.uiController = uiController;
        this.authManager = authManager;
        this.scryfallAPI = new ScryfallAPI();
        this.currentData = null;
        this.allRows = [];
        this.currentRowIndex = -1;
        this.currentGuruColor = null;
        this.numDiscrepancies = 0;
        // Store column indices as attributes for easier access
        this.redAnalysisColIndex = -1;
        this.blueAnalysisColIndex = -1;
        this.greenAnalysisColIndex = -1;
        this.redSignatureColIndex = -1;
        this.blueSignatureColIndex = -1;
        this.greenSignatureColIndex = -1;
        this.bindEvents();
        // Handle window resize for mobile/desktop layout changes
        this.handleResize = this.handleResize.bind(this);
        window.addEventListener('resize', this.handleResize);
    }

    reset() {
        this.currentData = null;
        this.allRows = [];
        this.currentRowIndex = -1;
        this.currentGuruColor = null;
        this.numDiscrepancies = 0;
        // Store column indices as attributes for easier access
        this.redAnalysisColIndex = -1;
        this.blueAnalysisColIndex = -1;
        this.greenAnalysisColIndex = -1;
        this.redSignatureColIndex = -1;
        this.blueSignatureColIndex = -1;
        this.greenSignatureColIndex = -1;
    }

    determineGuruColorFromSheet(sheetData) {
        // Get the current guru signature
        let currentSignature = '';
        if (this.authManager && this.authManager.guruSignature) {
            currentSignature = this.authManager.guruSignature;
        } else {
            currentSignature = localStorage.getItem(CONFIG.STORAGE_KEYS.GURU_SIGNATURE) || '';
        }

        if (!currentSignature.trim()) {
            console.log('No guru signature found, defaulting to red');
            return 'red';
        }

        // Find the merged guru sheet
        const mergedGuruSheet = sheetData.sheets?.find(sheet => 
            sheet.title === 'Merged Gurus'
        );

        if (!mergedGuruSheet || !mergedGuruSheet.values || mergedGuruSheet.values.length < 2) {
            console.log('No merged guru sheet found, defaulting to red');
            return 'red';
        }

        const headerRow = mergedGuruSheet.values[0];
        
        // Find signature columns
        const redSignatureColIndex = this.findColumnIndex(headerRow, ['Red Signature']);
        const blueSignatureColIndex = this.findColumnIndex(headerRow, ['Blue Signature']);
        const greenSignatureColIndex = this.findColumnIndex(headerRow, ['Green Signature']);

        console.log('Signature column indices:', {
            red: redSignatureColIndex,
            blue: blueSignatureColIndex,
            green: greenSignatureColIndex,
            currentSignature
        });

        // Check each signature column for the current guru's signature
        for (let rowIndex = 1; rowIndex < mergedGuruSheet.values.length; rowIndex++) {
            const row = mergedGuruSheet.values[rowIndex];
            
            // Check red signature column
            if (redSignatureColIndex !== -1 && row[redSignatureColIndex] === currentSignature) {
                console.log(`Found guru signature "${currentSignature}" in Red column at row ${rowIndex}`);
                return 'red';
            }
            
            // Check blue signature column
            if (blueSignatureColIndex !== -1 && row[blueSignatureColIndex] === currentSignature) {
                console.log(`Found guru signature "${currentSignature}" in Blue column at row ${rowIndex}`);
                return 'blue';
            }
            
            // Check green signature column
            if (greenSignatureColIndex !== -1 && row[greenSignatureColIndex] === currentSignature) {
                console.log(`Found guru signature "${currentSignature}" in Green column at row ${rowIndex}`);
                return 'green';
            }
        }

        console.log(`Guru signature "${currentSignature}" not found in any column`);
        throw new Error(`Guru signature "${currentSignature}" not found in any analysis column. Please check that you have matches assigned to analyse.`);
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
        document.getElementById('discrepancy-btn').addEventListener('click', () => this.skipToNextDiscrepancy());

        // Guru color selector
        this.bindGuruColorSelector();

        // --- MATCH TABLE MODAL ---
        document.getElementById('current-row-info').addEventListener('click', () => this.showMatchTableModal());
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

    bindGuruColorSelector() {
        const trigger = document.getElementById('sheet-name-info');
        const dropdown = document.getElementById('guru-color-dropdown');
        
        if (!trigger || !dropdown) {
            console.warn('Guru color selector elements not found');
            return;
        }

        // Toggle dropdown on trigger click
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = dropdown.classList.contains('show');
            
            if (isOpen) {
                this.closeGuruColorDropdown();
            } else {
                this.openGuruColorDropdown();
            }
        });

        // Handle color selection
        dropdown.addEventListener('click', (e) => {
            const option = e.target.closest('.guru-color-option');
            if (option) {
                const selectedColor = option.dataset.color;
                this.changeGuruColor(selectedColor);
                this.closeGuruColorDropdown();
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!trigger.contains(e.target) && !dropdown.contains(e.target)) {
                this.closeGuruColorDropdown();
            }
        });

        // Close dropdown on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeGuruColorDropdown();
            }
        });
    }

    openGuruColorDropdown() {
        const trigger = document.getElementById('sheet-name-info');
        const dropdown = document.getElementById('guru-color-dropdown');
        
        trigger.classList.add('active');
        dropdown.classList.add('show');
        
        // Update current color indicator
        this.updateGuruColorDropdown();
    }

    closeGuruColorDropdown() {
        const trigger = document.getElementById('sheet-name-info');
        const dropdown = document.getElementById('guru-color-dropdown');
        
        trigger.classList.remove('active');
        dropdown.classList.remove('show');
    }

    updateGuruColorDropdown() {
        const dropdown = document.getElementById('guru-color-dropdown');
        if (!dropdown) return;

        // Remove current class from all options
        dropdown.querySelectorAll('.guru-color-option').forEach(option => {
            option.classList.remove('current');
        });

        // Add current class to the active guru color
        if (this.currentGuruColor) {
            const currentOption = dropdown.querySelector(`[data-color="${this.currentGuruColor}"]`);
            if (currentOption) {
                currentOption.classList.add('current');
            }
        }
    }

    async changeGuruColor(newColor) {
        if (newColor === this.currentGuruColor) {
            return; // No change needed
        }

        try {            
            const oldColor = this.currentGuruColor;
            this.currentGuruColor = newColor;
            
            console.log(`Switching guru color from ${oldColor} to ${newColor}`);
            
            // Update the display immediately
            this.updateGuruColorDisplay();
            // Show the current row with the new guru color perspective
            await this.showCurrentRow();
            
            this.uiController.showStatus(`Switched to ${newColor} guru`, 'success');
            
        } catch (error) {
            console.error('Error changing guru color:', error);
            this.uiController.showStatus(`Error switching guru color: ${error.message}`, 'error');
            
            // Revert to old color on error
            this.currentGuruColor = oldColor;
            this.updateGuruColorDisplay();
        }
    }

    updateGuruColorDisplay() {
        const trigger = document.getElementById('sheet-name-info');
        if (trigger && this.currentGuruColor) {
            trigger.textContent = `${this.currentGuruColor.charAt(0).toUpperCase() + this.currentGuruColor.slice(1)} Guru`;
        }
        
        // Update dropdown current indicator
        this.updateGuruColorDropdown();
    }

    /**
     * Update the browser URL with current pod ID, guru color, and row number
     */
    updateURL() {
        if (!this.currentData?.sheetId) return;
        
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('pod', this.currentData.sheetId);
        
        if (this.currentRowIndex !== undefined && this.allRows?.length > 0) {
            newUrl.searchParams.delete('row');
            newUrl.searchParams.set('match', (this.currentRowIndex + 1).toString());
        }
        
        if (this.currentGuruColor) {
            newUrl.searchParams.set('guru', this.currentGuruColor);
        }

        window.history.replaceState({ 
            podId: this.currentData.sheetId,
            guruColor: this.currentGuruColor,
            rowIndex: this.currentRowIndex 
        }, '', newUrl);

        // Update title with current spreadsheet title
        const sheetName = this.currentData?.title || 'Unknown Pod';
        document.title = `${sheetName} - The Stylus`;
    }

    async loadData(sheetData, guruColor = null, rowNumber = 0) {
        this.currentData = sheetData;

        if (sheetData.sheets.some(sheet => sheet.title === 'Merged Gurus' && sheet.hidden)) {
            const notesData = sheetData.sheets.find(sheet => sheet.title === 'Deck Notes');
            if (notesData) {
                // Show deck notes editor if available
                this.showDeckNotesEditor(notesData);
                return false;
            } else {
                this.uiController.showError('No Deck Notes sheet found. Please ensure it exists to continue.');
                return false;
            }
        }

        if (rowNumber !== null && rowNumber > 0) {
            this.currentRowIndex = rowNumber - 1;
        }
        
        if (guruColor === null) {
            try {
                // Determine the current guru color from the actual sheet data
                this.currentGuruColor = this.determineGuruColorFromSheet(sheetData);
                console.log(`Determined guru color: ${this.currentGuruColor}`);
            } catch (error) {                
                // Check if this is a "signature not found" error - offer color selection
                if (error.message.includes('not found in any analysis column')) {
                    this.showGuruColorSelection(sheetData); 
                    return false;
                } else {
                    // For other errors, show a generic error message
                    console.error('Error determining guru color:', error);
                    this.uiController.showError('An error occurred while determining guru color');
                    return false;
                }
            }
        } else if (guruColor !== null) {
            this.currentGuruColor = guruColor.toLowerCase();
        }
        
        this.allRows = [];

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
            if (this.currentRowIndex === null || this.currentRowIndex === undefined || this.currentRowIndex < 0 || this.currentRowIndex >= this.allRows.length) {
                // Find the first row with empty Guru Analysis
                let firstEmpty = this.findFirstEmptyAnalysis();
                if (firstEmpty == null) {
                    this.currentRowIndex = 0;
                    this.showCompletionMessage();
                } else {
                    this.currentRowIndex = firstEmpty;
                }
            }
        }
        return true;
    }

    processDeckNotes(sheetData) {
        const deckNotesMap = new Map();
        
        if (!sheetData.sheets) {
            console.log('No sheets found in sheetData');
            return deckNotesMap;
        }
        
        // Find the "Deck Notes" sheet
        const deckNotesSheet = sheetData.sheets.find(sheet => 
            sheet.title && sheet.title.toLowerCase().includes('deck notes')
        );
        
        if (!deckNotesSheet) {
            console.log('No "Deck Notes" sheet found. Available sheets:', 
                sheetData.sheets.map(s => s.title));
            return deckNotesMap;
        }
                
        if (!deckNotesSheet.values || deckNotesSheet.values.length < 2) {
            console.log('Deck Notes sheet has no data or insufficient rows');
            return deckNotesMap;
        }
        
        const headerRow = deckNotesSheet.values[0];
        
        const decklistsColIndex = this.findColumnIndex(headerRow, ['Decklists', 'Decklist']);
        const goldfishClockColIndex = this.findColumnIndex(headerRow, ['Goldfish Clock', 'Clock']);
        const notesColIndex = this.findColumnIndex(headerRow, ['Notes']);
        const additionalNotesColIndex = this.findColumnIndex(headerRow, ['Additional Notes', 'Add Notes']);
        
        if (decklistsColIndex === -1) {
            console.log('Decklists column not found');
            return deckNotesMap;
        }
        
        // Process each row
        for (let i = 1; i < deckNotesSheet.values.length; i++) {
            const row = deckNotesSheet.values[i];
            const decklist = row[decklistsColIndex];
            
            if (decklist && decklist.trim()) {
                const deckInfo = {row: i};
                
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
        
        // Handle different sheet types
        if (sheet.title === 'Merged Gurus') {
            // For merged guru sheet, use the merged column structure
            this.processMergedGuruSheet(sheet, sheetIndex);
        } else {
            // For deck notes or other sheets, skip processing
            console.log(`Skipping sheet "${sheet.title}" - not a guru analysis sheet`);
            return;
        }
    }

    processMergedGuruSheet(sheet, sheetIndex) {
        const headerRow = sheet.values[0];
        
        // Find required columns in merged sheet structure
        // Expected columns: ID, Player1, Player2, Red Analysis, Red Signature, Blue Analysis, Blue Signature, Green Analysis, Green Signature
        const player1ColIndex = this.findColumnIndex(headerRow, ['Player 1', 'Player1']);
        const player2ColIndex = this.findColumnIndex(headerRow, ['Player 2', 'Player2']);

        // Find guru analysis columns and store as class attributes
        this.redAnalysisColIndex = this.findColumnIndex(headerRow, ['Red Analysis']);
        this.blueAnalysisColIndex = this.findColumnIndex(headerRow, ['Blue Analysis']);
        this.greenAnalysisColIndex = this.findColumnIndex(headerRow, ['Green Analysis']);
        // Find guru signature columns and store as class attributes
        this.redSignatureColIndex = this.findColumnIndex(headerRow, ['Red Signature']);
        this.blueSignatureColIndex = this.findColumnIndex(headerRow, ['Blue Signature']);
        this.greenSignatureColIndex = this.findColumnIndex(headerRow, ['Green Signature']);

        // Throw error if any required column is missing
        if (
            player1ColIndex === -1 ||
            player2ColIndex === -1 ||
            this.redAnalysisColIndex === -1 ||
            this.blueAnalysisColIndex === -1 ||
            this.greenAnalysisColIndex === -1 ||
            this.redSignatureColIndex === -1 ||
            this.blueSignatureColIndex === -1 ||
            this.greenSignatureColIndex === -1
        ) {
            throw new Error('One or more required columns are missing in the pod sheet. Please check the sheet structure.');
        }

        let discrepancies = 0;

        // Process data rows (skip header)
        for (let rowIndex = 1; rowIndex < sheet.values.length; rowIndex++) {
            const row = sheet.values[rowIndex];
            
            // Get the original row index from the backend filtering
            const originalRowIndex = sheet.originalRowIndices ? sheet.originalRowIndices[rowIndex] : rowIndex;

            const player1 = row[player1ColIndex] || '';
            const player2 = row[player2ColIndex] || '';
            const redAnalysis = row[this.redAnalysisColIndex].toString().trim() || '';
            const blueAnalysis = row[this.blueAnalysisColIndex].toString().trim() || '';
            const greenAnalysis = row[this.greenAnalysisColIndex].toString().trim() || '';
            const redSignature = row[this.redSignatureColIndex].toString().trim() || '';
            const blueSignature = row[this.blueSignatureColIndex].toString().trim() || '';
            const greenSignature = row[this.greenSignatureColIndex].toString().trim() || '';

            // Calculate outcome based on all guru analyses
            const outcomeValue = this.calculateOutcomeFromAnalyses(redAnalysis, blueAnalysis, greenAnalysis);

            // Check for discrepancies for the current guru
            const row_signatures = [redSignature, blueSignature, greenSignature];
            if (row_signatures.includes(this.authManager.guruSignature)) {
                // If the current guru signature is present, check for discrepancies
                if (outcomeValue.toLowerCase().trim() === 'discrepancy') {
                    discrepancies++;
                }
            }

            // Only include rows that have player data
            if (player1.trim() || player2.trim()) {
                this.allRows.push({
                    sheetIndex,
                    sheetTitle: sheet.title,
                    sheetId: sheet.sheetId,
                    rowIndex,
                    player1: player1.trim(),
                    player2: player2.trim(),
                    outcomeValue: outcomeValue,
                    redAnalysis: redAnalysis,
                    blueAnalysis: blueAnalysis,
                    greenAnalysis: greenAnalysis,
                    redSignature: redSignature,
                    blueSignature: blueSignature,
                    greenSignature: greenSignature,
                    originalRowIndex: originalRowIndex // Use the original row index from unfiltered data
                });
            }
        }

        // Update the number of discrepancies
        this.numDiscrepancies = discrepancies;
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

    calculateOutcomeFromAnalyses(redAnalysis, blueAnalysis, greenAnalysis) {
        // Collect all guru analyses
        const analyses = [];
        
        if (redAnalysis && redAnalysis.trim() !== '') {
            analyses.push(redAnalysis.trim());
        }
        if (blueAnalysis && blueAnalysis.trim() !== '') {
            analyses.push(blueAnalysis.trim());
        }
        if (greenAnalysis && greenAnalysis.trim() !== '') {
            analyses.push(greenAnalysis.trim());
        }
        
        // If any guru's analysis is missing, it's incomplete
        const expectedAnalyses = 3; // Red, Blue, Green
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

    isAnalysisComplete() {
        // Check if all rows have analysis
        for (let i = 0; i < this.allRows.length; i++) {
            const row = this.allRows[i];
            
            // Check for empty analysis using the helper method
            const currentAnalysis = this.getCurrentGuruAnalysis(row);
            if (!currentAnalysis || currentAnalysis.trim() === '') {
                return false;
            }
        }
        
        return this.allRows.length > 0; // Only complete if we have rows to analyse
    }

    findFirstEmptyAnalysis(startFromIndex = 0) {
        // Get the current guru signature for filtering
        let currentSignature = '';
        if (this.authManager && this.authManager.guruSignature) {
            currentSignature = this.authManager.guruSignature;
        } else {
            currentSignature = localStorage.getItem(CONFIG.STORAGE_KEYS.GURU_SIGNATURE) || '';
        }

        // Phase 1: Look for incomplete rows that belong to current guru (have current guru's signature)
        
        // First, find rows with current guru's signature that need analysis, starting from the given index
        for (let i = startFromIndex; i < this.allRows.length; i++) {
            const row = this.allRows[i];
            
            // Check if this row has the current guru's signature
            if (this.rowHasCurrentGuruSignature(row, currentSignature)) {
                // Check for empty analysis
                const currentAnalysis = this.getCurrentGuruAnalysis(row);
                if (!currentAnalysis || currentAnalysis.trim() === '') {
                    return i;
                }
            }
        }
        
        // If no incomplete analysis found from startFromIndex to end, loop back and search from beginning to startFromIndex
        if (startFromIndex > 0) {
            for (let i = 0; i < startFromIndex-1; i++) {
                const row = this.allRows[i];
                
                // Check if this row has the current guru's signature
                if (this.rowHasCurrentGuruSignature(row, currentSignature)) {
                    // Check for empty analysis
                    const currentAnalysis = this.getCurrentGuruAnalysis(row);
                    if (!currentAnalysis || currentAnalysis.trim() === '') {
                        return i;
                    }
                }
            }
        }

        // Phase 2: If no rows with current guru signature need analysis, look for rows with empty signatures
        
        // First, from startFromIndex to end
        for (let i = startFromIndex; i < this.allRows.length; i++) {
            const row = this.allRows[i];
            
            // Check if this row has empty guru signature (unclaimed)
            if (this.rowHasEmptySignature(row)) {
                return i;
            }
        }
        
        // If no empty signature found from startFromIndex to end, loop back and search from beginning to startFromIndex
        if (startFromIndex > 0) {
            for (let i = 0; i < startFromIndex-1; i++) {
                const row = this.allRows[i];
                
                // Check if this row has empty guru signature (unclaimed)
                if (this.rowHasEmptySignature(row)) {
                    return i;
                }
            }
        }
        
        // If no empty signature or analysis found, return null
        return null;
    }

    findFirstDiscrepancy(startFromIndex = 0) {
        // Get the current guru signature for filtering
        let currentSignature = '';
        if (this.authManager && this.authManager.guruSignature) {
            currentSignature = this.authManager.guruSignature;
        } else {
            currentSignature = localStorage.getItem(CONFIG.STORAGE_KEYS.GURU_SIGNATURE) || '';
        }
        // Look for discrepancies that belong to current guru (have current guru's signature)
        for (let i = startFromIndex; i < this.allRows.length; i++) {
            const row = this.allRows[i];
            // Determine which signature column (if any) matches the current signature for this row
            const rowSignatures = {
                red: row.redSignature,
                blue: row.blueSignature,
                green: row.greenSignature
            };
            for (const color of ['red', 'blue', 'green']) {
                if (rowSignatures[color] === currentSignature) {
                    // Check for discrepancy
                    if (row.outcomeValue && row.outcomeValue.toLowerCase().trim() === 'discrepancy') {
                        return { index: i, color };
                    }
                }
            }
        }

        // If no discrepancies found from startFromIndex to end, loop back and search from beginning to startFromIndex
        if (startFromIndex > 0) {
            for (let i = 0; i < startFromIndex; i++) {
                const row = this.allRows[i];
                const rowSignatures = {
                    red: row.redSignature,
                    blue: row.blueSignature,
                    green: row.greenSignature
                };
                for (const color of ['red', 'blue', 'green']) {
                    if (rowSignatures[color] === currentSignature) {
                        if (row.outcomeValue && row.outcomeValue.toLowerCase().trim() === 'discrepancy') {
                            return { index: i, color };
                        }
                    }
                }
            }
        }

        // If no discrepancies found, return the start index (or 0) and keep current color
        return { index: startFromIndex === 0 ? 0 : startFromIndex, color: this.currentGuruColor };
    }

    getCurrentGuruAnalysis(row) {
        // Get the current guru's analysis value based on guru color
        switch (this.currentGuruColor) {
            case 'red':
                return row.redAnalysis || '';
            case 'blue':
                return row.blueAnalysis || '';
            case 'green':
                return row.greenAnalysis || '';
            default:
                return '';
        }
    }

    getCurrentRowSignature(row) {
        // Get the current row's signature for the current guru color
        switch (this.currentGuruColor) {
            case 'red':
                return row.redSignature || '';
            case 'blue':
                return row.blueSignature || '';
            case 'green':
                return row.greenSignature || '';
            default:
                return '';
        }
    }

    rowHasCurrentGuruSignature(row, currentSignature) {
        if (!currentSignature.trim()) {
            return false;
        }
        
        // Check the current guru's signature column based on guru color
        switch (this.currentGuruColor) {
            case 'red':
                return row.redSignature === currentSignature;
            case 'blue':
                return row.blueSignature === currentSignature;
            case 'green':
                return row.greenSignature === currentSignature;
            default:
                return false;
        }
    }

    rowHasEmptySignature(row) {
        // Check if the current guru's signature column is empty
        switch (this.currentGuruColor) {
            case 'red':
                return !row.redSignature || row.redSignature.trim() === '';
            case 'blue':
                return !row.blueSignature || row.blueSignature.trim() === '';
            case 'green':
                return !row.greenSignature || row.greenSignature.trim() === '';
            default:
                return true;
        }
    }

    async showCurrentRow() {
        // Update URL with current state
        this.updateURL();

        // Show sheet link
        const sheetTitle = document.getElementById('sheet-title');
        const sheetLink = document.getElementById('google-sheet-link');
        sheetTitle.textContent = this.currentData.title;
        sheetLink.href = `https://docs.google.com/spreadsheets/d/${this.currentData.sheetId}/edit`;
        sheetLink.target = '_blank';
        sheetLink.title = 'Open pod in Google Sheets';

        if (this.currentRowIndex >= this.allRows.length || this.currentRowIndex < 0) {
            this.showMatchTableModal();
            return;
        }

        const currentRow = this.allRows[this.currentRowIndex];
        
        // Update progress info
        document.getElementById('current-row-info').textContent = 
            `Match ${this.currentRowIndex + 1} of ${this.allRows.length}`;
        this.updateGuruColorDisplay();

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
                analysisElement.textContent = 'Discrepancy';
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
                    
                    // No current guru analysis yet, show simple display
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

        // Show current guru's analysis with other gurus' analyses
        analysisElement.innerHTML = this.buildAnalysisDisplayWithOthers(currentRow, currentRow.outcomeValue || '');

        // Check if this row is claimed by another guru
        const currentRowSignature = this.getCurrentRowSignature(currentRow);
        let userGuruSignature = '';
        if (this.authManager && this.authManager.guruSignature) {
            userGuruSignature = this.authManager.guruSignature;
        } else {
            userGuruSignature = localStorage.getItem(CONFIG.STORAGE_KEYS.GURU_SIGNATURE) || '';
        }

        const isRowClaimedByAnotherGuru = currentRowSignature && currentRowSignature.trim() !== '' && currentRowSignature !== userGuruSignature;
        const isRowUnclaimed = !currentRowSignature || currentRowSignature.trim() === '';
        const isRowOwnedByCurrentUser = currentRowSignature === userGuruSignature;

        // Show/hide scoring buttons based on row ownership
        const scoringButtons = document.querySelectorAll('.scoring-btn');
        const claimedMessage = document.getElementById('claimed-message');
        const claimButton = document.getElementById('claim-button');
        const claimDeckButton = document.getElementById('claim-deck-button');
        const unclaimButton = document.getElementById('unclaim-button');
        const clearButton = document.getElementById('clear-result-button');
        
        if (isRowClaimedByAnotherGuru) {
            // Hide scoring buttons, claim button, and unclaim button, show claimed message
            scoringButtons.forEach(btn => btn.style.display = 'none');
            if (claimButton) claimButton.style.display = 'none';
            if (claimDeckButton) claimDeckButton.style.display = 'none';
            if (unclaimButton) unclaimButton.style.display = 'none';
            if (clearButton) clearButton.style.display = 'none';
            
            // Get the current analysis value for the claimed row
            const currentAnalysis = this.getCurrentGuruAnalysis(currentRow);
            const analysisText = currentAnalysis && currentAnalysis.trim() !== '' ? 
                ` - Analysis: ${this.formatAnalysisValue(currentAnalysis)}` : '';
            
            if (claimedMessage) {
                claimedMessage.style.display = 'block';
                claimedMessage.textContent = `Claimed by ${currentRowSignature}${analysisText}`;
            } else {
                // Create claimed message element if it doesn't exist
                const newClaimedMessage = document.createElement('div');
                newClaimedMessage.id = 'claimed-message';
                newClaimedMessage.className = 'claimed-message';
                newClaimedMessage.textContent = `Claimed by ${currentRowSignature}${analysisText}`;
                
                // Insert after the scoring buttons container
                const scoringContainer = document.querySelector('.scoring-buttons');
                if (scoringContainer) {
                    scoringContainer.insertAdjacentElement('afterend', newClaimedMessage);
                }
            }
        } else if (isRowUnclaimed) {
            // Hide scoring buttons, claimed message, and unclaim button, show claim button and claim deck button
            scoringButtons.forEach(btn => btn.style.display = 'none');
            if (claimedMessage) claimedMessage.style.display = 'none';
            if (unclaimButton) unclaimButton.style.display = 'none';
            if (clearButton) clearButton.style.display = 'none';

            // --- Claim Match Button ---
            let claimBtn = claimButton;
            if (claimBtn) {
                claimBtn.style.display = 'block';
                claimBtn.disabled = false;
                claimBtn.textContent = 'Claim Match';
            } else {
                claimBtn = document.createElement('button');
                claimBtn.id = 'claim-button';
                claimBtn.className = 'claim-btn primary-btn';
                claimBtn.textContent = 'Claim Match';
                claimBtn.addEventListener('click', () => this.claimRow());
                const scoringContainer = document.querySelector('.scoring-buttons');
                if (scoringContainer) {
                    scoringContainer.insertAdjacentElement('afterend', claimBtn);
                }
            }

            // --- Claim Deck Button ---
            let claimDeckBtn = document.getElementById('claim-deck-button');
            if (!claimDeckBtn) {
                claimDeckBtn = document.createElement('button');
                claimDeckBtn.id = 'claim-deck-button';
                claimDeckBtn.className = 'claim-btn primary-btn';
                claimDeckBtn.textContent = 'Claim Deck';
                claimDeckBtn.addEventListener('click', async () => {
                    claimDeckBtn.disabled = true;
                    claimDeckBtn.innerHTML = '<span class="spinner"></span> Claiming...';
                    await this.claimDeckRows();
                    claimDeckBtn.disabled = false;
                    claimDeckBtn.textContent = 'Claim Deck';
                });
                if (claimBtn && claimBtn.nextSibling) {
                    claimBtn.parentNode.insertBefore(claimDeckBtn, claimBtn.nextSibling);
                } else if (claimBtn) {
                    claimBtn.parentNode.appendChild(claimDeckBtn);
                }
            } else {
                claimDeckBtn.style.display = 'inline-block';
            }
        } else if (isRowOwnedByCurrentUser) {
            // Show scoring buttons, hide claimed message and claim/claim deck buttons
            scoringButtons.forEach(btn => btn.style.display = '');
            if (claimedMessage) claimedMessage.style.display = 'none';
            if (claimButton) claimButton.style.display = 'none';
            if (claimDeckButton) claimDeckButton.style.display = 'none';

            // Check if user has scored this match yet
            const currentAnalysis = this.getCurrentGuruAnalysis(currentRow);
            const hasUserScored = currentAnalysis && currentAnalysis.trim() !== '';

            // Manage unclaim / clear buttons
            let unclaimButton = document.getElementById('unclaim-button');
            let clearButton = document.getElementById('clear-result-button');

            if (!hasUserScored) {
                // User has claimed but not scored - show unclaim button and ensure clear button is hidden
                if (unclaimButton) {
                    unclaimButton.style.display = 'block';
                    unclaimButton.disabled = false;
                    unclaimButton.textContent = 'Unclaim Match';
                } else {
                    unclaimButton = document.createElement('button');
                    unclaimButton.id = 'unclaim-button';
                    unclaimButton.className = 'unclaim-btn secondary-btn';
                    unclaimButton.textContent = 'Unclaim Match';
                    unclaimButton.addEventListener('click', () => this.unclaimRow());
                    const skipButton = document.getElementById('skip-btn');
                    if (skipButton) {
                        skipButton.insertAdjacentElement('afterend', unclaimButton);
                    }
                }

                // Hide clear button when not scored
                if (clearButton) clearButton.style.display = 'none';
            } else {
                // User has scored - hide unclaim button and show clear button
                if (unclaimButton) unclaimButton.style.display = 'none';

                if (clearButton) {
                    clearButton.style.display = 'block';
                    clearButton.disabled = false;
                    clearButton.textContent = 'Clear My Result';
                } else {
                    clearButton = document.createElement('button');
                    clearButton.id = 'clear-result-button';
                    clearButton.className = 'clear-btn secondary-btn';
                    clearButton.textContent = 'Clear My Result';
                    clearButton.addEventListener('click', () => this.clearCurrentUserAnalysis());
                    const skipButton = document.getElementById('skip-btn');
                    if (skipButton) {
                        skipButton.insertAdjacentElement('afterend', clearButton);
                    }
                }
            }
            
            // Highlight the appropriate button based on current guru analysis value
            const currentAnalysisValue = currentAnalysis ? parseFloat(currentAnalysis) : null;
            this.highlightCurrentAnalysisButton(currentAnalysisValue);
        }

        // Update navigation buttons
        document.getElementById('prev-btn').disabled = this.currentRowIndex === 0;
        document.getElementById('next-btn').disabled = this.currentRowIndex >= this.allRows.length - 1;

        // Show/hide discrepancy button based on number of discrepancies
        const discrepancyButton = document.getElementById('discrepancy-btn');
        if (discrepancyButton) {
            if (this.numDiscrepancies > 0) {
                discrepancyButton.style.display = 'inline-block';
                discrepancyButton.textContent = `Next Discrepancy (${this.numDiscrepancies})`;
            } else {
                discrepancyButton.style.display = 'none';
            }
        }

        // Preload next match's card images in the background
        this.preloadNextMatchCards();
    }

    /**
     * Claim all unclaimed matches with the same Player 1 deck as the current row
     */
    async claimDeckRows() {
        if (this.currentRowIndex >= this.allRows.length) return;

        const currentRow = this.allRows[this.currentRowIndex];
        const player1Deck = currentRow.player1;
        if (!player1Deck) return;

        // Get user's guru signature
        let userGuruSignature = '';
        if (this.authManager && this.authManager.guruSignature) {
            userGuruSignature = this.authManager.guruSignature;
        } else {
            userGuruSignature = localStorage.getItem(CONFIG.STORAGE_KEYS.GURU_SIGNATURE) || '';
        }
        if (!userGuruSignature.trim()) {
            this.uiController.showStatus('No guru signature found. Please set your signature first.', 'error');
            return;
        }

        // Find all rows with the same Player 1 deck (total for this deck)
        const rowsToClaim = this.allRows.filter(row => row.player1 === player1Deck);

        if (rowsToClaim.length === 0) {
            this.uiController.showStatus(`No matches found for deck "${player1Deck}".`, 'error');
            return;
        }

        // Prepare batch updates
        const updates = {
            updates: rowsToClaim.map(row => {
                const signatureColIndex = this.getCurrentGuruColIndex('signature');
                return {
                    sheetId: row.sheetId,
                    row: row.originalRowIndex + 1,
                    col: signatureColIndex + 1,
                    value: userGuruSignature,
                    expectedValue: '',
                    valueType: 'string',
                    isMergedGuruUpdate: true,
                    guruSheetIds: this.currentData.sheets.find(s => s.title === 'Merged Gurus')?.guruSheetIds
                };
            })
        };

        try {
            this.uiController.showStatus(`Claiming ${rowsToClaim.length} matches for deck...`, 'loading');
            const result = await this.sheetsAPI.checkedUpdateSheetData(this.currentData.sheetId, updates);

            // Update local data for only those that were actually claimed
            let actuallyClaimed = 0;
            if (result && result.updatedCells) {
                rowsToClaim.forEach((row, i) => {
                    // Find the matching row in this.allRows by originalRowIndex and sheetId
                    const match = this.allRows.find(r => r.originalRowIndex === row.originalRowIndex && r.sheetId === row.sheetId);
                    if (!match) return;
                    // Find the matching row in the skipped ones
                    const skipped = result.skipped && result.skipped.find(s => s.row === row.originalRowIndex + 1);
                    if (skipped) {
                        // This row is already claimed, set the signature to the value from skipped
                        switch (this.currentGuruColor) {
                            case 'red': match.redSignature = skipped.currentValue; break;
                            case 'blue': match.blueSignature = skipped.currentValue; break;
                            case 'green': match.greenSignature = skipped.currentValue; break;
                        }
                    }
                    else {
                        // Successfully claimed this row, set the signature to user's guru signature
                        switch (this.currentGuruColor) {
                            case 'red': match.redSignature = userGuruSignature; break;
                            case 'blue': match.blueSignature = userGuruSignature; break;
                            case 'green': match.greenSignature = userGuruSignature; break;
                        }
                        actuallyClaimed++;
                    }
                });
            }

            this.uiController.showStatus(`Claimed ${actuallyClaimed} of ${rowsToClaim.length} matches for this deck.`, 'success');
            console.log(`🎯 Claimed ${actuallyClaimed} matches for deck "${player1Deck}" (${rowsToClaim.length} total)`);
            this.showCurrentRow();

        } catch (error) {
            console.error('Error claiming deck matches:', error);
            this.uiController.showStatus(`Error claiming deck matches: ${error.message}`, 'error');
        }
    }

    /**
     * Preload card images for the next match that will be evaluated
     * This improves user experience by having images ready when user navigates
     */
    preloadNextMatchCards() {
        // Find the next row that actually needs analysis (empty analysis or discrepancy)
        // starting from after the current row
        let nextRowIndex = this.findFirstEmptyAnalysis(this.currentRowIndex + 1);
        
        // If findFirstEmptyAnalysis returned null, it means there are no more rows to analyse, so don't preload
        if (nextRowIndex == null) {
            console.log('🎯 No next match to preload (analysis complete)');
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
                    const scryfallUrl = this.scryfallAPI.getCardUrl(cardData.cardName);
                    
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
                    const scryfallUrl = this.scryfallAPI.getCardUrl(cardData.cardName, false);
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

            // Use helper to get analysis column index
            const analysisColIndex = this.getCurrentGuruColIndex('analysis');
            console.log('🎯 Updating cell:', {
                sheetTitle: currentRow.title,
                originalRowIndex: currentRow.originalRowIndex,
                filteredRowIndex: currentRow.rowIndex,
                analysisColIndex,
                guruColor: this.currentGuruColor,
                value: value
            });

            // For merged guru sheet, we need to route to the correct individual sheet
            const updates = {
                updates: [{
                    sheetId: currentRow.sheetId,
                    row: currentRow.originalRowIndex + 1, // +1 because sheets are 1-indexed
                    col: analysisColIndex + 1, // +1 because sheets are 1-indexed
                    value: value.toString(),
                    valueType: 'number', // Explicitly specify this is a number
                    isMergedGuruUpdate: true,
                    guruSheetIds: this.currentData.sheets.find(s => s.title === 'Merged Gurus')?.guruSheetIds
                }]
            };

            await this.sheetsAPI.updateSheetData(this.currentData.sheetId, updates);
            
            // Update the specific guru analysis in the local data
            switch (this.currentGuruColor) {
                case 'red':
                    currentRow.redAnalysis = value.toString();
                    break;
                case 'blue':
                    currentRow.blueAnalysis = value.toString();
                    break;
                case 'green':
                    currentRow.greenAnalysis = value.toString();
                    break;
            }
            
            // Calculate and update the outcome value based on all guru analyses
            const newOutcome = this.calculateOutcomeFromAnalyses(
                currentRow.redAnalysis, 
                currentRow.blueAnalysis, 
                currentRow.greenAnalysis
            );
            currentRow.outcomeValue = newOutcome;
            
            // Update button highlighting immediately based on the new analysis value
            this.highlightCurrentAnalysisButton(value);
            // Update outcome display
            const analysisElement = document.getElementById('current-analysis-value');
            if (analysisElement) {
                analysisElement.innerHTML = this.buildAnalysisDisplayWithOthers(currentRow, newOutcome);
            }
            
            this.uiController.showStatus(`Analysis saved: ${this.getAnalysisLabel(value)}`, 'success');
            
            // Check if analysis is now complete
            if (this.isAnalysisComplete()) {
                this.showCompletionMessage();
                return;
            }
            
            // Reload data in the background to get fresh updates without moving to next row
            this.reloadAllDataInBackground();
            
        } catch (error) {
            console.error('Error saving analysis:', error);
            this.uiController.showStatus(`Error saving analysis: ${error.message}`, 'error');
        }
    }

    getAnalysisLabel(value) {
        if (value === 1.0) return 'Win';
        if (value === 0.5) return 'Tie';
        if (value === 0.0) return 'Loss';
        return value.toString();
    }

    async claimRow() {
        if (this.currentRowIndex >= this.allRows.length) return;

        const currentRow = this.allRows[this.currentRowIndex];
        
        // Get user's guru signature
        let userGuruSignature = '';
        if (this.authManager && this.authManager.guruSignature) {
            userGuruSignature = this.authManager.guruSignature;
        } else {
            userGuruSignature = localStorage.getItem(CONFIG.STORAGE_KEYS.GURU_SIGNATURE) || '';
        }

        if (!userGuruSignature.trim()) {
            this.uiController.showStatus('No guru signature found. Please set your signature first.', 'error');
            return;
        }

        // Show spinner on claim button
        const claimButton = document.getElementById('claim-button');
        const originalButtonText = claimButton ? claimButton.textContent : 'Claim Match';
        if (claimButton) {
            claimButton.disabled = true;
            claimButton.innerHTML = '<span class="spinner"></span> Claiming...';
        }

        try {
            this.uiController.showStatus('Claiming match...', 'loading');

            // Use helper to get signature column index
            const signatureColIndex = this.getCurrentGuruColIndex('signature');
            console.log('🎯 Claiming match:', {
                sheetTitle: currentRow.title,
                originalRowIndex: currentRow.originalRowIndex,
                filteredRowIndex: currentRow.rowIndex,
                signatureColIndex,
                guruColor: this.currentGuruColor,
                userSignature: userGuruSignature
            });

            // Use checked update to atomically claim the match only if signature is still empty
            const updates = {
                updates: [{
                    sheetId: currentRow.sheetId,
                    row: currentRow.originalRowIndex + 1, // +1 because sheets are 1-indexed
                    col: signatureColIndex + 1, // +1 because sheets are 1-indexed
                    value: userGuruSignature,
                    expectedValue: '', // Only update if current value is empty
                    valueType: 'string',
                    isMergedGuruUpdate: true,
                    guruSheetIds: this.currentData.sheets.find(s => s.title === 'Merged Gurus')?.guruSheetIds
                }]
            };

            const result = await this.sheetsAPI.checkedUpdateSheetData(this.currentData.sheetId, updates);

            if (result && result.skippedCells > 0) {
                // Someone else claimed the match first
                this.uiController.showStatus('Match was already claimed by someone else', 'info');
                // Refresh the display to show the updated state
                await this.reloadAllDataInBackground();
                return;
            }

            // Update local data with the new signature
            switch (this.currentGuruColor) {
                case 'red':
                    currentRow.redSignature = userGuruSignature;
                    break;
                case 'blue':
                    currentRow.blueSignature = userGuruSignature;
                    break;
                case 'green':
                    currentRow.greenSignature = userGuruSignature;
                    break;
            }

            this.uiController.showStatus('Match claimed successfully!', 'success');

            // Refresh the display to show scoring buttons now that the match is claimed
            await this.showCurrentRow();

        } catch (error) {
            console.error('Error claiming match:', error);

            // Reset claim button on error
            if (claimButton) {
                claimButton.disabled = false;
                claimButton.textContent = originalButtonText;
            }
            this.uiController.showStatus(`Error claiming match: ${error.message}`, 'error');
        }
    }

    async unclaimRow() {
        if (this.currentRowIndex >= this.allRows.length) return;

        const currentRow = this.allRows[this.currentRowIndex];
        
        // Get user's guru signature to verify ownership
        let userGuruSignature = '';
        if (this.authManager && this.authManager.guruSignature) {
            userGuruSignature = this.authManager.guruSignature;
        } else {
            userGuruSignature = localStorage.getItem(CONFIG.STORAGE_KEYS.GURU_SIGNATURE) || '';
        }

        if (!userGuruSignature.trim()) {
            this.uiController.showStatus('No guru signature found.', 'error');
            return;
        }

        // Verify that the current user owns this match
        const currentRowSignature = this.getCurrentRowSignature(currentRow);
        if (currentRowSignature !== userGuruSignature) {
            this.uiController.showStatus('You can only unclaim matches that you have claimed.', 'error');
            return;
        }

        // Check if user has already scored this match
        const currentAnalysis = this.getCurrentGuruAnalysis(currentRow);
        if (currentAnalysis && currentAnalysis.trim() !== '') {
            this.uiController.showStatus('Cannot unclaim a match that has already been scored.', 'error');
            return;
        }

        // Show spinner on unclaim button
        const unclaimButton = document.getElementById('unclaim-button');
        const originalButtonText = unclaimButton ? unclaimButton.textContent : 'Unclaim Match';
        if (unclaimButton) {
            unclaimButton.disabled = true;
            unclaimButton.innerHTML = '<span class="spinner"></span> Unclaiming...';
        }

        try {
            this.uiController.showStatus('Unclaiming match...', 'loading');

            // Use helper to get signature column index
            const signatureColIndex = this.getCurrentGuruColIndex('signature');
            console.log('🎯 Unclaiming match:', {
                sheetTitle: currentRow.title,
                originalRowIndex: currentRow.originalRowIndex,
                filteredRowIndex: currentRow.rowIndex,
                signatureColIndex,
                guruColor: this.currentGuruColor,
                userSignature: userGuruSignature
            });

            // Clear the signature using clearCell helper
            const updateObj = {
                sheetId: currentRow.sheetId,
                row: currentRow.originalRowIndex + 1, // +1 because sheets are 1-indexed
                col: signatureColIndex + 1, // +1 because sheets are 1-indexed
                isMergedGuruUpdate: true,
                guruSheetIds: this.currentData.sheets.find(s => s.title === 'Merged Gurus')?.guruSheetIds
            };

            await this.sheetsAPI.clearCell(this.currentData.sheetId, updateObj);
            
            // Update local data to clear the signature
            switch (this.currentGuruColor) {
                case 'red':
                    currentRow.redSignature = '';
                    break;
                case 'blue':
                    currentRow.blueSignature = '';
                    break;
                case 'green':
                    currentRow.greenSignature = '';
                    break;
            }
            
            this.uiController.showStatus('Match unclaimed successfully!', 'success');
            
            // Refresh the display to show claim button now that the match is unclaimed
            await this.showCurrentRow();
            
        } catch (error) {
            console.error('Error unclaiming match:', error);
            
            // Reset unclaim button on error
            if (unclaimButton) {
                unclaimButton.disabled = false;
                unclaimButton.textContent = originalButtonText;
            }
            
            this.uiController.showStatus(`Error unclaiming match: ${error.message}`, 'error');
        }
    }

    /**
     * Clear the current user's analysis for the current row (when they've already scored)
     */
    async clearCurrentUserAnalysis() {
        if (this.currentRowIndex >= this.allRows.length) return;

        const currentRow = this.allRows[this.currentRowIndex];

        // Get user's guru signature to verify ownership
        const userGuruSignature = this.authManager.guruSignature;

        // Verify that the current user owns this match
        const currentRowSignature = this.getCurrentRowSignature(currentRow);
        if (currentRowSignature !== userGuruSignature) {
            this.uiController.showStatus('You can only clear results for matches you own.', 'error');
            return;
        }

        // Check if user actually has an analysis to clear
        const currentAnalysis = this.getCurrentGuruAnalysis(currentRow);
        if (!currentAnalysis || currentAnalysis.trim() === '') {
            this.uiController.showStatus('No analysis to clear for this match.', 'info');
            return;
        }

        // Disable the clear button and show spinner
        const clearButton = document.getElementById('clear-result-button');
        const originalText = clearButton ? clearButton.textContent : 'Clear My Result';
        if (clearButton) {
            clearButton.disabled = true;
            clearButton.innerHTML = '<span class="spinner"></span> Clearing...';
        }

        try {
            this.uiController.showStatus('Clearing your analysis...', 'loading');

            // Use helper to get analysis column index
            const analysisColIndex = this.getCurrentGuruColIndex('analysis');

            const updateObj = {
                sheetId: currentRow.sheetId,
                row: currentRow.originalRowIndex + 1,
                col: analysisColIndex + 1,
                // value not needed for clearCell; we signal intent via row/col
                isMergedGuruUpdate: true,
                guruSheetIds: this.currentData.sheets.find(s => s.title === 'Merged Gurus')?.guruSheetIds
            };

            await this.sheetsAPI.clearCell(this.currentData.sheetId, updateObj);

            // Update local data to clear the analysis for the current guru
            switch (this.currentGuruColor) {
                case 'red': currentRow.redAnalysis = ''; break;
                case 'blue': currentRow.blueAnalysis = ''; break;
                case 'green': currentRow.greenAnalysis = ''; break;
            }

            // Recalculate outcome
            currentRow.outcomeValue = this.calculateOutcomeFromAnalyses(
                currentRow.redAnalysis,
                currentRow.blueAnalysis,
                currentRow.greenAnalysis
            );

            this.uiController.showStatus('Your analysis was cleared.', 'success');

            // Hide clear button after clearing
            if (clearButton) clearButton.style.display = 'none';

            // Update UI for current row
            await this.showCurrentRow();

        } catch (error) {
            console.error('Error clearing analysis:', error);
            if (clearButton) {
                clearButton.disabled = false;
                clearButton.textContent = originalText;
            }
            this.uiController.showStatus(`Error clearing analysis: ${error.message}`, 'error');
        }
    }

    async reloadAllData() {
        try {
            // Get fresh data for the entire sheet
            const freshSheetData = await this.sheetsAPI.getSheetData(this.currentData.sheetId);
            
            // Store the current row index to restore position
            const currentRowIndex = this.currentRowIndex;
            
            // Reload all data (this will rebuild this.allRows with fresh data)
            await this.loadData(freshSheetData);
            
            // Restore position to the same row (or closest valid row)
            this.currentRowIndex = Math.min(currentRowIndex, this.allRows.length - 1);

            // Show the current row with fresh data
            await this.showCurrentRow();
            
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
            const freshSheetData = await this.sheetsAPI.getSheetData(this.currentData.sheetId);
            
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
        // Collect other guru analyses (exclude the current guru's analysis)
        const otherAnalyses = [];
        
        // Show analyses from other gurus based on current guru color
        if (this.currentGuruColor !== 'red' && currentRow.redAnalysis) {
            otherAnalyses.push({ name: 'Red', value: currentRow.redAnalysis });
        }
        if (this.currentGuruColor !== 'blue' && currentRow.blueAnalysis) {
            otherAnalyses.push({ name: 'Blue', value: currentRow.blueAnalysis });
        }
        if (this.currentGuruColor !== 'green' && currentRow.greenAnalysis) {
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

    buildAnalysisDisplayWithOthers(currentRow, outcomeValue = '') {
        // Get current guru's analysis
        const currentGuruAnalysis = this.getCurrentGuruAnalysis(currentRow);
        
        // Collect all guru analyses (including current guru)
        const allAnalyses = [];
        
        // Add current guru's analysis first
        const currentGuruName = this.currentGuruColor.charAt(0).toUpperCase() + this.currentGuruColor.slice(1);
        allAnalyses.push({ 
            name: currentGuruName, 
            value: currentGuruAnalysis, 
            isCurrent: true 
        });

        const showOtherGurus = currentGuruAnalysis && currentGuruAnalysis.trim() !== '';
        
        // Add other guru analyses
        if (this.currentGuruColor !== 'red') {
            allAnalyses.push({ name: 'Red', value: currentRow.redAnalysis, isCurrent: false });
        }
        if (this.currentGuruColor !== 'blue') {
            allAnalyses.push({ name: 'Blue', value: currentRow.blueAnalysis, isCurrent: false });
        }
        if (this.currentGuruColor !== 'green') {
            allAnalyses.push({ name: 'Green', value: currentRow.greenAnalysis, isCurrent: false });
        }
        
        // Build the simple list HTML
        let html = '<div class="analysis-list">';
        
        // Show outcome header for all cases
        const outcomeDisplay = this.getOutcomeDisplayName(outcomeValue);
        html += `<div class="outcome-header">${outcomeDisplay}</div>`;
        
        html += '<ul class="guru-analyses-list">';
        
        allAnalyses.forEach(analysis => {
            const displayValue = showOtherGurus || !analysis.value ? this.formatAnalysisValue(analysis.value) : '███';
            const cssClass = showOtherGurus ? this.getAnalysisClass(analysis.value) : 'other';
            const prefix = analysis.isCurrent ? 'You' : analysis.name;
            
            html += `<li class="guru-analysis-item">
                <span class="guru-analysis-label">${prefix}:</span> 
                <span class="analysis-result ${cssClass}">${displayValue}</span>
            </li>`;
        });
        
        html += '</ul></div>';
        
        return html;
    }

    /**
     * Returns the column index for the current guru color and type ('analysis' or 'signature')
     */
    getCurrentGuruColIndex(type = 'analysis') {
        switch (type) {
            case 'analysis':
                switch (this.currentGuruColor) {
                    case 'red':
                        return this.redAnalysisColIndex;
                    case 'blue':
                        return this.blueAnalysisColIndex;
                    case 'green':
                        return this.greenAnalysisColIndex;
                }
                break;
            case 'signature':
                switch (this.currentGuruColor) {
                    case 'red':
                        return this.redSignatureColIndex;
                    case 'blue':
                        return this.blueSignatureColIndex;
                    case 'green':
                        return this.greenSignatureColIndex;
                }
                break;
        }
        return -1;
    }
    
    getOutcomeDisplayName(outcomeValue) {
        if (!outcomeValue || outcomeValue.trim() === '') return '';
        
        const value = outcomeValue.toLowerCase().trim();
        
        // Handle special outcome values
        if (value === 'discrepancy') return 'Discrepancy';
        if (value === 'incomplete') return 'Incomplete';
        
        // Try to parse as numeric value for consistent display
        const numValue = parseFloat(outcomeValue);
        if (!isNaN(numValue)) {
            if (numValue === 1.0) return 'Win';
            if (numValue === 0.5) return 'Tie';
            if (numValue === 0.0) return 'Loss';
            return `Custom (${numValue})`;
        }
        
        // Return the original value with proper capitalization
        return outcomeValue.charAt(0).toUpperCase() + outcomeValue.slice(1).toLowerCase();
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

    async previousRow() {
        if (this.currentRowIndex > 0) {
            this.currentRowIndex--;
            await this.showCurrentRow();
        }
    }

    async skipToNextIncomplete() {
        // Find the next empty starting from after current row
        const nextIncompleteIndex = this.findFirstEmptyAnalysis(this.currentRowIndex + 1);
        
        // Check if we found a row after the current one
        if (nextIncompleteIndex != null && nextIncompleteIndex != this.currentRowIndex) {
            this.currentRowIndex = nextIncompleteIndex;
            await this.showCurrentRow();
        } else {
            // No more incomplete rows found after current, show completion message
            this.showCompletionMessage();
        }
    }

    async skipToNextDiscrepancy() {
        // Find the next row with discrepancy starting from after current row
        const result = this.findFirstDiscrepancy(this.currentRowIndex + 1);
        this.currentRowIndex = result.index;
        // If a color was returned for the found row, switch to that guru color
        if (result.color) {
            this.currentGuruColor = result.color;
        }
        await this.showCurrentRow();
    }

    showCompletionMessage() {
        this.uiController.showStatus('All rows analysed! Great work!', 'success');
    }

    showNoDataMessage() {
        const analysisInterface = document.getElementById('guru-analysis-interface');
        analysisInterface.innerHTML = `
            <div class="empty-state">
                <h3>No Analysis Data Found</h3>
                <p>No rows found with the required columns:</p>
                <ul>
                    <li>Player 1</li>
                    <li>Player 2</li>
                    <li>Guru Analysis columns (Red, Blue, Green)</li>
                </ul>
                <p>Please check that your sheets have the correct column headers and data.</p>
            </div>
        `;
    }

    showDeckNotesEditor(notesData) {
        this.updateURL();
        if (!this.deckNotesEditor) {
            // Create a new instance if it doesn't exist
            this.deckNotesEditor = new DeckNotesEditor({
                analysisInterface: this,
                uiController: this.uiController,
                scryfallAPI: this.scryfallAPI,
                sheetsAPI: this.sheetsAPI,
                spreadsheetID: this.currentData.sheetId,
            });
        } else {
            // Update references in case they changed
            this.deckNotesEditor.uiController = this.uiController;
            this.deckNotesEditor.scryfallAPI = this.scryfallAPI;
            this.deckNotesEditor.sheetsAPI = this.sheetsAPI;
            this.deckNotesEditor.spreadsheetID = this.currentData.sheetId;
        }
        this.deckNotesEditor.show(notesData, this.currentData.title);
    }

    calculateColorStatistics(sheetData) {
        // Find the merged guru sheet
        const mergedGuruSheet = sheetData.sheets?.find(sheet => 
            sheet.title === 'Merged Gurus'
        );

        if (!mergedGuruSheet || !mergedGuruSheet.values || mergedGuruSheet.values.length < 2) {
            return { red: { claimed: 0, total: 0 }, blue: { claimed: 0, total: 0 }, green: { claimed: 0, total: 0 } };
        }

        const headerRow = mergedGuruSheet.values[0];
        
        // Find columns
        const player1ColIndex = this.findColumnIndex(headerRow, ['Player 1', 'Player1']);
        const player2ColIndex = this.findColumnIndex(headerRow, ['Player 2', 'Player2']);
        const redSignatureColIndex = this.findColumnIndex(headerRow, ['Red Signature']);
        const blueSignatureColIndex = this.findColumnIndex(headerRow, ['Blue Signature']);
        const greenSignatureColIndex = this.findColumnIndex(headerRow, ['Green Signature']);

        const stats = {
            red: { claimed: 0, total: 0 },
            blue: { claimed: 0, total: 0 },
            green: { claimed: 0, total: 0 }
        };

        // Count matches for each color
        for (let rowIndex = 1; rowIndex < mergedGuruSheet.values.length; rowIndex++) {
            const row = mergedGuruSheet.values[rowIndex];
            const player1 = row[player1ColIndex] || '';
            const player2 = row[player2ColIndex] || '';
            
            // Only count rows that have player data (actual matches)
            if (player1.trim() || player2.trim()) {
                stats.red.total++;
                stats.blue.total++;
                stats.green.total++;

                // Check if each color is claimed
                if (redSignatureColIndex !== -1 && row[redSignatureColIndex] && row[redSignatureColIndex].trim() !== '') {
                    stats.red.claimed++;
                }
                if (blueSignatureColIndex !== -1 && row[blueSignatureColIndex] && row[blueSignatureColIndex].trim() !== '') {
                    stats.blue.claimed++;
                }
                if (greenSignatureColIndex !== -1 && row[greenSignatureColIndex] && row[greenSignatureColIndex].trim() !== '') {
                    stats.green.claimed++;
                }
            }
        }

        return stats;
    }

    showGuruColorSelection(sheetData) {
        // Hide the existing guru analysis interface instead of overwriting it
        const analysisInterface = document.getElementById('guru-analysis-interface');
        analysisInterface.style.display = 'none';
        
        // Create a new color selection container
        const colorSelectionContainer = document.createElement('div');
        colorSelectionContainer.id = 'color-selection-container';
        colorSelectionContainer.className = 'color-selection-container full-screen';
        
        const stats = this.calculateColorStatistics(sheetData);
        const sheetTitle = sheetData.title || 'Unknown Sheet';
        
        colorSelectionContainer.innerHTML = `
            <div class="color-selection-screen">
                <h3>Choose Your Guru Color</h3>
                <h4 class="sheet-title">Pod: ${sheetTitle}</h4>
                <p>Your signature was not found in any existing analysis. Please select which guru color you want to use for analysis:</p>
                
                <div class="color-options">
                    <div class="color-option" id="color-red">
                        <div class="color-circle red"></div>
                        <div class="color-info">
                            <h4>Red Guru</h4>
                            <p>${stats.red.claimed} / ${stats.red.total} matches claimed</p>
                        </div>
                        <button class="select-color-btn" data-color="red">Select Red</button>
                    </div>
                    
                    <div class="color-option" id="color-blue">
                        <div class="color-circle blue"></div>
                        <div class="color-info">
                            <h4>Blue Guru</h4>
                            <p>${stats.blue.claimed} / ${stats.blue.total} matches claimed</p>
                        </div>
                        <button class="select-color-btn" data-color="blue">Select Blue</button>
                    </div>
                    
                    <div class="color-option" id="color-green">
                        <div class="color-circle green"></div>
                        <div class="color-info">
                            <h4>Green Guru</h4>
                            <p>${stats.green.claimed} / ${stats.green.total} matches claimed</p>
                        </div>
                        <button class="select-color-btn" data-color="green">Select Green</button>
                    </div>
                </div>
                
                <p class="color-selection-note">You can start analysing matches by claiming unclaimed matches or work on matches already assigned to your chosen color.</p>
            </div>
        `;
        
        // Insert the color selection container after the analysis interface
        analysisInterface.parentNode.insertBefore(colorSelectionContainer, analysisInterface.nextSibling);
        
        // Add event listeners for color selection
        colorSelectionContainer.querySelectorAll('.select-color-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const selectedColor = e.target.getAttribute('data-color');
                this.selectGuruColor(selectedColor, sheetData, colorSelectionContainer);
            });
        });
    }

    async selectGuruColor(color, sheetData, colorSelectionContainer) {
        console.log(`User selected guru color: ${color}`);
        
        // Set the guru color
        this.currentGuruColor = color;
        
        // Remove the color selection container
        if (colorSelectionContainer && colorSelectionContainer.parentNode) {
            colorSelectionContainer.parentNode.removeChild(colorSelectionContainer);
        }
        
        // Show the analysis interface again
        const analysisInterface = document.getElementById('guru-analysis-interface');
        analysisInterface.style.display = '';
        
        // Ensure the sheet editor is visible before loading data
        this.uiController.showSheetEditor();
        
        // Continue with the normal data loading process, but skip guru color determination
        await this.loadData(sheetData, color);
        await this.showCurrentRow();
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

        // Check if we have deck notes for this deck
        if (!this.deckNotesMap) {
            console.log('No deckNotesMap available');
            return;
        }
                
        if (!this.deckNotesMap.has(deckString)) {
            console.log('No deck notes found for:', deckString);
            return;
        }

        const deckInfo = this.deckNotesMap.get(deckString);
        console.log('Found deck info:', deckInfo);
        
        const infoElements = [];

        // Add goldfish clock, notes, and additional notes
        infoElements.push(`<span class="deck-clock">Clock: <span class="notes-value">${deckInfo.goldfishClock || ''}</span> <button class="edit-deck-info-btn" data-type="clock" title="Edit Clock">✎</button></span>`);
        infoElements.push(`<span class="deck-notes"><span class="notes-value">${deckInfo.notes || ''}</span> <button class="edit-deck-info-btn" data-type="notes" title="Edit Notes">✎</button></span>`);
        infoElements.push(`<hr class="deck-separator">`);
        infoElements.push(`<span class="deck-additional"><span class="notes-value">${deckInfo.additionalNotes || ''}</span> <button class="edit-deck-info-btn" data-type="additionalNotes" title="Edit Additional Notes">✎</button></span>`);


        const deckInfoDiv = document.getElementById(`${playerId}-deck-info`);
        deckInfoDiv.innerHTML = infoElements.join(' ');

        // --- Editing logic for deck info fields (auto-save on blur, Enter/Escape behavior) ---
        const handleEditClick = (e) => {
            const btn = e.target.closest('.edit-deck-info-btn');
            if (!btn) return;
            const type = btn.getAttribute('data-type');
            const span = btn.closest('span');
            if (!span) return;

            // Get current value from the parent span of the button
            const currentValue = span.querySelector('.notes-value').textContent || '';

            // Create input
            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentValue;
            input.className = 'deck-info-edit-input';
            input.setAttribute('aria-label', 'Edit deck info');
            input.style.width = '70%';

            // Replace span content
            const originalHTML = span.innerHTML;
            span.innerHTML = '';
            span.appendChild(input);
            input.focus();

            let escapePressed = false;

            // Save logic: only if changed
            const doSaveIfChanged = async () => {
                const newValue = input.value;
                // Restore original HTML
                span.innerHTML = originalHTML;
                // Re-attach the edit button listener
                span.querySelector('.edit-deck-info-btn').addEventListener('click', handleEditClick);
                if (newValue !== currentValue) {
                    this.uiController.showStatus(`Saving ${type} changes...`, 'loading');
                    // Find row and column indices in the Deck Notes sheet
                    const deckInfo = this.deckNotesMap.get(deckString) || {};
                    const row = deckInfo.row;
                    const colMap = { clock: 1, notes: 2, additionalNotes: 3 };
                    const col = colMap[type];
                    // Find the "Deck Notes" sheet
                    const deckNotesSheet = this.currentData.sheets.find(sheet => 
                        sheet.title && sheet.title.toLowerCase().includes('deck notes')
                    );
                    // Do a checked update to save the edited cell
                    const updates = {
                        updates: [{
                            sheetId: deckNotesSheet.sheetId,
                            row: row + 1, // +1 because sheets are 1-indexed
                            col: col + 1, // +1 because sheets are 1-indexed
                            value: newValue,
                            expectedValue: currentValue, // Only update if current value matches old content
                            valueType: 'auto-detect',
                        }]
                    };
                    const result = await this.sheetsAPI.checkedUpdateSheetData(this.currentData.sheetId, updates);
                    
                    if (result && result.skippedCells == 0) {
                        if (type === 'clock') deckInfo.goldfishClock = newValue;
                        else if (type === 'notes') deckInfo.notes = newValue;
                        else if (type === 'additionalNotes') deckInfo.additionalNotes = newValue;
                        this.deckNotesMap.set(deckString, { ...deckInfo });
                        const notesValueSpan = span.querySelector('.notes-value');
                        if (notesValueSpan) {
                            notesValueSpan.textContent = newValue;
                        }
                        this.uiController.showStatus(`${type.charAt(0).toUpperCase() + type.slice(1)} saved successfully!`, 'success');
                    } else {
                        this.uiController.showStatus(`Failed to save ${type} changes. The original data may have been modified.`, 'info');
                        console.warn(`Failed to save ${type} changes:`, result);
                    }
                }
            };

            input.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter') {
                    input.blur();
                } else if (ev.key === 'Escape') {
                    input.value = currentValue;
                    input.blur();
                }
            });

            input.addEventListener('blur', doSaveIfChanged);
        };

        deckInfoDiv.querySelectorAll('.edit-deck-info-btn').forEach(btn => {
            btn.addEventListener('click', handleEditClick);
        });

        console.log('Deck info displayed successfully');
    }

    // --- MATCH TABLE MODAL ---
    showMatchTableModal() {
        // Remove any existing modal
        this.closeMatchTableModal();

        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'match-table-overlay';

        // Modal container
        const modal = document.createElement('div');
        modal.className = 'match-table-modal';

        // Table
        const table = document.createElement('table');
        table.className = 'match-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>#</th>
                    <th>Player 1 Deck</th>
                    <th>Player 2 Deck</th>
                    <th>Signature</th>
                </tr>
            </thead>
            <tbody>
                ${this.allRows.map((row, idx) => {
                    const sig = this.getCurrentRowSignature(row) || '';
                    const highlight = idx === this.currentRowIndex ? 'current-row' : '';
                    return `<tr data-row="${idx}" class="${highlight}">
                        <td>${idx + 1}</td>
                        <td>${row.player1}</td>
                        <td>${row.player2}</td>
                        <td>${sig}</td>
                    </tr>`;
                }).join('')}
            </tbody>
        `;
        modal.appendChild(table);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Row click: jump to match
        table.addEventListener('click', (e) => {
            const tr = e.target.closest('tr[data-row]');
            if (tr) {
                const idx = parseInt(tr.getAttribute('data-row'), 10);
                this.currentRowIndex = idx;
                this.showCurrentRow();
                this.closeMatchTableModal();
            }
        });

        // Click outside modal closes if a row is selected
        overlay.addEventListener('mousedown', (e) => {
            if (e.target === overlay && this.currentRowIndex >= 0) {
                this.showCurrentRow();
                this.closeMatchTableModal();
            }
        });

        // Auto-scroll to the current match row
        requestAnimationFrame(() => {
            const currentRow = table.querySelector('tr.current-row');
            if (currentRow) {
                currentRow.scrollIntoView({ block: 'center', behavior: 'auto' });
            }
        });
    }

    closeMatchTableModal() {
        const existing = document.querySelector('.match-table-overlay');
        if (existing) existing.remove();
    }
}
