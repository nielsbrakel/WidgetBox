// Security invariants for everything that ships (SECURITY.md). They keep today's good habits from
// eroding: no HTML built from data, a fixed set of outbound hosts, and widget APIs that refuse bad
// input before they store anything.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { APPS_DIR, allWidgets } from "./workspace.js";

const require = createRequire(import.meta.url);

// Development files and the aquarium (rebuilt in its own thread) are not checked here.
const SKIP = /(^|\/)(node_modules|\.homeybuild|test|aquarium)(\/|$)|\.test\.js$|(^|\/)vendor\//;

const shippedFiles = (dir = APPS_DIR, base = APPS_DIR) =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    const relative = path.relative(base, full);
    if (SKIP.test(relative) || relative.startsWith("sandbox")) return [];
    if (statSync(full).isDirectory()) return shippedFiles(full, base);
    return /\.(html|js)$/.test(name) ? [relative] : [];
  });

const files = shippedFiles().map((file) => ({
  file,
  source: readFileSync(path.join(APPS_DIR, file), "utf8"),
}));

// Files that build markup with innerHTML, and how often. Their templates only interpolate
// translations, numbers, icons and ids the Homey has validated (lib/widgetState.js). New sinks need
// a review and a change here.
const HTML_SINK_ALLOWANCE = {
  "com.nielsvanbrakel.widgetbox-clocks/widgets/stopwatch/public/index.html": 1,
  "com.nielsvanbrakel.widgetbox-clocks/widgets/timer/public/index.html": 1,
};
const HTML_SINK = /\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML|document\.write|srcdoc/g;
const CODE_FROM_STRING = /\beval\s*\(|new\s+Function\s*\(|set(Timeout|Interval)\s*\(\s*["'`]/g;

// Every host an app or widget may talk to or embed.
const ALLOWED_HOSTS = new Set([
  "cdn.buienradar.nl",
  "data.buienradar.nl",
  "forecast.buienradar.nl",
  "gadgets.buienradar.nl",
  "gpsgadget.buienradar.nl",
  "image.buienradar.nl",
  "location.buienradar.nl",
  "observations.buienradar.nl",
  "www.buienradar.nl",
  "embed.windy.com",
  "www.youtube-nocookie.com",
  "i.ytimg.com",
  // XML namespace of inline SVG, never fetched
  "www.w3.org",
]);

describe("Security: no HTML or code from strings", () => {
  it("apps found to check", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files)("$file builds HTML only where allowed", ({ file, source }) => {
    const count = source.match(HTML_SINK)?.length ?? 0;
    expect(count, "new innerHTML-style sink: use textContent or DOM nodes").toBeLessThanOrEqual(
      HTML_SINK_ALLOWANCE[file] ?? 0,
    );
  });

  it.each(files)("$file never turns strings into code", ({ source }) => {
    expect(source.match(CODE_FROM_STRING)).toBeNull();
  });
});

describe("Security: outbound hosts", () => {
  it.each(files)("$file only references allowed hosts", ({ source }) => {
    const hosts = [...source.matchAll(/\bhttps?:\/\/([a-z0-9.-]+)/gi)].map((m) => m[1]);
    for (const host of hosts) expect(ALLOWED_HOSTS, `host ${host}`).toContain(host);
  });

  it.each(files)("$file uses https for everything it loads", ({ source }) => {
    const insecure = [...source.matchAll(/\bhttp:\/\/([a-z0-9.-]+)/gi)]
      .map((m) => m[1])
      .filter((host) => host !== "www.w3.org");
    expect(insecure).toEqual([]);
  });

  it.each(files)("$file gives embedded frames a referrer policy", ({ source }) => {
    const frames = source.match(/createElement\(\s*["']iframe["']\s*\)|<iframe\b/g)?.length ?? 0;
    const policies = source.match(/referrerpolicy/gi)?.length ?? 0;
    expect(policies).toBeGreaterThanOrEqual(frames);
  });

  it.each(files)("$file opens new windows with noopener", ({ source }) => {
    for (const link of source.match(/<a\b[^>]*target=["']_blank["'][^>]*>/g) ?? []) {
      expect(link).toMatch(/rel=["'][^"']*noopener/);
    }
  });
});

// Hostile bodies a caller on the local network could send to a widget's write routes.
const HOSTILE_BODIES = [
  null,
  "items",
  {},
  { items: "x" },
  { items: [null] },
  { items: Array.from({ length: 11 }, (_, i) => ({ id: `a${i}` })) },
  { items: [{ id: '"><img src=x onerror=alert(1)>' }] },
  { items: [{ id: "a" }, { id: "a" }] },
  { items: [{ id: "x".repeat(20000) }] },
  JSON.parse('{"items": [{"id": "a", "__proto__": {"polluted": true}}]}'),
];

const writeRoutes = allWidgets()
  .filter((widget) => widget.id !== "aquarium")
  .flatMap((widget) =>
    Object.entries(widget.compose.api ?? {})
      .filter(([, route]) => route.method !== "GET")
      .map(([name]) => ({ widget: `${widget.app.short}/${widget.id}`, name, dir: widget.dir })),
  );

describe("Security: widget API write routes", () => {
  it.each(writeRoutes)(
    "$widget $name rejects malformed input and stores nothing",
    async (route) => {
      const api = require(path.join(route.dir, "api.js"));
      const homey = {
        settings: { get: () => null, set: vi.fn(), unset: vi.fn(), getKeys: () => [] },
        api: { realtime: vi.fn() },
        error: vi.fn(),
      };
      const query = { widgetId: "a1b2c3d4-0000-4000-8000-abcdefabcdef" };
      for (const body of HOSTILE_BODIES) {
        await expect(
          api[route.name]({ homey, query, body }),
          JSON.stringify(body),
        ).rejects.toThrow();
      }
      for (const badQuery of [{}, { widgetId: "../x" }, { widgetId: "x".repeat(100) }]) {
        await expect(
          api[route.name]({ homey, query: badQuery, body: { items: [] } }),
        ).rejects.toThrow();
      }
      expect(homey.settings.set).not.toHaveBeenCalled();
      expect(homey.api.realtime).not.toHaveBeenCalled();
      expect({}.polluted).toBeUndefined();
    },
  );
});
