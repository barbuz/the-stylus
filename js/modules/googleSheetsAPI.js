export class GoogleSheetsAPI {
    constructor(authManager) {
        this.authManager = authManager;
    }

    async getSheetData(sheetId) {
        try {
            if (!this.authManager.isLoggedIn()) {
                throw new Error('User not authenticated');
            }

            // Get metadata first to find all sheets
            const metadata = await this.getSheetMetadata(sheetId);
            
            // Check for optional metadata sheet and start loading it in parallel
            const metadataSheet = metadata.sheets.find(sheet => 
                sheet.title.toLowerCase() === 'metadata'
            );
            const customMetadataPromise = metadataSheet 
                ? this.getCustomMetadata(sheetId, metadataSheet)
                : Promise.resolve({});
            
            // Only process specific sheets needed for the application
            const requiredSheetNames = ['Deck Notes', 'Red Gurus', 'Blue Gurus', 'Green Gurus'];
            const sheetsToProcess = metadata.sheets.filter(sheet => 
                requiredSheetNames.some(requiredName => 
                    sheet.title.toLowerCase().includes(requiredName.toLowerCase())
                )
            );

            console.log(`Processing sheets: ${sheetsToProcess.map(s => s.title).join(', ')}`);

            const allSheetsData = [];

            // Process Deck Notes sheet separately
            const deckNotesSheet = sheetsToProcess.find(sheet => 
                sheet.title.toLowerCase().includes('deck notes')
            );
            
            if (deckNotesSheet) {
                const deckNotesData = await this.getDeckNotes(sheetId, deckNotesSheet);
                allSheetsData.push(deckNotesData);
            }

            // Process and merge guru sheets
            const guruSheets = sheetsToProcess.filter(sheet => 
                !sheet.title.toLowerCase().includes('deck notes')
            );

            if (guruSheets.length > 0) {
                const mergedGuruSheet = await this.mergeGuruSheets(sheetId, guruSheets);
                allSheetsData.push(mergedGuruSheet);
                console.log("Merged Guru Sheets:", mergedGuruSheet);
            }

            // Wait for custom metadata to finish loading
            const customMetadata = await customMetadataPromise;
            if (metadataSheet && Object.keys(customMetadata).length > 0) {
                console.log('📋 Found metadata sheet:', customMetadata);
            }

            return {
                sheetId,
                title: metadata.title,
                sheets: allSheetsData,
                metadata: customMetadata
            };
        } catch (error) {
            console.error('API Error:', error);
            throw new Error(error.message || 'Failed to fetch sheet data');
        }
    }

    /**
     * Fetches custom metadata from a "metadata" sheet.
     * The sheet should have rows with structure: [Variable Name, Checkmark, Value]
     * Returns an object with variable names as keys and their values.
     */
    async getCustomMetadata(spreadsheetId, metadataSheet) {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: spreadsheetId,
                range: `'${metadataSheet.title}'!A:C`,
            });

            const values = response.result.values || [];
            const metadata = {};

            // Parse each row (skip header if present)
            for (let i = 0; i < values.length; i++) {
                const row = values[i];
                if (row && row.length >= 3) {
                    const variableName = row[0]?.trim();
                    // row[1] is the checkmark - we ignore it
                    const value = row[2]?.trim();

                    // Only add if we have both a variable name and value
                    if (variableName && value) {
                        // Convert to camelCase for consistency (e.g., "Pod Name" -> "podName")
                        const key = variableName
                            .split(' ')
                            .map((word, index) => 
                                index === 0 
                                    ? word.toLowerCase() 
                                    : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                            )
                            .join('');
                        
                        metadata[key] = value;
                    }
                }
            }

            return metadata;
        } catch (error) {
            console.error('API Error (getCustomMetadata):', error);
            // Don't throw - just return empty object if metadata sheet can't be read
            return {};
        }
    }

    async mergeGuruSheets(sheetId, guruSheets) {
        // Sort sheets to ensure consistent order: Red, Blue, Green
        const sortedSheets = guruSheets.sort((a, b) => {
            const order = ['red', 'blue', 'green'];
            const aIndex = order.findIndex(color => a.title.toLowerCase().includes(color));
            const bIndex = order.findIndex(color => b.title.toLowerCase().includes(color));
            return aIndex - bIndex;
        });

        // Get base data from Red Gurus sheet (columns A:D)
        const redGuruSheet = sortedSheets.find(sheet => 
            sheet.title.toLowerCase().includes('red')
        );

        if (!redGuruSheet) {
            throw new Error('Red Gurus sheet not found');
        }

        // Run all queries in parallel for maximum performance
        const allPromises = [
            // Base data query (A:C from Red Gurus, excluding outcome column D)
            gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: sheetId,
                range: `'${redGuruSheet.title}'!A1:C1000`,
            }),
            // Analysis and signature queries for all guru sheets
            ...sortedSheets.map(async (sheet) => {
                const color = sheet.title.toLowerCase().includes('red') ? 'red' :
                             sheet.title.toLowerCase().includes('blue') ? 'blue' : 'green';
                
                const response = await gapi.client.sheets.spreadsheets.values.get({
                    spreadsheetId: sheetId,
                    range: `'${sheet.title}'!E1:F1000`, // Only columns E and F (analysis and signature)
                });

                return {
                    color,
                    sheetId: sheet.sheetId,
                    values: response.result.values || []
                };
            })
        ];

        // Wait for all queries to complete
        const [baseResponse, ...guruResults] = await Promise.all(allPromises);
        const baseValues = baseResponse.result.values || [];
        
        // Organize guru results by color
        const guruData = {};
        guruResults.forEach(result => {
            guruData[result.color] = {
                sheetId: result.sheetId,
                values: result.values
            };
        });
        
        // Prepare merged data structure
        const mergedValues = [];
        
        if (baseValues.length > 0) {
            // Create header row: ID, Player 1, Player 2, Red Analysis, Red Signature, Blue Analysis, Blue Signature, Green Analysis, Green Signature
            const headerRow = [
                ...baseValues[0], // A:C from base (ID, Player 1, Player 2)
                'Red Analysis', 'Red Signature',
                'Blue Analysis', 'Blue Signature', 
                'Green Analysis', 'Green Signature'
            ];
            mergedValues.push(headerRow);

            // Merge data rows
            for (let i = 1; i < baseValues.length; i++) {
                const baseRow = baseValues[i] || [];
                const mergedRow = [...baseRow];

                // Pad base row to 3 columns if needed
                while (mergedRow.length < 3) {
                    mergedRow.push('');
                }

                // Add analysis and signature from each guru sheet
                for (const color of ['red', 'blue', 'green']) {
                    const colorData = guruData[color];
                    if (colorData && colorData.values[i]) {
                        mergedRow.push(colorData.values[i][0] || ''); // Analysis (column E)
                        mergedRow.push(colorData.values[i][1] || ''); // Signature (column F)
                    } else {
                        mergedRow.push(''); // Empty analysis
                        mergedRow.push(''); // Empty signature
                    }
                }

                mergedValues.push(mergedRow);
            }
        }

        const hidden = sortedSheets.some(sheet => sheet.hidden);

        return {
            title: 'Merged Gurus',
            sheetId: redGuruSheet.sheetId, // Use Red Gurus sheet ID as primary
            values: mergedValues,
            range: `'${redGuruSheet.title}'!A1:I${mergedValues.length}`,
            majorDimension: 'ROWS',
            columnMapping: this.getMergedGuruColumnMapping(),
            hidden: hidden,
            guruSheetIds: {
                red: sortedSheets.find(s => s.title.toLowerCase().includes('red'))?.sheetId,
                blue: sortedSheets.find(s => s.title.toLowerCase().includes('blue'))?.sheetId,
                green: sortedSheets.find(s => s.title.toLowerCase().includes('green'))?.sheetId
            }
        };
    }

    getMergedGuruColumnMapping() {
        return {
            id: 0,              // Column A
            player1: 1,         // Column B
            player2: 2,         // Column C
            redAnalysis: 3,     // Column D
            redSignature: 4,    // Column E
            blueAnalysis: 5,    // Column F
            blueSignature: 6,   // Column G
            greenAnalysis: 7,   // Column H
            greenSignature: 8   // Column I
        };
    }

    /**
     * Resolve the target sheetId and column index for an update that may be against
     * the merged gurus sheet. The update.col is expected to be 1-indexed for the
     * merged sheet layout. Returns { targetSheetId, targetCol } where targetCol is
     * a 1-indexed column number appropriate for the target sheet.
     */
    resolveTargetForMergedUpdate(update) {
        let targetSheetId = update.sheetId;
        let targetCol = update.col;

        if (update.isMergedGuruUpdate) {
            const columnMapping = this.getMergedGuruColumnMapping();

            if (update.col === columnMapping.redAnalysis + 1 || update.col === columnMapping.redSignature + 1) {
                targetSheetId = update.guruSheetIds.red;
                targetCol = update.col === columnMapping.redAnalysis + 1 ? 5 : 6; // E or F
            } else if (update.col === columnMapping.blueAnalysis + 1 || update.col === columnMapping.blueSignature + 1) {
                targetSheetId = update.guruSheetIds.blue;
                targetCol = update.col === columnMapping.blueAnalysis + 1 ? 5 : 6; // E or F
            } else if (update.col === columnMapping.greenAnalysis + 1 || update.col === columnMapping.greenSignature + 1) {
                targetSheetId = update.guruSheetIds.green;
                targetCol = update.col === columnMapping.greenAnalysis + 1 ? 5 : 6; // E or F
            } else if (update.col <= 3) {
                // Base columns (A:C) go to Red Gurus sheet
                targetSheetId = update.guruSheetIds.red;
                targetCol = update.col;
            }
        }

        return { targetSheetId, targetCol };
    }

    getColumnMapping(sheetTitle) {
        if (sheetTitle.toLowerCase().includes('deck notes')) {
            return {
                decklists: 0,      // Column A
                clock: 1,          // Column B
                notes: 2,          // Column C
                additionalNotes: 3 // Column D
            };
        } else {
            // Guru sheets (Red Gurus, Blue Gurus, Green Gurus)
            return {
                id: 0,             // Column A
                player1: 1,        // Column B
                player2: 2,        // Column C
                guruAnalysis: 4,   // Column E
                guruSignature: 5   // Column F
            };
        }
    }

    /**
     * Fetches the data from the Deck Notes sheet for the given spreadsheet ID.
     * Returns an object with title, sheetId, values, range, majorDimension, and columnMapping.
     */
    async getDeckNotes(spreadsheetId, deckNotesSheet, range = 'A:D') {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: spreadsheetId,
                range: `'${deckNotesSheet.title}'!${range}`,
            });

            return {
                title: deckNotesSheet.title,
                sheetId: deckNotesSheet.sheetId,
                values: response.result.values || [],
                range: response.result.range,
                majorDimension: response.result.majorDimension,
                columnMapping: this.getColumnMapping(deckNotesSheet.title)
            };
        } catch (error) {
            console.error('API Error (getDeckNotes):', error);
            throw new Error(error.message || 'Failed to fetch Deck Notes sheet');
        }
    }

    async updateSheetData(sheetId, updates) {
        try {
            if (!this.authManager.isLoggedIn()) {
                throw new Error('User not authenticated');
            }

            console.log('📝 Updating sheet data:', {
                spreadsheetId: sheetId,
                updates: updates.updates.map(u => ({
                    sheetId: u.sheetId,
                    row: u.row,
                    col: u.col,
                    value: u.value,
                    valueType: u.valueType || 'auto-detected'
                }))
            });

            const requests = updates.updates.map(update => {
                // Handle merged guru sheet updates by routing to appropriate individual sheet
                let targetSheetId = update.sheetId;
                let targetCol = update.col;

                // Resolve target sheet/column for merged guru updates
                const resolved = this.resolveTargetForMergedUpdate(update);
                targetSheetId = resolved.targetSheetId;
                targetCol = resolved.targetCol;

                // Use the explicitly specified value type
                let userEnteredValue;
                
                switch (update.valueType) {
                    case 'number':
                        userEnteredValue = { numberValue: parseFloat(update.value) };
                        break;
                    case 'string':
                        userEnteredValue = { stringValue: update.value.toString() };
                        break;
                    case 'formula':
                        userEnteredValue = { formulaValue: update.value.toString() };
                        break;
                    case 'boolean':
                        userEnteredValue = { boolValue: Boolean(update.value) };
                        break;
                    default:
                        // Fallback to auto-detection if type not specified
                        const numValue = parseFloat(update.value);
                        if (!isNaN(numValue) && isFinite(numValue)) {
                            userEnteredValue = { numberValue: numValue };
                        } else {
                            userEnteredValue = { stringValue: update.value.toString() };
                        }
                }

                return {
                    updateCells: {
                        start: {
                            sheetId: targetSheetId,
                            rowIndex: update.row - 1,
                            columnIndex: targetCol - 1
                        },
                        rows: [{
                            values: [{
                                userEnteredValue: userEnteredValue
                            }]
                        }],
                        fields: 'userEnteredValue'
                    }
                };
            });

            const response = await gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId: sheetId,
                resource: {
                    requests: requests
                }
            });

            console.log('✅ Sheet update successful:', {
                updatedCells: updates.updates.length,
                responseReplies: response.result.replies?.length || 0
            });

            return {
                success: true,
                updatedCells: updates.updates.length,
                response: response.result
            };
        } catch (error) {
            console.error('API Error:', error);
            throw new Error(error.message || 'Failed to update sheet data');
        }
    }

    async checkedUpdateSheetData(sheetId, updates) {
        try {
            if (!this.authManager.isLoggedIn()) {
                throw new Error('User not authenticated');
            }

            console.log('🔒 Performing checked update:', {
                spreadsheetId: sheetId,
                updates: updates.updates.map(u => ({
                    sheetId: u.sheetId,
                    row: u.row,
                    col: u.col,
                    value: u.value,
                    expectedValue: u.expectedValue,
                    valueType: u.valueType || 'auto-detected'
                }))
            });

            // First, get current values to verify they match expected values
            const valuesToCheck = [];
            for (const update of updates.updates) {
                let targetSheetId = update.sheetId;
                let targetCol = update.col;
                let targetRow = update.row;

                // Resolve merged target mapping for consistency
                const resolved = this.resolveTargetForMergedUpdate(update);
                targetSheetId = resolved.targetSheetId;
                targetCol = resolved.targetCol;

                valuesToCheck.push({
                    originalUpdate: update,
                    targetSheetId,
                    targetRow,
                    targetCol
                });
            }

            // Get all sheet metadata once
            const metadata = await this.getSheetMetadata(sheetId);

            // Build A1 ranges and map to checks
            const ranges = [];
            const checkToRange = [];
            for (const check of valuesToCheck) {
                const targetSheet = metadata.sheets.find(s => s.sheetId === check.targetSheetId);
                if (!targetSheet) {
                    throw new Error(`Target sheet with ID ${check.targetSheetId} not found`);
                }
                const columnLetter = String.fromCharCode(65 + check.targetCol - 1); // A=65
                const cellRange = `'${targetSheet.title}'!${columnLetter}${check.targetRow}`;
                ranges.push(cellRange);
                checkToRange.push({check, cellRange});
            }

            // Batch get all values
            const batchResponse = await gapi.client.sheets.spreadsheets.values.batchGet({
                spreadsheetId: sheetId,
                ranges: ranges
            });

            // Map results back to checks
            const checkResults = checkToRange.map((item, idx) => {
                const valueArr = batchResponse.result.valueRanges[idx]?.values;
                const currentValue = valueArr && valueArr[0] && valueArr[0][0]
                    ? valueArr[0][0].toString()
                    : '';
                const expectedValue = item.check.originalUpdate.expectedValue || '';
                return {
                    update: item.check.originalUpdate,
                    currentValue,
                    expectedValue,
                    matches: currentValue === expectedValue,
                    targetSheetId: item.check.targetSheetId,
                    targetCol: item.check.targetCol,
                    targetRow: item.check.targetRow
                };
            });

            // Only proceed with updates that pass the check
            const passedChecks = checkResults.filter(result => result.matches);
            const failedChecks = checkResults.filter(result => !result.matches);

            // Proceed with the update using the existing updateSheetData logic for passing updates only
            const updateRequests = passedChecks.map(result => {
                const update = result.update;
                let userEnteredValue;
                if (update.valueType === 'number') {
                    userEnteredValue = { numberValue: parseFloat(update.value) };
                } else if (update.valueType === 'boolean') {
                    userEnteredValue = { boolValue: update.value === 'true' || update.value === true };
                } else if (update.valueType === 'string') {
                    userEnteredValue = { stringValue: update.value.toString() };
                } else {
                    // Fallback to auto-detection if type not specified
                    const numValue = parseFloat(update.value);
                    if (!isNaN(numValue) && isFinite(numValue)) {
                        userEnteredValue = { numberValue: numValue };
                    } else {
                        userEnteredValue = { stringValue: update.value.toString() };
                    }
                }
                return {
                    updateCells: {
                        start: {
                            sheetId: result.targetSheetId,
                            rowIndex: result.targetRow - 1,
                            columnIndex: result.targetCol - 1
                        },
                        rows: [{
                            values: [{
                                userEnteredValue: userEnteredValue
                            }]
                        }],
                        fields: 'userEnteredValue'
                    }
                };
            });

            let response = null;
            if (updateRequests.length > 0) {
                response = await gapi.client.sheets.spreadsheets.batchUpdate({
                    spreadsheetId: sheetId,
                    resource: {
                        requests: updateRequests
                    }
                });
            }

            console.log('✅ Checked sheet update complete:', {
                updatedCells: updateRequests.length,
                skippedCells: failedChecks.length,
                responseReplies: response?.result?.replies?.length || 0
            });

            return {
                success: true,
                updatedCells: updateRequests.length,
                skippedCells: failedChecks.length,
                skipped: failedChecks.map(check => ({
                    row: check.targetRow,
                    col: check.targetCol,
                    expectedValue: check.expectedValue,
                    currentValue: check.currentValue
                })),
                response: response?.result
            };

        } catch (error) {
            console.error('Checked API Error:', error);
            throw new Error(error.message || 'Failed to perform checked update');
        }
    }

    async getSheetMetadata(sheetId) {
        try {
            if (!this.authManager.isLoggedIn()) {
                throw new Error('User not authenticated');
            }

            const response = await gapi.client.sheets.spreadsheets.get({
                spreadsheetId: sheetId,
            });

            return {
                title: response.result.properties.title,
                sheetId: sheetId,
                sheets: response.result.sheets.map(sheet => ({
                    title: sheet.properties.title,
                    sheetId: sheet.properties.sheetId,
                    gridProperties: sheet.properties.gridProperties,
                    hidden: !!sheet.properties.hidden
                }))
            };
        } catch (error) {
            console.error('API Error:', error);
            throw new Error(error.message || 'Failed to fetch sheet metadata');
        }
    }

    async batchUpdate(sheetId, requests) {
        try {
            if (!this.authManager.isLoggedIn()) {
                throw new Error('User not authenticated');
            }

            const response = await gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId: sheetId,
                resource: {
                    requests: requests
                }
            });

            return {
                success: true,
                response: response.result
            };
        } catch (error) {
            console.error('API Error:', error);
            throw new Error(error.message || 'Failed to perform batch update');
        }
    }

    /**
     * Unhides the Red, Blue, and Green Guru sheets in the spreadsheet.
     * Returns a promise that resolves when the operation is complete.
    */
    async unhideGuruSheets(sheetId) {
        if (!this.authManager.isLoggedIn()) {
            throw new Error('User not authenticated');
        }
        // Get all sheet metadata
        const metadata = await this.getSheetMetadata(sheetId);
        // Only match exact Guru sheet names (case-insensitive)
        const guruSheetNames = ['Red Gurus', 'Blue Gurus', 'Green Gurus'];
        const guruSheets = metadata.sheets.filter(sheet =>
            guruSheetNames.some(name => sheet.title.trim().toLowerCase() === name.toLowerCase())
        );
        if (guruSheets.length === 0) {
            throw new Error('No Guru sheets found to unhide');
        }
        // Build requests to unhide each sheet
        const requests = guruSheets.map(sheet => ({
            updateSheetProperties: {
                properties: {
                    sheetId: sheet.sheetId,
                    hidden: false
                },
                fields: 'hidden'
            }
        }));
        // Send batch update
        const response = await this.batchUpdate(sheetId, requests);
        return response;
    }

    /**
     * Clear a single cell's value using the Sheets API `spreadsheets.values.clear` endpoint.
     * spreadsheetId - the ID of the spreadsheet
     * targetSheetId - the numeric sheetId (not title) to identify which sheet to clear
     * row, col - 1-indexed coordinates of the cell to clear
     */
    /**
     * Clear a single cell's value.
     * Usage:
     *  - clearCell(spreadsheetId, updateObject) where updateObject is the same
     *    shape used in updateSheetData (must include isMergedGuruUpdate, col, row, sheetId, guruSheetIds)
     */
    /**
     * Clear a single cell's value using an update-like object.
     * clearCell(spreadsheetId, updateObject)
     * updateObject must include: row, col or isMergedGuruUpdate+col+guruSheetIds, sheetId
     */
    async clearCell(spreadsheetId, update) {
        try {
            if (!this.authManager.isLoggedIn()) {
                throw new Error('User not authenticated');
            }

            if (!update || typeof update !== 'object') {
                throw new Error('clearCell requires an update object');
            }

            if (!update.row) {
                throw new Error('Update object must include row');
            }

            // Use helper to resolve merged updates; otherwise, use provided sheetId and col
            const resolved = this.resolveTargetForMergedUpdate(update);
            const targetSheetId = resolved.targetSheetId;
            const col = resolved.targetCol;
            const row = update.row;

            const metadata = await this.getSheetMetadata(spreadsheetId);
            const targetSheet = metadata.sheets.find(s => s.sheetId === targetSheetId);
            if (!targetSheet) {
                throw new Error(`Target sheet with ID ${targetSheetId} not found`);
            }

            const columnLetter = String.fromCharCode(65 + col - 1);
            const range = `'${targetSheet.title}'!${columnLetter}${row}`;

            const response = await gapi.client.sheets.spreadsheets.values.clear({
                spreadsheetId,
                range,
                resource: {}
            });

            return {
                success: true,
                range,
                response: response.result
            };
        } catch (error) {
            console.error('API Error (clearCell):', error);
            throw new Error(error.message || 'Failed to clear cell');
        }
    }
}
