const DEFAULT_MAX_ENTRIES = 50;
const DEFAULT_RETRY_AFTER_MS = 60 * 1000;

/**
 * Small in-memory cache for upstream requests.
 *
 * - Fresh entries (younger than `ttlMs`) are returned without a request.
 * - Concurrent callers for the same key share one in-flight request.
 * - When a refresh fails, the last good value is returned while it is younger than
 *   `maxStaleMs`, and the next attempt waits `retryAfterMs` so a broken upstream is not hammered.
 * - The cache holds at most `maxEntries` keys and evicts the least recently stored key.
 */
class RequestCache {
  constructor({
    maxEntries = DEFAULT_MAX_ENTRIES,
    retryAfterMs = DEFAULT_RETRY_AFTER_MS,
    now = Date.now,
  } = {}) {
    this.maxEntries = maxEntries;
    this.retryAfterMs = retryAfterMs;
    this.now = now;
    this.entries = new Map();
    this.inflight = new Map();
  }

  get size() {
    return this.entries.size;
  }

  async get(key, { ttlMs, maxStaleMs = Number.POSITIVE_INFINITY }, loader) {
    const entry = this.entries.get(key);
    const age = entry ? this.now() - entry.storedAt : Number.POSITIVE_INFINITY;
    const usable = entry && age < maxStaleMs;

    if (entry && age < ttlMs) return entry.value;
    if (usable && entry.failedAt && this.now() - entry.failedAt < this.retryAfterMs) {
      return entry.value;
    }

    const pending = this.inflight.get(key);
    if (pending) return pending;

    const request = this.load(key, loader, usable ? entry : null);
    this.inflight.set(key, request);
    return request;
  }

  async load(key, loader, fallback) {
    try {
      const value = await loader();
      this.set(key, value);
      return value;
    } catch (error) {
      if (!fallback) throw error;
      fallback.failedAt = this.now();
      return fallback.value;
    } finally {
      this.inflight.delete(key);
    }
  }

  set(key, value) {
    this.entries.delete(key);
    this.entries.set(key, { value, storedAt: this.now(), failedAt: null });
    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      this.entries.delete(oldestKey);
    }
  }
}

module.exports = RequestCache;
