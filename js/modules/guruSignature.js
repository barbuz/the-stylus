/**
 * Guru Signature Manager
 * Handles guru username storage and validation
 */
import { CONFIG } from '../config.js';

export class GuruSignature {
    constructor() {
        this.storageKey = CONFIG.STORAGE_KEYS.GURU_SIGNATURE;
        this.authManager = null; // Will be set externally
        this.callbacks = {
            onSignatureSet: [],
            onSignatureChanged: []
        };
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadStoredSignature();
        
        // Listen for requests to change guru signature
        window.addEventListener('requestGuruSignatureChange', () => {
            this.changeSignature();
        });
    }

    /**
     * Set reference to auth manager for updating the header
     * @param {AuthManager} authManager - AuthManager instance
     */
    setAuthManager(authManager) {
        this.authManager = authManager;
    }

    /**
     * Manually reload signature from preferences (called after preferences are loaded)
     */
    reloadFromPreferences() {
        const storedSignature = this.authManager ? this.authManager.guruSignature : localStorage.getItem(this.storageKey);
        console.log('GuruSignature: Reloading from preferences, found:', storedSignature);
        
        if (storedSignature) {
            // Update auth manager header display
            if (this.authManager) {
                this.authManager.updateGuruSignature(storedSignature);
            }
            
            this.displaySignature(storedSignature);
            this.hideSignatureSection(); // Hide the input section
            this.showSheetInputSection();
            this.notifyCallbacks('onSignatureSet', storedSignature);
        }
    }

    bindEvents() {
        const setSignatureBtn = document.getElementById('set-signature-btn');
        const changeSignatureBtn = document.getElementById('change-signature-btn');
        const signatureInput = document.getElementById('guru-signature');

        if (setSignatureBtn) {
            setSignatureBtn.addEventListener('click', () => this.setSignature());
        }

        if (changeSignatureBtn) {
            changeSignatureBtn.addEventListener('click', () => this.changeSignature());
        }

        if (signatureInput) {
            signatureInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.setSignature();
                }
            });
        }
    }

    loadStoredSignature() {
        const storedSignature = localStorage.getItem(this.storageKey);
        
        if (storedSignature) {
            // Update auth manager header display
            if (this.authManager) {
                this.authManager.updateGuruSignature(storedSignature);
            }
            
            this.displaySignature(storedSignature);
            this.hideSignatureSection(); // Hide the input section
            this.showSheetInputSection();
            this.notifyCallbacks('onSignatureSet', storedSignature);
        } else {
            this.showSignatureSection();
        }
    }

    async setSignature(signature = null) {
        const signatureInput = document.getElementById('guru-signature');
        const finalSignature = signature || signatureInput.value.trim();

        if (!finalSignature) {
            this.showError('Please enter your Guru Signature (username)');
            return;
        }

        if (finalSignature.length > 50) {
            this.showError('Guru Signature must be less than 50 characters');
            return;
        }

        await this.saveSignature(finalSignature);
        
        // Update auth manager header display
        if (this.authManager) {
            this.authManager.updateGuruSignature(finalSignature);
        }
        
        this.displaySignature(finalSignature);
        this.hideSignatureSection(); // Hide the input section
        this.showSheetInputSection();
        this.notifyCallbacks('onSignatureSet', finalSignature);
    }

    changeSignature() {
        const signatureInput = document.getElementById('guru-signature');
        const currentSignature = this.getSignature();
        
        signatureInput.value = currentSignature;
        this.showSignatureSection();
        signatureInput.focus();
        signatureInput.select();
    }

    async saveSignature(signature) {
        // Use authManager to save signature (which will handle Drive vs localStorage)
        if (this.authManager) {
            await this.authManager.saveGuruSignature(signature);
        } else {
            // Fall back to localStorage if authManager not available
            localStorage.setItem(this.storageKey, signature);
        }
    }

    getSignature() {
        return localStorage.getItem(this.storageKey);
    }

    displaySignature(signature) {
        const guruDisplayName = document.getElementById('guru-display-name');
        const guruInfo = document.getElementById('guru-info');
        
        if (guruDisplayName && guruInfo) {
            guruDisplayName.textContent = signature;
            guruInfo.style.display = 'block';
        }
    }

    showSignatureSection() {
        const signatureSection = document.getElementById('guru-signature-section');
        const sheetInputSection = document.getElementById('sheet-input-section');
        const guruInfo = document.getElementById('guru-info');
        
        if (signatureSection) {
            signatureSection.style.display = 'block';
        }
        if (sheetInputSection) {
            sheetInputSection.style.display = 'none';
        }
        if (guruInfo) {
            guruInfo.style.display = 'none';
        }
    }

    hideSignatureSection() {
        const signatureSection = document.getElementById('guru-signature-section');
        
        if (signatureSection) {
            signatureSection.style.display = 'none';
        }
    }

    showSheetInputSection() {
        const sheetInputSection = document.getElementById('sheet-input-section');
        
        if (sheetInputSection) {
            sheetInputSection.style.display = 'block';
        }
    }

    showError(message) {
        // Create or update error message
        let errorDiv = document.getElementById('guru-signature-error');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.id = 'guru-signature-error';
            errorDiv.className = 'status-message error';
            
            const signatureSection = document.getElementById('guru-signature-section');
            if (signatureSection) {
                signatureSection.appendChild(errorDiv);
            }
        }
        
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        
        // Hide error after 5 seconds
        setTimeout(() => {
            if (errorDiv) {
                errorDiv.style.display = 'none';
            }
        }, 5000);
    }

    clearSignature() {
        localStorage.removeItem(this.storageKey);
        this.showSignatureSection();
        document.getElementById('guru-signature').value = '';
        this.notifyCallbacks('onSignatureChanged', null);
    }

    hasSignature() {
        return !!this.getSignature();
    }

    // Event system for other modules to listen to signature changes
    onSignatureSet(callback) {
        this.callbacks.onSignatureSet.push(callback);
    }

    onSignatureChanged(callback) {
        this.callbacks.onSignatureChanged.push(callback);
    }

    notifyCallbacks(event, signature) {
        this.callbacks[event].forEach(callback => {
            try {
                callback(signature);
            } catch (error) {
                console.error('Error in guru signature callback:', error);
            }
        });
    }

    // Get signature with metadata for audit trail
    getSignatureWithMetadata() {
        const signature = this.getSignature();
        if (!signature) return null;

        return {
            signature,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            sessionId: this.getSessionId()
        };
    }

    getSessionId() {
        let sessionId = sessionStorage.getItem('3cb-session-id');
        if (!sessionId) {
            sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('3cb-session-id', sessionId);
        }
        return sessionId;
    }
}
