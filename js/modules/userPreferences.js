/**
 * User Preferences Manager
 * Handles storing user preferences (guru signature, recent pods) in Google appData
 */
import { CONFIG } from '../config.js';

export class UserPreferences {
    constructor() {
        this.preferencesFileName = 'the-stylus-preferences.json';
        this.oldPreferencesFileName = '3cb-visual-guru-preferences.json'; // For migration
        this.preferencesFileId = null;
        this.isInitialized = false;
        this.cache = null;
        this.user = null;
    }

    /**
     * Initialize the preferences manager with user info
     * @param {Object} user - User object from Google auth
     */
    async initialize(user) {
        this.user = user;
        this.isInitialized = true;
        
        try {
            // Try to find existing preferences file
            await this.findOrCreatePreferencesFile();
            
            // Load preferences from appData
            const preferences = await this.loadPreferences();
            
            console.log('✅ User preferences initialized for:', user.email);
            return preferences;
        } catch (error) {
            console.error('Error initializing user preferences:', error);
            // Fall back to localStorage if appData fails
            return this.loadFromLocalStorage();
        }
    }

    /**
     * Find existing preferences file or create new one
     * Includes migration from old filename
     */
    async findOrCreatePreferencesFile() {
        try {
            // First, search for new filename
            const response = await gapi.client.drive.files.list({
                q: `name='${this.preferencesFileName}' and parents in 'appDataFolder' and trashed=false`,
                spaces: 'appDataFolder'
            });

            if (response.result.files && response.result.files.length > 0) {
                this.preferencesFileId = response.result.files[0].id;
                console.log('📄 Found existing preferences file:', this.preferencesFileId);
                return;
            }

            // If not found, check for old filename and migrate
            console.log('🔍 Checking for old preferences file to migrate...');
            const oldResponse = await gapi.client.drive.files.list({
                q: `name='${this.oldPreferencesFileName}' and parents in 'appDataFolder' and trashed=false`,
                spaces: 'appDataFolder'
            });

            if (oldResponse.result.files && oldResponse.result.files.length > 0) {
                const oldFileId = oldResponse.result.files[0].id;
                console.log('📦 Found old preferences file, migrating data...');
                
                // Load data from old file
                const oldData = await this.loadPreferencesFromFile(oldFileId);
                
                // Create new file with the old data
                await this.createPreferencesFile(oldData);
                
                console.log('✅ Successfully migrated preferences from old file');
                return;
            }

            // No old or new file found, create new one
            await this.createPreferencesFile();
        } catch (error) {
            console.error('Error finding/creating preferences file:', error);
            throw error;
        }
    }

    /**
     * Create new preferences file in Google appData
     * @param {Object} initialData - Optional initial data (for migration)
     */
    async createPreferencesFile(initialData = null) {
        try {
            const defaultPreferences = initialData || {
                guruSignature: '',
                recentPods: [],
                version: '1.0.0',
                lastUpdated: new Date().toISOString()
            };

            // Ensure we have the required structure even if migrating
            if (initialData) {
                defaultPreferences.lastUpdated = new Date().toISOString();
            }

            const fileMetadata = {
                name: this.preferencesFileName,
                parents: ['appDataFolder'] // Store in app-specific hidden folder
            };

            const response = await gapi.client.request({
                path: 'https://www.googleapis.com/upload/drive/v3/files',
                method: 'POST',
                params: {
                    uploadType: 'multipart'
                },
                headers: {
                    'Content-Type': 'multipart/related; boundary="foo_bar_baz"'
                },
                body: this.createMultipartBody(fileMetadata, JSON.stringify(defaultPreferences, null, 2))
            });

            this.preferencesFileId = response.result.id;
            this.cache = defaultPreferences;
            
            console.log('📄 Created new preferences file:', this.preferencesFileId);
        } catch (error) {
            console.error('Error creating preferences file:', error);
            throw error;
        }
    }

    /**
     * Create multipart body for file upload
     */
    createMultipartBody(metadata, data) {
        const delimiter = 'foo_bar_baz';
        const close_delim = `\r\n--${delimiter}--`;
        
        let body = '--' + delimiter + '\r\n';
        body += 'Content-Type: application/json\r\n\r\n';
        body += JSON.stringify(metadata) + '\r\n';
        body += '--' + delimiter + '\r\n';
        body += 'Content-Type: application/json\r\n\r\n';
        body += data;
        body += close_delim;
        
        return body;
    }

    /**
     * Load preferences from a specific file ID
     * @param {string} fileId - The file ID to load from
     */
    async loadPreferencesFromFile(fileId) {
        try {
            const response = await gapi.client.drive.files.get({
                fileId: fileId,
                alt: 'media'
            });

            const preferences = JSON.parse(response.body);
            
            console.log('📥 Loaded preferences from file:', {
                guruSignature: preferences.guruSignature,
                recentPodsCount: preferences.recentPods?.length || 0,
                lastUpdated: preferences.lastUpdated
            });

            this.cache = preferences;
            
            return preferences;
        } catch (error) {
            console.error('Error loading preferences from file:', error);
            throw error;
        }
    }

    /**
     * Load preferences from Google appData
     */
    async loadPreferences() {
        if (!this.preferencesFileId) {
            throw new Error('No preferences file ID available');
        }

        return await this.loadPreferencesFromFile(this.preferencesFileId);
    }

    /**
     * Save preferences to Google appData
     */
    async savePreferences(preferences) {
        if (!this.preferencesFileId) {
            throw new Error('No preferences file ID available');
        }

        try {
            // Update timestamp
            preferences.lastUpdated = new Date().toISOString();
            
            const response = await gapi.client.request({
                path: `https://www.googleapis.com/upload/drive/v3/files/${this.preferencesFileId}`,
                method: 'PATCH',
                params: {
                    uploadType: 'media'
                },
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(preferences, null, 2)
            });

            this.cache = preferences;
            
            console.log('💾 Saved preferences to appData');
            return response;
        } catch (error) {
            console.error('Error saving preferences to appData:', error);
            // Fall back to localStorage
            this.saveToLocalStorage(preferences);
            throw error;
        }
    }

    /**
     * Get guru signature
     */
    async getGuruSignature() {
        if (!this.isInitialized) {
            return localStorage.getItem(CONFIG.STORAGE_KEYS.GURU_SIGNATURE) || '';
        }

        try {
            if (!this.cache) {
                await this.loadPreferences();
            }
            return this.cache.guruSignature || '';
        } catch (error) {
            console.error('Error getting guru signature from appData:', error);
            return localStorage.getItem(CONFIG.STORAGE_KEYS.GURU_SIGNATURE) || '';
        }
    }

    /**
     * Set guru signature
     */
    async setGuruSignature(signature) {
        if (!this.isInitialized) {
            localStorage.setItem(CONFIG.STORAGE_KEYS.GURU_SIGNATURE, signature);
            return;
        }

        try {
            if (!this.cache) {
                await this.loadPreferences();
            }

            if (this.cache.guruSignature !== signature) {
                this.cache.guruSignature = signature;
                await this.savePreferences(this.cache);

            }
            // Also update localStorage as backup
            localStorage.setItem(CONFIG.STORAGE_KEYS.GURU_SIGNATURE, signature);
        } catch (error) {
            console.error('Error setting guru signature in appData:', error);
            // Fall back to localStorage
            localStorage.setItem(CONFIG.STORAGE_KEYS.GURU_SIGNATURE, signature);
        }
    }

    /**
     * Get recent pods
     */
    async getRecentPods() {
        if (!this.isInitialized) {
            const stored = localStorage.getItem(CONFIG.STORAGE_KEYS.RECENT_PODS);
            return stored ? JSON.parse(stored) : [];
        }

        try {
            if (!this.cache) {
                await this.loadPreferences();
            }
            return this.cache.recentPods || [];
        } catch (error) {
            console.error('Error getting recent pods from appData:', error);
            const stored = localStorage.getItem(CONFIG.STORAGE_KEYS.RECENT_PODS);
            return stored ? JSON.parse(stored) : [];
        }
    }

    /**
     * Set recent pods
     */
    async setRecentPods(pods) {
        if (!this.isInitialized) {
            localStorage.setItem(CONFIG.STORAGE_KEYS.RECENT_PODS, JSON.stringify(pods));
            return;
        }

        try {
            if (!this.cache) {
                await this.loadPreferences();
            }

            this.cache.recentPods = pods;
            await this.savePreferences(this.cache);
            
            // Also update localStorage as backup
            localStorage.setItem(CONFIG.STORAGE_KEYS.RECENT_PODS, JSON.stringify(pods));
        } catch (error) {
            console.error('Error setting recent pods in appData:', error);
            // Fall back to localStorage
            localStorage.setItem(CONFIG.STORAGE_KEYS.RECENT_PODS, JSON.stringify(pods));
        }
    }

    /**
     * Load preferences from localStorage (fallback)
     */
    loadFromLocalStorage() {
        const guruSignature = localStorage.getItem(CONFIG.STORAGE_KEYS.GURU_SIGNATURE) || '';
        const recentPodsStr = localStorage.getItem(CONFIG.STORAGE_KEYS.RECENT_PODS);
        const recentPods = recentPodsStr ? JSON.parse(recentPodsStr) : [];

        return {
            guruSignature,
            recentPods,
            version: '1.0.0',
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Save preferences to localStorage (fallback)
     */
    saveToLocalStorage(preferences) {
        if (preferences.guruSignature) {
            localStorage.setItem(CONFIG.STORAGE_KEYS.GURU_SIGNATURE, preferences.guruSignature);
        }
        if (preferences.recentPods) {
            localStorage.setItem(CONFIG.STORAGE_KEYS.RECENT_PODS, JSON.stringify(preferences.recentPods));
        }
    }

    /**
     * Clear all preferences (both appData and localStorage)
     */
    async clearAllPreferences() {
        try {
            if (this.preferencesFileId && this.isInitialized) {
                // Clear appData preferences
                const emptyPreferences = {
                    guruSignature: '',
                    recentPods: [],
                    version: '1.0.0',
                    lastUpdated: new Date().toISOString()
                };
                
                await this.savePreferences(emptyPreferences);
            }
        } catch (error) {
            console.error('Error clearing appData preferences:', error);
        }

        // Clear localStorage
        localStorage.removeItem(CONFIG.STORAGE_KEYS.GURU_SIGNATURE);
        localStorage.removeItem(CONFIG.STORAGE_KEYS.RECENT_PODS);
        
        console.log('🗑️ Cleared all preferences');
    }
}
