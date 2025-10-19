import { GoogleSheetsAPI } from './modules/googleSheetsAPI.js';
import { UIController } from './modules/uiController.js';
import { AuthManager } from './modules/authManager.js';
import { GuruSignature } from './modules/guruSignature.js';
import { GuruAnalysisInterface } from './modules/guruAnalysisInterface.js';
import { RecentPodsManager } from './modules/recentPods.js';
import { CONFIG } from './config.js';
import { isValidGoogleSheetsUrl, extractSheetId } from './utils/urlUtils.js';

class ThreeCardBlindGuruTool {
    constructor() {
        this.authManager = new AuthManager();
        this.guruSignature = new GuruSignature(this.authManager);
        this.sheetsAPI = new GoogleSheetsAPI(this.authManager);
        this.uiController = new UIController();
        this.analysisInterface = null; // Initialized after auth
        this.recentPodsManager = new RecentPodsManager();

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
                
                
                // Initialize user preferences and connect to recent pods manager
                if (this.authManager.userPreferences && this.authManager.userPreferences.isInitialized) {
                    this.recentPodsManager.setUserPreferences(this.authManager.userPreferences);
                }

                // Try to initialize the guru signature from persisted preferences so it's
                // available immediately after login (avoids race where loadSheet blocks)
                try {
                    if (this.authManager.userPreferences) {
                        const persistedSig = await this.authManager.userPreferences.getGuruSignature();
                        if (persistedSig && persistedSig.trim() !== '') {
                            await this.guruSignature.initSignature(persistedSig);
                        }
                    }
                } catch (err) {
                    console.warn('Could not initialize guru signature from preferences:', err);
                }
                
                // Initialize recent pods manager after user preferences are set
                await this.recentPodsManager.initialize();

                // Check if we should go directly to analysis mode based on URL parameters
                const hasUrlParameters = await this.checkForDirectAnalysisMode();

                if (!hasUrlParameters) {
                    // No URL parameters, show normal home screen
                    if (this.authManager.isLoggedIn()) {
                        this.uiController.showStatus('Ready to load pod sheet', 'success');
                    } else {
                        this.authManager.showLoginScreen();
                    }
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
        window.addEventListener('userLoggedIn', async () => {
            console.log('User logged in');
            
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
                this.guruSignature.initSignature(await this.authManager.userPreferences.getGuruSignature());
                this.recentPodsManager.setUserPreferences(this.authManager.userPreferences);
                // Reload recent pods from Google appData after login
                await this.recentPodsManager.loadRecentPods();
                this.recentPodsManager.renderRecentPods();
            }
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

    setupGuruSignatureHandlers() {
        // Listen for signature events
        this.guruSignature.onSignatureSet((signature) => {
            console.log('Guru signature set:', signature);
            this.uiController.showStatus(`Welcome, ${signature}! Ready to edit pod sheets.`, 'success');
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
        exitAnalysisBtn.addEventListener('click', () => this.uiController.showSheetInputSection());
        
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

    async checkForDirectAnalysisMode() {
        const urlParams = new URLSearchParams(window.location.search);
        const podId = urlParams.get('pod');
        
        if (podId) {
            console.log('🔗 URL parameters detected, going directly to analysis mode');
            
            // Hide the home screen sections
            this.uiController.hideHomeScreen();
            
            // Handle URL parameters for auto-loading
            await this.handleURLParameters();
            
            return true; // Indicates we went to analysis mode
        }
        
        return false; // No URL parameters, use normal flow
    }

    async handleURLParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const podId = urlParams.get('pod');
        const guruColor = urlParams.get('guru');
        let rowNumber = urlParams.get('match');
        if (rowNumber === null || rowNumber === undefined) {
            rowNumber = urlParams.get('row');
        }
        
        if (podId) {
            try {
                console.log(`🔗 Auto-loading pod from URL: ${podId}, color: ${guruColor}, row: ${rowNumber}`);
                
                this.showLoading('Loading pod data...');
                // Load the pod by ID
                await this.loadSheet(podId, guruColor, parseInt(rowNumber, 10));
                
                this.hideLoading();
                
            } catch (error) {
                console.warn('Failed to auto-load pod from URL:', error);
                this.hideLoading();
                this.uiController.showStatus(`Could not load pod from URL: ${error.message}`, 'error');
                
                // Clear invalid pod ID from URL
                this.clearInvalidURLParameters();
            }
        }
    }

    clearInvalidURLParameters() {
        const newUrl = new URL(window.location);
        newUrl.searchParams.delete('pod');
        newUrl.searchParams.delete('guru');
        newUrl.searchParams.delete('row');
        newUrl.searchParams.delete('match');
        window.history.replaceState({}, '', newUrl);
    }

    async loadSheet(sheetId = null, guruColor = null, rowNumber = null) {
        // Check if guru signature is set before loading sheet
        if (!this.guruSignature.hasSignature()) {
            console.warn('Guru signature not set, cannot load sheet');
            this.uiController.showStatus('Please set your Guru Signature before loading a sheet', 'error');
            this.guruSignature.showSignatureSection();
            return;
        }

        let targetSheetId = sheetId;
        let sheetUrl = '';
        
        // If no sheetId provided, get it from the URL input
        if (!targetSheetId) {
            const url = document.getElementById('sheet-url').value.trim();
            
            if (!url) {
                this.uiController.showStatus('Please enter a pod Google Sheets URL', 'error');
                return;
            }

            if (!isValidGoogleSheetsUrl(url)) {
                this.uiController.showStatus('Please enter a valid Google Sheets URL', 'error');
                return;
            }
            
            targetSheetId = extractSheetId(url);
            sheetUrl = url;
        } else {
            // Construct URL from sheet ID for recent pods functionality
            sheetUrl = `https://docs.google.com/spreadsheets/d/${targetSheetId}`;
        }

        try {
            this.uiController.showStatus('Loading pod...', 'loading');
            this.uiController.setLoadingState(true);

            const sheetData = await this.sheetsAPI.getSheetData(targetSheetId);
            
            this.currentSheetData = sheetData;
            this.currentSheetId = targetSheetId;
            
            // Load data into the analysis interface
            if (!this.analysisInterface) {
                this.analysisInterface = new GuruAnalysisInterface(this.sheetsAPI, this.uiController, this.authManager.guruSignature);
            } else {
                this.analysisInterface.reset();
                this.analysisInterface.setGuruSignature(this.authManager.guruSignature);
            }
            const isLoaded = await this.analysisInterface.loadData(sheetData, guruColor, rowNumber);
            this.uiController.showSheetEditor(sheetData.title || 'Untitled Pod', targetSheetId);
            if (isLoaded) {
                await this.analysisInterface.showCurrentRow();
            }
            
            // Add to recent pods
            this.recentPodsManager.addRecentPod(targetSheetId, sheetData.title || 'Untitled Pod', sheetUrl);
            this.uiController.showStatus(`Loaded pod - ${sheetData.title || 'Untitled Pod'}`, 'success');

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
            this.analysisInterface.reset();
            await this.analysisInterface.loadData(sheetData);
            await this.analysisInterface.showCurrentRow();
            
            const totalRows = this.analysisInterface.getTotalRows();
            this.uiController.showStatus(`Refreshed - ${totalRows} rows available`, 'success');
            
        } catch (error) {
            console.error('Error refreshing pod:', error);
            this.uiController.showStatus(`Error refreshing: ${error.message}`, 'error');
        }
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ThreeCardBlindGuruTool();
    
    // Register service worker for PWA functionality
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                    console.log('✅ Service Worker registered successfully:', registration.scope);
                    
                    // Check for updates periodically
                    setInterval(() => {
                        registration.update();
                    }, 60000); // Check every minute
                })
                .catch((error) => {
                    console.error('❌ Service Worker registration failed:', error);
                });
        });
    }
});
