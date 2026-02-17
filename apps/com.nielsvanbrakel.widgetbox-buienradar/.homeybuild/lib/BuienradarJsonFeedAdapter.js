'use strict';

const BuienradarAdapter = require('./BuienradarAdapter');

class BuienradarJsonFeedAdapter extends BuienradarAdapter {

    constructor() {
        super();
        this.URL = 'https://data.buienradar.nl/2.0/feed/json';
        this.TTL = 600000; // 10 minutes
    }

    async getData() {
        const data = await this.fetchCached(this.URL, this.TTL);
        return this.normalizeFeed(data);
    }

    normalizeFeed(feed) {
        // Basic normalization or return raw if widgets handle it
        // Adding convenience getters could happen here
        return {
            ...feed,
            _attribution: this.getAttribution()
        };
    }

    /**
     * Helper to find nearest station
     * @param {number} lat 
     * @param {number} lon 
     * @param {*} feedData 
     */
    findNearestStation(lat, lon, feedData) {
        const stations = feedData.actual?.stationmeasurements || [];
        if (!stations.length) return null;

        let nearest = null;
        let minDist = Infinity;

        for (const station of stations) {
            const dist = Math.sqrt(
                Math.pow(station.lat - lat, 2) + Math.pow(station.lon - lon, 2)
            );
            if (dist < minDist) {
                minDist = dist;
                nearest = station;
            }
        }
        return nearest;
    }
}

module.exports = BuienradarJsonFeedAdapter;
