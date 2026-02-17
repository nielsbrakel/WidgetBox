'use strict';

const BuienradarJsonFeedAdapter = require('../../lib/BuienradarJsonFeedAdapter');

module.exports = {
    async getData({ homey, query }) {
        const adapter = new BuienradarJsonFeedAdapter();

        try {
            const feed = await adapter.getData();
            const forecast = feed.forecast?.fivedayforecast || [];

            // Map to simpler structure
            const days = forecast.map(day => ({
                day: new Date(day.day).toLocaleDateString('nl-NL', { weekday: 'long' }),
                date: new Date(day.day).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }),
                min: day.mintemperatureMin,
                max: day.maxtemperatureMax,
                rain: day.rainChance,
                iconUrl: day.iconurl
            }));

            return { forecast: days };
        } catch (e) {
            throw new Error('Could not fetch forecast');
        }
    }
};
