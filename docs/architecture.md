# Architecture

## Layout

```
WidgetBox/
├── apps/                      # deployables: each folder is one Homey app, or the sandbox
│   ├── com.nielsvanbrakel.widgetbox-clocks/
│   │   ├── .homeycompose/app.json   # source manifest (app.json is generated from it)
│   │   ├── app.js                   # Homey app process
│   │   ├── lib/                     # app-side modules, unit-tested
│   │   └── widgets/<id>/
│   │       ├── widget.compose.json  # settings, api routes
│   │       ├── api.js               # widget API on the Homey (optional)
│   │       └── public/              # what the dashboard webview loads
│   │           ├── index.html       # DOM wiring only
│   │           ├── *.js             # widget logic, unit-tested (D-009)
│   │           └── vendor/          # GENERATED copies of packages/widget-kit (D-014)
│   ├── com.nielsvanbrakel.widgetbox-{weather,layout,video,games}/
│   └── sandbox/                     # Vite app: every widget with a fake Homey
├── packages/
│   └── widget-kit/                  # shared widget helpers, source of the vendored copies
├── scripts/                         # repo tooling (kit sync, release, bundle checks), tested
├── tests/
│   ├── repo/                        # repo-wide checks: manifests, translations, security
│   ├── e2e/                         # Playwright specs against the sandbox
│   └── pages/                       # Playwright page objects
└── docs/                            # glossary, decisions, releasing, this file
```

## Dependency rules

- A Homey app never imports from `packages/`, another app or the repo root. It only contains
  vendored copies, so the folder can be packed and published on its own (D-003).
- `packages/*` never imports from `apps/`.
- The sandbox and the tests may import from `packages/*` and read app folders.

## How a widget runs

On a Homey, the dashboard loads `widgets/<id>/public/index.html` in a webview and injects a
`Homey` object: `Homey.ready()`, `Homey.getSettings()`, `Homey.on("settings.set")`,
`Homey.api()` for the widget's own routes in `api.js`, and `Homey.__()` for translations from
`locales/*.json`. `api.js` runs in the app process next to `app.js` and owns storage and outbound
requests (SECURITY.md).

The sandbox reproduces this: it reads every `widget.compose.json`, renders the settings form and
loads the widget page in an iframe with a fake `Homey` (`apps/sandbox/src/lib/MockHomey.js`).

## Quality gates

| Gate | Where | What it catches |
| --- | --- | --- |
| Biome, knip | `pnpm check:static`, pre-commit | lint, format (also inline widget scripts), dead code |
| Vitest | `pnpm test:coverage` | modules, widget pages in jsdom, repo-wide checks (`tests/repo`) |
| Homey CLI | `pnpm validate` | manifest errors; CI also fails when `app.json` drifts from compose |
| Bundle check | `pnpm test:bundle` | dev files in a build, size over budget |
| Kit drift | `pnpm kit:check` | edited or stale vendored copies |
| Playwright | `pnpm test:e2e` | widgets in the sandbox, light and dark, accessibility |
| Workflow lint | CI | actionlint, zizmor |
