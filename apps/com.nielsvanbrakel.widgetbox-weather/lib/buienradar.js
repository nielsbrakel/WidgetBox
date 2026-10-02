const { distanceKm } = require("./location");

const ICON_BASE_URL = "https://cdn.buienradar.nl/resources/images/icons/weather/96x96/";
const ICON_CODE_PATTERN = /^[a-z]{1,2}$/i;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

/** Buienradar rain intensity (0-255) to mm/h. */
function intensityToMmPerHour(value) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(10 ** ((value - 109) / 32) * 100) / 100;
}

/** Parses the raintext format: one "intensity|HH:MM" pair per line. */
function parseRaintext(text) {
  if (typeof text !== "string") return [];
  const points = [];
  for (const line of text.split(/\r?\n/)) {
    const [rawValue, rawTime] = line.split("|");
    const value = Number.parseInt(rawValue, 10);
    const time = rawTime?.trim();
    if (Number.isFinite(value) && TIME_PATTERN.test(time ?? "")) {
      points.push({ time, mmPerHour: intensityToMmPerHour(value) });
    }
  }
  return points;
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function iconUrlFromCode(code) {
  return typeof code === "string" && ICON_CODE_PATTERN.test(code)
    ? `${ICON_BASE_URL}${code.toUpperCase()}.png`
    : null;
}

function safeIconUrl(url) {
  return typeof url === "string" && url.startsWith("https://cdn.buienradar.nl/") ? url : null;
}

/** Normalizes a station from the JSON feed or the observations API to one shape. */
function normalizeStation(raw, origin) {
  const station = {
    id: toNumber(raw.stationid),
    name:
      typeof raw.stationname === "string" ? raw.stationname.replace(/^Meetstation\s+/i, "") : "",
    region: typeof raw.regio === "string" ? raw.regio : "",
    observedAt: typeof raw.timestamp === "string" ? raw.timestamp : null,
    temperature: toNumber(raw.temperature),
    feelTemperature: toNumber(raw.feeltemperature),
    humidity: toNumber(raw.humidity),
    windBft: toNumber(raw.windspeedBft),
    windDirectionDegrees: toNumber(raw.winddirectiondegrees),
    rainLastHour: toNumber(raw.rainFallLastHour),
    iconUrl: safeIconUrl(raw.fullIconUrl) ?? iconUrlFromCode(raw.iconcode),
    distanceKm: null,
  };
  if (origin && Number.isFinite(raw.lat) && Number.isFinite(raw.lon)) {
    station.distanceKm = Math.round(distanceKm(origin, { lat: raw.lat, lon: raw.lon }));
  }
  return station;
}

/** Finds the station closest to `origin` that reports a temperature. */
function findNearestStation(feed, origin) {
  const stations = feed?.actual?.stationmeasurements;
  if (!Array.isArray(stations)) return null;

  let nearest = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const station of stations) {
    if (!Number.isFinite(station.lat) || !Number.isFinite(station.lon)) continue;
    if (toNumber(station.temperature) === null) continue;
    const distance = distanceKm(origin, { lat: station.lat, lon: station.lon });
    if (distance < nearestDistance) {
      nearest = station;
      nearestDistance = distance;
    }
  }
  return nearest;
}

const AMSTERDAM_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Amsterdam",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "YYYY-MM-DD" of `date` in Europe/Amsterdam, the time zone of Buienradar's forecast dates. */
function amsterdamDate(date) {
  return AMSTERDAM_DATE.format(date);
}

/**
 * Normalizes the daily forecast of forecast.buienradar.nl. Dates stay as "YYYY-MM-DD".
 * Days before `today` ("YYYY-MM-DD") are dropped, so cached data never starts with yesterday.
 */
function normalizeForecastDays(forecast, count, today = "") {
  const days = Array.isArray(forecast?.days) ? forecast.days : [];
  return days
    .map((day) => ({ day, date: typeof day.date === "string" ? day.date.slice(0, 10) : null }))
    .filter(({ date }) => date === null || date >= today)
    .slice(0, count)
    .map(({ day, date }) => ({
      date,
      min: toNumber(day.mintemperature),
      max: toNumber(day.maxtemperature),
      rainChance: toNumber(day.precipitation),
      rainMm: toNumber(day.precipitationmm),
      iconUrl: iconUrlFromCode(day.iconcode),
    }));
}

module.exports = {
  amsterdamDate,
  findNearestStation,
  intensityToMmPerHour,
  normalizeForecastDays,
  normalizeStation,
  parseRaintext,
};
