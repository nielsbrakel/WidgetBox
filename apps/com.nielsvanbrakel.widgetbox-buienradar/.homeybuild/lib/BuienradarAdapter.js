'use strict';

/**
 * Base adapter for Buienradar Data.
 * Handles fetching, caching (stale-while-revalidate), and compliance.
 */
class BuienradarAdapter {

    constructor() {
        this.cache = new Map();
        this.ATTRIBUTION = {
            text: "Data: Buienradar.nl",
            url: "https://www.buienradar.nl",
            required: true
        };
    }

    /**
     * Fetch data with stale-while-revalidate caching.
     * @param {string} url 
     * @param {number} ttlMs Time to live in milliseconds
     * @returns {Promise<any>} Parsed JSON or data
     */
    async fetchCached(url, ttlMs = 300000) {
        const now = Date.now();
        const cached = this.cache.get(url);

        // Return cached if fresh
        if (cached && (now - cached.fetchedAt < ttlMs)) {
            return cached.data;
        }

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);

            const data = await this.parseResponse(response);

            // Update cache
            this.cache.set(url, {
                data,
                fetchedAt: now
            });

            return data;
        } catch (error) {
            console.error(`[BuienradarAdapter] Fetch failed for ${url}:`, error);

            // Return stale data if available
            if (cached) {
                return cached.data;
            }
            throw error;
        }
    }

    async parseResponse(response) {
        return response.json();
    }

    getAttribution() {
        return this.ATTRIBUTION;
    }
}

module.exports = BuienradarAdapter;
