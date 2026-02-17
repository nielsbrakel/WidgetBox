/**
 * Mock API responses for Buienradar widgets.
 * Each export handles one widget's mock data + optional real fetching.
 */

/**
 * Generate time-based rain forecast mock data.
 */
function generateForecast(scenario) {
    const forecast = [];
    const now = new Date();
    const ms = 1000 * 60 * 5;
    const rounded = new Date(Math.round(now.getTime() / ms) * ms);

    for (let i = 0; i < 24; i++) {
        const time = new Date(rounded.getTime() + (i * ms));
        const hours = time.getHours().toString().padStart(2, '0');
        const minutes = time.getMinutes().toString().padStart(2, '0');

        let mm = 0;

        if (scenario === 'no-rain') {
            mm = 0;
        } else if (scenario === 'light-rain') {
            mm = Math.random() * 0.5;
        } else if (scenario === 'heavy-rain') {
            mm = 2.0 + (Math.random() * 5.0);
        } else {
            // Default / Dynamic bell curve
            if (i > 3 && i < 15) {
                const x = (i - 9);
                mm = Math.max(0, 5 - (x * x * 0.2));
            }
        }

        forecast.push({
            time: `${hours}:${minutes}`,
            mmPerHour: parseFloat(mm.toFixed(1)),
            mm: parseFloat(mm.toFixed(1)),
        });
    }

    return { forecast };
}

const MOCK_STATION = {
    station: {
        stationname: 'Meetstation De Bilt (MOCK)',
        temperature: 14.5,
        humidity: 82,
        windspeedBft: 3,
        rainFallLastHour: 0.0,
        iconurl: 'https://cdn.buienradar.nl/resources/images/icons/weather/small/zonnig.png',
    },
};

const MOCK_FORECAST = {
    forecast: [
        { day: 'Maandag', date: '13 feb', min: 8, max: 12, rain: 10, iconUrl: 'https://cdn.buienradar.nl/resources/images/icons/weather/96x96/Q.png' },
        { day: 'Dinsdag', date: '14 feb', min: 9, max: 13, rain: 40, iconUrl: 'https://cdn.buienradar.nl/resources/images/icons/weather/96x96/F.png' },
        { day: 'Woensdag', date: '15 feb', min: 7, max: 11, rain: 80, iconUrl: 'https://cdn.buienradar.nl/resources/images/icons/weather/96x96/F.png' },
        { day: 'Donderdag', date: '16 feb', min: 8, max: 14, rain: 20, iconUrl: 'https://cdn.buienradar.nl/resources/images/icons/weather/96x96/B.png' },
        { day: 'Vrijdag', date: '17 feb', min: 6, max: 10, rain: 0, iconUrl: 'https://cdn.buienradar.nl/resources/images/icons/weather/96x96/A.png' },
    ],
};

/**
 * Fetch real rain graph data from Buienradar.
 */
async function fetchRealGraph(settings, endpoint) {
    const urlParams = new URLSearchParams(endpoint.split('?')[1]);
    const lat = urlParams.get('lat') || settings.lat || 52.1;
    const lon = urlParams.get('lon') || settings.lon || 5.1;

    const response = await fetch(`https://gpsgadget.buienradar.nl/data/raintext/?lat=${lat}&lon=${lon}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();

    const forecast = [];
    for (const line of text.trim().split('\n')) {
        const [val, time] = line.split('|');
        if (val && time) {
            const mm = Math.pow(10, (parseInt(val) - 109) / 32);
            forecast.push({
                time,
                mm: isNaN(mm) ? 0 : mm,
                mmPerHour: isNaN(mm) ? 0 : mm,
            });
        }
    }
    return { forecast };
}

/**
 * Fetch real station/forecast data from Buienradar JSON feed.
 */
async function fetchRealStationOrForecast(widgetId, settings) {
    const response = await fetch('https://data.buienradar.nl/2.0/feed/json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    const lat = parseFloat(settings.lat || 52.1);
    const lon = parseFloat(settings.lon || 5.1);

    // Find closest station
    let bestStation = null;
    let minDist = Infinity;

    if (settings.stationId) {
        bestStation = data.actual.stationmeasurements.find(s => s.stationid == settings.stationId);
    }

    if (!bestStation && data.actual?.stationmeasurements) {
        for (const station of data.actual.stationmeasurements) {
            const dist = Math.sqrt(Math.pow(station.lat - lat, 2) + Math.pow(station.lon - lon, 2));
            if (dist < minDist) {
                minDist = dist;
                bestStation = station;
            }
        }
    }

    if (widgetId === 'buienradar-station') {
        if (!bestStation) throw new Error('No station found');
        return {
            station: {
                stationname: bestStation.stationname,
                temperature: bestStation.temperature,
                humidity: bestStation.humidity,
                windspeedBft: bestStation.windspeedBft,
                rainFallLastHour: bestStation.rainFallLastHour,
                iconurl: bestStation.iconurl,
            },
        };
    }

    if (widgetId === 'buienradar-forecast') {
        const days = data.forecast.fivedayforecast.map(d => ({
            day: new Date(d.day).toLocaleDateString('nl-NL', { weekday: 'long' }),
            date: new Date(d.day).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }),
            min: d.mintemperature,
            max: d.maxtemperature,
            rain: d.rainChance,
            iconUrl: d.iconurl,
        }));
        return { forecast: days };
    }

    return null;
}

/**
 * Handle API call for a Buienradar widget.
 * Returns response data or null if this widget isn't a buienradar widget.
 */
export async function handleBuienradarApi(widgetId, scenario, settings, method, endpoint) {
    const BUIENRADAR_WIDGETS = ['buienradar-graph', 'buienradar-station', 'buienradar-forecast'];
    if (!BUIENRADAR_WIDGETS.includes(widgetId)) return null;

    // Real data fetching
    if (scenario.type === 'real') {
        if (widgetId === 'buienradar-graph') {
            return fetchRealGraph(settings, endpoint);
        }
        return fetchRealStationOrForecast(widgetId, settings);
    }

    // Mock data
    if (widgetId === 'buienradar-graph') {
        return generateForecast(scenario.id || 'default');
    }
    if (widgetId === 'buienradar-station') {
        return MOCK_STATION;
    }
    if (widgetId === 'buienradar-forecast') {
        return MOCK_FORECAST;
    }

    return null;
}
