// Decides which Homey apps the release workflow publishes (.github/workflows/release.yml).
// Prints `apps=<json>` for $GITHUB_OUTPUT. Inputs come from the environment:
//   PUBLISHED  changesets/action's published-packages output (after a version merge)
//   APP        the app chosen in a manual run (short name, e.g. "clocks")
//   HOLD       repository variable HOMEY_RELEASE_HOLD: short names never published automatically
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PREFIX = "com.nielsvanbrakel.widgetbox-";
const shortName = (id) => id.slice(PREFIX.length);

const toEntry = (app) => ({ id: app.id, short: shortName(app.id), version: app.version });

/** @returns {{ id: string, short: string, version: string }[]} */
export const planRelease = ({ apps, published = [], dispatchApp, hold = "" }) => {
  if (dispatchApp) {
    const app = apps.find((candidate) => shortName(candidate.id) === dispatchApp);
    if (!app) throw new Error(`Unknown app "${dispatchApp}"`);
    return [toEntry(app)];
  }
  const onHold = new Set(
    hold
      .split(",")
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean),
  );
  const tagged = new Set(published.map((pkg) => `${pkg.name}@${pkg.version}`));
  return apps
    .filter((app) => tagged.has(`${app.id}@${app.version}`))
    .filter((app) => !onHold.has(shortName(app.id)))
    .map(toEntry);
};

const APPS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../apps");

/** Reads the apps and the workflow's environment and returns the `apps=` output line. */
export const main = (env = process.env, appsDir = APPS_DIR) => {
  const apps = readdirSync(appsDir)
    .filter((name) => name.startsWith(PREFIX))
    .map((name) => JSON.parse(readFileSync(path.join(appsDir, name, "package.json"), "utf8")))
    .map((pkg) => ({ id: pkg.name, version: pkg.version }));
  const plan = planRelease({
    apps,
    published: JSON.parse(env.PUBLISHED || "[]"),
    dispatchApp: env.APP || undefined,
    hold: env.HOLD ?? "",
  });
  return `apps=${JSON.stringify(plan)}`;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(main());
