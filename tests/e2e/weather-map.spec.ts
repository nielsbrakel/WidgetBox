import { expect, test } from "@playwright/test";
import { WeatherPage } from "../pages/WeatherPage";

test.describe("Weather map", () => {
  let map: WeatherPage;

  test.beforeEach(async ({ page }) => {
    map = new WeatherPage(page);
    await map.stubThirdParties();
    await map.goto();
    await map.selectWidget("Weather map");
  });

  test("uses the Homey location by default and sends no undefined values", async () => {
    await expect(map.embedIframe).toBeVisible();
    const params = await map.embedParams();
    expect(params.get("lat")).toBe("52.09");
    expect(params.get("lon")).toBe("5.12");
    expect(params.get("zoom")).toBe("5");
    expect(params.get("overlay")).toBe("wind");
    expect(params.toString()).not.toContain("undefined");
    await expect(map.embedIframe).toHaveAttribute(
      "referrerpolicy",
      "strict-origin-when-cross-origin",
    );
  });

  test("uses the configured location", async () => {
    await map.setSettingInput(/^Latitude/, "40,71");
    await map.setSettingInput(/^Longitude/, "-74.00");
    await expect(map.embedIframe).toHaveAttribute("src", /lat=40\.71/);
    await expect(map.embedIframe).toHaveAttribute("src", /lon=-74/);
  });

  test("clamps the zoom level", async () => {
    await map.setSettingInput("Zoom level", "8");
    await expect(map.embedIframe).toHaveAttribute("src", /zoom=8/);
    await map.setSettingInput("Zoom level", "40");
    await expect(map.embedIframe).toHaveAttribute("src", /zoom=11/);
  });

  test("updates layer, model and altitude", async () => {
    await map.setSettingSelect("Map layer", { label: "Rain" });
    await map.setSettingSelect("Forecast model", "gfs");
    await map.setSettingSelect("Altitude", "850h");
    await expect(map.embedIframe).toHaveAttribute("src", /overlay=rain/);
    await expect(map.embedIframe).toHaveAttribute("src", /product=gfs/);
    await expect(map.embedIframe).toHaveAttribute("src", /level=850h/);
  });

  test("updates the visibility toggles and units", async () => {
    await map.setSettingCheckbox("Show pressure lines", true);
    await map.setSettingCheckbox("Show location marker", false);
    await map.setSettingCheckbox("Hide promo message", false);
    await map.setSettingSelect("Wind unit", "kmh");
    await expect.poll(async () => (await map.embedParams()).get("metricWind")).toBe("km/h");
    const params = await map.embedParams();
    expect(params.get("pressure")).toBe("true");
    expect(params.get("marker")).toBe("false");
    expect(params.get("message")).toBe("false");
  });

  test("locks the map behind a visible hint until tapped", async () => {
    const shield = map.iframe.locator("#shield");
    await expect(shield).toBeVisible();
    await expect(shield).toContainText("Tap to interact");
    await shield.click();
    await expect(shield).toBeHidden();
    const lock = map.iframe.locator("#lock");
    await expect(lock).toBeVisible();
    await lock.click();
    await expect(shield).toBeVisible();
  });

  test("shows an empty state without a location", async () => {
    await map.selectScenario("no-location");
    await expect(map.iframe.locator("#notice-title")).toHaveText(
      "Set a location in the widget settings",
    );
    await expect(map.embedIframe).toHaveCount(0);
  });

  test("shows a translated notice on iOS", async () => {
    await map.selectScenario("ios");
    await expect(map.iframe.locator("#notice-title")).toHaveText(
      "The weather map is not available on iOS",
    );
    await expect(map.embedIframe).toHaveCount(0);
  });
});
