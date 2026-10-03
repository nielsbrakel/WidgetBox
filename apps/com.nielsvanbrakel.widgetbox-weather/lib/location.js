const STATION_ID_PATTERN = /^\d{4,6}$/;

/** Parses a coordinate typed by a user ("52.1", "52,1", " 5 "). Returns null when invalid. */
function parseCoordinate(value, limit) {
  if (typeof value === "number")
    return Number.isFinite(value) && Math.abs(value) <= limit ? value : null;
  if (typeof value !== "string") return null;
  const text = value.trim().replace(",", ".");
  if (text === "") return null;
  const number = Number(text);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
}

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

/**
 * Reads a latitude/longitude pair.
 * Returns `{ lat, lon }`, `null` when both are empty, or throws INVALID_LOCATION.
 */
function parseLocation(latitude, longitude) {
  if (isBlank(latitude) && isBlank(longitude)) return null;
  const lat = parseCoordinate(latitude, 90);
  const lon = parseCoordinate(longitude, 180);
  if (lat === null || lon === null) {
    const error = new Error("INVALID_LOCATION");
    error.code = "INVALID_LOCATION";
    throw error;
  }
  return { lat, lon };
}

/** Rounds to 2 decimals (about 1 km), which matches the resolution of the Buienradar data. */
function roundCoordinate(value) {
  return Math.round(value * 100) / 100;
}

function roundLocation({ lat, lon }) {
  return { lat: roundCoordinate(lat), lon: roundCoordinate(lon) };
}

/** Great-circle distance in kilometres. */
function distanceKm(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function isValidStationId(value) {
  return typeof value === "string" && STATION_ID_PATTERN.test(value);
}

module.exports = {
  distanceKm,
  isBlank,
  isValidStationId,
  parseCoordinate,
  parseLocation,
  roundLocation,
};
