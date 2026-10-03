import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

// Every widget, in both languages, behaves the way a real Homey needs (D-016):
// it calls Homey.ready() exactly once, uses no translation key that is missing, and throws nothing.
// The aquarium is rebuilt separately and checked by its own specs.
const APPS_DIR = path.resolve(import.meta.dirname, "../../apps");
const widgets = readdirSync(APPS_DIR)
  .filter((app) => app.startsWith("com."))
  .flatMap((app) =>
    readdirSync(path.join(APPS_DIR, app, "widgets")).map((id) => ({
      id,
      name: JSON.parse(
        readFileSync(path.join(APPS_DIR, app, "widgets", id, "widget.compose.json"), "utf8"),
      ).name.en as string,
    })),
  )
  .filter((widget) => widget.id !== "aquarium");

type HomeyProbe = { readyCount: number; missing: string[] } | null;

for (const widget of widgets) {
  for (const lang of ["en", "nl"]) {
    test(`${widget.name} (${lang}) is ready once and fully translated`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.goto(`/?widget=${widget.id}&lang=${lang}`);
      const frame = () => page.frame({ url: new RegExp(`/widgets/${widget.id}/public/`) });
      const probe = () =>
        frame()?.evaluate((): HomeyProbe => {
          const homey = (window as unknown as { Homey?: Record<string, unknown> }).Homey;
          if (!homey || typeof homey.readyCount !== "number") return null;
          return {
            readyCount: homey.readyCount as number,
            missing: [...(homey.missingTranslations as Set<string>)],
          };
        }) ?? Promise.resolve(null);

      await expect.poll(async () => (await probe())?.readyCount ?? 0).toBeGreaterThan(0);
      // Give a second ready() call (a common bug with several init paths) time to happen.
      await page.waitForTimeout(500);
      const result = await probe();
      expect(result?.readyCount, "Homey.ready() calls").toBe(1);
      expect(result?.missing, "missing translations").toEqual([]);
      expect(errors, "uncaught errors").toEqual([]);
    });
  }
}
