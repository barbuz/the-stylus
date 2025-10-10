import { CONFIG } from '../config.js';

export class UIController {
    constructor() {
        this.statusMessage = document.getElementById('status-message');
        this.sheetEditor = document.getElementById('sheet-editor');
        this.loadBtn = document.getElementById('load-sheet-btn');
        this.saveBtn = document.getElementById('save-btn');
        this.refreshBtn = document.getElementById('refresh-btn');
        this.sheetTitle = document.getElementById('sheet-title');
        this.sheetLink = document.getElementById('google-sheet-link');

        // --- Pointer type detection ---
        this._pointerType = null;
        this._pointerDetectionDone = false;
        this._pointerHandler = (e) => {
            if (!this._pointerDetectionDone) {
                this._pointerType = e.pointerType;
                this._pointerDetectionDone = true;
                console.log(`Pointer type detected: ${this._pointerType}`);
                window.removeEventListener('pointerdown', this._pointerHandler, true);
                window.removeEventListener('pointermove', this._pointerHandler, true);
            }
        };
        window.addEventListener('pointerdown', this._pointerHandler, true);
        window.addEventListener('pointermove', this._pointerHandler, true);
    }
    /**
     * Returns the detected pointer type: 'mouse', 'touch', 'pen', or null if not yet detected.
     */
    getPointerType() {
        return this._pointerType;
    }

    showStatus(message, type = 'info') {
        this.statusMessage.textContent = message;
        this.statusMessage.className = `status-message ${type}`;
        this.statusMessage.style.display = 'block';

        // Auto-hide success messages after 3 seconds, info messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                this.hideStatus();
            }, 3000);
        } else if (type === 'info') {
            setTimeout(() => {
                this.hideStatus();
            }, 5000);
        }
    }

    hideStatus() {
        this.statusMessage.style.display = 'none';
        this.statusMessage.className = 'status-message';
    }

    showSheetEditor(title = 'Sheet Editor', sheetId) {
        this.sheetTitle.textContent = title;
        this.sheetLink.href = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
        this.sheetLink.target = '_blank';
        this.sheetLink.title = 'Open pod in Google Sheets';

        // Hide the other sections for fullscreen experience
        const guruSignatureSection = document.getElementById('guru-signature-section');
        const sheetInputSection = document.getElementById('sheet-input-section');
        const header = document.querySelector('header');
        
        if (guruSignatureSection) guruSignatureSection.style.display = 'none';
        if (sheetInputSection) sheetInputSection.style.display = 'none';
        if (header) header.style.display = 'none';
        
        // Add fullscreen class and show the editor
        this.sheetEditor.classList.add('fullscreen-analysis');
        this.sheetEditor.style.display = 'block';
        
        // Add body class for mobile scrolling support
        document.body.classList.add('fullscreen-mode');
    }

    hideSheetEditor() {
        this.sheetEditor.style.display = 'none';
    }

    clearURLParameters() {
        // Clear pod-related parameters from the URL when returning to home
        const newUrl = new URL(window.location);
        newUrl.searchParams.delete('pod');
        newUrl.searchParams.delete('guru');
        newUrl.searchParams.delete('row');
        newUrl.searchParams.delete('match');
        window.history.replaceState({}, '', newUrl);
    }

    hideHomeScreen() {
        // Hide the home screen sections to go directly to analysis mode
        const sheetInputSection = document.getElementById('sheet-input-section');
        const guruSignatureSection = document.getElementById('guru-signature-section');
        
        if (sheetInputSection) {
            sheetInputSection.style.display = 'none';
        }
        if (guruSignatureSection) {
            guruSignatureSection.style.display = 'none';
        }
        
        console.log('🏠 Home screen hidden for direct analysis mode');
    }

    showSheetInputSection() {
        // Clear URL parameters when returning to home
        this.clearURLParameters();
        
        // Show the input sections again when exiting fullscreen analysis
        const sheetInputSection = document.getElementById('sheet-input-section');
        const header = document.querySelector('header');

        // Hide the sheet editor
        this.sheetEditor.style.display = 'none';
        
        // Always show these sections
        if (sheetInputSection) sheetInputSection.style.display = 'block';
        if (header) header.style.display = 'block';
        
        // Remove body class for mobile scrolling support
        document.body.classList.remove('fullscreen-mode');
        
        // Only show guru signature section if no signature is set
        // Check if guru signature exists in localStorage using the CONFIG storage key
        const guruSignature = localStorage.getItem(CONFIG.STORAGE_KEYS.GURU_SIGNATURE);
        const guruSignatureSection = document.getElementById('guru-signature-section');
        
        if (guruSignatureSection) {
            if (guruSignature) {
                // User has a signature, keep the section hidden
                guruSignatureSection.style.display = 'none';
                console.log('🔒 Guru signature exists, keeping section hidden');
            } else {
                // No signature set, show the section
                guruSignatureSection.style.display = 'block';
                console.log('⚠️ No guru signature found, showing section');
            }
        }
    }

    setLoadingState(isLoading) {
        const buttons = [this.loadBtn, this.saveBtn, this.refreshBtn];
        
        buttons.forEach(btn => {
            if (btn) {
                btn.disabled = isLoading;
                
                if (isLoading && btn === this.loadBtn) {
                    btn.innerHTML = '<span class="loading-spinner"></span>Loading...';
                } else if (!isLoading && btn === this.loadBtn) {
                    btn.innerHTML = 'Load Results';
                }
                
                if (isLoading && btn === this.saveBtn) {
                    btn.innerHTML = '<span class="loading-spinner"></span>Saving...';
                } else if (!isLoading && btn === this.saveBtn) {
                    btn.innerHTML = 'Save Results';
                }
                
                if (isLoading && btn === this.refreshBtn) {
                    btn.innerHTML = '<span class="loading-spinner"></span>Refreshing...';
                } else if (!isLoading && btn === this.refreshBtn) {
                    btn.innerHTML = 'Refresh';
                }
            }
        });
    }

    showError(message) {
        this.showStatus(message, 'error');
    }

    showSuccess(message) {
        this.showStatus(message, 'success');
    }

    showLoading(message) {
        this.showStatus(message, 'loading');
    }

    enableEditorControls() {
        if (this.saveBtn) this.saveBtn.disabled = false;
        if (this.refreshBtn) this.refreshBtn.disabled = false;
    }

    disableEditorControls() {
        if (this.saveBtn) this.saveBtn.disabled = true;
        if (this.refreshBtn) this.refreshBtn.disabled = true;
    }

    showConfirmDialog(message) {
        return new Promise((resolve) => {
            const result = confirm(message);
            resolve(result);
        });
    }
}
