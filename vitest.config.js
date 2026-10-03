import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "apps/*/widgets/**/*.test.js",
      "apps/*/lib/**/*.test.js",
      "packages/*/**/*.test.js",
      "scripts/**/*.test.js",
      "tests/repo/**/*.test.js",
    ],
    exclude: ["**/node_modules/**", "**/.homeybuild/**"],
    coverage: {
      provider: "v8",
      // Coverage counts testable modules only: code inside widget HTML runs in jsdom and is not
      // attributed to the .html file, so widget logic belongs in public/*.js modules.
      include: [
        "apps/*/lib/**/*.js",
        "apps/*/widgets/*/public/*.js",
        "packages/*/src/**/*.js",
        "scripts/**/*.mjs",
      ],
      exclude: [
        "**/*.test.js",
        "**/aquarium/**",
        "scripts/check-bundles.mjs",
        "scripts/install-hooks.mjs",
      ],
      reporter: ["text-summary", "html"],
      thresholds: { lines: 95, statements: 90, functions: 95, branches: 85 },
    },
  },
});
