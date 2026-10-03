const RequestCache = require("./RequestCache");
const {
  amsterdamDate,
  findNearestStation,
  normalizeForecastDays,
  normalizeStation,
  parseRaintext,
  trimFeed,
  trimForecast,
} = require("./buienradar");
const { isValidStationId, roundLocation } = require("./location");

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const URLS = {
  raintext: "https://gpsgadget.buienradar.nl/data/raintext/",
  feed: "https://data.buienradar.nl/2.0/feed/json",
  observation: "https://observations.buienradar.nl/1.0/actual/weatherstation/",
  geoLocation: "https://location.buienradar.nl/1.1/location/geo",
  forecast: "https://forecast.buienradar.nl/2.0/forecast/",
};

const POLICY = {
  rain: { ttlMs: 5 * MINUTE, maxStaleMs: 30 * MINUTE },
  feed: { ttlMs: 10 * MINUTE, maxStaleMs: 2 * HOUR },
  observation: { ttlMs: 10 * MINUTE, maxStaleMs: 2 * HOUR },
  geoLocation: { ttlMs: 7 * 24 * HOUR },
  forecast: { ttlMs: 30 * MINUTE, maxStaleMs: 12 * HOUR },
};

const MAX_FORECAST_DAYS = 7;
// The largest response (the full feed) is about 80 KB; anything far bigger is broken or hostile
// and could push the app over Homey's memory limit.
const MAX_BODY_BYTES = 2 * 1024 * 1024;

class WeatherError extends Error {
  constructor(code, options) {
    super(code, options);
    this.name = "WeatherError";
    this.code = code;
  }
}

/** Reads a response body as text, giving up as soon as it passes `maxBytes`. */
async function readLimited(response, maxBytes) {
  const declared = Number(response.headers.get("content-length"));
  if (declared > maxBytes) throw new Error(`Response of ${declared} bytes is too large`);

  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw new Error(`Response is larger than ${maxBytes} bytes`);
    }
    text += decoder.decode(value, { stream: true });
  }
}

/**
 * Fetches and normalizes Buienradar data for all widgets of the app.
 * Created once per app, so every widget on every dashboard shares one cache.
 */
class WeatherService {
  constructor({
    fetchImpl = globalThis.fetch,
    cache = new RequestCache(),
    timeoutMs = 10000,
    maxBodyBytes = MAX_BODY_BYTES,
    now = () => new Date(),
  } = {}) {
    this.fetchImpl = fetchImpl;
    this.maxBodyBytes = maxBodyBytes;
    this.now = now;
    this.cache = cache;
    this.timeoutMs = timeoutMs;
  }

  async request(url, type = "json") {
    let response;
    try {
      response = await this.fetchImpl(url, {
        signal: AbortSignal.timeout(this.timeoutMs),
        redirect: "error",
      });
    } catch (error) {
      throw new WeatherError("UPSTREAM_UNAVAILABLE", { cause: error });
    }
    if (response.status === 404) throw new WeatherError("NOT_FOUND");
    if (!response.ok) throw new WeatherError("UPSTREAM_UNAVAILABLE");
    try {
      const text = await readLimited(response, this.maxBodyBytes);
      return type === "text" ? text : JSON.parse(text);
    } catch (error) {
      throw new WeatherError("UPSTREAM_UNAVAILABLE", { cause: error });
    }
  }

  /** Two-hour rain forecast in 5-minute steps. Only covers the Netherlands and Belgium. */
  async getRainForecast(location) {
    const { lat, lon } = roundLocation(location);
    return this.cache.get(`rain:${lat}:${lon}`, POLICY.rain, async () => {
      const params = new URLSearchParams({ lat: String(lat), lon: String(lon) });
      let text;
      try {
        text = await this.request(`${URLS.raintext}?${params}`, "text");
      } catch (error) {
        if (error.code === "NOT_FOUND") throw new WeatherError("OUT_OF_RANGE", { cause: error });
        throw error;
      }
      const points = parseRaintext(text);
      if (points.length === 0) throw new WeatherError("NO_DATA");
      return { points, updatedAt: new Date().toISOString() };
    });
  }

  /** Current measurements of a given station, or of the station nearest to `location`. */
  async getStation({ location, stationId }) {
    if (stationId) {
      if (!isValidStationId(stationId)) throw new WeatherError("INVALID_STATION");
      return this.cache.get(`station:${stationId}`, POLICY.observation, async () => {
        let raw;
        try {
          raw = await this.request(`${URLS.observation}${stationId}`);
        } catch (error) {
          if (error.code === "NOT_FOUND")
            throw new WeatherError("INVALID_STATION", { cause: error });
          throw error;
        }
        return { station: normalizeStation(raw, null), updatedAt: new Date().toISOString() };
      });
    }

    const feed = await this.cache.get("feed", POLICY.feed, async () => ({
      data: trimFeed(await this.request(URLS.feed)),
      updatedAt: new Date().toISOString(),
    }));
    const origin = roundLocation(location);
    const nearest = findNearestStation(feed.data, origin);
    if (!nearest) throw new WeatherError("NO_DATA");
    return { station: normalizeStation(nearest, origin), updatedAt: feed.updatedAt };
  }

  /** Daily forecast for `location` (any place in the world). */
  async getForecast(location, dayCount = 5) {
    const count = Math.min(Math.max(Math.trunc(dayCount) || 5, 1), MAX_FORECAST_DAYS);
    const place = await this.getPlace(location);
    const forecast = await this.cache.get(`forecast:${place.id}`, POLICY.forecast, async () => ({
      data: trimForecast(await this.request(`${URLS.forecast}${place.id}`)),
      updatedAt: new Date().toISOString(),
    }));
    // Filtered at read time: cached data fetched before midnight must not start with yesterday.
    const days = normalizeForecastDays(forecast.data, count, amsterdamDate(this.now()));
    if (days.length === 0) throw new WeatherError("NO_DATA");
    return { place: place.name, days, updatedAt: forecast.updatedAt };
  }

  async getPlace(location) {
    const { lat, lon } = roundLocation(location);
    return this.cache.get(`place:${lat}:${lon}`, POLICY.geoLocation, async () => {
      const params = new URLSearchParams({ lat: String(lat), lon: String(lon) });
      const place = await this.request(`${URLS.geoLocation}?${params}`);
      if (!Number.isInteger(place?.id)) throw new WeatherError("NO_DATA");
      return { id: place.id, name: typeof place.name === "string" ? place.name : "" };
    });
  }
}

module.exports = { WeatherError, WeatherService, URLS };
