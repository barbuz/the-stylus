import { CONFIG } from '../config.js';
import { UserPreferences } from './userPreferences.js';

export class AuthManager {
    constructor() {
        this.user = null;
        this.isAuthenticated = false;
        this.guruSignature = '';
        this.tokenClient = null;
        this.initialized = false;
        this.userPreferences = new UserPreferences();
    }

    async initialize() {
        if (this.initialized) return;
        
        try {
            // Initialize Google API client for Sheets API
            await new Promise((resolve, reject) => {
                gapi.load('client', {
                    callback: resolve,
                    onerror: reject
                });
            });
            
            await gapi.client.init({
                discoveryDocs: CONFIG.DISCOVERY_DOCS,
            });

            // Load user ID from localStorage if available
            const userId = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_ID);
            
            // Initialize Google Identity Services for authentication
            this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: CONFIG.GOOGLE_CLIENT_ID,
                scope: CONFIG.SCOPES,
                login_hint: userId || '', // Use stored user ID if available
                callback: (response) => {
                    if (response.error) {
                        console.error('OAuth error:', response.error);
                        return;
                    }
                    const idToken = response.id_token;
                    let sub = null;
                    // If an ID token is provided, extract the user ID (sub)
                    if (idToken) {
                        const payload = JSON.parse(atob(idToken.split('.')[1]));
                        sub = payload.sub;
                    }
                    console.log('✅ OAuth token received');
                    this.handleAuthSuccess(response.access_token, sub, response.expires_in);
                }
            });
            
            this.initialized = true;
            console.log('✅ Google API client and Identity Services initialized');
            
        } catch (error) {
            console.error('Error initializing Google services:', error);
            throw error;
        }
    }


    async handleAuthSuccess(accessToken, sub, expiresIn = 3600) {
        try {
            // Set access token for gapi client
            gapi.client.setToken({
                access_token: accessToken
            });
            
            // Create minimal user object without profile data
            this.user = {
                accessToken: accessToken
            };
            this.isAuthenticated = true;
            
            // Store tokens for persistence
            this.saveTokens(accessToken, expiresIn);

            // Save user sub if they want to be remembered
            if (this.shouldRememberUser() && sub) {
                localStorage.setItem(CONFIG.STORAGE_KEYS.USER_ID, sub);
                localStorage.setItem(CONFIG.STORAGE_KEYS.LAST_LOGIN, Date.now().toString());
            } else {
                localStorage.removeItem(CONFIG.STORAGE_KEYS.USER_ID);
                localStorage.removeItem(CONFIG.STORAGE_KEYS.LAST_LOGIN);
            }
            
            // Initialize user preferences in Google Drive
            await this.initializeUserPreferences();
            
            // Update UI immediately
            this.renderAuthSection();
            this.showAppContent();
            
            // Dispatch login event
            window.dispatchEvent(new CustomEvent('userLoggedIn'));

            console.log('✅ User successfully authenticated');
            
        } catch (error) {
            console.error('Error during authentication:', error);
            
            // Show error to user and reset login button
            this.setLoginButtonLoading(false);
            
            // If we can't proceed with authentication, reset state
            this.isAuthenticated = false;
            this.user = null;
            
            // Show a user-friendly error message
            alert('Authentication failed. Please try logging in again.');
        }
    }

    async initializeUserPreferences() {
        try {
            // Initialize user preferences with appData storage
            await this.userPreferences.initialize(this.user);
            
            // Load guru signature from appData
            const guruSignature = await this.userPreferences.getGuruSignature();
            if (guruSignature) {
                this.guruSignature = guruSignature;
                this.updateGuruSignature(guruSignature);
                
                // Dispatch event to notify other components
                window.dispatchEvent(new CustomEvent('guruSignatureLoaded', {
                    detail: { signature: guruSignature }
                }));
            }
            
            console.log('✅ User preferences initialized from Google appData');
        } catch (error) {
            console.error('Error initializing user preferences:', error);
            // Fall back to localStorage
            this.loadGuruSignature();
        }
    }

    loadGuruSignature() {
        const stored = localStorage.getItem(CONFIG.STORAGE_KEYS.GURU_SIGNATURE);
        if (stored) {
            this.guruSignature = stored;
        }
    }

    async saveGuruSignature(signature) {
        this.guruSignature = signature;
        
        try {
            // Save to Google appData if user preferences are initialized
            if (this.userPreferences.isInitialized) {
                await this.userPreferences.setGuruSignature(signature);
            } else {
                // Fall back to localStorage
                localStorage.setItem(CONFIG.STORAGE_KEYS.GURU_SIGNATURE, signature);
            }
        } catch (error) {
            console.error('Error saving guru signature:', error);
            // Fall back to localStorage
            localStorage.setItem(CONFIG.STORAGE_KEYS.GURU_SIGNATURE, signature);
        }
    }

    saveTokens(accessToken, expiresIn = 3600) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.ACCESS_TOKEN, accessToken);
        
        // Calculate expiry time
        const expiryTime = Date.now() + (expiresIn * 1000);
        localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN_EXPIRY, expiryTime.toString());
        
        console.log('💾 Token saved for persistent session', {
            expires_at: new Date(expiryTime).toLocaleString(),
            expires_in_minutes: Math.round(expiresIn / 60)
        });
    }

    setRememberUser(remember = true) {
        if (remember) {
            localStorage.setItem(CONFIG.STORAGE_KEYS.REMEMBER_USER, 'true');
        } else {
            localStorage.removeItem(CONFIG.STORAGE_KEYS.REMEMBER_USER);
        }
    }

    shouldRememberUser() {
        return localStorage.getItem(CONFIG.STORAGE_KEYS.REMEMBER_USER) === 'true';
    }

    getLastLoginTime() {
        const lastLogin = localStorage.getItem(CONFIG.STORAGE_KEYS.LAST_LOGIN);
        return lastLogin ? parseInt(lastLogin) : null;
    }

    getStoredTokens() {
        const accessToken = localStorage.getItem(CONFIG.STORAGE_KEYS.ACCESS_TOKEN);
        const expiryTime = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN_EXPIRY);
        
        if (!accessToken) {
            return null;
        }
        
        return { 
            accessToken, 
            expiryTime: expiryTime ? parseInt(expiryTime) : null 
        };
    }

    clearStoredAuth() {
        localStorage.removeItem(CONFIG.STORAGE_KEYS.ACCESS_TOKEN);
        localStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN_EXPIRY);
        console.log('🗑️ Cleared stored authentication');
    }

    async attemptAutoReauth() {
        try {
            // Only attempt auto re-auth if user opted to be remembered
            if (!this.shouldRememberUser()) {
                console.log('🔐 Auto re-auth skipped - user chose not to be remembered');
                return false;
            }

            // Load user ID from localStorage
            const userId = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_ID);
            if (!userId) {
                console.log('🔐 Auto re-auth skipped - user ID not found');
                return false;
            }

            console.log('🔄 Attempting automatic re-authentication...');
            
            // Try silent authentication with Google Identity Services
            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    console.log('⏰ Auto re-auth timeout after 5 seconds');
                    resolve(false);
                }, 5000);

                try {
                    // Create a silent token client for automatic login
                    const silentTokenClient = google.accounts.oauth2.initTokenClient({
                        client_id: CONFIG.GOOGLE_CLIENT_ID,
                        scope: CONFIG.SCOPES,
                        login_hint: userId, // Use stored user ID
                        prompt: 'none', // No user interaction
                        callback: (response) => {
                            clearTimeout(timeout);
                            
                            if (response.error) {
                                console.log('❌ Silent auto re-auth failed:', response.error);
                                resolve(false);
                            } else {
                                console.log('✅ Silent auto re-auth successful');
                                this.handleAuthSuccess(response.access_token, null, response.expires_in);
                                resolve(true);
                            }
                        }
                    });

                    // Request token silently (no user interaction)
                    silentTokenClient.requestAccessToken();
                    
                } catch (error) {
                    clearTimeout(timeout);
                    console.log('❌ Error during silent auth:', error);
                    resolve(false);
                }
            });
            
        } catch (error) {
            console.error('Auto re-authentication failed:', error);
            return false;
        }
    }

    async checkAuthStatus() {
        try {
            if (!this.initialized) {
                await this.initialize();
            }
            
            // Load guru signature early, regardless of auth status
            this.loadGuruSignature();
            
            // First, check for stored tokens in localStorage
            const storedTokens = this.getStoredTokens();
            if (storedTokens) {
                console.log('🔄 Found stored tokens, checking expiry...');
                
                // Check if access token is expired
                const isExpired = storedTokens.expiryTime && Date.now() >= storedTokens.expiryTime;
                
                if (isExpired) {
                    console.log('🕒 Access token expired, attempting automatic re-authentication...');
                    
                    // Try automatic re-authentication
                    const reauthSuccess = await this.attemptAutoReauth();
                    if (reauthSuccess) {
                        console.log('✅ Automatic re-authentication successful');
                        return true;
                    }
                    
                    console.log('❌ Automatic re-authentication failed, clearing stored auth');
                    this.clearStoredAuth();
                    
                    // Show login screen when auto re-auth fails
                    this.showLoginScreen();
                    return false;
                }
                
                // Try to validate the token using stored tokens only
                try {
                    // Set access token for gapi client
                    gapi.client.setToken({
                        access_token: storedTokens.accessToken
                    });
                    
                    this.user = {
                        accessToken: storedTokens.accessToken
                    };
                    this.isAuthenticated = true;
                    this.loadGuruSignature();
                    
                    // Initialize user preferences for restored session
                    await this.initializeUserPreferences();
                    
                    console.log('✅ Session restored successfully');
                    
                    // Render auth section to show guru signature
                    this.renderAuthSection();
                    
                    // Dispatch login event for restored session
                    setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('userLoggedIn'));
                    }, 100);
                    
                    return true;
                } catch (error) {
                    console.log('❌ Error validating stored token, attempting silent re-auth...', error);
                    
                    // Try automatic re-authentication when there's an error
                    const reauthSuccess = await this.attemptAutoReauth();
                    if (reauthSuccess) {
                        console.log('✅ Silent re-authentication successful after token validation error');
                        return true;
                    }
                    
                    console.log('❌ Silent re-authentication failed, clearing stored auth');
                    this.clearStoredAuth();
                    
                    // Show login screen when silent re-auth fails
                    return false;
                }
            }
            
            // Final attempt: try silent authentication if no valid tokens found
            if (!this.isAuthenticated) {
                console.log('🔄 No valid tokens found, attempting silent authentication...');
                const reauthSuccess = await this.attemptAutoReauth();
                if (reauthSuccess) {
                    console.log('✅ Silent authentication successful as fallback');
                    return true;
                }
            }
            
            this.isAuthenticated = false;
            this.user = null;
            console.log('❌ No valid authentication found');
            
            // Show login screen when no authentication is found
            this.showLoginScreen();
            return false;
        } catch (error) {
            console.error('Error checking auth status:', error);
            this.isAuthenticated = false;
            this.user = null;
            
            // Show login screen when there's an error checking auth
            this.showLoginScreen();
            return false;
        }
    }

    async login() {
        try {
            if (!this.initialized) {
                await this.initialize();
            }
            
            // Show loading state on login button
            this.setLoginButtonLoading(true);
            
            // Request access token using Google Identity Services
            this.tokenClient.requestAccessToken();
            
        } catch (error) {
            console.error('Error during login:', error);
            this.setLoginButtonLoading(false);
            return false;
        }
    }

    async logout() {
        try {
            // Trigger custom event before logout
            window.dispatchEvent(new CustomEvent('userLoggedOut'));
            
            // Revoke the token if we have one
            if (this.user && this.user.accessToken) {
                google.accounts.oauth2.revoke(this.user.accessToken);
            }
            
            this.isAuthenticated = false;
            this.user = null;
            this.guruSignature = '';
            
            // Clear all stored authentication data
            this.clearStoredAuth();
            
            // Clear remember preference and login time (user manually logged out)
            localStorage.removeItem(CONFIG.STORAGE_KEYS.REMEMBER_USER);
            localStorage.removeItem(CONFIG.STORAGE_KEYS.LAST_LOGIN);
            
            // Note: We intentionally keep the guru signature in localStorage so it persists across logout/login
            
            console.log('👋 User logged out successfully');
            window.location.reload();
        } catch (error) {
            console.error('Error logging out:', error);
        }
    }

    getUser() {
        return this.user;
    }

    isLoggedIn() {
        return this.isAuthenticated;
    }

    getAccessToken() {
        if (this.user && this.user.accessToken) {
            return this.user.accessToken;
        }
        
        // Try to get token from localStorage as fallback
        const storedTokens = this.getStoredTokens();
        return storedTokens ? storedTokens.accessToken : null;
    }

    renderAuthSection() {
        const authSection = document.getElementById('auth-section');
        console.log('AuthManager: Rendering auth section with guruSignature:', this.guruSignature);
        
        if (this.isAuthenticated && this.user) {
            authSection.innerHTML = `
                <div class="user-info">
                    ${this.guruSignature ? `
                        <div class="guru-signature-display">
                            <span class="guru-label">Guru:</span>
                            <span class="guru-signature-name" id="guru-signature-display">${this.guruSignature}</span>
                        </div>
                    ` : ''}
                </div>
                <button id="logout-btn" class="logout-btn">Logout</button>
            `;
            
            document.getElementById('logout-btn').addEventListener('click', () => {
                this.logout();
            });
            
            // Add click handler for guru signature to change it
            if (this.guruSignature) {
                const guruSignatureDisplay = document.getElementById('guru-signature-display');
                if (guruSignatureDisplay) {
                    guruSignatureDisplay.addEventListener('click', () => {
                        this.promptGuruSignatureChange();
                    });
                    guruSignatureDisplay.style.cursor = 'pointer';
                    guruSignatureDisplay.title = 'Click to change guru signature';
                }
            }
        } else {
            authSection.innerHTML = '';
        }
    }

    /**
     * Update the guru signature display in the auth section
     * @param {string} signature - New guru signature
     */
    updateGuruSignature(signature) {
        console.log('AuthManager: Updating guru signature to:', signature);
        this.saveGuruSignature(signature);
        // Only re-render if user is authenticated
        if (this.user) {
            this.renderAuthSection(); // Re-render to show the signature
        }
    }

    /**
     * Prompt user to change guru signature
     */
    promptGuruSignatureChange() {
        // Dispatch event for guru signature module to handle
        window.dispatchEvent(new CustomEvent('requestGuruSignatureChange'));
    }

    showLoginScreen() {
        document.getElementById('login-section').style.display = 'block';
        document.getElementById('app-content').style.display = 'none';
        
        const loginBtn = document.getElementById('login-btn');
        // Remove existing listeners to prevent duplicates
        const newLoginBtn = loginBtn.cloneNode(true);
        loginBtn.parentNode.replaceChild(newLoginBtn, loginBtn);
        
        // Set checkbox state based on stored preference
        const rememberCheckbox = document.getElementById('remember-me-checkbox');
        if (rememberCheckbox) {
            rememberCheckbox.checked = this.shouldRememberUser();
        }
        
        newLoginBtn.addEventListener('click', () => {
            // Save the remember me preference before login
            const rememberMe = document.getElementById('remember-me-checkbox')?.checked ?? true;
            this.setRememberUser(rememberMe);
            this.login();
        });
    }

    /**
     * Set loading state on login button
     */
    setLoginButtonLoading(isLoading) {
        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) {
            if (isLoading) {
                loginBtn.disabled = true;
                loginBtn.innerHTML = `
                    <div class="loading-spinner"></div>
                    Signing in...
                `;
            } else {
                loginBtn.disabled = false;
                loginBtn.innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 24 24" style="margin-right: 8px;">
                        <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Sign in with Google
                `;
            }
        }
    }

    showAppContent() {
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';
    }
}
