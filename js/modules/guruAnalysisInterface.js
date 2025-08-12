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
        this.currentGuruColor = null;
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
            sheet.sheetTitle === 'Merged Gurus'
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
        throw new Error(`Guru signature "${currentSignature}" not found in any analysis column. Please check that you have matches assigned to analyze.`);
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
            this.uiController.showStatus(`Switching to ${newColor} guru...`, 'loading');
            
            const oldColor = this.currentGuruColor;
            this.currentGuruColor = newColor;
            
            console.log(`Switching guru color from ${oldColor} to ${newColor}`);
            
            // Update the display immediately
            this.updateGuruColorDisplay();
            // Show the current row with the new guru color perspective
            await this.showCurrentRow();
            
            this.uiController.showStatus(`Switched to ${newColor} guru successfully`, 'success');
            
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


    async loadData(sheetData, guruColorAlreadyDetermined = false, showMatchTable = false) {
        this.currentData = sheetData;
        
        if (!guruColorAlreadyDetermined) {
            try {
                // Determine the current guru color from the actual sheet data
                this.currentGuruColor = this.determineGuruColorFromSheet(sheetData);
                console.log(`Determined guru color: ${this.currentGuruColor}`);
            } catch (error) {
                console.error('Error determining guru color:', error);
                
                // Check if this is a "signature not found" error - offer color selection
                if (error.message.includes('not found in any analysis column')) {
                    this.showGuruColorSelection(sheetData);
                    return;
                } else {
                    this.showGuruSignatureError(error.message);
                    return;
                }
            }
        }
        
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
            if (showMatchTable) {
                // Show the match picker directly
                this.showMatchTableModal();
            }
            else if (this.isAnalysisComplete()) {
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
        
        // Handle different sheet types
        if (sheet.sheetTitle === 'Merged Gurus') {
            // For merged guru sheet, use the merged column structure
            this.processMergedGuruSheet(sheet, sheetIndex);
        } else {
            // For deck notes or other sheets, skip processing
            console.log(`Skipping sheet "${sheet.sheetTitle}" - not a guru analysis sheet`);
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

        // Process data rows (skip header)
        for (let rowIndex = 1; rowIndex < sheet.values.length; rowIndex++) {
            const row = sheet.values[rowIndex];
            
            // Get the original row index from the backend filtering
            const originalRowIndex = sheet.originalRowIndices ? sheet.originalRowIndices[rowIndex] : rowIndex;

            const player1 = row[player1ColIndex] || '';
            const player2 = row[player2ColIndex] || '';
            const redAnalysis = row[this.redAnalysisColIndex] || '';
            const blueAnalysis = row[this.blueAnalysisColIndex] || '';
            const greenAnalysis = row[this.greenAnalysisColIndex] || '';
            const redSignature = row[this.redSignatureColIndex] || '';
            const blueSignature = row[this.blueSignatureColIndex] || '';
            const greenSignature = row[this.greenSignatureColIndex] || '';

            // Calculate outcome based on all guru analyses
            const outcomeValue = this.calculateOutcomeFromAnalyses(redAnalysis, blueAnalysis, greenAnalysis);

            // Only include rows that have player data
            if (player1.trim() || player2.trim()) {
                this.allRows.push({
                    sheetIndex,
                    sheetTitle: sheet.sheetTitle,
                    sheetId: sheet.sheetId,
                    rowIndex,
                    player1: player1.trim(),
                    player2: player2.trim(),
                    outcomeValue: outcomeValue,
                    redAnalysis: redAnalysis.toString().trim(),
                    blueAnalysis: blueAnalysis.toString().trim(),
                    greenAnalysis: greenAnalysis.toString().trim(),
                    redSignature: redSignature.toString().trim(),
                    blueSignature: blueSignature.toString().trim(),
                    greenSignature: greenSignature.toString().trim(),
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
        // Check if all rows have analysis and no discrepancies
        for (let i = 0; i < this.allRows.length; i++) {
            const row = this.allRows[i];
            
            // Check for empty analysis using the helper method
            const currentAnalysis = this.getCurrentGuruAnalysis(row);
            if (!currentAnalysis || currentAnalysis.trim() === '') {
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
        // Get the current guru signature for filtering
        let currentSignature = '';
        if (this.authManager && this.authManager.guruSignature) {
            currentSignature = this.authManager.guruSignature;
        } else {
            currentSignature = localStorage.getItem(CONFIG.STORAGE_KEYS.GURU_SIGNATURE) || '';
        }

        // Phase 1: Look for incomplete/discrepant rows that belong to current guru (have current guru's signature)
        
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
                
                // Check for discrepancies
                if (row.outcomeValue && row.outcomeValue.toLowerCase().trim() === 'discrepancy') {
                    return i;
                }
            }
        }
        
        // If no incomplete analysis found from startFromIndex to end, loop back and search from beginning to startFromIndex
        if (startFromIndex > 0) {
            for (let i = 0; i < startFromIndex; i++) {
                const row = this.allRows[i];
                
                // Check if this row has the current guru's signature
                if (this.rowHasCurrentGuruSignature(row, currentSignature)) {
                    // Check for empty analysis
                    const currentAnalysis = this.getCurrentGuruAnalysis(row);
                    if (!currentAnalysis || currentAnalysis.trim() === '') {
                        return i;
                    }
                    
                    // Check for discrepancies
                    if (row.outcomeValue && row.outcomeValue.toLowerCase().trim() === 'discrepancy') {
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
            for (let i = 0; i < startFromIndex; i++) {
                const row = this.allRows[i];
                
                // Check if this row has empty guru signature (unclaimed)
                if (this.rowHasEmptySignature(row)) {
                    return i;
                }
            }
        }
        
        // If no empty signature or analysis found, return the start index or 0
        return startFromIndex === 0 ? 0 : startFromIndex;
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
        if (this.currentRowIndex >= this.allRows.length) {
            this.showCompletionMessage();
            return;
        }

        const currentRow = this.allRows[this.currentRowIndex];
        
        // Update progress info
        document.getElementById('current-row-info').textContent = 
            `Row ${this.currentRowIndex + 1} of ${this.allRows.length}`;
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

        // Check if current guru has provided an analysis - independent of outcome value
        const currentGuruAnalysis = this.getCurrentGuruAnalysis(currentRow);
        if (currentGuruAnalysis && currentGuruAnalysis.trim() !== '') {
            // Show current guru's analysis with other gurus' analyses
            analysisElement.innerHTML = this.buildAnalysisDisplayWithOthers(currentRow, currentRow.outcomeValue || '');
        }

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
        const unclaimButton = document.getElementById('unclaim-button');
        
        if (isRowClaimedByAnotherGuru) {
            // Hide scoring buttons, claim button, and unclaim button, show claimed message
            scoringButtons.forEach(btn => btn.style.display = 'none');
            if (claimButton) claimButton.style.display = 'none';
            if (unclaimButton) unclaimButton.style.display = 'none';
            
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
            const claimDeckBtn = document.getElementById('claim-deck-button');
            if (claimDeckBtn) claimDeckBtn.style.display = 'none';

            // Check if user has scored this match yet
            const currentAnalysis = this.getCurrentGuruAnalysis(currentRow);
            const hasUserScored = currentAnalysis && currentAnalysis.trim() !== '';
            
            // Show/hide unclaim button based on whether user has scored
            const unclaimButton = document.getElementById('unclaim-button');
            if (!hasUserScored) {
                // User has claimed but not scored - show unclaim button
                if (unclaimButton) {
                    unclaimButton.style.display = 'block';
                    // Reset unclaim button in case it is in "Unclaiming..." state
                    unclaimButton.disabled = false;
                    unclaimButton.textContent = 'Unclaim Match';
                } else {
                    // Create unclaim button if it doesn't exist
                    const newUnclaimButton = document.createElement('button');
                    newUnclaimButton.id = 'unclaim-button';
                    newUnclaimButton.className = 'unclaim-btn secondary-btn';
                    newUnclaimButton.textContent = 'Unclaim Match';
                    newUnclaimButton.addEventListener('click', () => this.unclaimRow());
                    // Insert after the skip button
                    const skipButton = document.getElementById('skip-btn');
                    if (skipButton) {
                        skipButton.insertAdjacentElement('afterend', newUnclaimButton);
                    }
                }
            } else {
                // User has scored - hide unclaim button
                if (unclaimButton) unclaimButton.style.display = 'none';
            }
            
            // Highlight the appropriate button based on current guru analysis value
            const currentAnalysisValue = currentAnalysis ? parseFloat(currentAnalysis) : null;
            this.highlightCurrentAnalysisButton(currentAnalysisValue);
        }

        // Update navigation buttons
        document.getElementById('prev-btn').disabled = this.currentRowIndex === 0;
        document.getElementById('next-btn').disabled = this.currentRowIndex >= this.allRows.length - 1;

        // Hide completion message
        document.getElementById('completion-message').style.display = 'none';

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
        const allDeckRows = this.allRows.filter(row => row.player1 === player1Deck);
        // Find all unclaimed rows with the same Player 1 deck
        const rowsToClaim = allDeckRows.filter(row => {
            let sig = '';
            switch (this.currentGuruColor) {
                case 'red': sig = row.redSignature; break;
                case 'blue': sig = row.blueSignature; break;
                case 'green': sig = row.greenSignature; break;
            }
            return !sig || sig.trim() === '';
        });

        console.log(`🎯 Found ${allDeckRows.length} matches for deck "${player1Deck}" (${rowsToClaim.length} unclaimed)`);

        if (allDeckRows.length === 0) {
            this.uiController.showStatus('No matches found for this deck.', 'error');
            return;
        }

        if (rowsToClaim.length === 0) {
            this.uiController.showStatus(`All ${allDeckRows.length} matches for this deck are already claimed.`, 'error');
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
                    guruSheetIds: this.currentData.sheets.find(s => s.sheetTitle === 'Merged Gurus')?.guruSheetIds
                };
            })
        };

        try {
            this.uiController.showStatus(`Claiming ${rowsToClaim.length} of ${allDeckRows.length} matches for deck...`, 'loading');
            const result = await this.sheetsAPI.checkedUpdateSheetData(this.currentData.sheetId, updates);

            // Update local data for only those that were actually claimed
            let actuallyClaimed = 0;
            if (result && result.updatedCells) {
                // Only update local data for rows that were not skipped
                const claimedRows = [];
                // Build a set of claimed (row,col) for fast lookup
                const claimedSet = new Set(
                    updates.updates
                        .map((u, i) => result.skipped && result.skipped.some(s => s.row === u.row && s.col === u.col) ? null : i)
                        .filter(i => i !== null)
                );
                rowsToClaim.forEach((row, i) => {
                    // Find the matching row in this.allRows by originalRowIndex and sheetId
                    const match = this.allRows.find(r => r.originalRowIndex === row.originalRowIndex && r.sheetId === row.sheetId);
                    if (!match) return;
                    if (claimedSet.has(i)) {
                        switch (this.currentGuruColor) {
                            case 'red': match.redSignature = userGuruSignature; break;
                            case 'blue': match.blueSignature = userGuruSignature; break;
                            case 'green': match.greenSignature = userGuruSignature; break;
                        }
                        actuallyClaimed++;
                    } else {
                        // This row is claimed, set the signature to a placeholder
                        switch (this.currentGuruColor) {
                            case 'red': match.redSignature = 'unknown'; break;
                            case 'blue': match.blueSignature = 'unknown'; break;
                            case 'green': match.greenSignature = 'unknown'; break;
                        }
                    }
                });
            }

            this.uiController.showStatus(`Claimed ${actuallyClaimed} of ${allDeckRows.length} matches for this deck.`, 'success');
            console.log(`🎯 Claimed ${actuallyClaimed} matches for deck "${player1Deck}" (${allDeckRows.length} total)`);
            console.log('🎯 Updated local data:', this.allRows.filter(r => r.player1 === player1Deck));
            await this.showCurrentRow();

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

            // Use helper to get analysis column index
            const analysisColIndex = this.getCurrentGuruColIndex('analysis');
            console.log('🎯 Updating cell:', {
                sheetTitle: currentRow.sheetTitle,
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
                    guruSheetIds: this.currentData.sheets.find(s => s.sheetTitle === 'Merged Gurus')?.guruSheetIds
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
                sheetTitle: currentRow.sheetTitle,
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
                    guruSheetIds: this.currentData.sheets.find(s => s.sheetTitle === 'Merged Gurus')?.guruSheetIds
                }]
            };

            await this.sheetsAPI.checkedUpdateSheetData(this.currentData.sheetId, updates);
            
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
            
            // Check if this was a race condition (someone else claimed it)
            if (error.message.includes('values changed')) {
                this.uiController.showStatus('Match was already claimed by someone else', 'error');
                // Refresh the display to show the updated state
                await this.reloadAllDataInBackground();
            } else {
                this.uiController.showStatus(`Error claiming match: ${error.message}`, 'error');
            }
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
                sheetTitle: currentRow.sheetTitle,
                originalRowIndex: currentRow.originalRowIndex,
                filteredRowIndex: currentRow.rowIndex,
                signatureColIndex,
                guruColor: this.currentGuruColor,
                userSignature: userGuruSignature
            });

            // Clear the signature by setting it to empty string
            const updates = {
                updates: [{
                    sheetId: currentRow.sheetId,
                    row: currentRow.originalRowIndex + 1, // +1 because sheets are 1-indexed
                    col: signatureColIndex + 1, // +1 because sheets are 1-indexed
                    value: '',
                    valueType: 'string',
                    isMergedGuruUpdate: true,
                    guruSheetIds: this.currentData.sheets.find(s => s.sheetTitle === 'Merged Gurus')?.guruSheetIds
                }]
            };

            await this.sheetsAPI.updateSheetData(this.currentData.sheetId, updates);
            
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
            
            try {
                // Update guru color in case signature changed
                this.currentGuruColor = this.determineGuruColorFromSheet(freshSheetData);
                console.log(`Updated guru color: ${this.currentGuruColor}`);
            } catch (error) {
                console.warn('Error determining guru color during background refresh:', error);
                // Don't throw error in background refresh, just log it
                return;
            }
            
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
        if (currentGuruAnalysis && currentGuruAnalysis.trim() !== '') {
            const currentGuruName = this.currentGuruColor.charAt(0).toUpperCase() + this.currentGuruColor.slice(1);
            allAnalyses.push({ 
                name: currentGuruName, 
                value: currentGuruAnalysis, 
                isCurrent: true 
            });
        }
        
        // Add other guru analyses
        if (this.currentGuruColor !== 'red' && currentRow.redAnalysis && currentRow.redAnalysis.trim() !== '') {
            allAnalyses.push({ name: 'Red', value: currentRow.redAnalysis, isCurrent: false });
        }
        if (this.currentGuruColor !== 'blue' && currentRow.blueAnalysis && currentRow.blueAnalysis.trim() !== '') {
            allAnalyses.push({ name: 'Blue', value: currentRow.blueAnalysis, isCurrent: false });
        }
        if (this.currentGuruColor !== 'green' && currentRow.greenAnalysis && currentRow.greenAnalysis.trim() !== '') {
            allAnalyses.push({ name: 'Green', value: currentRow.greenAnalysis, isCurrent: false });
        }
        
        // Build the simple list HTML
        let html = '<div class="analysis-list">';
        
        // Show outcome header for all cases
        if (outcomeValue && outcomeValue.trim() !== '') {
            const outcomeDisplay = this.getOutcomeDisplayName(outcomeValue);
            html += `<div class="outcome-header">${outcomeDisplay}</div>`;
        }
        
        html += '<ul class="guru-analyses-list">';
        
        allAnalyses.forEach(analysis => {
            const displayValue = this.formatAnalysisValue(analysis.value);
            const cssClass = this.getAnalysisClass(analysis.value);
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

    calculateColorStatistics(sheetData) {
        // Find the merged guru sheet
        const mergedGuruSheet = sheetData.sheets?.find(sheet => 
            sheet.sheetTitle === 'Merged Gurus'
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
        colorSelectionContainer.className = 'color-selection-container';
        
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
                
                <p class="color-selection-note">You can start analyzing matches by claiming unclaimed matches or work on matches already assigned to your chosen color.</p>
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
        // Skip the loading state to avoid DOM element conflicts
        await this.loadData(sheetData, true);
        this.showMatchTableModal();
    }

    showGuruSignatureError(errorMessage) {
        const analysisInterface = document.getElementById('guru-analysis-interface');
        const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${this.currentData.sheetId}/edit`;
        
        analysisInterface.innerHTML = `
            <div class="empty-state">
                <h3>Guru Signature Not Found</h3>
                <p>${errorMessage}</p>
                <p>This could happen if:</p>
                <ul>
                    <li>You haven't been assigned any matches to analyze yet</li>
                    <li>Your guru signature doesn't match any signatures in the sheet</li>
                    <li>The sheet structure has changed</li>
                </ul>
                <p>Please check your guru signature settings and the sheet.</p>
                <p><a href="${spreadsheetUrl}" target="_blank" rel="noopener noreferrer" class="spreadsheet-link">Open Spreadsheet in Google Sheets</a></p>
                <button id="retry-load-btn" class="primary-btn" style="margin-top: 16px;">Retry</button>
            </div>
        `;
        
        // Add retry functionality
        document.getElementById('retry-load-btn').addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('refreshAnalysis'));
        });
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

        // Click outside modal closes
        overlay.addEventListener('mousedown', (e) => {
            if (e.target === overlay) {
                this.closeMatchTableModal();
            }
        });
    }

    closeMatchTableModal() {
        const existing = document.querySelector('.match-table-overlay');
        if (existing) existing.remove();
    }
}
