'use strict';

const BuienradarJsonFeedAdapter = require('../../lib/BuienradarJsonFeedAdapter');
const StationFallbackAdapter = require('../../lib/StationFallbackAdapter');

module.exports = {
    async getData({ homey, query }) {
        const lat = parseFloat(query.lat) || 52.1;
        const lon = parseFloat(query.lon) || 5.1;
        const stationId = query.stationId; // Optional manual override

        const feedAdapter = new BuienradarJsonFeedAdapter();
        const fallbackAdapter = new StationFallbackAdapter();

        // 1. If manual ID provided, use it directly (fallback adapter usually quicker for single station)
        if (stationId) {
            try {
                const station = await fallbackAdapter.getStationData(stationId);
                return { station };
            } catch (e) {
                // If fallback fails, maybe try feed? But ID is specific.
                throw new Error(`Failed to fetch station ${stationId}`);
            }
        }

        // 2. Auto-select nearest from feed
        try {
            const feed = await feedAdapter.getData();
            const station = feedAdapter.findNearestStation(lat, lon, feed);

            if (station) {
                return { station };
            }

            throw new Error('No nearest station found');
        } catch (e) {
            console.error('Feed fetch failed or no station found', e);
            throw new Error('Could not fetch weather data');
        }
    }
};
