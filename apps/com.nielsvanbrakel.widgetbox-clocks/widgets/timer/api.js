const { createStateApi, invalid, toInt, toTimestampOrNull } = require("../../lib/widgetState");

const MAX_DURATION_MS = (23 * 3600 + 59 * 60 + 59) * 1000;
const STATUSES = new Set(["idle", "running", "paused"]);

/**
 * A countdown: `durationMs` as set by the user, `remainingMs` left at the last start or pause,
 * `startedAt` (epoch ms, Homey clock) while running, and `status` idle | running | paused.
 * A running timer whose remaining time has passed is finished; that is derived, not stored.
 */
const sanitizeItem = (item) => {
  if (!STATUSES.has(item.status)) throw invalid("status");
  const durationMs = toInt(item.durationMs, 0, MAX_DURATION_MS, "durationMs");
  const startedAt = toTimestampOrNull(item.startedAt, "startedAt");
  if ((item.status === "running") !== (startedAt !== null)) throw invalid("startedAt");

  return {
    status: item.status,
    durationMs,
    remainingMs: toInt(item.remainingMs, 0, durationMs, "remainingMs"),
    startedAt,
  };
};

module.exports = createStateApi({ prefix: "timer", sanitizeItem });
