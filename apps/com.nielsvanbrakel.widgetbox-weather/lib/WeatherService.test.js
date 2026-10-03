import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { WeatherService, URLS } = require("./WeatherService");
const { intensityToMmPerHour, parseRaintext } = require("./buienradar");

const UTRECHT = { lat: 52.0907, lon: 5.1214 };

function textResponse(body, status = 200) {
  return new Response(body, { status });
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function createService(handler, now = new Date("2026-10-03T10:00:00Z")) {
  const fetchImpl = vi.fn(async (url) => handler(String(url)));
  return { service: new WeatherService({ fetchImpl, now: () => now }), fetchImpl };
}

const FEED = {
  actual: {
    stationmeasurements: [
      {
        stationid: 6260,
        stationname: "Meetstation De Bilt",
        regio: "Utrecht",
        lat: 52.1,
        lon: 5.18,
        timestamp: "2026-10-02T23:10:00",
        temperature: 9.4,
        feeltemperature: 8.1,
        humidity: 93,
        windspeedBft: 1,
        winddirectiondegrees: 108,
        rainFallLastHour: 0.2,
        fullIconUrl: "https://cdn.buienradar.nl/resources/images/icons/weather/96x96/CC.png",
      },
      {
        stationid: 6240,
        stationname: "Meetstation Schiphol",
        lat: 52.3,
        lon: 4.77,
        temperature: 10,
        fullIconUrl: "https://evil.example/icon.png",
      },
      { stationid: 6999, stationname: "Broken", lat: 52.09, lon: 5.12, temperature: null },
    ],
  },
};

describe("raintext parsing", () => {
  it("converts intensity to mm/h", () => {
    expect(intensityToMmPerHour(0)).toBe(0);
    expect(intensityToMmPerHour(77)).toBe(0.1);
    expect(intensityToMmPerHour(109)).toBe(1);
  });

  it("skips malformed lines", () => {
    expect(parseRaintext("000|10:00\r\n109|10:05\ngarbage\n|10:15\n")).toEqual([
      { time: "10:00", mmPerHour: 0 },
      { time: "10:05", mmPerHour: 1 },
    ]);
  });
});

describe("WeatherService.getRainForecast", () => {
  it("builds the URL with rounded coordinates and caches by rounded key", async () => {
    const { service, fetchImpl } = createService(() => textResponse("000|10:00\n109|10:05"));

    const result = await service.getRainForecast(UTRECHT);
    await service.getRainForecast({ lat: 52.0912, lon: 5.1189 });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe(`${URLS.raintext}?lat=52.09&lon=5.12`);
    expect(fetchImpl.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(result.points).toHaveLength(2);
    expect(typeof result.updatedAt).toBe("string");
  });

  it("de-duplicates concurrent requests", async () => {
    const { service, fetchImpl } = createService(() => textResponse("000|10:00"));
    await Promise.all([service.getRainForecast(UTRECHT), service.getRainForecast(UTRECHT)]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("maps a 404 to OUT_OF_RANGE", async () => {
    const { service } = createService(() => textResponse("Not found", 404));
    await expect(service.getRainForecast({ lat: 48.85, lon: 2.35 })).rejects.toMatchObject({
      code: "OUT_OF_RANGE",
    });
  });

  it("maps network failures to UPSTREAM_UNAVAILABLE", async () => {
    const service = new WeatherService({
      fetchImpl: async () => {
        throw new TypeError("fetch failed");
      },
    });
    await expect(service.getRainForecast(UTRECHT)).rejects.toMatchObject({
      code: "UPSTREAM_UNAVAILABLE",
    });
  });
});

describe("WeatherService.getStation", () => {
  it("picks the nearest station with a temperature and normalizes it", async () => {
    const { service } = createService(() => jsonResponse(FEED));
    const { station } = await service.getStation({ location: UTRECHT });

    expect(station).toMatchObject({
      id: 6260,
      name: "De Bilt",
      temperature: 9.4,
      humidity: 93,
      windBft: 1,
      rainLastHour: 0.2,
      iconUrl: "https://cdn.buienradar.nl/resources/images/icons/weather/96x96/CC.png",
      distanceKm: 4,
    });
  });

  it("shares the feed between locations", async () => {
    const { service, fetchImpl } = createService(() => jsonResponse(FEED));
    await service.getStation({ location: UTRECHT });
    const { station } = await service.getStation({ location: { lat: 52.31, lon: 4.76 } });
    expect(station.id).toBe(6240);
    expect(station.iconUrl).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("validates the station id before building a URL", async () => {
    const { service, fetchImpl } = createService(() => jsonResponse({}));
    await expect(service.getStation({ stationId: "../../x" })).rejects.toMatchObject({
      code: "INVALID_STATION",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("loads a specific station from the observations API", async () => {
    const { service, fetchImpl } = createService(() =>
      jsonResponse({ stationid: 6260, stationname: "Meetstation De Bilt", temperature: 9 }),
    );
    const { station } = await service.getStation({ stationId: "6260" });
    expect(fetchImpl.mock.calls[0][0]).toBe(`${URLS.observation}6260`);
    expect(station).toMatchObject({ id: 6260, name: "De Bilt", temperature: 9, humidity: null });
  });
});

describe("WeatherService.getForecast", () => {
  const forecast = {
    days: Array.from({ length: 10 }, (_, i) => ({
      date: `2026-10-${String(3 + i).padStart(2, "0")}T00:00:00`,
      mintemperature: 8 + i,
      maxtemperature: 15 + i,
      precipitation: i * 10,
      precipitationmm: i,
      iconcode: "j",
    })),
  };

  it("resolves the place and returns the requested number of days", async () => {
    const { service, fetchImpl } = createService((url) =>
      url.startsWith(URLS.geoLocation)
        ? jsonResponse({ id: 2745912, name: "Utrecht" })
        : jsonResponse(forecast),
    );

    const result = await service.getForecast(UTRECHT, 3);

    expect(fetchImpl.mock.calls[0][0]).toBe(`${URLS.geoLocation}?lat=52.09&lon=5.12`);
    expect(fetchImpl.mock.calls[1][0]).toBe(`${URLS.forecast}2745912`);
    expect(result.place).toBe("Utrecht");
    expect(result.days).toHaveLength(3);
    expect(result.days[0]).toEqual({
      date: "2026-10-03",
      min: 8,
      max: 15,
      rainChance: 0,
      rainMm: 0,
      iconUrl: "https://cdn.buienradar.nl/resources/images/icons/weather/96x96/J.png",
    });
  });

  it("drops days before today in Amsterdam, also from cached data", async () => {
    let now = new Date("2026-10-03T21:00:00Z");
    const fetchImpl = vi.fn(async (url) =>
      String(url).startsWith(URLS.geoLocation)
        ? jsonResponse({ id: 1, name: "X" })
        : jsonResponse(forecast),
    );
    const service = new WeatherService({ fetchImpl, now: () => now });
    expect((await service.getForecast(UTRECHT, 3)).days[0].date).toBe("2026-10-03");

    // 22:30 UTC is already 00:30 on the 4th in Amsterdam; the cache still holds the same data.
    now = new Date("2026-10-03T22:30:00Z");
    const { days } = await service.getForecast(UTRECHT, 3);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(days.map((day) => day.date)).toEqual(["2026-10-04", "2026-10-05", "2026-10-06"]);
  });

  it("clamps the day count", async () => {
    const { service } = createService((url) =>
      url.startsWith(URLS.geoLocation)
        ? jsonResponse({ id: 1, name: "X" })
        : jsonResponse(forecast),
    );
    expect((await service.getForecast(UTRECHT, 99)).days).toHaveLength(7);
    expect((await service.getForecast(UTRECHT, Number.NaN)).days).toHaveLength(5);
  });
});

describe("upstream limits", () => {
  it("refuses redirects, so data only comes from the Buienradar hosts", async () => {
    const { service, fetchImpl } = createService(() => jsonResponse(FEED));
    await service.getStation({ location: UTRECHT });
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ redirect: "error" });
  });

  it("rejects a response that announces a body over the size limit", async () => {
    const response = jsonResponse(FEED);
    response.headers.set("content-length", String(10 * 1024 * 1024));
    const { service } = createService(() => response);
    await expect(service.getStation({ location: UTRECHT })).rejects.toMatchObject({
      code: "UPSTREAM_UNAVAILABLE",
    });
  });

  it("stops reading a body that grows past the size limit", async () => {
    const chunk = new TextEncoder().encode("x".repeat(64 * 1024));
    let sent = 0;
    const endless = new ReadableStream({
      pull(controller) {
        sent += chunk.length;
        controller.enqueue(chunk);
      },
    });
    const service = new WeatherService({
      fetchImpl: async () => new Response(endless),
      maxBodyBytes: 256 * 1024,
    });
    await expect(service.getRainForecast(UTRECHT)).rejects.toMatchObject({
      code: "UPSTREAM_UNAVAILABLE",
    });
    expect(sent).toBeLessThan(1024 * 1024);
  });
});

describe("cache footprint", () => {
  // Homey runs each app in its own small Node process: keep only what the widgets read.
  const cached = (service, key) => service.cache.entries.get(key).value.data;

  it("keeps only the station fields the widgets use from the feed", async () => {
    const bulky = {
      ...FEED,
      actual: {
        ...FEED.actual,
        sunrise: "x",
        stationmeasurements: FEED.actual.stationmeasurements.map((station) => ({
          ...station,
          graphUrl: "https://example.com/".repeat(20),
          weatherdescription: "Zwaar bewolkt",
        })),
      },
      forecast: { fivedayforecast: Array(5).fill({ text: "long".repeat(200) }) },
    };
    const { service } = createService(() => jsonResponse(bulky));

    const result = await service.getStation({ location: UTRECHT });

    expect(result.station.name).toBe("De Bilt");
    expect(Object.keys(cached(service, "feed"))).toEqual(["actual"]);
    expect(Object.keys(cached(service, "feed").actual)).toEqual(["stationmeasurements"]);
    expect(cached(service, "feed").actual.stationmeasurements[0]).not.toHaveProperty("graphUrl");
  });

  it("keeps only the day fields the widgets use from a forecast", async () => {
    const days = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-10-${String(3 + i).padStart(2, "0")}T00:00:00`,
      mintemperature: 8,
      maxtemperature: 15,
      precipitation: 10,
      precipitationmm: 1,
      iconcode: "j",
      hours: Array(24).fill({ temperature: 10, winddirection: "ZW" }),
    }));
    const { service } = createService((url) =>
      url.startsWith(URLS.geoLocation)
        ? jsonResponse({ id: 1, name: "Utrecht" })
        : jsonResponse({ location: { name: "x".repeat(500) }, days }),
    );

    await service.getForecast(UTRECHT, 5);

    const stored = cached(service, "forecast:1");
    expect(Object.keys(stored)).toEqual(["days"]);
    expect(stored.days[0]).toEqual({
      date: "2026-10-03T00:00:00",
      mintemperature: 8,
      maxtemperature: 15,
      precipitation: 10,
      precipitationmm: 1,
      iconcode: "j",
    });
    expect(JSON.stringify(stored).length).toBeLessThan(8 * 1024);
  });

  it("holds at most 20 locations", () => {
    expect(new WeatherService().cache.maxEntries).toBe(20);
  });
});
