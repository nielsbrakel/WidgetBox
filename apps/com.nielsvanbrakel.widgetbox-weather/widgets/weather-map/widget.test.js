import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadWidget } from "../../test/loadWidget.js";

describe("weather-map widget", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  async function load(options = {}) {
    const widget = loadWidget("weather-map", {
      api: vi.fn().mockResolvedValue({ latitude: 52.09, longitude: 5.12 }),
      ...options,
    });
    await vi.advanceTimersByTimeAsync(0);
    return widget;
  }

  function embedUrl(document) {
    return new URL(document.querySelector("iframe").src);
  }

  it("falls back to the Homey location and never sends undefined", async () => {
    const { document, Homey } = await load();
    expect(Homey.api).toHaveBeenCalledWith("GET", "/location");
    const url = embedUrl(document);
    expect(url.searchParams.get("lat")).toBe("52.09");
    expect(url.searchParams.get("zoom")).toBe("5");
    expect(url.searchParams.get("overlay")).toBe("wind");
    expect(url.toString()).not.toContain("undefined");
  });

  it("uses and validates the configured settings", async () => {
    const { document, Homey } = await load({
      settings: {
        latitude: "40,71",
        longitude: "-74",
        zoom: 30,
        overlay: "bogus",
        metricWind: "kmh",
      },
    });
    expect(Homey.api).not.toHaveBeenCalled();
    const url = embedUrl(document);
    expect(url.searchParams.get("lat")).toBe("40.71");
    expect(url.searchParams.get("lon")).toBe("-74");
    expect(url.searchParams.get("zoom")).toBe("11");
    expect(url.searchParams.get("overlay")).toBe("wind");
    expect(url.searchParams.get("metricWind")).toBe("km/h");
  });

  it("shows an empty state without any location", async () => {
    const { $ } = await load({ api: vi.fn().mockResolvedValue(null) });
    expect($("iframe")).toBeNull();
    expect($("#notice-title").textContent).toBe("Set a location in the widget settings");
  });

  it("shows an error for an invalid location", async () => {
    const { $ } = await load({ settings: { latitude: "abc", longitude: "5" } });
    expect($("iframe")).toBeNull();
    expect($("#notice-title").textContent).toContain("not valid");
  });

  it("debounces reloads and only reloads when the URL changed", async () => {
    const { document, setSetting } = await load();
    const first = document.querySelector("iframe");
    setSetting("zoom", 7);
    setSetting("zoom", 8);
    await vi.advanceTimersByTimeAsync(600);
    const second = document.querySelector("iframe");
    expect(second).not.toBe(first);
    expect(embedUrl(document).searchParams.get("zoom")).toBe("8");
    setSetting("aspectRatio", "16:9");
    await vi.advanceTimersByTimeAsync(600);
    expect(document.querySelector("iframe")).toBe(second);
  });

  it("locks the map behind a visible hint and unlocks on tap", async () => {
    const { $ } = await load();
    expect($("#shield").hidden).toBe(false);
    expect($("#hint").textContent).toBe("Tap to interact");
    $("#shield").click();
    expect($("#shield").hidden).toBe(true);
    expect($("#lock").hidden).toBe(false);
    await vi.advanceTimersByTimeAsync(30 * 1000);
    expect($("#shield").hidden).toBe(false);
  });

  it("shows a translated notice on iOS", async () => {
    const { $ } = await load({
      beforeReady(window) {
        window.__SIMULATE_IOS__ = true;
      },
    });
    expect($("iframe")).toBeNull();
    expect($("#notice-title").textContent).toBe("The weather map is not available on iOS");
  });
});
