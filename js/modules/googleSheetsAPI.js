export class GoogleSheetsAPI {
    constructor(authManager) {
        this.authManager = authManager;
    }

    async getSheetData(sheetId, guruSignature = null) {
        try {
            if (!this.authManager.isLoggedIn()) {
                throw new Error('User not authenticated');
            }

            // Get metadata first to find all sheets
            const metadata = await this.getSheetMetadata(sheetId);
            
            // Only process specific sheets needed for the application
            const requiredSheetNames = ['Deck Notes', 'Red Gurus', 'Blue Gurus', 'Green Gurus'];
            const sheetsToProcess = metadata.sheets.filter(sheet => 
                requiredSheetNames.some(requiredName => 
                    sheet.title.toLowerCase().includes(requiredName.toLowerCase())
                )
            );

            console.log(`Processing sheets: ${sheetsToProcess.map(s => s.title).join(', ')}`);

            const allSheetsData = [];

            for (const sheet of sheetsToProcess) {
                const response = await gapi.client.sheets.spreadsheets.values.get({
                    spreadsheetId: sheetId,
                    range: `'${sheet.title}'!A1:Z1000`,
                });

                let sheetData = {
                    sheetTitle: sheet.title,
                    sheetId: sheet.sheetId,
                    values: response.result.values || [],
                    range: response.result.range,
                    majorDimension: response.result.majorDimension
                };

                // Filter by guru signature if provided, but skip reference sheets like "Deck Notes"
                if (guruSignature && sheetData.values.length > 0) {
                    // Don't filter "Deck Notes" sheet - it contains reference data, not guru-specific data
                    if (!sheet.title.toLowerCase().includes('deck notes')) {
                        sheetData = this.filterByGuruSignature(sheetData, guruSignature);
                    }
                }

                allSheetsData.push(sheetData);
            }

            return {
                sheetId,
                title: metadata.title,
                sheets: allSheetsData,
                guruSignature: guruSignature
            };
        } catch (error) {
            console.error('API Error:', error);
            throw new Error(error.message || 'Failed to fetch sheet data');
        }
    }

    filterByGuruSignature(sheetData, guruSignature) {
        if (!sheetData.values || sheetData.values.length === 0) {
            return sheetData;
        }

        // Find the Guru Signature column
        const headerRow = sheetData.values[0];
        const guruSignatureColIndex = headerRow.findIndex(header => 
            header && header.toLowerCase().includes('guru signature')
        );

        if (guruSignatureColIndex === -1) {
            console.warn(`No "Guru Signature" column found in ${sheetData.sheetTitle}`);
            return {
                ...sheetData,
                values: [headerRow] // Only return header if no signature column
            };
        }

        // Filter rows where guru signature matches (case-insensitive)
        const filteredValues = [headerRow]; // Always include header
        const originalRowIndices = [0]; // Track original row indices (0 for header)
        
        for (let i = 1; i < sheetData.values.length; i++) {
            const row = sheetData.values[i];
            const cellSignature = row[guruSignatureColIndex];
            
            if (cellSignature && cellSignature.toString().toLowerCase().trim() === guruSignature.toLowerCase().trim()) {
                filteredValues.push(row);
                originalRowIndices.push(i); // Store the original row index
            }
        }

        return {
            ...sheetData,
            values: filteredValues,
            originalRowIndices: originalRowIndices, // Include mapping to original indices
            filteredRowCount: filteredValues.length - 1, // Exclude header from count
            originalRowCount: sheetData.values.length - 1
        };
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
                            sheetId: update.sheetId, // Use the actual sheet ID from the request
                            rowIndex: update.row - 1,
                            columnIndex: update.col - 1
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
                    gridProperties: sheet.properties.gridProperties
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
}
