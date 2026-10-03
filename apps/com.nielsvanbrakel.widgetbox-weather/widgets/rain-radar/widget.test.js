import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadWidget } from "../../test/loadWidget.js";

describe("rain-radar widget", () => {
  let images;

  beforeEach(() => {
    vi.useFakeTimers();
    images = [];
  });
  afterEach(() => vi.useRealTimers());

  function load() {
    return loadWidget("rain-radar", {
      beforeReady(window) {
        window.Image = function createImage() {
          const image = window.document.createElement("img");
          images.push(image);
          return image;
        };
      },
    });
  }

  it("keeps the Buienradar branding and caches per 5-minute period", () => {
    const { Homey } = load();
    expect(Homey.ready).toHaveBeenCalledTimes(1);
    const url = new URL(images[0].src);
    expect(url.searchParams.get("renderBranding")).toBe("True");
    expect(url.searchParams.get("t")).toBe(String(Math.floor(Date.now() / 300000)));
  });

  it("swaps the image only after it loaded", () => {
    const { $ } = load();
    expect($("#radar").hidden).toBe(true);
    images[0].onload();
    expect($("#radar")).toBe(images[0]);
    expect($("#message").hidden).toBe(true);
  });

  it("keeps the last image and shows an offline badge when a refresh fails", async () => {
    const { $ } = load();
    images[0].onload();
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    images[1].onerror();
    expect($("#radar")).toBe(images[0]);
    expect($("#offline").hidden).toBe(false);
    expect($("#offline").textContent).toMatch(/^Offline/);
  });

  it("gives up on an image that hangs and tries again on schedule", async () => {
    const { $ } = load();
    images[0].onload();
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(images).toHaveLength(2);

    // The refresh never answers (flaky Wi-Fi): it is abandoned and the next one still runs.
    await vi.advanceTimersByTimeAsync(20 * 1000);
    expect(images[1].getAttribute("src")).toBeNull();
    expect($("#offline").hidden).toBe(false);
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(images).toHaveLength(3);
  });

  it("always shows the credit and opens it in a popup", () => {
    const { $, Homey } = load();
    $("#credit").click();
    expect(Homey.popup).toHaveBeenCalledWith("https://www.buienradar.nl");
  });
});
