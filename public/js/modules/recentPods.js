import { CONFIG } from '../config.js';
import { getElement } from '../utils/domUtils.js';
import { TIME_CONSTANTS } from '../utils/constants.js';

export class RecentPodsManager {
    constructor() {
        this.maxRecentPods = 20; // Keep last 20 pods
        this.recentPods = [];
        this.timeAgoCache = new Map(); // Cache time ago calculations
        this.cacheExpiry = 60000; // 1 minute cache expiry
        this.userPreferences = null; // Will be set when auth manager is available
        this.isInitialized = false;
    }

    /**
     * Set the user preferences service (called from main.js after auth)
     */
    setUserPreferences(userPreferences) {
        this.userPreferences = userPreferences;
        this.isInitialized = true;
        // Reload pods from appData
        this.loadRecentPods().then(() => {
            this.renderRecentPods();
        });
    }

    /**
     * Filter pods to only include those from the current calendar month
     * @param {Array} pods - Array of pod objects
     * @returns {Array} Filtered array of pods from current month
     */
    filterCurrentMonth(pods) {
        if (!Array.isArray(pods)) {
            return [];
        }

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        return pods.filter(pod => {
            if (!pod.dateAdded) {
                return false; // Exclude pods without dateAdded
            }

            const podDate = new Date(pod.dateAdded);
            return podDate.getFullYear() === currentYear && 
                   podDate.getMonth() === currentMonth;
        });
    }

    /**
     * Load recent pods from localStorage or Google Drive
     */
    async loadRecentPods() {
        try {
            let pods = [];
            
            if (this.userPreferences && this.userPreferences.isInitialized) {
                // Load from Google appData
                pods = await this.userPreferences.getRecentPods();
                console.log('📥 Loaded recent pods from Google appData:', pods.length, 'pods');
            } else {
                // Fall back to localStorage
                const stored = localStorage.getItem(CONFIG.STORAGE_KEYS.RECENT_PODS);
                pods = stored ? JSON.parse(stored) : [];
                console.log('📥 Loaded recent pods from localStorage:', pods.length, 'pods');
            }
            
            // Filter out pods not from current calendar month
            pods = this.filterCurrentMonth(pods);
            
            // Sort by dateAdded (newest first)
            pods.sort((a, b) => b.dateAdded - a.dateAdded);
            
            this.recentPods = pods;
            return pods;
        } catch (error) {
            console.error('Error loading recent pods:', error);
            this.recentPods = [];
            return [];
        }
    }

    /**
     * Save recent pods to localStorage or Google Drive
     */
    async saveRecentPods() {
        try {
            // Filter out pods not from current calendar month before saving
            this.recentPods = this.filterCurrentMonth(this.recentPods);
            
            // Sort by dateAdded (newest first)
            this.recentPods.sort((a, b) => b.dateAdded - a.dateAdded);
            
            // Keep only the maximum number of pods
            if (this.recentPods.length > this.maxRecentPods) {
                this.recentPods = this.recentPods.slice(0, this.maxRecentPods);
            }
            
            if (this.userPreferences && this.userPreferences.isInitialized) {
                // Save to Google appData
                await this.userPreferences.setRecentPods(this.recentPods);
                console.log('💾 Saved recent pods to Google appData:', this.recentPods.length, 'pods');
            } else {
                // Fall back to localStorage
                localStorage.setItem(CONFIG.STORAGE_KEYS.RECENT_PODS, JSON.stringify(this.recentPods));
                console.log('💾 Saved recent pods to localStorage:', this.recentPods.length, 'pods');
            }
        } catch (error) {
            console.error('Error saving recent pods:', error);
            // Always try to save to localStorage as backup
            localStorage.setItem(CONFIG.STORAGE_KEYS.RECENT_PODS, JSON.stringify(this.recentPods));
        }
    }

    /**
     * Add a pod to recent list
     * @param {string} sheetId - Google Sheets ID
     * @param {string} title - Pod title/name
     * @param {string} url - Full Google Sheets URL
     */
    async addRecentPod(sheetId, title, url) {
        if (!sheetId || !title || !url) {
            console.warn('Invalid pod data provided to addRecentPod');
            return;
        }

        // Check if pod already exists to preserve original dateAdded
        const existingPod = this.recentPods.find(pod => pod.sheetId === sheetId);
        const originalDateAdded = existingPod ? existingPod.dateAdded : Date.now();

        // Remove existing entry if it exists
        this.recentPods = this.recentPods.filter(pod => pod.sheetId !== sheetId);

        // Add to beginning of list with current timestamp for lastAccessed
        const now = Date.now();
        this.recentPods.unshift({
            sheetId,
            title: title.trim(),
            url,
            lastAccessed: now,
            dateAdded: originalDateAdded // Preserve original dateAdded or use current time for new pods
        });

        await this.saveRecentPods();
        this.renderRecentPods();
        
        console.log(`📋 ${existingPod ? 'Updated' : 'Added'} "${title}" ${existingPod ? 'in' : 'to'} recent pods`);
    }

    /**
     * Remove a pod from recent list
     * @param {string} sheetId - Google Sheets ID to remove
     */
    async removeRecentPod(sheetId) {
        this.recentPods = this.recentPods.filter(pod => pod.sheetId !== sheetId);
        await this.saveRecentPods();
        this.renderRecentPods();
        console.log(`🗑️ Removed pod from recent list: ${sheetId}`);
    }

    /**
     * Clear all recent pods
     */
    async clearRecentPods() {
        this.recentPods = [];
        await this.saveRecentPods();
        this.renderRecentPods();
        console.log('🗑️ Cleared all recent pods');
    }

    /**
     * Get recent pods list
     */
    getRecentPods() {
        return [...this.recentPods]; // Return copy
    }

    /**
     * Update last accessed time for a pod
     * @param {string} sheetId - Google Sheets ID
     */
    async updateLastAccessed(sheetId) {
        const pod = this.recentPods.find(p => p.sheetId === sheetId);
        if (pod) {
            pod.lastAccessed = Date.now();
            await this.saveRecentPods();
        }
    }

    /**
     * Render recent pods in the UI
     */
    renderRecentPods() {
        const recentPodsSection = getElement('recent-pods-section');
        const recentPodsList = getElement('recent-pods-list');

        if (!recentPodsSection || !recentPodsList) {
            console.warn('⚠️ Recent pods DOM elements not found');
            return;
        }

        // Filter and sort pods before rendering
        this.recentPods = this.filterCurrentMonth(this.recentPods);
        this.recentPods.sort((a, b) => b.dateAdded - a.dateAdded);

        // Show/hide section based on whether we have recent pods
        if (this.recentPods.length === 0) {
            recentPodsSection.style.display = 'none';
            return;
        }

        recentPodsSection.style.display = 'block';

        // Clear existing list
        recentPodsList.innerHTML = '';

        // Use document fragment for better performance
        const fragment = document.createDocumentFragment();
        
        // Render each recent pod (already sorted by dateAdded, newest first)
        this.recentPods.forEach((pod, index) => {
            const podElement = this.createPodElement(pod);
            fragment.appendChild(podElement);
        });
        
        recentPodsList.appendChild(fragment);
    }

    /**
     * Create DOM element for a recent pod
     * @param {Object} pod - Pod data
     * @returns {HTMLElement} Pod element
     */
    createPodElement(pod) {
        const podElement = document.createElement('div');
        podElement.className = 'recent-pod-item';
        
        // Format date added time
        const dateAddedDate = new Date(pod.dateAdded);
        const addedTimeAgo = this.getTimeAgo(dateAddedDate);
        
        // Format last accessed time
        const lastAccessedDate = new Date(pod.lastAccessed);
        const lastOpenedTimeAgo = this.getTimeAgo(lastAccessedDate);

        podElement.innerHTML = `
            <div class="recent-pod-info">
                <div class="recent-pod-name">${this.escapeHtml(pod.title)}</div>
                <div class="recent-pod-meta">
                    <span>Added: ${addedTimeAgo}</span>
                    <span class="separator"> • </span>
                    <span>Last opened: ${lastOpenedTimeAgo}</span>
                </div>
            </div>
            <button class="recent-pod-remove" title="Remove from recent">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
            </button>
        `;

        // Add click handler for loading the pod
        const podInfo = podElement.querySelector('.recent-pod-info');
        podInfo.addEventListener('click', () => {
            this.loadRecentPod(pod);
        });

        // Add click handler for removing the pod
        const removeBtn = podElement.querySelector('.recent-pod-remove');
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeRecentPod(pod.sheetId);
        });

        return podElement;
    }

    /**
     * Load a recent pod with better error handling
     * @param {Object} pod - Pod data to load
     */
    loadRecentPod(pod) {
        try {
            console.log(`🔄 Loading recent pod: ${pod.title}`);
            
            // Update last accessed time
            this.updateLastAccessed(pod.sheetId);
            
            // Set the URL in the input field
            const urlInput = getElement('sheet-url');
            if (urlInput) {
                urlInput.value = pod.url;
            } else {
                console.warn('Sheet URL input element not found');
            }

            // Dispatch event to trigger loading
            window.dispatchEvent(new CustomEvent('loadRecentPod', {
                detail: { pod }
            }));

            // Also trigger the main load function
            const loadBtn = getElement('load-sheet-btn');
            if (loadBtn) {
                loadBtn.click();
            } else {
                console.warn('Load sheet button not found');
            }
        } catch (error) {
            console.error('Error loading recent pod:', error);
        }
    }

    /**
     * Get human-readable time ago string with caching
     * @param {Date} date - Date to compare
     * @returns {string} Time ago string
     */
    getTimeAgo(date) {
        const timestamp = date.getTime();
        const cacheKey = `${timestamp}-${Math.floor(Date.now() / this.cacheExpiry)}`;
        
        // Check cache first
        if (this.timeAgoCache.has(cacheKey)) {
            return this.timeAgoCache.get(cacheKey);
        }
        
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        let result;
        if (diffMins < 1) result = 'just now';
        else if (diffMins < 60) result = `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
        else if (diffHours < 24) result = `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        else if (diffDays < 7) result = `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
        else result = date.toLocaleDateString();
        
        // Cache the result
        this.timeAgoCache.set(cacheKey, result);
        
        // Clean old cache entries periodically
        if (this.timeAgoCache.size > 100) {
            this.cleanTimeAgoCache();
        }
        
        return result;
    }

    /**
     * Clean expired cache entries
     */
    cleanTimeAgoCache() {
        const currentCacheKey = Math.floor(Date.now() / this.cacheExpiry);
        for (const [key] of this.timeAgoCache) {
            const cacheKeyFromEntry = key.split('-')[1];
            if (parseInt(cacheKeyFromEntry) < currentCacheKey) {
                this.timeAgoCache.delete(key);
            }
        }
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Initialize recent pods display
     */
    async initialize() {
        // Load recent pods first
        if (!this.isInitialized) {
            // If user preferences not available, load from localStorage
            await this.loadRecentPods();
        }
        this.renderRecentPods();
    }


}
