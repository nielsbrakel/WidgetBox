// Accessibility rules that hold in source. The axe sweep in tests/e2e/accessibility.spec.ts
// checks the rendered widgets; this keeps motion opt-out from regressing in any widget.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { allWidgets } from "./workspace.js";

const MOTION = /animation:|transition:|@keyframes|\.animate\(|scroll-behavior:\s*smooth/;

const pages = allWidgets()
  .filter((widget) => widget.id !== "aquarium")
  .map((widget) => ({
    widget: `${widget.app.short}/${widget.id}`,
    source: readFileSync(path.join(widget.dir, "public/index.html"), "utf8"),
  }));

describe("Accessibility: motion", () => {
  it.each(pages.filter((page) => MOTION.test(page.source)))(
    "$widget turns animation off for prefers-reduced-motion",
    ({ source }) => {
      // In CSS (@media) or in script (matchMedia), as the flip clock does.
      expect(source).toMatch(/\(prefers-reduced-motion: reduce\)/);
    },
  );
});
