# WidgetBox: notes for AI assistants

Homey Pro dashboard widgets, grouped into five self-contained Homey apps under `apps/`, plus a
browser sandbox (`apps/sandbox`) that previews every widget with a fake Homey API. Read
[docs/CONTEXT.md](docs/CONTEXT.md) (the words we use), [docs/architecture.md](docs/architecture.md)
(where code lives) and [docs/decisions.md](docs/decisions.md) (D-xxx) before changing code. The
skills in `.agents/skills/` (homey, widgetbox, widget-settings-conventions) hold the widget patterns.

## Ground rules

- **Self-contained apps (D-003).** An app folder never imports from outside itself and has no
  runtime `dependencies`. Shared widget helpers live in `packages/widget-kit` and are copied into
  each widget's `public/vendor/` by `pnpm kit:sync`; never edit a vendored copy.
- **Test-first.** New logic starts with a failing Vitest test. Logic lives in modules that tests
  can load: `lib/` on the Homey side and `widgets/<id>/public/*.js` next to a widget (D-009). Inline
  `<script>` in `index.html` only wires the DOM.
- **Ids are frozen once published (D-008).** App, widget and setting ids of a released app never
  change; add a new id and migrate instead.
- **Untrusted input.** Settings and remote data go into the DOM with `textContent` or through an
  allow-list map, never `innerHTML`. Outbound hosts are listed in `tests/repo/security.test.js`.
  `api.js` handlers validate every field they receive (SECURITY.md).
- **Homey look.** Colors, fonts and spacing come from `var(--homey-*)`; dark mode via the
  `homey-dark-mode` body class, never `prefers-color-scheme`. Respect `prefers-reduced-motion`.
- **Two languages.** Every user-visible text exists in `en` and `nl`, in sentence case (D-010).
  No third-party brand names in app or widget names (D-002).
- **Versions come from changesets (D-012).** Don't bump versions or edit `.homeychangelog.json`
  by hand; add a changeset with an `en:` and an `nl:` line.
- Lint and format with **Biome**. Suppress a rule only with `// biome-ignore lint/<group>/<rule>: <reason>`.
- The aquarium widget is being rebuilt separately; leave `widgets/aquarium` alone.

## Commands

`pnpm check` (Biome, knip, unit tests with coverage, Homey validation) · `pnpm test` ·
`pnpm test:e2e` (set `PW_CHROMIUM_PATH` to use a preinstalled Chromium) · `pnpm test:bundle` ·
`pnpm validate` · `pnpm sandbox` · `pnpm kit:sync` · `pnpm changeset` · `pnpm lint:fix`

Commit messages follow Conventional Commits with the app as scope (`fix(clocks): …`); the
commit-msg hook checks them. Pull requests target `dev`.
