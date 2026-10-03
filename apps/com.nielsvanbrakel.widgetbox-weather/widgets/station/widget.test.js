import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadWidget } from "../../test/loadWidget.js";

const STATION = {
  station: {
    id: 6260,
    name: "De Bilt",
    observedAt: "2026-10-02T23:10:00",
    temperature: 9.4,
    feelTemperature: 8.2,
    humidity: 93,
    windBft: 3,
    windDirectionDegrees: 225,
    rainLastHour: 0.2,
    iconUrl: "https://cdn.buienradar.nl/resources/images/icons/weather/96x96/CC.png",
    distanceKm: 4,
  },
  updatedAt: "2026-10-02T21:12:00.000Z",
};

describe("station widget", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  async function load(options = {}) {
    const widget = loadWidget("station", { api: vi.fn().mockResolvedValue(STATION), ...options });
    await vi.advanceTimersByTimeAsync(0);
    return widget;
  }

  it("renders the measurements with translated labels", async () => {
    const { $ } = await load();
    expect($("#name").textContent).toBe("De Bilt · 4 km");
    expect($("#temperature").textContent).toBe("9.4°");
    expect($("#feels").textContent).toBe("Feels like 8°");
    expect($("#wind").textContent).toBe("3 Bft SW");
    expect($("#rain").textContent).toBe("0.2 mm");
    expect($("#humidity").textContent).toBe("93%");
    expect($("#humidity-label").textContent).toBe("Humidity");
    expect($("#status").textContent).toBe("23:10");
    expect($("#icon").hidden).toBe(false);
  });

  it("shows a dash for missing values and ignores icons from other hosts", async () => {
    const api = vi.fn().mockResolvedValue({
      station: { name: "X", temperature: null, iconUrl: "https://evil.example/x.png" },
      updatedAt: STATION.updatedAt,
    });
    const { $ } = await load({ api });
    expect($("#temperature").textContent).toBe("—");
    expect($("#wind").textContent).toBe("—");
    expect($("#humidity").textContent).toBe("—");
    expect($("#icon").hidden).toBe(true);
    expect($("#app").innerHTML).not.toContain("undefined");
  });

  it("passes the station id and location to the backend", async () => {
    const { Homey } = await load({
      settings: { latitude: "52.1", longitude: "5.1", stationId: " 6260 " },
    });
    expect(Homey.api).toHaveBeenCalledWith("GET", "/?latitude=52.1&longitude=5.1&stationId=6260");
  });

  it("shows a readable error instead of the station name", async () => {
    const { $ } = await load({ api: vi.fn().mockRejectedValue(new Error("INVALID_STATION")) });
    expect($("#message").hidden).toBe(false);
    expect($("#message").textContent).toContain("Station not found");
    expect($("#details").hidden).toBe(true);
  });

  it("applies alignment and layout without refetching", async () => {
    const { $, Homey, setSetting } = await load();
    setSetting("horizontalAlignment", "right");
    setSetting("style", "compact");
    await vi.advanceTimersByTimeAsync(1000);
    expect($("#app").className).toBe("widget align-right style-compact");
    expect(Homey.api).toHaveBeenCalledTimes(1);
  });

  it("calls ready exactly once", async () => {
    const { Homey } = await load();
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    expect(Homey.ready).toHaveBeenCalledTimes(1);
    expect(Homey.api).toHaveBeenCalledTimes(2);
  });
});
