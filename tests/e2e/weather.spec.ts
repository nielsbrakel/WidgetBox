import { expect, test } from "@playwright/test";
import { WeatherPage } from "../pages/WeatherPage";

test.describe("Weather widgets", () => {
  let weather: WeatherPage;

  test.beforeEach(async ({ page }) => {
    weather = new WeatherPage(page);
    await weather.stubThirdParties();
    await weather.goto();
  });

  test.describe("Rain forecast graph", () => {
    test.beforeEach(async () => {
      await weather.selectWidget("Rain forecast graph");
    });

    test("renders bars, level lines and the credit", async () => {
      await expect(weather.iframe.locator("#plot rect")).toHaveCount(24);
      await expect(weather.iframe.locator(".level span")).toHaveText([
        "Light",
        "Moderate",
        "Heavy",
      ]);
      await expect(weather.iframe.locator("#status")).toContainText("Updated");
      await expect(weather.iframe.locator("#credit")).toHaveText("Buienradar.nl");
    });

    test("switches to a smooth line", async () => {
      await weather.setSettingSelect("Graph style", "smooth");
      await expect(weather.iframe.locator("path.stroke")).toHaveAttribute("d", /C/);
      await expect(weather.iframe.locator("#plot rect")).toHaveCount(0);
    });

    test("shows a tooltip on tap", async () => {
      await weather.iframe.locator("#chart").click({ position: { x: 120, y: 40 } });
      await expect(weather.iframe.locator("#tooltip")).toBeVisible();
      await expect(weather.iframe.locator("#tooltip")).toContainText("mm/h");
    });

    test("shows the dry state", async () => {
      await weather.selectScenario("no-rain");
      await expect(weather.iframe.locator("#message")).toHaveText(
        "No rain expected in the next 2 hours",
      );
    });

    test("explains locations outside the Netherlands and Belgium", async () => {
      await weather.selectScenario("out-of-range");
      await expect(weather.iframe.locator("#message")).toContainText("Netherlands and Belgium");
    });

    test("opens the credit in a popup", async () => {
      await weather.iframe.locator("#credit").click();
      await expect.poll(() => weather.lastPopupUrl()).toBe("https://www.buienradar.nl");
    });
  });

  test.describe("Weather station", () => {
    test.beforeEach(async () => {
      await weather.selectWidget("Weather station");
    });

    test("renders the measurements", async () => {
      await expect(weather.iframe.locator("#temperature")).toHaveText("14.5°");
      await expect(weather.iframe.locator("#wind")).toHaveText("3 Bft SW");
      await expect(weather.iframe.locator("#humidity-label")).toHaveText("Humidity");
    });

    test("updates the alignment", async () => {
      await expect(weather.iframe.locator("#app")).toHaveClass(/align-left/);
      await weather.setSettingSelect("Horizontal alignment", "right");
      await expect(weather.iframe.locator("#app")).toHaveClass(/align-right/);
    });

    test("shows an error state", async () => {
      await weather.selectScenario("error");
      await expect(weather.iframe.locator("#message")).toContainText("Could not load weather data");
    });
  });

  test.describe("Weather forecast", () => {
    test.beforeEach(async () => {
      await weather.selectWidget("Weather forecast");
    });

    test("renders five days starting today", async () => {
      await expect(weather.iframe.locator(".day")).toHaveCount(5);
      await expect(weather.iframe.locator(".day .long").first()).toHaveText("Today");
    });

    test("changes the number of days", async () => {
      await weather.setSettingSelect("Number of days", "7");
      await expect(weather.iframe.locator(".day")).toHaveCount(7);
    });

    test("asks for a location when none is known", async () => {
      await weather.selectScenario("no-location");
      await expect(weather.iframe.locator("#message")).toHaveText(
        "Set a location in the widget settings",
      );
    });
  });

  test.describe("Rain radar", () => {
    test.beforeEach(async () => {
      await weather.selectWidget("Rain radar");
    });

    test("shows the radar image with the credit", async () => {
      await expect(weather.iframe.locator("img#radar")).toBeVisible();
      await expect(weather.iframe.locator("img#radar")).toHaveAttribute(
        "src",
        /renderBranding=True/,
      );
      await expect(weather.iframe.locator("#credit")).toBeVisible();
    });
  });

  test.describe("5-day radar", () => {
    test.beforeEach(async () => {
      await weather.selectWidget("5-day radar");
    });

    test("loads the sandboxed gadget", async () => {
      const gadget = weather.iframe.locator("#frame iframe");
      await expect(gadget).toHaveAttribute("src", /gadgets\.buienradar\.nl\/gadget\/radarfivedays/);
      await expect(gadget).toHaveAttribute("sandbox", "");
      await expect(weather.iframe.locator("#status")).toContainText("Updated");
    });
  });
});

test.describe("Rain radar offline", () => {
  test("shows an error instead of a broken image", async ({ page }) => {
    const weather = new WeatherPage(page);
    await weather.stubThirdParties({ radarImage: "fail" });
    await weather.goto();
    await weather.selectWidget("Rain radar");
    await expect(weather.iframe.locator("#message")).toContainText("Could not load weather data");
    await expect(weather.iframe.locator("img#radar")).toBeHidden();
  });
});
