import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { widgets } from "./catalog";

// Every widget passes axe's WCAG 2.2 AA rules in both Homey themes. Only the widget page is
// checked, not the sandbox around it or third-party players embedded in it.
const WIDGET_FRAME = 'iframe[title="Widget Sandbox"]';

for (const widget of widgets) {
  for (const theme of ["light", "dark"]) {
    test(`${widget.name} (${theme}) has no accessibility violations`, async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem("sandbox-theme", value), theme);
      await page.goto(`/?widget=${widget.id}`);
      const frame = page.frameLocator(WIDGET_FRAME);
      await expect
        .poll(() =>
          frame
            .locator("html")
            .evaluate(
              (html) =>
                (html.ownerDocument.defaultView as Window & { Homey?: { readyCount: number } })
                  .Homey?.readyCount ?? 0,
            )
            .catch(() => 0),
        )
        .toBeGreaterThan(0);

      const results = await new AxeBuilder({ page })
        .include([WIDGET_FRAME, "body"])
        .exclude([WIDGET_FRAME, "iframe"])
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      const violations = results.violations.map((v) => ({
        rule: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => `${n.target.join(" ")}: ${n.failureSummary?.split("\n")[1]}`),
      }));
      expect(violations).toEqual([]);
    });
  }
}
