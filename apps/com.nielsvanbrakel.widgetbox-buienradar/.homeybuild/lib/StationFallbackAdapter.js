'use strict';

const BuienradarAdapter = require('./BuienradarAdapter');

class StationFallbackAdapter extends BuienradarAdapter {

    constructor() {
        super();
        this.BASE_URL = 'https://observations.buienradar.nl/1.0/actual/weatherstation';
        this.TTL = 600000; // 10 minutes
    }

    async getStationData(stationId) {
        const url = `${this.BASE_URL}/${stationId}`;
        return this.fetchCached(url, this.TTL);
    }
}

module.exports = StationFallbackAdapter;
