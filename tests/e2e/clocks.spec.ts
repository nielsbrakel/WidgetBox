import { expect, test } from "@playwright/test";
import { ClocksPage } from "../pages/ClocksPage";

test.describe("Clocks App", () => {
  let clocks: ClocksPage;

  test.beforeEach(async ({ page }) => {
    clocks = new ClocksPage(page);
    await clocks.goto();
  });

  test.describe("Analog Clock", () => {
    test.beforeEach(async () => {
      await clocks.selectWidget("Analog Clock");
      // The sandbox only applies setting changes once the widget has loaded.
      await clocks.verifyAnalogLoaded();
    });

    test("should load the clock", async () => {
      await clocks.verifyAnalogLoaded();
    });

    test("should toggle second hand", async () => {
      await expect(clocks.secondHand).toBeVisible();

      await clocks.setSettingCheckbox("Show Second Hand", false);
      await expect(clocks.secondHand).toBeHidden();

      await clocks.setSettingCheckbox("Show Second Hand", true);
      await expect(clocks.secondHand).toBeVisible();
    });

    test("should toggle the date", async () => {
      await expect(clocks.dateGroup).toBeHidden();

      await clocks.setSettingCheckbox("Show Date", true);
      await expect(clocks.dateGroup).toBeVisible();
      await expect(clocks.dateGroup).toHaveText(String(new Date().getDate()));
    });

    test("should show the Swiss second hand tip only in the Swiss style", async () => {
      await expect(clocks.secondTip).toBeHidden();

      await clocks.setSettingSelect("Style", { value: "swiss" });
      await expect(clocks.secondTip).toBeVisible();
      await expect(clocks.app).toHaveClass(/style-swiss/);
    });

    test("should keep Homey classes on the body", async () => {
      await clocks.setSettingSelect("Color", { value: "blue" });
      await expect(clocks.iframe.locator("body")).toHaveClass(/homey-widget/);
      await expect(clocks.app).toHaveClass(/color-blue/);
    });
  });

  test.describe("Digital Clock", () => {
    test.beforeEach(async () => {
      await clocks.selectWidget("Digital Clock");
      await clocks.verifyDigitalLoaded();
    });

    test("should load the clock", async () => {
      await clocks.verifyDigitalLoaded();
    });

    test("should toggle seconds", async () => {
      await expect(clocks.digitalSeconds).toHaveText("");

      await clocks.setSettingCheckbox("Show Seconds", true);
      await expect(clocks.digitalSeconds).toHaveText(/^:\d{2}$/);

      await clocks.setSettingCheckbox("Show Seconds", false);
      await expect(clocks.digitalSeconds).toHaveText("");
    });

    test("should toggle the date", async () => {
      await expect(clocks.digitalDate).toBeVisible();

      await clocks.setSettingCheckbox("Show Date", false);
      await expect(clocks.digitalDate).toBeHidden();
    });

    test("should show a 12-hour time with a translated period", async () => {
      await clocks.setSettingSelect("Time Format", { value: "12" });
      await expect(clocks.digitalTime).toHaveText(/\d{1,2}:\d{2}/);
      await expect(clocks.digitalPeriod).toHaveText(/^(AM|PM)$/);
    });
  });

  test.describe("Flip Clock", () => {
    test.beforeEach(async () => {
      await clocks.selectWidget("Flip Clock");
      await clocks.verifyFlipLoaded();
    });

    test("should load the clock", async () => {
      await clocks.verifyFlipLoaded();
    });

    test("should toggle seconds", async () => {
      await expect(clocks.flipSeconds).toHaveCount(0);

      await clocks.setSettingCheckbox("Show Seconds", true);
      await expect(clocks.flipSeconds).toBeVisible();

      await clocks.setSettingCheckbox("Show Seconds", false);
      await expect(clocks.flipSeconds).toHaveCount(0);
    });

    test("should toggle colons", async () => {
      await expect(clocks.app).not.toHaveClass(/hide-colons/);

      await clocks.setSettingCheckbox("Show Colons", false);
      await expect(clocks.app).toHaveClass(/hide-colons/);

      await clocks.setSettingCheckbox("Show Colons", true);
      await expect(clocks.app).not.toHaveClass(/hide-colons/);
    });

    test("should show the period card in 12-hour mode without flipping from undefined", async () => {
      await clocks.setSettingSelect("Time Format", { value: "12" });
      await expect(clocks.flipPeriod).toBeVisible();
      await expect(clocks.flipPeriod.locator(".half.top")).toHaveText(/^(AM|PM)$/);
      await expect(clocks.flipClock).not.toContainText("undefined");
    });
  });

  test.describe("Binary Clock", () => {
    test.beforeEach(async () => {
      await clocks.selectWidget("Binary Clock");
      await expect(clocks.binaryGroups.first()).toBeVisible();
    });

    test("should load the clock", async () => {
      await expect(clocks.binaryClock).toBeVisible();
      await expect(clocks.binaryGroups).toHaveCount(3);
    });

    test("should keep every dot inside a narrow, padded card", async ({ page }) => {
      await page.locator(".device-frame").evaluate((frame) => {
        frame.style.width = "170px";
      });
      await expect
        .poll(() =>
          clocks.binaryClock.evaluate((clock) => {
            const app = clock.parentElement as HTMLElement;
            const box = clock.getBoundingClientRect();
            const style = getComputedStyle(app);
            const padX = Number.parseFloat(style.paddingLeft);
            const padY = Number.parseFloat(style.paddingBottom);
            return (
              padX > 0 &&
              padY > 0 &&
              box.left >= padX - 1 &&
              box.right <= document.documentElement.clientWidth - padX + 1 &&
              box.bottom <= window.innerHeight - padY + 1
            );
          }),
        )
        .toBe(true);
    });

    test("should toggle seconds", async () => {
      await clocks.setSettingCheckbox("Show Seconds", false);
      await expect(clocks.binaryGroups).toHaveCount(2);

      await clocks.setSettingCheckbox("Show Seconds", true);
      await expect(clocks.binaryGroups).toHaveCount(3);
    });

    test("should show translated labels", async () => {
      await expect(clocks.binaryLabels).toHaveText(["H", "M", "S"]);

      await clocks.setSettingCheckbox("Show Labels", false);
      await expect(clocks.app).toHaveClass(/hide-labels/);
      await expect(clocks.binaryLabels.first()).toBeHidden();

      await clocks.setSettingCheckbox("Show Labels", true);
      await expect(clocks.app).not.toHaveClass(/hide-labels/);
    });

    test("should show AM or PM as text in 12-hour mode", async () => {
      await clocks.setSettingSelect("Time Format", { value: "12" });
      await expect(clocks.binaryPeriod).toHaveText(/^(AM|PM)$/);
    });
  });

  test.describe("Word Clock Grid", () => {
    test.beforeEach(async () => {
      await clocks.selectWidget("Word Clock Grid");
      await expect(clocks.wordGridCells).toHaveCount(100);
    });

    test("should render a 10x10 grid with the time highlighted", async () => {
      await expect(clocks.wordGrid).toBeVisible();
      await expect(clocks.wordGridCells).toHaveCount(100);
      expect(await clocks.wordGridActiveCells.count()).toBeGreaterThan(4);
    });

    test("should switch language", async () => {
      await clocks.setSettingSelect("Language", { value: "nl" });
      await expect(clocks.wordGridCells.first()).toHaveText("H");

      await clocks.setSettingSelect("Language", { value: "en" });
      await expect(clocks.wordGridCells.first()).toHaveText("I");
    });

    test("should fit a narrow column", async ({ page }) => {
      await page.setViewportSize({ width: 600, height: 800 });
      await clocks.setSettingSelect("Size", { value: "xlarge" });
      const overflow = await clocks.wordGrid.evaluate(
        (matrix) => matrix.getBoundingClientRect().right - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });

  test.describe("Word Clock Sentence", () => {
    test.beforeEach(async () => {
      await clocks.selectWidget("Word Clock Sentence");
      await expect(clocks.wordSentence).not.toBeEmpty();
    });

    test("should write the time as a sentence", async () => {
      await expect(clocks.wordSentence).toHaveText(/^It is /);
      await expect(clocks.wordSentence.locator(".highlight").first()).toBeVisible();
    });

    test("should switch language", async () => {
      await clocks.setSettingSelect("Language", { value: "nl" });
      await expect(clocks.wordSentence).toHaveText(/^Het is /);
    });
  });
});
