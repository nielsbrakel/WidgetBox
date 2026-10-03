import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const RequestCache = require("./RequestCache");

function createClock(start = 1_000_000) {
  let time = start;
  return { now: () => time, advance: (ms) => (time += ms) };
}

describe("RequestCache", () => {
  it("returns fresh entries without calling the loader again", async () => {
    const clock = createClock();
    const cache = new RequestCache({ now: clock.now });
    const loader = vi.fn().mockResolvedValue("a");

    await cache.get("k", { ttlMs: 1000 }, loader);
    clock.advance(999);
    expect(await cache.get("k", { ttlMs: 1000 }, loader)).toBe("a");
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("reloads after the ttl expired", async () => {
    const clock = createClock();
    const cache = new RequestCache({ now: clock.now });
    const loader = vi.fn().mockResolvedValueOnce("a").mockResolvedValueOnce("b");

    await cache.get("k", { ttlMs: 1000 }, loader);
    clock.advance(1000);
    expect(await cache.get("k", { ttlMs: 1000 }, loader)).toBe("b");
  });

  it("shares one in-flight request between concurrent callers", async () => {
    const cache = new RequestCache();
    let resolve;
    const loader = vi.fn(() => new Promise((r) => (resolve = r)));

    const first = cache.get("k", { ttlMs: 1000 }, loader);
    const second = cache.get("k", { ttlMs: 1000 }, loader);
    resolve("value");

    expect(await Promise.all([first, second])).toEqual(["value", "value"]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("returns stale data when a refresh fails and backs off before retrying", async () => {
    const clock = createClock();
    const cache = new RequestCache({ now: clock.now, retryAfterMs: 60_000 });
    const loader = vi
      .fn()
      .mockResolvedValueOnce("old")
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce("new");

    await cache.get("k", { ttlMs: 1000 }, loader);
    clock.advance(5000);
    expect(await cache.get("k", { ttlMs: 1000 }, loader)).toBe("old");
    clock.advance(30_000);
    expect(await cache.get("k", { ttlMs: 1000 }, loader)).toBe("old");
    expect(loader).toHaveBeenCalledTimes(2);
    clock.advance(30_000);
    expect(await cache.get("k", { ttlMs: 1000 }, loader)).toBe("new");
  });

  it("does not serve data older than maxStaleMs", async () => {
    const clock = createClock();
    const cache = new RequestCache({ now: clock.now });
    const loader = vi.fn().mockResolvedValueOnce("old").mockRejectedValueOnce(new Error("down"));

    await cache.get("k", { ttlMs: 1000, maxStaleMs: 10_000 }, loader);
    clock.advance(20_000);
    await expect(cache.get("k", { ttlMs: 1000, maxStaleMs: 10_000 }, loader)).rejects.toThrow(
      "down",
    );
  });

  it("propagates errors when nothing is cached and does not cache them", async () => {
    const cache = new RequestCache();
    const loader = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce("ok");

    await expect(cache.get("k", { ttlMs: 1000 }, loader)).rejects.toThrow("down");
    expect(await cache.get("k", { ttlMs: 1000 }, loader)).toBe("ok");
  });

  it("evicts the oldest entries beyond maxEntries", async () => {
    const cache = new RequestCache({ maxEntries: 2 });
    for (const key of ["a", "b", "c"]) {
      await cache.get(key, { ttlMs: 1000 }, async () => key);
    }
    expect(cache.size).toBe(2);
    expect([...cache.entries.keys()]).toEqual(["b", "c"]);
  });
});
