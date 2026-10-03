import { describe, expect, it } from "vitest";
import { main, planRelease } from "./release-plan.mjs";

const apps = [
  { id: "com.nielsvanbrakel.widgetbox-clocks", version: "0.2.0" },
  { id: "com.nielsvanbrakel.widgetbox-weather", version: "0.1.0" },
  { id: "com.nielsvanbrakel.widgetbox-layout", version: "0.1.1" },
];

describe("planRelease after a version merge", () => {
  it("publishes every app changesets tagged", () => {
    const published = [
      { name: "com.nielsvanbrakel.widgetbox-clocks", version: "0.2.0" },
      { name: "com.nielsvanbrakel.widgetbox-layout", version: "0.1.1" },
    ];
    expect(planRelease({ apps, published })).toEqual([
      { id: "com.nielsvanbrakel.widgetbox-clocks", short: "clocks", version: "0.2.0" },
      { id: "com.nielsvanbrakel.widgetbox-layout", short: "layout", version: "0.1.1" },
    ]);
  });

  it("skips apps on hold, by short name, case and spaces ignored", () => {
    const published = [
      { name: "com.nielsvanbrakel.widgetbox-clocks", version: "0.2.0" },
      { name: "com.nielsvanbrakel.widgetbox-weather", version: "0.1.0" },
    ];
    expect(planRelease({ apps, published, hold: " Weather , games" })).toEqual([
      { id: "com.nielsvanbrakel.widgetbox-clocks", short: "clocks", version: "0.2.0" },
    ]);
  });

  it("ignores tagged packages that are not Homey apps", () => {
    expect(planRelease({ apps, published: [{ name: "sandbox", version: "1.0.0" }] })).toEqual([]);
  });

  it("publishes nothing when nothing was tagged", () => {
    expect(planRelease({ apps, published: [] })).toEqual([]);
  });
});

describe("planRelease for a manual run", () => {
  it("publishes the chosen app at its checked-in version, even when on hold", () => {
    expect(planRelease({ apps, dispatchApp: "weather", hold: "weather" })).toEqual([
      { id: "com.nielsvanbrakel.widgetbox-weather", short: "weather", version: "0.1.0" },
    ]);
  });

  it("fails for an unknown app", () => {
    expect(() => planRelease({ apps, dispatchApp: "toaster" })).toThrow(/toaster/);
  });
});

describe("release-plan main", () => {
  it("reads this repository's apps and prints the plan as a GitHub output line", () => {
    const line = main({ APP: "layout", PUBLISHED: "", HOLD: "" });
    expect(line).toMatch(/^apps=\[\{"id":"com\.nielsvanbrakel\.widgetbox-layout","short":"layout"/);
  });

  it("plans nothing for a push without tags", () => {
    expect(main({ PUBLISHED: "[]" })).toBe("apps=[]");
  });
});
