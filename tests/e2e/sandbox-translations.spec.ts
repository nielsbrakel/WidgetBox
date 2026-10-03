import { expect, test } from "@playwright/test";
import { TimersPage } from "../pages/TimersPage";

test.describe("Sandbox Translations", () => {
  let ui: TimersPage;

  test.beforeEach(async ({ page }) => {
    ui = new TimersPage(page);
    await ui.goto();
  });

  test("should translate widget text correctly", async () => {
    await ui.selectWidget("Stopwatch");

    // en.json widgets.stopwatch.addStopwatch, not the raw key
    await expect(ui.btnAdd).toContainText("Add stopwatch", { timeout: 5000 });
  });
});
