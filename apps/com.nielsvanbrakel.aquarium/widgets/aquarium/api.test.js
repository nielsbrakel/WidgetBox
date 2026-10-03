import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const api = require("./api.js");

function fakeHomey(initial = {}) {
  const store = { ...initial };
  const settings = {
    get: vi.fn((k) => (k in store ? structuredClone(store[k]) : null)),
    set: vi.fn((k, v) => {
      store[k] = structuredClone(v);
    }),
    unset: vi.fn((k) => {
      delete store[k];
    }),
  };
  return { homey: { settings }, store };
}

const query = { widgetId: "w1" };

describe("aquarium widget api", () => {
  afterEach(() => vi.useRealTimers());

  it("creates and stores a save on first load", async () => {
    const { homey, store } = fakeHomey();
    const res = await api.getState({ homey, query });
    expect(res.created).toBe(true);
    expect(store.aquarium2_w1.v).toBe(res.save.v);
  });

  it("does not rewrite the save on every read", async () => {
    vi.useFakeTimers({ now: Date.UTC(2026, 0, 1) });
    const { homey } = fakeHomey();
    await api.getState({ homey, query });
    homey.settings.set.mockClear();
    vi.advanceTimersByTime(5 * 60 * 1000);
    await api.getState({ homey, query });
    expect(homey.settings.set).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60 * 60 * 1000);
    await api.getState({ homey, query });
    expect(homey.settings.set).toHaveBeenCalledTimes(1);
  });

  it("replaces a first-version save with a fresh one and a welcome gift", async () => {
    const { homey, store } = fakeHomey({ aquarium_w1: { coins: 3 } });
    const res = await api.getState({ homey, query });
    expect(res.save.coins).toBeGreaterThan(250);
    expect(store.aquarium_w1).toBeUndefined();
  });

  it("applies batched actions and reports each result", async () => {
    const { homey, store } = fakeHomey();
    const { save } = await api.getState({ homey, query });
    const drop = save.tanks.pond.drops[0].id;
    const res = await api.doAction({
      homey,
      query,
      body: {
        actions: [
          { type: "collect", tank: "pond", id: drop },
          { type: "collect", tank: "pond", id: drop },
        ],
      },
    });
    expect(res.results).toEqual([{ ok: true }, { ok: false, error: "gone" }]);
    expect(store.aquarium2_w1.coins).toBe(res.save.coins);
  });

  it("caps the batch size and survives junk bodies", async () => {
    const { homey } = fakeHomey();
    const many = Array.from({ length: 80 }, () => ({ type: "nope" }));
    expect((await api.doAction({ homey, query, body: { actions: many } })).results).toHaveLength(
      50,
    );
    expect((await api.doAction({ homey, query, body: "junk" })).results).toEqual([]);
    expect((await api.doAction({ homey, query, body: null })).results).toEqual([]);
  });

  it("resets to a fresh save", async () => {
    const { homey, store } = fakeHomey();
    await api.getState({ homey, query });
    store.aquarium2_w1.coins = 999;
    const res = await api.doAction({ homey, query, body: { reset: true } });
    expect(res.save.coins).toBe(40);
  });

  it("never applies the same batch twice", async () => {
    const { homey } = fakeHomey();
    const { save } = await api.getState({ homey, query });
    save.coins = 0;
    const body = { batch: "b1", actions: [{ type: "buyFood", food: "flakes" }] };
    homey.settings.set("aquarium2_w1", { ...save, coins: 100 });
    await api.doAction({ homey, query, body });
    const again = await api.doAction({ homey, query, body });
    expect(again.duplicate).toBe(true);
    expect(again.save.coins).toBe(100 - 15);
  });

  it("keeps a broken save aside and starts fresh", async () => {
    const { homey, store } = fakeHomey({ aquarium2_w1: { v: 2, tanks: 5 } });
    const res = await api.getState({ homey, query });
    expect(res.save.v).toBe(2);
    expect(Array.isArray(res.save.tanks.pond.fish)).toBe(true);
    expect(store.aquarium2_w1.tanks.pond).toBeTruthy();
  });
});
