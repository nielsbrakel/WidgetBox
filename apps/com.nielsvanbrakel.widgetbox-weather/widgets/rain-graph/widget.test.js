import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadWidget } from "../../test/loadWidget.js";

function forecast(values, start = "10:00") {
  const [h, m] = start.split(":").map(Number);
  return {
    points: values.map((mmPerHour, i) => {
      const minutes = h * 60 + m + i * 5;
      const time = `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
      return { time, mmPerHour };
    }),
    updatedAt: "2026-10-02T08:00:00.000Z",
  };
}

const RAIN = forecast([
  0, 0, 0.5, 1.2, 3, 6, 2, 0.4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
]);
const DRY = forecast(Array(24).fill(0));

describe("rain-graph widget", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 2, 10, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function load(options = {}) {
    const widget = loadWidget("rain-graph", { api: vi.fn().mockResolvedValue(RAIN), ...options });
    await vi.advanceTimersByTimeAsync(0);
    return widget;
  }

  it("calls ready once with the aspect ratio height and requests the configured location", async () => {
    const { Homey } = await load({ settings: { latitude: "52,1", longitude: "5.1" } });
    expect(Homey.ready).toHaveBeenCalledTimes(1);
    expect(Homey.ready).toHaveBeenCalledWith({ height: "56.25%" });
    expect(Homey.api).toHaveBeenCalledWith("GET", "/?latitude=52%2C1&longitude=5.1");
  });

  it("sends empty coordinates so the backend can use the Homey location", async () => {
    const { Homey } = await load();
    expect(Homey.api).toHaveBeenCalledWith("GET", "/?latitude=&longitude=");
  });

  it("renders one bar per point and the level lines", async () => {
    const { document } = await load();
    expect(document.querySelectorAll("#plot rect")).toHaveLength(24);
    expect([...document.querySelectorAll(".level span")].map((l) => l.textContent)).toEqual([
      "Light",
      "Moderate",
      "Heavy",
    ]);
  });

  it("does not grow the DOM on repeated refreshes", async () => {
    const { document } = await load();
    const count = document.querySelectorAll("*").length;
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(document.querySelectorAll("*").length).toBe(count);
  });

  it("honors the refresh interval setting", async () => {
    const { Homey } = await load({ settings: { refreshInterval: "900" } });
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(Homey.api).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    expect(Homey.api).toHaveBeenCalledTimes(2);
  });

  it("draws a curved path for the smooth style and a straight one for line", async () => {
    const { document, setSetting } = await load({ settings: { graphStyle: "smooth" } });
    expect(document.querySelector(".stroke").getAttribute("d")).toContain("C");
    setSetting("graphStyle", "line");
    await vi.advanceTimersByTimeAsync(0);
    const d = document.querySelector(".stroke").getAttribute("d");
    expect(d).toContain("L");
    expect(d).not.toContain("C");
  });

  it("places the now line at the current time", async () => {
    const { document } = await load();
    const now = document.querySelector("#now");
    expect(now.hidden).toBe(false);
    expect(Number.parseFloat(now.style.left)).toBeCloseTo((2.4 / 23) * 100, 1);
  });

  it("shows a tooltip on tap", async () => {
    const { document, window } = await load();
    const chart = document.querySelector("#chart");
    chart.getBoundingClientRect = () => ({ left: 0, width: 240, top: 0, height: 100 });
    chart.dispatchEvent(new window.MouseEvent("click", { bubbles: true, clientX: 51 }));
    const tooltip = document.querySelector("#tooltip");
    expect(tooltip.hidden).toBe(false);
    expect(tooltip.textContent).toBe("10:25 · 6 mm/h");
    await vi.advanceTimersByTimeAsync(5000);
    expect(tooltip.hidden).toBe(true);
  });

  it("shows a message when no rain is expected", async () => {
    const { document } = await load({ api: vi.fn().mockResolvedValue(DRY) });
    expect(document.querySelector("#message").textContent).toBe(
      "No rain expected in the next 2 hours",
    );
  });

  it("explains out of range and missing locations", async () => {
    const outOfRange = await load({ api: vi.fn().mockRejectedValue(new Error("OUT_OF_RANGE")) });
    expect(outOfRange.$("#message").textContent).toContain("Netherlands and Belgium");
    const missing = await load({ api: vi.fn().mockRejectedValue(new Error("LOCATION_REQUIRED")) });
    expect(missing.$("#message").textContent).toBe("Set a location in the widget settings");
  });

  it("keeps the last data and marks it offline when a refresh fails", async () => {
    const api = vi.fn().mockResolvedValueOnce(RAIN).mockRejectedValue(new Error("UPSTREAM"));
    const { document } = await load({ api });
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(document.querySelectorAll("#plot rect")).toHaveLength(24);
    expect(document.querySelector("#status").textContent).toMatch(/^Offline · updated/);
  });

  it("debounces location changes and updates the height for a new aspect ratio", async () => {
    const { Homey, setSetting } = await load();
    setSetting("latitude", "5");
    setSetting("latitude", "52");
    setSetting("aspectRatio", "1:1");
    await vi.advanceTimersByTimeAsync(600);
    expect(Homey.api).toHaveBeenCalledTimes(2);
    expect(Homey.setHeight).toHaveBeenCalledWith("100%");
  });

  it("opens the Buienradar credit in a popup", async () => {
    const { $, Homey } = await load();
    $("#credit").click();
    expect(Homey.popup).toHaveBeenCalledWith("https://www.buienradar.nl");
  });
});
