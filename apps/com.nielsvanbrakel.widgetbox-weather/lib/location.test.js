import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { distanceKm, isValidStationId, parseCoordinate, parseLocation, roundLocation } =
  require("./location");

describe("location helpers", () => {
  it("parses coordinates with a dot or a comma", () => {
    expect(parseCoordinate("52.1", 90)).toBe(52.1);
    expect(parseCoordinate(" 52,1 ", 90)).toBe(52.1);
    expect(parseCoordinate(-4.5, 180)).toBe(-4.5);
  });

  it("rejects invalid or out of range coordinates", () => {
    expect(parseCoordinate("", 90)).toBeNull();
    expect(parseCoordinate("abc", 90)).toBeNull();
    expect(parseCoordinate("91", 90)).toBeNull();
    expect(parseCoordinate("52.1&lon=1", 90)).toBeNull();
    expect(parseCoordinate(undefined, 90)).toBeNull();
  });

  it("returns null for an empty location and throws for a partial or invalid one", () => {
    expect(parseLocation("", " ")).toBeNull();
    expect(parseLocation(undefined, undefined)).toBeNull();
    expect(parseLocation("52.1", "5.1")).toEqual({ lat: 52.1, lon: 5.1 });
    expect(() => parseLocation("52.1", "")).toThrow("INVALID_LOCATION");
    expect(() => parseLocation("200", "5")).toThrow("INVALID_LOCATION");
  });

  it("rounds locations to two decimals", () => {
    expect(roundLocation({ lat: 52.123456, lon: 5.126 })).toEqual({ lat: 52.12, lon: 5.13 });
  });

  it("computes great-circle distances", () => {
    const utrecht = { lat: 52.09, lon: 5.12 };
    const amsterdam = { lat: 52.37, lon: 4.9 };
    expect(Math.round(distanceKm(utrecht, amsterdam))).toBe(35);
  });

  it("only accepts numeric station ids of 4 to 6 digits", () => {
    expect(isValidStationId("6260")).toBe(true);
    expect(isValidStationId("626")).toBe(false);
    expect(isValidStationId("../6260")).toBe(false);
    expect(isValidStationId(6260)).toBe(false);
  });
});
