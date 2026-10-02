import { expect, test } from "@playwright/test";
import { LayoutPage } from "../pages/LayoutPage";

test.describe("Layout App", () => {
  let layout: LayoutPage;

  test.beforeEach(async ({ page }) => {
    layout = new LayoutPage(page);
    await layout.goto();
  });

  // ── Spacer ─────────────────────────────────────────────
  test.describe("Spacer", () => {
    test.beforeEach(async () => {
      await layout.selectWidget("Spacer");
      await layout.verifySpacerLoaded();
    });

    test("should have default height of 32", async () => {
      await layout.expectWidgetHeight("32px");
    });

    test("should update height when setting changes", async () => {
      await layout.setSettingInput("Height (pixels)", "48");
      await layout.expectWidgetHeight("48px");
    });

    test("should clamp height to at least 8 so it stays findable in edit mode", async () => {
      await layout.setSettingInput("Height (pixels)", "0");
      await layout.expectWidgetHeight("8px");
    });

    test("should clamp height to at most 200", async () => {
      await layout.setSettingInput("Height (pixels)", "5000");
      await layout.expectWidgetHeight("200px");
    });
  });

  // ── Separator ──────────────────────────────────────────
  test.describe("Separator", () => {
    test.beforeEach(async () => {
      await layout.selectWidget("Separator");
      await layout.verifySeparatorLoaded();
    });

    test("should render a 1px solid theme line by default", async () => {
      const style = await layout.getSeparatorStyle();
      expect(style).toBe("1px solid rgb(179, 179, 179)");
    });

    test("should update thickness", async () => {
      await layout.setSettingSelect("Thickness", "3");
      expect(await layout.getSeparatorStyle()).toContain("3px");
    });

    test("should update line style", async () => {
      await layout.setSettingSelect("Style", "dashed");
      expect(await layout.getSeparatorStyle()).toContain("dashed");
    });

    test("should use the Homey blue palette color", async () => {
      await layout.setSettingSelect("Color", "blue");
      expect(await layout.getSeparatorStyle()).toContain("rgb(0, 153, 255)");
    });

    test("should use a purple fallback because Homey has no purple variable", async () => {
      await layout.setSettingSelect("Color", "purple");
      expect(await layout.getSeparatorStyle()).toContain("rgb(168, 85, 247)");
    });

    test("should update margin", async () => {
      await layout.setSettingInput("Side Margin", "32");
      expect(await layout.getSeparatorMargin()).toBe("0px 32px");
    });

    test("should keep a fixed height of 24", async () => {
      await layout.setSettingSelect("Thickness", "4");
      await layout.expectWidgetHeight("24px");
    });
  });

  // ── Header ─────────────────────────────────────────────
  test.describe("Header", () => {
    test.beforeEach(async () => {
      await layout.selectWidget("Header");
      await layout.verifyHeaderLoaded();
    });

    test('should display default text "Section"', async () => {
      expect(await layout.getHeaderText()).toBe("Section");
    });

    test("should update text", async () => {
      await layout.setSettingInput("Text", "Living Room");
      expect(await layout.getHeaderText()).toBe("Living Room");
    });

    test("should truncate long text with an ellipsis instead of clipping", async () => {
      await layout.setSettingInput(
        "Text",
        "Living room, kitchen, dining area and the garden terrace at the back of the house",
      );
      expect(await layout.isHeaderTruncated()).toBe(true);
      await layout.expectWidgetHeight("40px");
    });

    test("should update alignment to center", async () => {
      await layout.setSettingSelect("Horizontal Alignment", "center");
      expect(await layout.getHeaderStyle("textAlign")).toBe("center");
    });

    test("should update weight to normal", async () => {
      await layout.setSettingSelect("Font Weight", "normal");
      expect(await layout.getHeaderStyle("fontWeight")).toBe("400");
    });

    test("should map sizes to Homey font sizes and grow the widget", async () => {
      expect(await layout.getHeaderStyle("fontSize")).toBe("20px");
      await layout.setSettingSelect("Size", "large");
      expect(await layout.getHeaderStyle("fontSize")).toBe("24px");
      await layout.expectWidgetHeight("48px");
      await layout.setSettingSelect("Size", "xsmall");
      expect(await layout.getHeaderStyle("fontSize")).toBe("14px");
      await layout.expectWidgetHeight("24px");
    });

    test("should use the Homey red palette color", async () => {
      await layout.setSettingSelect("Color", "red");
      expect(await layout.getHeaderStyle("color")).toBe("rgb(255, 59, 48)");
    });

    test("should follow the Homey text color in light and dark mode", async () => {
      const light = await layout.getHeaderStyle("color");
      await layout.toggleTheme();
      await expect.poll(() => layout.getHeaderStyle("color")).not.toBe(light);
      await layout.toggleTheme();
      await expect.poll(() => layout.getHeaderStyle("color")).toBe(light);
    });
  });
});
