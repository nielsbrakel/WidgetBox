// Builds every Homey app with `homey app build` and checks what would be uploaded to the store:
// no development files, and each app within its size budget (scripts/bundle-budgets.json).
// Usage: node scripts/check-bundles.mjs [app-short-name ...]
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APPS = path.join(ROOT, "apps");
const BUDGETS = JSON.parse(readFileSync(path.join(ROOT, "scripts/bundle-budgets.json"), "utf8"));

// `homey app build` adds its own node_modules/homey stub (the SDK entry point); anything else in
// node_modules would be a runtime dependency, which apps must not have.
const FORBIDDEN = [
  /\.test\.js$/,
  /\.md$/,
  /(^|\/)(test|docs|sandbox)\//,
  /^node_modules\/(?!homey\/)/,
];

const walk = (dir, base = dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full, base) : [path.relative(base, full)];
  });

const only = process.argv.slice(2);
const apps = readdirSync(APPS)
  .filter((name) => name.startsWith("com."))
  .filter((name) => only.length === 0 || only.some((short) => name.endsWith(`-${short}`)));

let failed = false;
for (const app of apps) {
  const dir = path.join(APPS, app);
  execFileSync("pnpm", ["exec", "homey", "app", "build"], {
    cwd: dir,
    stdio: "ignore",
    env: { ...process.env, HOMEY_SKIP_STARTUP_NOTIFIERS: "1" },
  });
  const buildDir = path.join(dir, ".homeybuild");
  const files = walk(buildDir);
  const bytes = files.reduce((sum, file) => sum + statSync(path.join(buildDir, file)).size, 0);
  const kb = Math.round(bytes / 1024);
  const budget = BUDGETS.appKb[app] ?? BUDGETS.appKb.default;

  const problems = files
    .filter((file) => FORBIDDEN.some((pattern) => pattern.test(file)))
    .map((file) => `ships a development file: ${file}`);
  if (kb > budget) problems.push(`bundle is ${kb} KB, budget ${budget} KB`);

  console.log(`${problems.length ? "✗" : "✓"} ${app}: ${files.length} files, ${kb} KB`);
  for (const problem of problems) console.log(`    ${problem}`);
  failed ||= problems.length > 0;
}

process.exitCode = failed ? 1 : 0;
