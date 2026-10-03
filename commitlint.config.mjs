// Conventional Commits with the app (or area) as scope: `fix(clocks): …`, `ci: …`.
// An unknown scope is a warning, not an error, so a new area never blocks a commit.

const SCOPES = [
  // apps
  "clocks",
  "weather",
  "layout",
  "video",
  "games",
  "aquarium",
  // shared areas
  "sandbox",
  "kit",
  "e2e",
  "store",
  "brand",
  "repo",
  "ci",
  "deps",
  "release",
];

/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "test",
        "refactor",
        "perf",
        "chore",
        "docs",
        "ci",
        "build",
        "style",
        "revert",
      ],
    ],
    "scope-enum": [1, "always", SCOPES],
    // Dependabot writes "Bump …", and long URLs appear in bodies.
    "subject-case": [0],
    "header-max-length": [2, "always", 100],
    "body-max-line-length": [1, "always", 100],
    "footer-max-line-length": [1, "always", 100],
  },
};
