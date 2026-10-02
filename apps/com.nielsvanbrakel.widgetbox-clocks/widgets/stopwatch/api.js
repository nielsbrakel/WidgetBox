const {
  DAY_MS,
  createStateApi,
  invalid,
  toInt,
  toTimestampOrNull,
} = require("../../lib/widgetState");

const MAX_LAPS = 99;
const MAX_ELAPSED_MS = 1000 * DAY_MS;

/**
 * A stopwatch: `elapsedMs` accumulated before the current run, `startedAt` (epoch ms, Homey
 * clock) while running or null when paused, and `laps` as total elapsed ms at each lap.
 */
const sanitizeItem = (item) => {
  if (!Array.isArray(item.laps) || item.laps.length > MAX_LAPS) throw invalid("laps");
  return {
    elapsedMs: toInt(item.elapsedMs, 0, MAX_ELAPSED_MS, "elapsedMs"),
    startedAt: toTimestampOrNull(item.startedAt, "startedAt"),
    laps: item.laps.map((lap) => toInt(lap, 0, MAX_ELAPSED_MS, "lap")),
  };
};

module.exports = createStateApi({ prefix: "stopwatch", sanitizeItem });
