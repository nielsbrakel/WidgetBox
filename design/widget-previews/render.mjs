#!/usr/bin/env node
/**
 * Renders the widget preview SVGs in ./svg to the preview-light.png / preview-dark.png
 * files of each widget (Homey guideline 1.10: 1024x1024, transparent background).
 *
 * Usage (from the repo root):
 *   node design/widget-previews/render.mjs            # all previews
 *   node design/widget-previews/render.mjs timer      # only the given widget(s)
 *
 * Set PW_CHROMIUM to a Chromium executable when Playwright's bundled browser is not installed.
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const svgDir = join(here, "svg");

const APPS = {
  "com.nielsvanbrakel.widgetbox-clocks": [
    "analog-clock",
    "binary-clock",
    "digital-clock",
    "flip-clock",
    "word-clock-grid",
    "word-clock-sentence",
    "stopwatch",
    "timer",
  ],
  "com.nielsvanbrakel.widgetbox-weather": [
    "radar-5day",
    "rain-graph",
    "rain-radar",
    "forecast",
    "station",
    "weather-map",
  ],
  "com.nielsvanbrakel.widgetbox-layout": ["header", "separator", "spacer"],
  "com.nielsvanbrakel.widgetbox-video": ["youtube"],
};

const only = new Set(process.argv.slice(2));
const jobs = Object.entries(APPS).flatMap(([app, widgets]) =>
  widgets
    .filter((widget) => only.size === 0 || only.has(widget))
    .map((widget) => ({ widget, outDir: join(root, "apps", app, "widgets", widget) })),
);

if (jobs.length === 0) {
  console.error(`No matching widgets for: ${[...only].join(", ")}`);
  process.exit(1);
}

const fallbackChromium = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const executablePath =
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: local design tool, not a turbo task
  process.env.PW_CHROMIUM ?? (existsSync(fallbackChromium) ? fallbackChromium : undefined);

const browser = await chromium.launch({ executablePath });
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });

for (const { widget, outDir } of jobs) {
  const svg = join(svgDir, `${widget}.svg`);
  if (!existsSync(svg)) throw new Error(`Missing source: ${svg}`);
  for (const theme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto(pathToFileURL(svg).href);
    await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
    const out = join(outDir, `preview-${theme}.png`);
    await page.screenshot({ path: out, omitBackground: true });
    console.log(`wrote ${out.slice(root.length + 1)}`);
  }
}

await browser.close();
