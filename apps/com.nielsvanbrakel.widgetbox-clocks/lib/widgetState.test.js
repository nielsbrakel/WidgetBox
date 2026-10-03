import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { DAY_MS, STALE_AFTER_MS, pruneStaleStates } = require("./widgetState");
const stopwatchApi = require("../widgets/stopwatch/api");
const timerApi = require("../widgets/timer/api");

const createFakeHomey = () => {
  const store = new Map();
  return {
    store,
    settings: {
      get: (key) => store.get(key) ?? null,
      set: (key, value) => store.set(key, structuredClone(value)),
      unset: (key) => store.delete(key),
      getKeys: () => [...store.keys()],
    },
    api: { realtime: vi.fn() },
    error: vi.fn(),
  };
};

const widgetId = "a1b2c3d4-0000-4000-8000-abcdefabcdef";
const query = { widgetId };

const stopwatch = (overrides = {}) => ({
  id: "sw1",
  elapsedMs: 1500,
  startedAt: null,
  laps: [500, 1200],
  ...overrides,
});

const timer = (overrides = {}) => ({
  id: "t1",
  status: "idle",
  durationMs: 300000,
  remainingMs: 300000,
  startedAt: null,
  ...overrides,
});

describe.each([
  ["stopwatch", stopwatchApi],
  ["timer", timerApi],
])("%s widget.compose.json api block", (name, api) => {
  it("declares exactly the functions exported by api.js", () => {
    const composePath = path.resolve(__dirname, `../widgets/${name}/widget.compose.json`);
    const compose = JSON.parse(readFileSync(composePath, "utf8"));
    expect(Object.keys(compose.api).sort()).toEqual(Object.keys(api).sort());
  });
});

describe("stopwatch state api", () => {
  let homey;
  beforeEach(() => {
    homey = createFakeHomey();
  });

  it("returns null when nothing is stored", async () => {
    expect(await stopwatchApi.getState({ homey, query })).toBeNull();
  });

  it("stores a validated copy, stamps updatedAt and broadcasts it", async () => {
    const body = { items: [stopwatch({ extra: "dropped" })], junk: true };
    const saved = await stopwatchApi.setState({ homey, query, body });

    const stored = homey.store.get(`stopwatch_${widgetId}`);
    expect(stored.items).toEqual([stopwatch()]);
    expect(stored).not.toHaveProperty("junk");
    expect(typeof stored.updatedAt).toBe("number");
    expect(saved.serverNow).toBeTypeOf("number");
    expect(homey.api.realtime).toHaveBeenCalledWith("stopwatch:state", {
      widgetId,
      state: expect.objectContaining({ items: stored.items }),
    });

    const loaded = await stopwatchApi.getState({ homey, query });
    expect(loaded.items).toEqual(stored.items);
    expect(loaded.serverNow).toBeTypeOf("number");
  });

  it("validates stored state again on read and returns nothing when it no longer passes", async () => {
    // Stored by an older app version, or edited by hand: never trust it on the way out either.
    homey.store.set(`stopwatch_${widgetId}`, {
      items: [stopwatch({ id: '"><img src=x onerror=alert(1)>' })],
      updatedAt: Date.now(),
    });
    expect(await stopwatchApi.getState({ homey, query })).toBeNull();
  });

  it("drops unknown stored fields on read", async () => {
    homey.store.set(`stopwatch_${widgetId}`, {
      items: [stopwatch({ extra: "<b>old</b>" })],
      updatedAt: 1234,
    });
    const loaded = await stopwatchApi.getState({ homey, query });
    expect(loaded.items).toEqual([stopwatch()]);
    expect(loaded.updatedAt).toBe(1234);
  });

  it("returns items in the same key order as the widgets serialize them (id first)", async () => {
    const saved = await stopwatchApi.setState({ homey, query, body: { items: [stopwatch()] } });
    expect(JSON.stringify(saved.items)).toBe(JSON.stringify([stopwatch()]));
    const timers = await timerApi.setState({ homey, query, body: { items: [timer()] } });
    expect(JSON.stringify(timers.items)).toBe(JSON.stringify([timer()]));
  });

  it("still saves when the realtime broadcast fails", async () => {
    homey.api.realtime.mockImplementation(() => {
      throw new Error("offline");
    });
    await stopwatchApi.setState({ homey, query, body: { items: [stopwatch()] } });
    expect(homey.store.size).toBe(1);
    expect(homey.error).toHaveBeenCalled();
  });

  it.each([
    ["missing widgetId", {}, { items: [] }],
    ["malformed widgetId", { widgetId: "../etc" }, { items: [] }],
    ["overlong widgetId", { widgetId: "x".repeat(65) }, { items: [] }],
  ])("rejects %s", async (_, badQuery, body) => {
    await expect(stopwatchApi.setState({ homey, query: badQuery, body })).rejects.toThrow();
    await expect(stopwatchApi.getState({ homey, query: badQuery })).rejects.toThrow();
    expect(homey.store.size).toBe(0);
  });

  it.each([
    ["a non-object body", "nope"],
    ["missing items", {}],
    ["too many items", { items: Array.from({ length: 11 }, (_, i) => stopwatch({ id: `s${i}` })) }],
    ["duplicate ids", { items: [stopwatch(), stopwatch()] }],
    ["a bad item id", { items: [stopwatch({ id: "<script>" })] }],
    ["negative elapsed", { items: [stopwatch({ elapsedMs: -1 })] }],
    ["string elapsed", { items: [stopwatch({ elapsedMs: "10" })] }],
    ["a far future start", { items: [stopwatch({ startedAt: Date.now() + 2 * DAY_MS })] }],
    ["too many laps", { items: [stopwatch({ laps: Array(100).fill(1) })] }],
    ["non-numeric laps", { items: [stopwatch({ laps: ["x"] })] }],
  ])("rejects %s", async (_, body) => {
    await expect(stopwatchApi.setState({ homey, query, body })).rejects.toThrow(/Invalid state/);
    expect(homey.store.size).toBe(0);
  });
});

describe("timer state api", () => {
  let homey;
  beforeEach(() => {
    homey = createFakeHomey();
  });

  it("accepts idle, running and paused timers", async () => {
    const items = [
      timer(),
      timer({ id: "t2", status: "running", startedAt: Date.now(), remainingMs: 1000 }),
      timer({ id: "t3", status: "paused", remainingMs: 12345 }),
    ];
    await timerApi.setState({ homey, query, body: { items } });
    expect(homey.store.get(`timer_${widgetId}`).items).toEqual(items);
  });

  it("keeps timer and stopwatch state of the same instance id apart", async () => {
    await timerApi.setState({ homey, query, body: { items: [timer()] } });
    expect(await stopwatchApi.getState({ homey, query })).toBeNull();
  });

  it.each([
    ["an unknown status", timer({ status: "finished" })],
    ["running without a start", timer({ status: "running" })],
    ["paused with a start", timer({ status: "paused", startedAt: Date.now() })],
    ["remaining above duration", timer({ remainingMs: 300001 })],
    ["a duration of 24 hours", timer({ durationMs: 24 * 3600 * 1000, remainingMs: 0 })],
  ])("rejects %s", async (_, item) => {
    await expect(timerApi.setState({ homey, query, body: { items: [item] } })).rejects.toThrow(
      /Invalid state/,
    );
  });
});

describe("pruneStaleStates", () => {
  it("removes stale and malformed widget states and keeps everything else", () => {
    const homey = createFakeHomey();
    const now = Date.now();
    homey.store.set("stopwatch_fresh", { items: [], updatedAt: now - DAY_MS });
    homey.store.set("timer_stale", { items: [], updatedAt: now - STALE_AFTER_MS - 1 });
    homey.store.set("timer_legacy", { timers: [] });
    homey.store.set("unrelated_setting", { updatedAt: 0 });

    expect(pruneStaleStates(homey, now)).toBe(2);
    expect([...homey.store.keys()].sort()).toEqual(["stopwatch_fresh", "unrelated_setting"]);
  });
});
