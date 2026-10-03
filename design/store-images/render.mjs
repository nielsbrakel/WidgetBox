#!/usr/bin/env node
/**
 * Renders each app's Homey App Store images (assets/images/{small,large,xlarge}.jpg)
 * from real widgets in the sandbox, placed on a dashboard in the app's brand mood.
 *
 * Usage (from the repo root, with the sandbox running: `pnpm sandbox`):
 *   node design/store-images/render.mjs            # every app
 *   node design/store-images/render.mjs weather    # only the given app key(s)
 *
 * Set PW_CHROMIUM to a Chromium executable when Playwright's bundled browser is not
 * installed, and SANDBOX_URL when the sandbox does not run on http://localhost:5173.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { BRAND } from "./brand.mjs";
import { SCENES } from "./scenes.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const cache = join(here, ".cache");
mkdirSync(cache, { recursive: true });

// biome-ignore-start lint/suspicious/noUndeclaredEnvVars: local design tool, not a turbo task
const sandbox = process.env.SANDBOX_URL ?? "http://localhost:5173";
const fallbackChromium = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const executablePath =
  process.env.PW_CHROMIUM ?? (existsSync(fallbackChromium) ? fallbackChromium : undefined);
// Weather widgets load their condition icons from the Buienradar CDN.
const proxy = process.env.HTTPS_PROXY
  ? { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" }
  : undefined;
// biome-ignore-end lint/suspicious/noUndeclaredEnvVars: local design tool, not a turbo task

// 10:09 is the classic watch-advert time: both hands frame the dial.
const FROZEN_TIME = new Date("2026-10-02T10:09:30");

const only = new Set(process.argv.slice(2));
const apps = Object.keys(SCENES).filter((app) => only.size === 0 || only.has(BRAND[app].key));
if (apps.length === 0) {
  console.error(`No matching apps for: ${[...only].join(", ")}`);
  process.exit(1);
}

const browser = await chromium.launch({ executablePath, proxy });

/** Captures one widget from the sandbox at the given CSS width; returns its image and height. */
async function captureWidget(item, theme, width, registry) {
  const context = await browser.newContext({
    viewport: { width: 1400, height: 1000 },
    deviceScaleFactor: 2,
    ignoreHTTPSErrors: Boolean(proxy),
  });
  const page = await context.newPage();
  await page.clock.install({ time: FROZEN_TIME });
  await page.addInitScript((t) => localStorage.setItem("sandbox-theme", t), theme);
  await page.goto(`${sandbox}/?widget=${item.widget}`);
  await page.locator(".device-frame iframe").waitFor();

  if (item.scenario) await page.locator(".debug-section select").selectOption(item.scenario);
  const settings = registry.find((w) => w.id === item.widget).settings;
  for (const [id, value] of Object.entries(item.settings ?? {})) {
    const index = settings.findIndex((s) => s.id === id);
    const group = page.locator(".setting-group:not(.debug-section)").nth(index);
    if (settings[index].type === "dropdown") await group.locator("select").selectOption(value);
    else if (settings[index].type === "checkbox") await group.locator("input").setChecked(value);
    else await group.locator("input").fill(String(value));
  }

  await page.addStyleTag({
    content: `body, .app-container, .preview-area, .preview-content { background: transparent !important; }
      .device-frame { border: 0 !important; box-shadow: none !important; background: transparent !important; padding: 0 !important; }`,
  });
  await page.evaluate((w) => {
    document.querySelector(".device-frame").style.width = `${w}px`;
  }, width);
  await page.clock.runFor(2500);
  await page.waitForTimeout(700); // CSS height transitions run on real time

  const card = page.locator(".device-frame > div");
  const { height } = await card.boundingBox();
  const file = join(
    cache,
    `${item.widget}-${theme}-${width}-${Object.values(item.settings ?? {}).join("-")}.png`,
  );
  await card.screenshot({ path: file, omitBackground: true });
  await context.close();
  return { file, height: Math.round(height) };
}

/** Builds the dashboard page for one scene variant. */
async function buildPage(app, variant, registry) {
  const brand = BRAND[app];
  const scene = SCENES[app];
  const dark = brand.theme === "dark";
  const [w, h] = variant === "small" ? [500, 350] : [1000, 700];
  const top = scene.title && variant !== "small" ? 132 : 56;

  const blocks = [];
  for (const column of scene[variant]) {
    const placed = [];
    for (const item of column.items) {
      if (item.widget) {
        const shot = await captureWidget(item, brand.theme, column.w, registry);
        placed.push({
          height: shot.height,
          tag: `<img class="widget" src="${pathToFileURL(shot.file).href}"`,
        });
      } else {
        placed.push({ height: item.height, tag: `<div class="block"`, html: item.html });
      }
    }
    const total = placed.reduce((sum, p) => sum + p.height + 16, -16);
    let y = column.y === "center" ? Math.round((h - total) / 2) : (column.y ?? top);
    for (const p of placed) {
      const style = `left:${column.x}px;top:${y}px;width:${column.w}px`;
      blocks.push(
        p.html
          ? `${p.tag} style="${style};height:${p.height}px">${p.html}</div>`
          : `${p.tag} style="${style}">`,
      );
      y += p.height + 16;
    }
    if (y - 16 > h)
      console.warn(`  ! ${brand.key} ${variant}: column at x=${column.x} overflows (${y - 16}px)`);
  }

  const heading =
    scene.title && variant !== "small"
      ? `<h1>${scene.title}<span>${scene.subtitle}</span></h1>`
      : "";

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    :root {
      --brand: ${brand.color};
      --accent: ${dark ? brand.glow : brand.color};
      --base: ${dark ? "#101116" : "#eef0f4"};
      --card: ${dark ? "#22262e" : "#ffffff"};
      --text: ${dark ? "#ffffff" : "#1d1d22"};
      --muted: ${dark ? "#9a9ca6" : "#73737d"};
      --chip: ${dark ? "#2e323b" : "#eef0f4"};
      --shadow: ${dark ? "0 10px 30px rgba(0,0,0,.35)" : "0 10px 30px rgba(28,28,48,.08), 0 2px 6px rgba(28,28,48,.05)"};
    }
    * { box-sizing: border-box; margin: 0; }
    body {
      width: ${w}px; height: ${h}px; overflow: hidden; position: relative;
      font-family: Nunito, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: var(--text);
      background:
        radial-gradient(70% 80% at 100% 0%, color-mix(in srgb, var(--brand) ${dark ? 42 : 34}%, transparent), transparent 70%),
        radial-gradient(60% 70% at 0% 100%, color-mix(in srgb, var(--brand) ${dark ? 22 : 18}%, transparent), transparent 70%),
        var(--base);
    }
    h1 { position: absolute; left: 56px; top: 50px; font-size: 32px; font-weight: 700; letter-spacing: -.01em; }
    h1 span { margin-left: 14px; font-size: 17px; font-weight: 600; color: var(--accent); }
    .widget, .block { position: absolute; }
    .widget { border-radius: 12px; filter: drop-shadow(${dark ? "0 10px 24px rgba(0,0,0,.35)" : "0 8px 20px rgba(28,28,48,.08)"}); }
    .tile, .video { background: var(--card); border-radius: 12px; box-shadow: var(--shadow); height: 100%; }
    .tile { padding: 18px; display: flex; flex-direction: column; }
    .chip { width: 40px; height: 40px; border-radius: 10px; background: var(--chip); display: grid; place-items: center; margin-bottom: auto; }
    .chip.on { background: #ffa51f; }
    .chip svg { width: 22px; height: 22px; fill: none; stroke: var(--muted); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .chip.on svg { stroke: #fff; }
    .name { font-size: 17px; font-weight: 700; }
    .state { font-size: 14px; font-weight: 600; color: var(--muted); margin-top: 2px; }
    .pair, .row4 { display: grid; gap: 16px; height: 100%; }
    .pair { grid-template-columns: 1fr 1fr; }
    .row4 { grid-template-columns: repeat(4, 1fr); }
    .video { overflow: hidden; position: relative; }
    .video > svg { width: 100%; height: 100%; display: block; }
    .play { position: absolute; left: 50%; top: 50%; width: 68px; height: 46px; margin: -23px 0 0 -34px; border-radius: 12px; background: rgba(20,20,24,.72); display: grid; place-items: center; }
    .play svg { width: 26px; height: 26px; fill: #fff; }
  </style></head><body>${heading}${blocks.join("")}</body></html>`;
}

async function shoot(html, file, cssSize, scale) {
  const htmlFile = join(cache, "page.html");
  writeFileSync(htmlFile, html);
  const context = await browser.newContext({
    viewport: { width: cssSize[0], height: cssSize[1] },
    deviceScaleFactor: scale,
  });
  const page = await context.newPage();
  await page.goto(pathToFileURL(htmlFile).href);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: file, type: "jpeg", quality: 82 });
  await context.close();
  console.log(`wrote ${file.slice(root.length + 1)}`);
}

// Generated by the sandbox on start (`pnpm sandbox`).
const { default: registry } = await import("../../apps/sandbox/src/registry.json", {
  with: { type: "json" },
});

for (const app of apps) {
  const out = join(root, "apps", app, "assets", "images");
  const xlarge = await buildPage(app, "xlarge", registry);
  await shoot(xlarge, join(out, "xlarge.jpg"), [1000, 700], 1);
  await shoot(xlarge, join(out, "large.jpg"), [1000, 700], 0.5);
  await shoot(await buildPage(app, "small", registry), join(out, "small.jpg"), [500, 350], 0.5);
}

await browser.close();
