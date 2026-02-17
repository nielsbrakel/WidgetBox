'use strict';

const BuienradarAdapter = require('./BuienradarAdapter');

class RaintextAdapter extends BuienradarAdapter {

    constructor() {
        super();
        this.BASE_URL = 'https://gpsgadget.buienradar.nl/data/raintext/';
        this.TTL = 300000; // 5 minutes
    }

    async getRainForecast(lat, lon) {
        const url = `${this.BASE_URL}?lat=${lat}&lon=${lon}`;
        return this.fetchCached(url, this.TTL);
    }

    async parseResponse(response) {
        const text = await response.text();
        return this.parseRaintext(text);
    }

    parseRaintext(text) {
        if (!text) return [];

        // Format: 000|10:00 050|10:05 ...
        // Value is 0-255. Formula: mm/h = 10^((value-109)/32)

        return text.trim().split(/\r?\n/).map(line => {
            const [valStr, timeStr] = line.split('|');
            const value = parseInt(valStr, 10);
            const mmPerHour = value === 0 ? 0 : Math.pow(10, (value - 109) / 32);

            return {
                time: timeStr,
                value: value,
                mmPerHour: parseFloat(mmPerHour.toFixed(2))
            };
        });
    }
}

module.exports = RaintextAdapter;
