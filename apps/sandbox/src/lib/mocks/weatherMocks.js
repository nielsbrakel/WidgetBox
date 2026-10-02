/**
 * Mock API responses for the WidgetBox Weather widgets.
 * The shapes match what the app's WeatherService returns (see apps/…-weather/lib).
 * The "real" scenarios call the public Buienradar endpoints from the browser.
 */

const WEATHER_WIDGETS = ["rain-graph", "station", "forecast", "weather-map"];
const MOCK_LOCATION = { latitude: 52.09, longitude: 5.12 };
const ICON_BASE = "https://cdn.buienradar.nl/resources/images/icons/weather/96x96/";

// Buienradar reports times and dates in Europe/Amsterdam, whatever the viewer's time zone.
const AMSTERDAM_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Amsterdam",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const AMSTERDAM_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Amsterdam",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function rainIntensity(scenario, index) {
  if (scenario === "no-rain") return 0;
  if (scenario === "light-rain") return 0.1 + ((index * 7) % 5) / 10;
  if (scenario === "heavy-rain") return 3 + ((index * 13) % 9);
  if (index > 3 && index < 15) return Math.max(0, 5 - (index - 9) ** 2 * 0.2);
  return 0;
}

function mockRainForecast(scenario) {
  const step = 5 * 60 * 1000;
  const start = Math.floor(Date.now() / step) * step;
  const points = Array.from({ length: 24 }, (_, index) => {
    const time = new Date(start + index * step);
    return {
      time: AMSTERDAM_TIME.format(time),
      mmPerHour: Math.round(rainIntensity(scenario, index) * 100) / 100,
    };
  });
  return { points, updatedAt: new Date().toISOString() };
}

function mockStation() {
  return {
    station: {
      id: 6260,
      name: "De Bilt",
      region: "Utrecht",
      observedAt: new Date().toISOString().slice(0, 19),
      temperature: 14.5,
      feelTemperature: 13.2,
      humidity: 82,
      windBft: 3,
      windDirectionDegrees: 225,
      rainLastHour: 0.4,
      iconUrl: `${ICON_BASE}C.png`,
      distanceKm: 4,
    },
    updatedAt: new Date().toISOString(),
  };
}

function mockForecast(days = 5) {
  const icons = ["A", "B", "C", "F", "Q", "J", "R"];
  const [year, month, day] = AMSTERDAM_DATE.format(new Date()).split("-").map(Number);
  return {
    place: "Utrecht",
    days: Array.from({ length: days }, (_, index) => {
      const date = new Date(Date.UTC(year, month - 1, day + index));
      return {
        date: date.toISOString().slice(0, 10),
        min: 6 + ((index * 3) % 5),
        max: 12 + ((index * 5) % 8),
        rainChance: (index * 23) % 90,
        rainMm: (index * 1.3) % 4,
        iconUrl: `${ICON_BASE}${icons[index % icons.length]}.png`,
      };
    }),
    updatedAt: new Date().toISOString(),
  };
}

function readQuery(endpoint) {
  return new URLSearchParams(endpoint.split("?")[1] ?? "");
}

function queryLocation(endpoint) {
  const query = readQuery(endpoint);
  const lat = Number((query.get("latitude") || String(MOCK_LOCATION.latitude)).replace(",", "."));
  const lon = Number((query.get("longitude") || String(MOCK_LOCATION.longitude)).replace(",", "."));
  return { lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 };
}

async function fetchRealRain(endpoint) {
  const { lat, lon } = queryLocation(endpoint);
  const response = await fetch(
    `https://gpsgadget.buienradar.nl/data/raintext/?lat=${lat}&lon=${lon}`,
  );
  if (response.status === 404) throw new Error("OUT_OF_RANGE");
  if (!response.ok) throw new Error("UPSTREAM_UNAVAILABLE");
  const points = (await response.text())
    .split(/\r?\n/)
    .map((line) => line.split("|"))
    .filter(([value, time]) => value && /^\d{2}:\d{2}$/.test(time?.trim() ?? ""))
    .map(([value, time]) => {
      const intensity = Number.parseInt(value, 10);
      const mm = intensity > 0 ? 10 ** ((intensity - 109) / 32) : 0;
      return { time: time.trim(), mmPerHour: Math.round(mm * 100) / 100 };
    });
  return { points, updatedAt: new Date().toISOString() };
}

async function fetchRealStation(endpoint) {
  const origin = queryLocation(endpoint);
  const response = await fetch("https://data.buienradar.nl/2.0/feed/json");
  if (!response.ok) throw new Error("UPSTREAM_UNAVAILABLE");
  const feed = await response.json();
  const stations = feed.actual.stationmeasurements.filter((s) => s.temperature != null);
  const distance = (s) => Math.hypot(s.lat - origin.lat, (s.lon - origin.lon) * 0.6);
  const nearest = stations.reduce((best, s) => (distance(s) < distance(best) ? s : best));
  return {
    station: {
      id: nearest.stationid,
      name: nearest.stationname.replace(/^Meetstation\s+/i, ""),
      region: nearest.regio,
      observedAt: nearest.timestamp,
      temperature: nearest.temperature,
      feelTemperature: nearest.feeltemperature,
      humidity: nearest.humidity,
      windBft: nearest.windspeedBft,
      windDirectionDegrees: nearest.winddirectiondegrees,
      rainLastHour: nearest.rainFallLastHour,
      iconUrl: nearest.fullIconUrl,
      distanceKm: Math.round(distance(nearest) * 111),
    },
    updatedAt: new Date().toISOString(),
  };
}

async function fetchRealForecast(endpoint) {
  const { lat, lon } = queryLocation(endpoint);
  const days = Number(readQuery(endpoint).get("days")) || 5;
  const place = await (
    await fetch(`https://location.buienradar.nl/1.1/location/geo?lat=${lat}&lon=${lon}`)
  ).json();
  const forecast = await (
    await fetch(`https://forecast.buienradar.nl/2.0/forecast/${place.id}`)
  ).json();
  return {
    place: place.name,
    days: forecast.days.slice(0, days).map((day) => ({
      date: day.date.slice(0, 10),
      min: day.mintemperature,
      max: day.maxtemperature,
      rainChance: day.precipitation,
      rainMm: day.precipitationmm,
      iconUrl: `${ICON_BASE}${day.iconcode.toUpperCase()}.png`,
    })),
    updatedAt: new Date().toISOString(),
  };
}

const REAL_HANDLERS = {
  "rain-graph": fetchRealRain,
  station: fetchRealStation,
  forecast: fetchRealForecast,
};

/**
 * Handles an API call for a weather widget.
 * Returns the response, or null when the widget is not a weather widget.
 */
export async function handleWeatherApi(widgetId, scenario, _settings, _method, endpoint) {
  if (!WEATHER_WIDGETS.includes(widgetId)) return null;

  if (endpoint.startsWith("/location")) {
    return scenario.id === "no-location" ? null : MOCK_LOCATION;
  }
  if (scenario.id === "no-location") throw new Error("LOCATION_REQUIRED");
  if (scenario.id === "out-of-range") throw new Error("OUT_OF_RANGE");
  if (scenario.type === "real") return REAL_HANDLERS[widgetId]?.(endpoint) ?? null;

  if (widgetId === "rain-graph") return mockRainForecast(scenario.id);
  if (widgetId === "station") return mockStation();
  if (widgetId === "forecast") return mockForecast(Number(readQuery(endpoint).get("days")) || 5);
  return null;
}
