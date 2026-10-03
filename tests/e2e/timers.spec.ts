import { expect, test } from "@playwright/test";
import { TimersPage } from "../pages/TimersPage";

test.describe("Clocks & Timers: stopwatch and timer", () => {
  let ui: TimersPage;

  test.beforeEach(async ({ page }) => {
    // A controllable clock in the sandbox and the widget frame: tests jump ahead instead of sleeping.
    await page.clock.install();
    ui = new TimersPage(page);
    await ui.goto();
  });

  test.describe("Stopwatch", () => {
    test.beforeEach(async () => {
      await ui.selectWidget("Stopwatch");
      await expect(ui.items).toHaveCount(1);
    });

    test("starts at zero with labelled touch-sized buttons", async () => {
      await expect(ui.time()).toHaveText("00:00.00");
      await expect(ui.action("toggle")).toHaveAttribute("aria-label", "Start");
      await expect(ui.action("reset")).toBeDisabled();
      const box = await ui.action("toggle").boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    });

    test("runs, pauses and resets", async ({ page }) => {
      await ui.action("toggle").click();
      await expect(ui.action("toggle")).toHaveAttribute("aria-label", "Pause");
      await page.clock.fastForward(1100);
      await ui.action("toggle").click();

      const paused = await ui.time().innerText();
      expect(paused).toMatch(/^00:01\.\d\d$/);
      await page.clock.fastForward(300);
      await expect(ui.time()).toHaveText(paused);

      await ui.action("reset").click();
      await expect(ui.time()).toHaveText("00:00.00");
    });

    test("persists through the widget API and keeps running after a reload", async ({ page }) => {
      await ui.action("toggle").click();
      await page.clock.fastForward(1200);

      await expect
        .poll(async () => (await ui.storedState("stopwatch"))?.items)
        .toEqual([expect.objectContaining({ startedAt: expect.any(Number) })]);

      await ui.reloadWidget();
      await expect(ui.action("toggle")).toHaveAttribute("aria-label", "Pause");
      await expect(ui.time()).toHaveText(/^00:0[1-9]\.\d\d$/);
    });

    test("hides hundredths when disabled", async () => {
      await ui.setSettingCheckbox("Show hundredths of a second", false);
      await expect(ui.time()).toHaveText("00:00");
    });

    test("records laps, newest first", async ({ page }) => {
      await ui.setSettingCheckbox("Show lap times", true);
      await ui.action("toggle").click();
      await page.clock.fastForward(300);
      await ui.action("lap").click();
      await page.clock.fastForward(300);
      await ui.action("lap").click();

      const laps = ui.item().locator(".lap");
      await expect(laps).toHaveCount(2);
      await expect(laps.first()).toContainText("Lap 2");
      await expect
        .poll(async () => (await ui.storedState("stopwatch"))?.items[0].laps.length)
        .toBe(2);
    });

    test("adds and removes stopwatches with a 44px remove button", async () => {
      await expect(ui.action("remove")).toHaveCount(0);
      await ui.btnAdd.click();
      await expect(ui.items).toHaveCount(2);

      const box = await ui.action("remove").boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      await expect(ui.action("remove")).toHaveAttribute("aria-label", "Remove stopwatch");

      await ui.action("remove").click();
      await expect(ui.items).toHaveCount(1);
    });

    test("stops offering more stopwatches at the maximum", async () => {
      await ui.setSettingInput(/^Maximum number of stopwatches/, "2");
      await ui.btnAdd.click();
      await expect(ui.items).toHaveCount(2);
      await expect(ui.btnAdd).toHaveCount(0);
    });

    test("shows a fixed number of stopwatches when adding is not allowed", async () => {
      await ui.setSettingCheckbox("Allow adding and removing stopwatches", false);
      await ui.setSettingInput(/^Number of stopwatches/, "3");
      await expect(ui.items).toHaveCount(3);
      await expect(ui.btnAdd).toHaveCount(0);
      await expect(ui.action("remove")).toHaveCount(0);
    });

    test("fits a narrow dashboard column", async () => {
      await ui.btnAdd.click();
      await ui.setPreviewWidth(170);
      await expect(ui.iframe.locator("body")).toHaveClass(/narrow/);
      expect(await ui.hasHorizontalOverflow()).toBe(false);
    });
  });

  test.describe("Timer", () => {
    test.beforeEach(async () => {
      await ui.selectWidget("Timer");
      await expect(ui.items).toHaveCount(1);
    });

    test("starts with the default duration in a stepper", async () => {
      await expect(ui.unitValue("hours")).toHaveText("00");
      await expect(ui.unitValue("minutes")).toHaveText("05");
      await expect(ui.unitValue("seconds")).toHaveText("00");
      await expect(ui.stepper("minutes", 1)).toHaveAttribute("aria-label", "More minutes");
      const box = await ui.stepper("minutes", 1).boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
    });

    test("steps values with wrap-around and disables start at zero", async () => {
      await ui.stepper("seconds", -1).click();
      await expect(ui.unitValue("seconds")).toHaveText("59");
      await ui.stepper("seconds", 1).click();
      await ui.press(ui.stepper("minutes", -1), 5);
      await expect(ui.unitValue("minutes")).toHaveText("00");
      await expect(ui.action("toggle")).toBeDisabled();
    });

    test("counts down, pauses and resets", async ({ page }) => {
      await ui.action("toggle").click();
      await expect(ui.countdown()).toHaveText(/^0[45]:\d\d$/);
      await page.clock.fastForward(1100);
      await ui.action("toggle").click();
      await expect(ui.action("toggle")).toHaveAttribute("aria-label", "Start");
      await expect(ui.countdown()).toHaveText("04:59");

      await ui.action("reset").click();
      await expect(ui.unitValue("minutes")).toHaveText("05");
    });

    test("does not gain time when paused, resumed and reloaded", async ({ page }) => {
      await ui.setTimerDuration({ seconds: 10 });
      await ui.action("toggle").click();
      await page.clock.fastForward(1500);
      await ui.action("toggle").click();
      await ui.action("toggle").click();
      await page.clock.fastForward(500);

      await ui.reloadWidget();
      await expect(ui.countdown()).toHaveText(/^00:0[78]$/);
      const stored = await ui.storedState("timer");
      expect(stored.items[0].status).toBe("running");
      expect(stored.items[0].remainingMs).toBeLessThan(9000);
    });

    test("shows when time is up and returns to the stepper on done", async () => {
      await ui.setTimerDuration({ seconds: 1 });
      await ui.action("toggle").click();

      await expect(ui.item()).toHaveClass(/finished/, { timeout: 4000 });
      await expect(ui.item()).toContainText("Time's up");
      await expect(ui.countdown()).toHaveText(/^−00:0\d$/);

      await ui.action("done").click();
      await expect(ui.unitValue("seconds")).toHaveText("01");
    });

    test("applies a changed default duration to an idle timer", async () => {
      await ui.setSettingInput(/^Default minutes/, "10");
      await expect(ui.unitValue("minutes")).toHaveText("10");
    });

    test("adds and removes timers", async () => {
      await ui.btnAdd.click();
      await expect(ui.items).toHaveCount(2);
      await ui.action("remove", 1).click();
      await expect(ui.items).toHaveCount(1);
    });

    test("fits a narrow dashboard column", async () => {
      await ui.btnAdd.click();
      await ui.action("toggle").click();
      await ui.setPreviewWidth(170);
      await expect(ui.iframe.locator("body")).toHaveClass(/narrow/);
      expect(await ui.hasHorizontalOverflow()).toBe(false);
      const stepper = await ui.item(1).locator(".stepper").boundingBox();
      expect(stepper?.width).toBeLessThanOrEqual(170);
    });
  });
});
