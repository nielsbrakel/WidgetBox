import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadWidget } from "../../test/loadWidget.js";

const ICON = "https://cdn.buienradar.nl/resources/images/icons/weather/96x96/J.png";

function forecast(count) {
  return {
    place: "Utrecht",
    days: Array.from({ length: count }, (_, i) => ({
      date: `2026-10-${String(2 + i).padStart(2, "0")}`,
      min: 8 + i,
      max: 15 + i,
      rainChance: i * 10,
      rainMm: 0,
      iconUrl: i === 1 ? "javascript:alert(1)" : ICON,
    })),
    updatedAt: "2026-10-02T08:00:00.000Z",
  };
}

describe("forecast widget", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T07:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  async function load(options = {}) {
    const widget = loadWidget("forecast", {
      api: vi.fn().mockResolvedValue(forecast(5)),
      ...options,
    });
    await vi.advanceTimersByTimeAsync(0);
    return widget;
  }

  it("requests the configured location and number of days", async () => {
    const { Homey } = await load({ settings: { latitude: "52", longitude: "5", days: "3" } });
    expect(Homey.api).toHaveBeenCalledWith("GET", "/?latitude=52&longitude=5&days=3");
  });

  it("renders a row per day with client-side day names", async () => {
    const { document } = await load();
    const rows = document.querySelectorAll(".day");
    expect(rows).toHaveLength(5);
    expect(rows[0].querySelector(".long").textContent).toBe("Today");
    expect(rows[1].querySelector(".long").textContent).toBe("Tomorrow");
    expect(rows[2].querySelector(".long").textContent).toBe("Sunday");
    expect(rows[2].querySelector(".rain").textContent).toBe("20%");
    expect(rows[0].querySelector(".rain").textContent).toBe("");
    expect(document.querySelector("#status").textContent).toMatch(/^Utrecht · /);
  });

  it("drops days before today in Amsterdam after midnight", async () => {
    vi.setSystemTime(new Date("2026-10-02T22:30:00Z"));
    const { document } = await load();
    const rows = document.querySelectorAll(".day");
    expect(rows).toHaveLength(4);
    expect(rows[0].querySelector(".long").textContent).toBe("Today");
    expect(rows[1].querySelector(".long").textContent).toBe("Tomorrow");
  });

  it("only loads icons from the Buienradar CDN", async () => {
    const { document } = await load();
    const icons = document.querySelectorAll(".icon");
    expect(icons[0].getAttribute("src")).toBe(ICON);
    expect(icons[1].hasAttribute("src")).toBe(false);
  });

  it("shows skeleton rows before the data arrives and calls ready once", async () => {
    const { document, Homey } = loadWidget("forecast", { api: () => new Promise(() => {}) });
    expect(document.querySelectorAll(".day")).toHaveLength(5);
    expect(document.querySelector("#days").classList.contains("skeleton")).toBe(true);
    expect(Homey.ready).toHaveBeenCalledTimes(1);
  });

  it("shows an error state", async () => {
    const { $ } = await load({ api: vi.fn().mockRejectedValue(new Error("UPSTREAM")) });
    expect($("#days").hidden).toBe(true);
    expect($("#message").textContent).toContain("Could not load weather data");
  });
});
