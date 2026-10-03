/**
 * Shared backend for widgets that keep per-instance state on Homey (stopwatch, timer).
 *
 * State is stored in the app settings under `<prefix>_<widgetInstanceId>` as
 * `{ items: [...], updatedAt }`. Every write is validated, size capped and broadcast with
 * `homey.api.realtime` so the same widget open on other devices updates immediately.
 */

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_ITEMS = 10;
const MAX_STATE_BYTES = 16 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_AFTER_MS = 180 * DAY_MS;
const STATE_PREFIXES = ["stopwatch", "timer"];

const invalid = (message) => new Error(`Invalid state: ${message}`);

const assertWidgetId = (widgetId) => {
  if (typeof widgetId !== "string" || !ID_PATTERN.test(widgetId)) {
    throw new Error("Invalid or missing widgetId");
  }
  return widgetId;
};

/** Returns an integer in [min, max] or throws. Fractions are rounded. */
const toInt = (value, min, max, name) => {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw invalid(`${name} is not a number`);
  const rounded = Math.round(value);
  if (rounded < min || rounded > max) throw invalid(`${name} is out of range`);
  return rounded;
};

/** Returns null or an epoch timestamp in milliseconds that is not in the far future. */
const toTimestampOrNull = (value, name, now = Date.now()) => {
  if (value === null || value === undefined) return null;
  return toInt(value, 0, now + DAY_MS, name);
};

const toItemId = (value) => {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) throw invalid("item id");
  return value;
};

/**
 * Validates `{ items: [...] }` with the widget specific `sanitizeItem` and returns a clean copy.
 * Unknown fields are dropped; anything malformed throws.
 */
const sanitizeState = (body, sanitizeItem) => {
  if (!body || typeof body !== "object" || !Array.isArray(body.items)) {
    throw invalid("expected { items: [] }");
  }
  if (body.items.length > MAX_ITEMS) throw invalid(`more than ${MAX_ITEMS} items`);

  const items = body.items.map((item) => {
    if (!item || typeof item !== "object") throw invalid("item is not an object");
    return { id: toItemId(item.id), ...sanitizeItem(item) };
  });
  if (new Set(items.map((item) => item.id)).size !== items.length) throw invalid("duplicate ids");

  return { items };
};

const withServerTime = (state) => (state ? { ...state, serverNow: Date.now() } : null);

/**
 * Builds the widget API (`getState` / `setState`) for one widget type.
 * The exported names must match the "api" block in that widget's widget.compose.json.
 */
const createStateApi = ({ prefix, sanitizeItem }) => {
  const keyFor = (widgetId) => `${prefix}_${assertWidgetId(widgetId)}`;

  return {
    async getState({ homey, query }) {
      return withServerTime(homey.settings.get(keyFor(query?.widgetId)) ?? null);
    },

    async setState({ homey, query, body }) {
      const key = keyFor(query?.widgetId);
      const state = { ...sanitizeState(body, sanitizeItem), updatedAt: Date.now() };
      if (JSON.stringify(state).length > MAX_STATE_BYTES) throw invalid("state is too large");

      homey.settings.set(key, state);
      try {
        homey.api.realtime(`${prefix}:state`, {
          widgetId: query.widgetId,
          state: withServerTime(state),
        });
      } catch (err) {
        homey.error?.(`Failed to broadcast ${prefix} state`, err);
      }
      return withServerTime(state);
    },
  };
};

/**
 * Removes stored widget states that have not been written for STALE_AFTER_MS (or are malformed).
 * Homey has no "widget removed" hook, so this is how state of deleted widgets gets cleaned up.
 * Returns the number of removed keys.
 */
const pruneStaleStates = (homey, now = Date.now()) => {
  const keyPattern = new RegExp(`^(${STATE_PREFIXES.join("|")})_`);
  let removed = 0;

  for (const key of homey.settings.getKeys()) {
    if (!keyPattern.test(key)) continue;
    const updatedAt = homey.settings.get(key)?.updatedAt;
    if (typeof updatedAt === "number" && now - updatedAt <= STALE_AFTER_MS) continue;
    homey.settings.unset(key);
    removed += 1;
  }
  return removed;
};

module.exports = {
  DAY_MS,
  MAX_ITEMS,
  STALE_AFTER_MS,
  createStateApi,
  invalid,
  pruneStaleStates,
  toInt,
  toTimestampOrNull,
};
