import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { vi } from "vitest";

const APP_DIR = path.resolve(import.meta.dirname, "..");
const LOCALE = JSON.parse(fs.readFileSync(path.join(APP_DIR, "locales/en.json"), "utf8"));

function translate(key) {
  const value = key.split(".").reduce((node, part) => node?.[part], LOCALE);
  return typeof value === "string" ? value : key;
}

/**
 * Loads a widget's public/index.html in jsdom with a mocked Homey SDK.
 * Call vi.useFakeTimers() first: the widget's timers then run on the fake clock.
 */
export function loadWidget(widgetId, { settings = {}, api = vi.fn(), beforeReady } = {}) {
  const file = path.join(APP_DIR, "widgets", widgetId, "public/index.html");
  const dom = new JSDOM(fs.readFileSync(file, "utf8"), {
    runScripts: "dangerously",
    url: "http://localhost/",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  window.Date = Date;
  window.setTimeout = setTimeout;
  window.clearTimeout = clearTimeout;
  window.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };

  const listeners = new Map();
  const Homey = {
    ready: vi.fn(),
    setHeight: vi.fn(),
    popup: vi.fn(),
    api,
    getSettings: () => ({ ...settings }),
    on: (event, listener) => listeners.set(event, [...(listeners.get(event) ?? []), listener]),
    __: vi.fn(translate),
  };

  beforeReady?.(window);
  window.onHomeyReady(Homey);

  return {
    window,
    document: window.document,
    Homey,
    $: (selector) => window.document.querySelector(selector),
    setSetting(key, value) {
      for (const listener of listeners.get("settings.set") ?? []) listener(key, value);
    },
  };
}
