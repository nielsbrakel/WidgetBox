// Checks that `homey app validate` does not do: it never looks inside widgets, versions or
// translations. Everything here runs offline in milliseconds.
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { allWidgets, flatten, homeyApps, imageSize, ROOT, readJson } from "./workspace.js";

const require = createRequire(import.meta.url);
const LANGUAGES = ["en", "nl"];

// The aquarium is being rebuilt in its own thread: its previews are not 1024x1024 yet and one
// setting id is snake_case. Remove it from these lists when the rebuild lands.
const PREVIEW_SIZE_EXEMPT = new Set(["aquarium"]);
const SETTING_ID_CASE_EXEMPT = new Set(["aquarium"]);

const apps = homeyApps();
const widgets = allWidgets();

const isTranslated = (text) =>
  LANGUAGES.every((lang) => typeof text?.[lang] === "string" && text[lang].trim() !== "");

describe("Homey apps: versions and changelogs", () => {
  it.each(apps)("$short has one version in package.json, compose and app.json", (app) => {
    expect(app.compose.version).toBe(app.pkg.version);
    expect(app.manifest.version).toBe(app.pkg.version);
  });

  it.each(apps)("$short has an en and nl changelog entry for its version", (app) => {
    const changelog = readJson(path.join(app.dir, ".homeychangelog.json"));
    const entry = changelog[app.pkg.version];
    expect(isTranslated(entry), `.homeychangelog.json["${app.pkg.version}"]`).toBe(true);
  });

  it.each(apps)("$short changelog entries are plain store text", (app) => {
    const changelog = readJson(path.join(app.dir, ".homeychangelog.json"));
    for (const [version, entry] of Object.entries(changelog)) {
      for (const lang of LANGUAGES) {
        const text = entry[lang] ?? "";
        expect(text.length, `${version}.${lang} length`).toBeLessThanOrEqual(400);
        expect(text, `${version}.${lang} has markdown or a link`).not.toMatch(/[*_`#[\]]|https?:/);
      }
    }
  });
});

describe("Homey apps: packaging", () => {
  it.each(apps)("$short has no runtime dependencies", (app) => {
    // `homey app build` copies production dependencies with `npm ls`, which breaks on pnpm's
    // symlinked node_modules. Apps must stay dependency-free (docs/decisions.md D-003).
    expect(app.pkg.dependencies ?? {}).toEqual({});
  });

  it("every app has the same .homeyignore", () => {
    const [first, ...rest] = apps.map((app) =>
      readFileSync(path.join(app.dir, ".homeyignore"), "utf8"),
    );
    for (const other of rest) expect(other).toBe(first);
  });

  it.each(apps)(
    "$short compose file declares no widgets (they come from widget.compose.json)",
    (app) => {
      expect(app.compose.widgets).toBeUndefined();
    },
  );
});

describe("Homey apps: store listing", () => {
  it.each(apps)("$short name, description and tags are in en and nl", (app) => {
    expect(isTranslated(app.compose.name)).toBe(true);
    expect(isTranslated(app.compose.description)).toBe(true);
    for (const lang of LANGUAGES) expect(app.compose.tags?.[lang]?.length).toBeGreaterThan(0);
  });

  it.each(apps)("$short has README.txt and README.nl.txt", (app) => {
    for (const file of ["README.txt", "README.nl.txt"]) {
      const text = readFileSync(path.join(app.dir, file), "utf8").trim();
      expect(text.length, file).toBeGreaterThan(40);
    }
  });

  it.each(apps)("$short has an icon and store images at the sizes Homey asks for", (app) => {
    expect(existsSync(path.join(app.dir, "assets/icon.svg"))).toBe(true);
    const sizes = { small: [250, 175], large: [500, 350], xlarge: [1000, 700] };
    for (const [name, [width, height]] of Object.entries(sizes)) {
      const file = path.join(app.dir, app.compose.images[name]);
      expect(imageSize(file), name).toMatchObject({ width, height });
    }
  });

  it.each(apps)("$short brand color is a hex color with at least 3:1 contrast to white", (app) => {
    const hex = app.compose.brandColor;
    expect(hex).toMatch(/^#[0-9a-fA-F]{6}$/);
    const channel = (offset) => {
      const c = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
    expect(1.05 / (luminance + 0.05)).toBeGreaterThanOrEqual(3);
  });
});

describe("Homey apps: translations", () => {
  it.each(apps)("$short locale files have the same non-empty keys", (app) => {
    const keys = LANGUAGES.map((lang) => {
      const file = path.join(app.dir, "locales", `${lang}.json`);
      const entries = flatten(readJson(file));
      for (const [key, value] of entries) expect(value, `${lang}: ${key}`).not.toBe("");
      return entries.map(([key]) => key).sort();
    });
    expect(keys[1]).toEqual(keys[0]);
  });
});

describe("Widgets: files", () => {
  it.each(widgets)("$app.short/$id has public/index.html", (widget) => {
    expect(existsSync(path.join(widget.dir, "public/index.html"))).toBe(true);
  });

  it.each(widgets.filter((w) => !PREVIEW_SIZE_EXEMPT.has(w.id)))(
    "$app.short/$id has 1024x1024 PNG previews for light and dark",
    (widget) => {
      for (const theme of ["light", "dark"]) {
        const file = path.join(widget.dir, `preview-${theme}.png`);
        expect(imageSize(file), file).toEqual({ type: "png", width: 1024, height: 1024 });
      }
    },
  );
});

describe("Widgets: settings", () => {
  it.each(widgets)("$app.short/$id name and description are in en and nl", (widget) => {
    expect(isTranslated(widget.compose.name)).toBe(true);
    expect(isTranslated(widget.compose.description)).toBe(true);
  });

  it.each(widgets)("$app.short/$id settings are translated and consistent", (widget) => {
    const settings = widget.compose.settings ?? [];
    const ids = settings.map((setting) => setting.id);
    expect(new Set(ids).size, "unique setting ids").toBe(ids.length);

    for (const setting of settings) {
      const where = `${widget.id}.${setting.id}`;
      if (!SETTING_ID_CASE_EXEMPT.has(widget.id)) {
        expect(setting.id, `${where} is camelCase`).toMatch(/^[a-z][a-zA-Z0-9]*$/);
      }
      expect(isTranslated(setting.label), `${where} label`).toBe(true);
      if (setting.hint) expect(isTranslated(setting.hint), `${where} hint`).toBe(true);

      if (setting.type === "dropdown") {
        const values = setting.values.map((option) => option.id);
        expect(values, `${where} default`).toContain(setting.value);
        for (const option of setting.values) {
          expect(isTranslated(option.label), `${where}.${option.id} label`).toBe(true);
        }
      }
      if (setting.type === "number") {
        if (setting.min !== undefined) {
          expect(setting.value, `${where} >= min`).toBeGreaterThanOrEqual(setting.min);
        }
        if (setting.max !== undefined) {
          expect(setting.value, `${where} <= max`).toBeLessThanOrEqual(setting.max);
        }
      }
    }
  });
});

describe("Widgets: API", () => {
  it.each(widgets)("$app.short/$id api.js exports exactly the compose api keys", (widget) => {
    const apiFile = path.join(widget.dir, "api.js");
    const declared = Object.keys(widget.compose.api ?? {}).sort();
    if (declared.length === 0) {
      expect(existsSync(apiFile), "api.js without an api block").toBe(false);
      return;
    }
    expect(statSync(apiFile).isFile()).toBe(true);
    expect(Object.keys(require(apiFile)).sort()).toEqual(declared);
  });
});

describe("Repository", () => {
  it("the CI Playwright container matches @playwright/test", () => {
    const ci = readFileSync(path.join(ROOT, ".github/workflows/ci.yml"), "utf8");
    const pkg = readJson(path.join(ROOT, "package.json"));
    const version = pkg.devDependencies["@playwright/test"];
    const images = [...ci.matchAll(/mcr\.microsoft\.com\/playwright:v([\d.]+)-/g)].map((m) => m[1]);
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) expect(image).toBe(version);
  });

  it("the release workflow publishes with the Homey CLI version from the lockfile", () => {
    const release = readFileSync(path.join(ROOT, ".github/workflows/release.yml"), "utf8");
    const pkg = readJson(path.join(ROOT, "package.json"));
    const pinned = [...release.matchAll(/homey@(\d[\w.-]*)/g)].map((m) => m[1]);
    expect(pinned.length).toBeGreaterThan(0);
    for (const version of pinned) expect(version).toBe(pkg.devDependencies.homey);
  });
});
