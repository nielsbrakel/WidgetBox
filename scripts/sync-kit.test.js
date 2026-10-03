import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { HEADER, syncKit } from "./sync-kit.mjs";

let root;
const SOURCE = "/* kit */\nconst x = 1;\n";
const write = (file, text) => {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), text);
};
const read = (file) => readFileSync(path.join(root, file), "utf8");
const USES_KIT = '<script src="vendor/widget-kit.js"></script>';

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "sync-kit-"));
  write("packages/widget-kit/src/widget-kit.js", SOURCE);
  write("apps/com.a/widgets/clock/public/index.html", `<body>${USES_KIT}</body>`);
  write("apps/com.a/widgets/plain/public/index.html", "<body></body>");
  write("apps/com.b/widgets/timer/public/index.html", `<body>${USES_KIT}</body>`);
});

describe("syncKit", () => {
  it("copies the kit, with a generated-file header, into every widget that loads it", () => {
    const result = syncKit(root);
    expect(result.map((r) => [r.file, r.status])).toEqual([
      ["apps/com.a/widgets/clock/public/vendor/widget-kit.js", "written"],
      ["apps/com.b/widgets/timer/public/vendor/widget-kit.js", "written"],
    ]);
    expect(read("apps/com.a/widgets/clock/public/vendor/widget-kit.js")).toBe(HEADER + SOURCE);
    expect(existsSync(path.join(root, "apps/com.a/widgets/plain/public/vendor"))).toBe(false);
  });

  it("leaves copies that are up to date alone", () => {
    syncKit(root);
    expect(syncKit(root).every((r) => r.status === "ok")).toBe(true);
  });

  it("in check mode reports stale and missing copies without writing", () => {
    syncKit(root);
    write("apps/com.a/widgets/clock/public/vendor/widget-kit.js", "edited by hand");
    write("apps/com.a/widgets/plain/public/index.html", `<body>${USES_KIT}</body>`);
    const result = syncKit(root, { check: true });
    expect(result.filter((r) => r.status !== "ok").map((r) => [r.file, r.status])).toEqual([
      ["apps/com.a/widgets/clock/public/vendor/widget-kit.js", "stale"],
      ["apps/com.a/widgets/plain/public/vendor/widget-kit.js", "missing"],
    ]);
    expect(read("apps/com.a/widgets/clock/public/vendor/widget-kit.js")).toBe("edited by hand");
  });

  it("flags a copy in a widget that no longer loads it", () => {
    syncKit(root);
    write("apps/com.b/widgets/timer/public/index.html", "<body></body>");
    expect(syncKit(root, { check: true })).toContainEqual({
      file: "apps/com.b/widgets/timer/public/vendor/widget-kit.js",
      status: "unused",
    });
  });

  it("removes such an unused copy when not checking", () => {
    syncKit(root);
    write("apps/com.b/widgets/timer/public/index.html", "<body></body>");
    syncKit(root);
    expect(
      existsSync(path.join(root, "apps/com.b/widgets/timer/public/vendor/widget-kit.js")),
    ).toBe(false);
  });
});
