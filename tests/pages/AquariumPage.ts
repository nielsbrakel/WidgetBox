import { expect, type Frame, type Locator } from "@playwright/test";
import { SandboxPage } from "./SandboxPage";

type Point = { x: number; y: number };

/*
 * Page object for the Aquarium widget. Every game interaction is a tap: DOM buttons are clicked
 * through the iframe and canvas targets (coins, algae, fish, decor slots) are located through
 * the widget's debug handle and tapped at their on-screen position.
 */
export class AquariumPage extends SandboxPage {
  get app() {
    return this.iframe.locator("#app");
  }
  get canvas() {
    return this.iframe.locator("#tank");
  }
  get coins() {
    return this.iframe.locator("#coinVal");
  }
  get level() {
    return this.iframe.locator("#levelVal");
  }
  get modal() {
    return this.iframe.locator("#modal");
  }
  get sheet() {
    return this.iframe.locator("#sheet");
  }
  get sheetTitle() {
    return this.iframe.locator("#sheetTitle");
  }
  get tray() {
    return this.iframe.locator("#tray");
  }
  get card() {
    return this.iframe.locator("#card");
  }
  get toasts() {
    return this.iframe.locator("#toasts");
  }
  get scenarioSelect() {
    return this.page
      .locator("select")
      .filter({ has: this.page.locator('option[value="pond-day2"]') });
  }

  ui(name: string, arg?: string): Locator {
    return this.iframe
      .locator(arg ? `[data-ui="${name}"][data-arg="${arg}"]` : `[data-ui="${name}"]`)
      .first();
  }

  dock(name: "feed" | "play" | "shop" | "menu") {
    return this.iframe.locator(`.dock-btn[data-ui="${name}"]`);
  }

  async open(scenario = "default") {
    // The sandbox shell loads web fonts; the widget itself needs nothing external.
    await this.page.goto("/", { waitUntil: "domcontentloaded" });
    await this.selectWidget("Aquarium");
    await this.ready();
    if (scenario !== "default") {
      // Picking a scenario reloads the widget frame.
      const reloaded = this.page.waitForEvent("framenavigated", (f) =>
        f.url().includes("/widgets/aquarium/"),
      );
      await this.scenarioSelect.selectOption(scenario);
      await reloaded;
      await this.ready();
    }
  }

  async ready() {
    await expect(this.app).not.toHaveClass(/is-loading/, { timeout: 10000 });
    await expect.poll(() => this.state((g) => !!g.save)).toBe(true);
  }

  frame(): Frame {
    const frame = this.page.frames().find((f) => f.url().includes("/widgets/aquarium/"));
    if (!frame) throw new Error("Aquarium frame not found");
    return frame;
  }

  // Read from the running game through its debug handle.
  // biome-ignore lint/suspicious/noExplicitAny: the game object is plain JS.
  state<T>(fn: (game: any) => T): Promise<T> {
    return this.frame().evaluate(`(${fn.toString()})(window.__aquarium)`) as Promise<T>;
  }

  async locate(kind: string, arg?: unknown): Promise<Point | null> {
    return this.frame().evaluate(
      ([k, a]) =>
        (
          window as unknown as {
            __aquarium: { scene: { locate: (k: unknown, a: unknown) => Point | null } };
          }
        ).__aquarium.scene.locate(k, a),
      [kind, arg] as const,
    );
  }

  async tapCanvas(point: Point) {
    await this.canvas.click({ position: point });
  }

  async tapThing(kind: string, arg?: unknown) {
    const p = await this.locate(kind, arg);
    expect(p, `nothing to tap for ${kind}`).not.toBeNull();
    await this.tapCanvas(p as Point);
  }

  async closeWelcome() {
    if (await this.modal.isVisible()) await this.ui("modalClose").click();
    await expect(this.modal).toBeHidden();
  }

  async coinCount() {
    return this.state((g) => g.save.coins as number);
  }
}
