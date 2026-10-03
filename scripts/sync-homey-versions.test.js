import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { main, releaseNotes, syncApp } from "./sync-homey-versions.mjs";

const CHANGELOG = `# com.nielsvanbrakel.widgetbox-clocks

## 0.2.0

### Minor Changes

- 1a2b3c4: en: The timer beeps when it ends.
  nl: De timer piept als hij afloopt.

### Patch Changes

- 5d6e7f8: en: Analog clock redraws after waking.
  nl: Analoge klok tekent opnieuw na het ontwaken.

## 0.1.1

### Patch Changes

- 9a8b7c6: en: Older fix.
  nl: Oudere fix.
`;

describe("releaseNotes", () => {
  it("joins the en and nl lines of every change in the version's section", () => {
    expect(releaseNotes(CHANGELOG, "0.2.0")).toEqual({
      en: "The timer beeps when it ends. Analog clock redraws after waking.",
      nl: "De timer piept als hij afloopt. Analoge klok tekent opnieuw na het ontwaken.",
    });
  });

  it("reads only the requested version", () => {
    expect(releaseNotes(CHANGELOG, "0.1.1")).toEqual({ en: "Older fix.", nl: "Oudere fix." });
  });

  it("fails when the version has no section", () => {
    expect(() => releaseNotes(CHANGELOG, "9.9.9")).toThrow(/no section for 9\.9\.9/);
  });

  it("fails when a change has no Dutch line", () => {
    const missingNl = "## 1.0.0\n\n### Patch Changes\n\n- abc: en: Only English.\n";
    expect(() => releaseNotes(missingNl, "1.0.0")).toThrow(/nl/);
  });

  it("fails when a change has no en:/nl: lines at all", () => {
    const plain = "## 1.0.0\n\n### Patch Changes\n\n- abc: Something changed.\n";
    expect(() => releaseNotes(plain, "1.0.0")).toThrow(/en: and nl:/);
  });
});

describe("syncApp", () => {
  let dir;
  const write = (file, value) => {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(
      path.join(dir, file),
      typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`,
    );
  };
  const read = (file) => JSON.parse(readFileSync(path.join(dir, file), "utf8"));

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "sync-homey-"));
    write("package.json", { name: "com.example.app", version: "0.2.0" });
    write(".homeycompose/app.json", { id: "com.example.app", version: "0.1.0", sdk: 3 });
    write("app.json", { _comment: "generated", id: "com.example.app", version: "0.1.0" });
    write(".homeychangelog.json", { "0.1.0": { en: "First release.", nl: "Eerste versie." } });
    write("CHANGELOG.md", CHANGELOG);
  });

  it("copies the package.json version into the Homey manifests", () => {
    expect(syncApp(dir)).toEqual({ id: "com.example.app", version: "0.2.0", changed: true });
    expect(read(".homeycompose/app.json")).toEqual({
      id: "com.example.app",
      version: "0.2.0",
      sdk: 3,
    });
    expect(read("app.json").version).toBe("0.2.0");
  });

  it("adds the release notes to .homeychangelog.json and keeps older entries", () => {
    syncApp(dir);
    expect(read(".homeychangelog.json")).toEqual({
      "0.1.0": { en: "First release.", nl: "Eerste versie." },
      "0.2.0": {
        en: "The timer beeps when it ends. Analog clock redraws after waking.",
        nl: "De timer piept als hij afloopt. Analoge klok tekent opnieuw na het ontwaken.",
      },
    });
  });

  it("does nothing when the versions already match", () => {
    write("package.json", { name: "com.example.app", version: "0.1.0" });
    expect(syncApp(dir)).toEqual({ id: "com.example.app", version: "0.1.0", changed: false });
    expect(read(".homeychangelog.json")).toEqual({
      "0.1.0": { en: "First release.", nl: "Eerste versie." },
    });
  });

  it("writes nothing when the release notes are incomplete", () => {
    write("CHANGELOG.md", "## 0.2.0\n\n- abc: en: Only English.\n");
    expect(() => syncApp(dir)).toThrow(/nl/);
    expect(read(".homeycompose/app.json").version).toBe("0.1.0");
  });

  it("caps store text at 400 characters", () => {
    const long = "x".repeat(250);
    write(
      "CHANGELOG.md",
      `## 0.2.0\n\n- a: en: ${long}\n  nl: ${long}\n- b: en: ${long}\n  nl: kort\n`,
    );
    expect(() => syncApp(dir)).toThrow(/400/);
  });
});

describe("sync-homey-versions main", () => {
  it("finds every app in this repository already in sync", () => {
    expect(main()).toEqual([]);
  });
});
