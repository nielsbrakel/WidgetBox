import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["apps/*/widgets/**/*.test.js", "apps/*/lib/**/*.test.js"],
    exclude: ["**/node_modules/**", "**/.homeybuild/**"],
  },
});
