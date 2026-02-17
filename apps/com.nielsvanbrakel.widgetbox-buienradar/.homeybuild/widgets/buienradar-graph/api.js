'use strict';

const RaintextAdapter = require('../../lib/RaintextAdapter');

module.exports = {
    async getData({ homey, query }) {
        const lat = query.lat;
        const lon = query.lon;

        if (!lat || !lon) {
            throw new Error('Missing location');
        }

        const adapter = new RaintextAdapter();
        try {
            const forecast = await adapter.getRainForecast(lat, lon);
            return { forecast };
        } catch (e) {
            throw new Error('Failed to fetch rain data');
        }
    }
};
