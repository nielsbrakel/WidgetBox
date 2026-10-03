// @vitest-environment jsdom
import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const WidgetKit = require("./widget-kit.js");

const fakeHomey = (translations = {}) => ({
  ready: vi.fn(),
  setHeight: vi.fn(),
  __: vi.fn((key) => translations[key] ?? key),
});

describe("createHeightReporter", () => {
  it("calls ready() with the first height and setHeight() for later changes", () => {
    const Homey = fakeHomey();
    let height = 120.2;
    const report = WidgetKit.createHeightReporter(Homey, () => height);

    report();
    expect(Homey.ready).toHaveBeenCalledExactlyOnceWith({ height: 121 });

    height = 140;
    report();
    expect(Homey.setHeight).toHaveBeenCalledExactlyOnceWith(140);
    expect(Homey.ready).toHaveBeenCalledOnce();
  });

  it("does not report the same height twice (no resize feedback loops)", () => {
    const Homey = fakeHomey();
    const report = WidgetKit.createHeightReporter(Homey, () => 80);
    report();
    report();
    report();
    expect(Homey.ready).toHaveBeenCalledOnce();
    expect(Homey.setHeight).not.toHaveBeenCalled();
  });

  it("measures the page body by default", () => {
    const Homey = fakeHomey();
    vi.spyOn(document.body, "getBoundingClientRect").mockReturnValue({ height: 64.5 });
    WidgetKit.createHeightReporter(Homey)();
    expect(Homey.ready).toHaveBeenCalledWith({ height: 65 });
  });
});

describe("createTicker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-03T10:00:00.400Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
  });

  const setHidden = (hidden) => {
    Object.defineProperty(document, "hidden", { configurable: true, value: hidden });
    document.dispatchEvent(new Event("visibilitychange"));
  };

  it("ticks at once and then just after every interval boundary", () => {
    const tick = vi.fn();
    WidgetKit.createTicker(tick, () => 1000).start();
    expect(tick).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(600 + 19);
    expect(tick).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(tick).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1000);
    expect(tick).toHaveBeenCalledTimes(3);
  });

  it("reads the interval on every tick, so a setting change takes effect", () => {
    const tick = vi.fn();
    let interval = 1000;
    WidgetKit.createTicker(tick, () => interval).start();
    interval = 60000;
    vi.advanceTimersByTime(1000);
    expect(tick).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(5000);
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it("stops while the page is hidden and catches up when it is shown again", () => {
    const tick = vi.fn();
    WidgetKit.createTicker(tick, () => 1000).start();
    setHidden(true);
    vi.advanceTimersByTime(10000);
    expect(tick).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);

    setHidden(false);
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it("restarting does not leave a second timer running", () => {
    const tick = vi.fn();
    const ticker = WidgetKit.createTicker(tick, () => 1000);
    ticker.start();
    ticker.start();
    expect(vi.getTimerCount()).toBe(1);
  });

  it("supports a custom slack after the boundary", () => {
    const tick = vi.fn();
    WidgetKit.createTicker(tick, () => 1000, { slackMs: 50 }).start();
    vi.advanceTimersByTime(600 + 49);
    expect(tick).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(tick).toHaveBeenCalledTimes(2);
  });
});

describe("createTranslator", () => {
  it("reads keys under the widget's namespace", () => {
    const Homey = fakeHomey({ "widgets.timer.start": "Start" });
    const t = WidgetKit.createTranslator(Homey, "widgets.timer");
    expect(t("start", "fallback")).toBe("Start");
  });

  it("falls back when Homey returns the key itself (missing translation)", () => {
    const t = WidgetKit.createTranslator(fakeHomey(), "widgets.timer");
    expect(t("missing", "Fallback")).toBe("Fallback");
  });

  it("falls back when Homey returns only the last key segment or nothing", () => {
    const Homey = fakeHomey();
    Homey.__.mockReturnValueOnce("missing").mockReturnValueOnce(undefined);
    const t = WidgetKit.createTranslator(Homey, "widgets.timer");
    expect(t("missing", "A")).toBe("A");
    expect(t("missing", "B")).toBe("B");
  });

  it("fills {tokens}", () => {
    const Homey = fakeHomey({ "widgets.timer.name": "Timer {number} of {total}" });
    const t = WidgetKit.createTranslator(Homey, "widgets.timer");
    expect(t("name", "", { number: 2, total: 3 })).toBe("Timer 2 of 3");
  });

  it("works without a namespace", () => {
    const t = WidgetKit.createTranslator(fakeHomey({ language: "nl" }));
    expect(t("language", "en")).toBe("nl");
  });
});

describe("contentWidth", () => {
  it("is the element's width without its horizontal padding", () => {
    const element = document.createElement("div");
    element.style.paddingLeft = "8px";
    element.style.paddingRight = "4.5px";
    Object.defineProperty(element, "clientWidth", { value: 200 });
    document.body.append(element);
    expect(WidgetKit.contentWidth(element)).toBe(187.5);
  });
});

describe("createStateSync", () => {
  const canonical = (items) => items.map(({ id, ms }) => ({ id, ms: Math.round(ms) }));

  const setup = ({ responses = {}, delayMs = 300 } = {}) => {
    let items = [];
    const request = vi.fn(async (method, body) => {
      const response = responses[method];
      if (response instanceof Error) throw response;
      return typeof response === "function" ? response(body) : response;
    });
    const onError = vi.fn();
    const sync = WidgetKit.createStateSync({
      request,
      canonical,
      getItems: () => items,
      setItems: (next) => {
        items = next;
      },
      delayMs,
      onError,
    });
    return {
      sync,
      request,
      onError,
      items: () => items,
      edit: (next) => {
        items = next;
      },
    };
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
  });
  afterEach(() => vi.useRealTimers());

  it("loads the stored items and reports a change", async () => {
    const { sync, items } = setup({ responses: { GET: { items: [{ id: "a", ms: 5 }] } } });
    expect(await sync.load()).toBe(true);
    expect(items()).toEqual([{ id: "a", ms: 5 }]);
  });

  it("ignores a state with no items, and a load that fails", async () => {
    const failing = setup({ responses: { GET: new Error("offline") } });
    expect(await failing.sync.load()).toBe(false);
    expect(failing.onError).toHaveBeenCalledOnce();
    expect(setup().sync.receive({ items: "nope" })).toBe(false);
  });

  it("ignores an echo of a state it already has", () => {
    const { sync } = setup();
    expect(sync.receive({ items: [{ id: "a", ms: 5.2 }] })).toBe(true);
    expect(sync.receive({ items: [{ id: "a", ms: 5 }] })).toBe(false);
  });

  it("debounces saves and sends the latest canonical items once", async () => {
    const { sync, request, edit } = setup({ responses: { PUT: {} } });
    edit([{ id: "a", ms: 1.4 }]);
    sync.saveSoon();
    vi.advanceTimersByTime(200);
    edit([{ id: "a", ms: 2.6 }]);
    sync.saveSoon();
    expect(sync.isSaving()).toBe(true);
    await vi.advanceTimersByTimeAsync(300);
    expect(request).toHaveBeenCalledExactlyOnceWith("PUT", { items: [{ id: "a", ms: 3 }] });
    expect(sync.isSaving()).toBe(false);
  });

  it("does not take the echo of its own save as a change", async () => {
    const { sync, edit } = setup({ responses: { PUT: {} } });
    edit([{ id: "a", ms: 3 }]);
    sync.saveSoon();
    await sync.flush();
    expect(sync.receive({ items: [{ id: "a", ms: 3 }] })).toBe(false);
  });

  it("ignores remote states while a save is pending or in flight", async () => {
    let finish;
    const { sync, edit, items } = setup({
      responses: { PUT: () => new Promise((resolve) => (finish = resolve)) },
    });
    edit([{ id: "mine", ms: 1 }]);
    sync.saveSoon();
    expect(sync.receive({ items: [{ id: "theirs", ms: 1 }] })).toBe(false);

    const saving = sync.flush();
    expect(sync.isSaving()).toBe(true);
    expect(sync.receive({ items: [{ id: "theirs", ms: 1 }] })).toBe(false);
    expect(await sync.load()).toBe(false);
    finish({});
    await saving;

    expect(sync.isSaving()).toBe(false);
    expect(items()).toEqual([{ id: "mine", ms: 1 }]);
  });

  it("flush does nothing when no save is pending", async () => {
    const { sync, request } = setup();
    await sync.flush();
    expect(request).not.toHaveBeenCalled();
  });

  it("reports a failed save and is idle again afterwards", async () => {
    const { sync, onError } = setup({ responses: { PUT: new Error("offline") } });
    sync.saveSoon();
    await sync.flush();
    expect(onError).toHaveBeenCalledOnce();
    expect(sync.isSaving()).toBe(false);
  });

  it("keeps now() on Homey's clock from serverNow in loads and saves", async () => {
    const { sync } = setup({
      responses: { GET: { serverNow: 1_005_000, items: [] }, PUT: { serverNow: 998_000 } },
    });
    expect(sync.now()).toBe(1_000_000);
    await sync.load();
    expect(sync.now()).toBe(1_005_000);
    sync.saveSoon();
    await sync.flush();
    expect(sync.now()).toBe(998_000);
  });
});
