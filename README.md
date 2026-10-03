# WidgetBox

**Dashboard widgets for Homey Pro.**

WidgetBox is a small family of widgets made to feel at home on the Homey dashboard. Every widget uses Homey's own colors, fonts and spacing, follows light and dark mode, and adds something the built-in dashboard does not offer.

## Apps

The widgets are grouped into five Homey apps by theme. Grouping keeps the number of installed apps (and the storage they take on a Homey) low, while each app stays focused on one concept as the App Store guidelines ask. Every app is released on its own, with its own version number.

| App | ID | Widgets |
|-----|----|---------|
| **WidgetBox Clocks & Timers** | `com.nielsvanbrakel.widgetbox-clocks` | Analog, digital, flip and binary clocks, two word clocks (grid and sentence), stopwatch, timer |
| **WidgetBox Weather** | `com.nielsvanbrakel.widgetbox-weather` | 2-hour rain graph, rain radar, 5-day radar, weather forecast and weather station (Buienradar data, Netherlands and Belgium), interactive weather map (Windy) |
| **WidgetBox Layout** | `com.nielsvanbrakel.widgetbox-layout` | Header, separator, spacer |
| **WidgetBox Video** | `com.nielsvanbrakel.widgetbox-video` | Video player for YouTube videos, livestreams and playlists |
| **WidgetBox Games** | `com.nielsvanbrakel.widgetbox-games` | Aquarium, a cozy idle game (being rebuilt, not released yet) |

## Monorepo structure

```
WidgetBox/
├── apps/
│   ├── com.nielsvanbrakel.widgetbox-clocks/
│   ├── com.nielsvanbrakel.widgetbox-weather/
│   ├── com.nielsvanbrakel.widgetbox-layout/
│   ├── com.nielsvanbrakel.widgetbox-video/
│   ├── com.nielsvanbrakel.widgetbox-games/
│   └── sandbox/             # Local preview of every widget with a mocked Homey API
├── packages/widget-kit/     # Shared widget helpers, copied into each widget (pnpm kit:sync)
├── scripts/                 # Release, kit sync and bundle checks
├── tests/                   # Repo-wide checks and Playwright end-to-end tests
├── docs/                    # Glossary, architecture, decisions, releasing
├── pnpm-workspace.yaml      # pnpm workspace configuration
└── biome.json               # Linting and formatting
```

Each app is a standalone Homey app that can be developed, validated and published on its own. The monorepo uses [pnpm](https://pnpm.io/) workspaces; root scripts run the per-app Homey CLI commands with `pnpm -r`.

## Development

### Prerequisites

- **Node.js** 26 (see `.nvmrc`)
- **pnpm** (version pinned in `package.json`, `corepack enable` picks it up)
- **Homey CLI** (installed as a dev dependency, run it with `pnpm exec homey`)

### Common commands

```bash
pnpm install       # also installs the git hooks
pnpm sandbox       # Preview all widgets in the browser
pnpm check         # Biome, knip, unit tests with coverage, Homey validation
pnpm test          # Unit tests (Vitest)
pnpm test:e2e      # End-to-end tests (Playwright)
pnpm validate      # homey app validate --level publish for every app
pnpm test:bundle   # Build every app and check what would ship
```

### Running an app on a Homey

```bash
cd apps/com.nielsvanbrakel.widgetbox-clocks
pnpm exec homey app run
```

> **Note:** Only one app can run in dev mode at a time. Use `homey app install` to put several apps on a Homey at once.

### Releasing

Apps are versioned and released independently and automatically: a pull request adds a changeset (`pnpm changeset`) with an English and a Dutch line, and after merge a release workflow versions, tags and uploads the app once the owner approves. See [docs/releasing.md](docs/releasing.md).

### Documentation

- [CONTRIBUTING.md](CONTRIBUTING.md): workflow and hard rules
- [docs/CONTEXT.md](docs/CONTEXT.md): the words we use
- [docs/architecture.md](docs/architecture.md): where code lives and the quality gates
- [docs/decisions.md](docs/decisions.md): why things are the way they are
- [SECURITY.md](SECURITY.md): reporting problems and the threat model

## Store assets

Each app has its own line icon (`assets/icon.svg`, 960×960, transparent), store images (`assets/images/{small,large,xlarge}.jpg`, 250×175 / 500×350 / 1000×700) showing the app's widgets on a dashboard, a `README.txt` with a Dutch `README.nl.txt`, and a brand color with enough contrast for a white icon.

## Philosophy

1. **Native feel.** Widgets use Homey's design tokens and respect light and dark mode, so they look like they belong on the dashboard.
2. **Customizable, not complicated.** Meaningful settings (size, color, alignment, format) with sensible defaults.
3. **Small and purposeful.** Every widget should solve a real dashboard need, and every app should stay light on a Homey's storage.

## License

[MIT](LICENSE) © 2026 Niels van Brakel
