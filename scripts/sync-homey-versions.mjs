// Runs after `changeset version` (pnpm release:version). Changesets bumps each app's
// package.json and writes CHANGELOG.md; the Homey CLI reads the version from
// .homeycompose/app.json and app.json and the store changelog from .homeychangelog.json.
// This copies the new version and its en/nl release notes into those files.
//
// A changeset summary for an app has one `en:` and one `nl:` line:
//
//   ---
//   "com.nielsvanbrakel.widgetbox-clocks": minor
//   ---
//
//   en: The timer beeps when it ends.
//   nl: De timer piept als hij afloopt.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LANGUAGES = ["en", "nl"];
// The Homey App Store shows at most this many characters of a changelog entry.
const MAX_STORE_TEXT = 400;

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const section = (changelog, version) => {
  const heading = new RegExp(`^## ${escapeRegExp(version)}\\s*$`, "m");
  const start = changelog.search(heading);
  if (start === -1) throw new Error(`CHANGELOG.md has no section for ${version}`);
  const rest = changelog.slice(start).split("\n").slice(1).join("\n");
  const next = rest.search(/^## /m);
  return next === -1 ? rest : rest.slice(0, next);
};

/** The en/nl store text for one version, built from the changes in its CHANGELOG.md section. */
export const releaseNotes = (changelog, version) => {
  const changes = section(changelog, version)
    .split(/^- /m)
    .slice(1)
    .map((change) => {
      const lines = Object.fromEntries(
        [...change.matchAll(/^(?:\s*\w+:)?\s*(en|nl):\s*(.+?)\s*$/gm)].map((m) => [m[1], m[2]]),
      );
      if (Object.keys(lines).length === 0) {
        throw new Error(`Change in ${version} needs en: and nl: lines: "${change.trim()}"`);
      }
      for (const lang of LANGUAGES) {
        if (!lines[lang]) throw new Error(`Change in ${version} has no ${lang}: line`);
      }
      return lines;
    });
  if (changes.length === 0) throw new Error(`CHANGELOG.md section ${version} lists no changes`);
  return Object.fromEntries(
    LANGUAGES.map((lang) => [lang, changes.map((change) => change[lang]).join(" ")]),
  );
};

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const writeJson = (file, value) => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

/** Brings one app's Homey files to its package.json version. Writes nothing on error. */
export const syncApp = (appDir) => {
  const { version } = readJson(path.join(appDir, "package.json"));
  const composeFile = path.join(appDir, ".homeycompose/app.json");
  const compose = readJson(composeFile);
  if (compose.version === version) return { id: compose.id, version, changed: false };

  const notes = releaseNotes(readFileSync(path.join(appDir, "CHANGELOG.md"), "utf8"), version);
  for (const lang of LANGUAGES) {
    if (notes[lang].length > MAX_STORE_TEXT) {
      throw new Error(
        `${compose.id} ${version}: the ${lang} release notes are ${notes[lang].length} characters; ` +
          `the store allows ${MAX_STORE_TEXT}. Shorten the changesets.`,
      );
    }
  }

  const manifestFile = path.join(appDir, "app.json");
  const changelogFile = path.join(appDir, ".homeychangelog.json");
  const manifest = readJson(manifestFile);
  const changelog = readJson(changelogFile);

  writeJson(composeFile, { ...compose, version });
  writeJson(manifestFile, { ...manifest, version });
  writeJson(changelogFile, { ...changelog, [version]: notes });
  return { id: compose.id, version, changed: true };
};

const APPS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../apps");

/** Syncs every app and returns the ones that changed. */
export const main = (appsDir = APPS_DIR) =>
  readdirSync(appsDir)
    .filter((entry) => entry.startsWith("com."))
    .map((name) => syncApp(path.join(appsDir, name)))
    .filter((result) => result.changed);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const result of main()) console.log(`${result.id}: ${result.version}`);
}
