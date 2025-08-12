import { GoogleSheetsAPI } from './modules/googleSheetsAPI.js';
import { UIController } from './modules/uiController.js';
import { AuthManager } from './modules/authManager.js';
import { GuruSignature } from './modules/guruSignature.js';
import { GuruAnalysisInterface } from './modules/guruAnalysisInterface.js';
import { RecentPodsManager } from './modules/recentPods.js';
import { CONFIG } from './config.js';

class ThreeCardBlindGuruTool {
    constructor() {
        this.authManager = new AuthManager();
        this.guruSignature = new GuruSignature();
        this.sheetsAPI = new GoogleSheetsAPI(this.authManager);
        this.uiController = new UIController();
        this.analysisInterface = new GuruAnalysisInterface(this.sheetsAPI, this.uiController, this.authManager);
        this.recentPodsManager = new RecentPodsManager();
        
        // Set auth manager reference in guru signature
        this.guruSignature.setAuthManager(this.authManager);
        
        this.currentSheetData = null;
        this.currentSheetId = null;
        this.handlersSetup = false; // Track if handlers have been set up
        this.authSectionRendered = false; // Track if auth section has been rendered
        
        this.init();
    }

    async init() {
        try {
            // Show loading while initializing
            this.showLoading('Initializing application...');
            
            // Set up event listeners first, before any authentication
            this.setupPreferencesHandlers();
            
            // Initialize Google API first
            await this.authManager.initialize();
            
            // Check authentication status
            const isAuthenticated = await this.authManager.checkAuthStatus();
            
            // Hide loading after checking authentication
            this.hideLoading();
            
            if (isAuthenticated) {
                this.authManager.renderAuthSection();
                this.authManager.showAppContent();
                this.authSectionRendered = true; // Mark as rendered
                
                // Only set up handlers once
                if (!this.handlersSetup) {
                    this.setupGuruSignatureHandlers();
                    this.bindEvents();
                    this.handlersSetup = true;
                }
                
                // Load user preferences if authenticated
                this.loadGuruSignature();
                
                // Initialize user preferences and connect to recent pods manager
                if (this.authManager.userPreferences && this.authManager.userPreferences.isInitialized) {
                    this.recentPodsManager.setUserPreferences(this.authManager.userPreferences);
                }
                
                // Initialize recent pods manager after user preferences are set
                await this.recentPodsManager.initialize();

                if (this.authManager.isLoggedIn()) {
                    this.uiController.showStatus('Ready to load pod sheet', 'success');
                } else {
                    this.authManager.showLoginScreen();
                }
            } else {
                // User is not authenticated, show login screen
                console.log('User not authenticated, showing login screen');
                this.authManager.showLoginScreen();
            }
        } catch (error) {
            console.error('Error initializing application:', error);
            this.hideLoading();
            this.uiController.showStatus('Error initializing Google API. Please refresh the page.', 'error');
        }
    }
    
    setupPreferencesHandlers() {
        // Listen for user login
        window.addEventListener('userLoggedIn', async (event) => {
            console.log('User logged in:', event.detail.user.name);
            
            // Only render auth section if it hasn't been rendered yet during initialization
            // This prevents duplicate rendering when user is already authenticated
            if (!this.authSectionRendered) {
                this.authManager.renderAuthSection();
                this.authManager.showAppContent();
                this.authSectionRendered = true;
            }
            
            // Only set up handlers once
            if (!this.handlersSetup) {
                this.setupGuruSignatureHandlers();
                this.bindEvents();
                this.handlersSetup = true;
            }
            
            // Initialize user preferences and connect to recent pods manager
            if (this.authManager.userPreferences && this.authManager.userPreferences.isInitialized) {
                this.recentPodsManager.setUserPreferences(this.authManager.userPreferences);
                // Reload recent pods from Google appData after login
                await this.recentPodsManager.loadRecentPods();
                this.recentPodsManager.renderRecentPods();
            }
            
            // Load guru signature if available
            this.loadGuruSignature();
            
            // Show success message
            if (this.uiController && this.uiController.showStatus) {
                this.uiController.showStatus('Welcome! Ready to load pod sheet', 'success');
            } else {
                console.log('Welcome! Ready to load pod sheet');
            }
        });

        // Listen for guru signature loaded from Drive
        window.addEventListener('guruSignatureLoaded', (event) => {
            console.log('Guru signature loaded from Drive:', event.detail.signature);
            // Update UI to show the loaded signature
            this.guruSignature.reloadFromPreferences();
        });

        // Clear preferences on logout
        window.addEventListener('userLoggedOut', () => {
            this.clearLocalPreferences();
            this.handlersSetup = false; // Reset handlers flag so they can be set up again on next login
            this.authSectionRendered = false; // Reset auth section flag
        });
    }

    /**
     * Show simple loading indicator under header
     */
    showLoading(message = 'Loading...') {
        const loadingElement = document.getElementById('app-loading');
        const loadingText = document.getElementById('loading-text');
        if (loadingElement && loadingText) {
            loadingText.textContent = message;
            loadingElement.style.display = 'flex';
        }
    }

    /**
     * Hide loading indicator
     */
    hideLoading() {
        const loadingElement = document.getElementById('app-loading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }

    clearLocalPreferences() {
        // Clear local storage
        localStorage.removeItem(CONFIG.STORAGE_KEYS.GURU_SIGNATURE);
    }

    loadGuruSignature() {
        // Load guru signature from localStorage
        const guruSignature = localStorage.getItem(CONFIG.STORAGE_KEYS.GURU_SIGNATURE);
        if (guruSignature) {
            console.log('Loading guru signature:', guruSignature);
            this.guruSignature.displaySignature(guruSignature);
            this.guruSignature.hideSignatureSection();
        }
    }

    setupGuruSignatureHandlers() {
        // Listen for signature events
        this.guruSignature.onSignatureSet((signature) => {
            console.log('Guru signature set:', signature);
            this.uiController.showStatus(`Welcome, ${signature}! Ready to edit pod sheets.`, 'success');
            // Update auth manager to show signature in header (only if different)
            const currentSignature = this.authManager.getCurrentGuruSignature?.() || '';
            if (currentSignature !== signature) {
                this.authManager.updateGuruSignature(signature);
            }
        });

        this.guruSignature.onSignatureChanged((signature) => {
            console.log('Guru signature changed:', signature);
            if (!signature) {
                this.uiController.showStatus('Please set your Guru Signature to continue.', 'info');
            }
        });
    }

    bindEvents() {
        const loadBtn = document.getElementById('load-sheet-btn');
        const refreshBtn = document.getElementById('refresh-btn');
        const exitAnalysisBtn = document.getElementById('exit-analysis-btn');
        const sheetUrlInput = document.getElementById('sheet-url');

        loadBtn.addEventListener('click', () => this.loadSheet());
        refreshBtn.addEventListener('click', () => this.refreshSheet());
        exitAnalysisBtn.addEventListener('click', () => this.exitAnalysis());
        
        // Allow Enter key to trigger load
        sheetUrlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.loadSheet();
            }
        });

        // Listen for recent pod load events
        window.addEventListener('loadRecentPod', (event) => {
            const { pod } = event.detail;
            console.log(`📋 Loading recent pod: ${pod.title}`);
            // The loadSheet() method will be called automatically by the recent pods manager
        });

        // Listen for user logout to optionally handle recent pods
        window.addEventListener('userLoggedOut', () => {
            // Note: We keep recent pods even after logout so they're available when user logs back in
            // If you want to clear them on logout, uncomment the next line:
            // this.recentPodsManager.clearRecentPods();
            console.log('📋 User logged out - keeping recent pods for next session');
        });
    }

    async loadSheet() {
        // Check if guru signature is set before loading sheet
        if (!this.guruSignature.hasSignature()) {
            this.uiController.showStatus('Please set your Guru Signature before loading a sheet', 'error');
            this.guruSignature.showSignatureSection();
            return;
        }

        const url = document.getElementById('sheet-url').value.trim();
        
        if (!url) {
            this.uiController.showStatus('Please enter a pod Google Sheets URL', 'error');
            return;
        }

        if (!this.isValidGoogleSheetsUrl(url)) {
            this.uiController.showStatus('Please enter a valid Google Sheets URL', 'error');
            return;
        }

        try {
            this.uiController.showStatus('Loading pod...', 'loading');
            this.uiController.setLoadingState(true);

            const sheetId = this.extractSheetId(url);
            const sheetData = await this.sheetsAPI.getSheetData(sheetId);
            
            this.currentSheetData = sheetData;
            this.currentSheetId = sheetId;
            
            // Load data into the analysis interface instead of the renderer
            await this.analysisInterface.loadData(sheetData);
            this.uiController.showSheetEditor(sheetData.title || 'Pod');
            
            // Add to recent pods
            this.recentPodsManager.addRecentPod(sheetId, sheetData.title || 'Untitled Pod', url);
            
            // Show success message
            const totalRows = this.analysisInterface.getTotalRows();
            this.uiController.showStatus(`Pod loaded successfully - ${totalRows} rows available`, 'success');
            
        } catch (error) {
            console.error('Error loading pod:', error);
            this.uiController.showStatus(`Error loading pod: ${error.message}`, 'error');
        } finally {
            this.uiController.setLoadingState(false);
        }
    }

    async refreshSheet() {
        if (!this.currentSheetId) {
            this.uiController.showStatus('No pod loaded', 'error');
            return;
        }

        try {
            this.uiController.showStatus('Refreshing pod...', 'loading');
            
            const sheetData = await this.sheetsAPI.getSheetData(this.currentSheetId);
            this.currentSheetData = sheetData;
            
            // Reload data into the analysis interface
            await this.analysisInterface.loadData(sheetData);
            
            const totalRows = this.analysisInterface.getTotalRows();
            this.uiController.showStatus(`Refreshed - ${totalRows} rows available`, 'success');
            
        } catch (error) {
            console.error('Error refreshing pod:', error);
            this.uiController.showStatus(`Error refreshing: ${error.message}`, 'error');
        }
    }

    exitAnalysis() {
        // Hide the fullscreen analysis and show the regular interface
        const sheetEditor = document.getElementById('sheet-editor');
        sheetEditor.style.display = 'none';
        sheetEditor.classList.remove('fullscreen-analysis');
        
        // Show the sheet input section again
        this.uiController.showSheetInputSection();
        this.uiController.showStatus('Analysis session ended. Load a sheet to start analysing again.', 'info');
    }

    isValidGoogleSheetsUrl(url) {
        const pattern = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9-_]+/;
        return pattern.test(url);
    }

    extractSheetId(url) {
        const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        return match ? match[1] : null;
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ThreeCardBlindGuruTool();
});
