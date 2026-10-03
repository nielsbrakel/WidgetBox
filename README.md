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
| **Pocket Aquarium** | `com.nielsvanbrakel.aquarium` | Aquarium, a cozy idle game (being rebuilt, not released yet) |

## Monorepo structure

```
WidgetBox/
├── apps/
│   ├── com.nielsvanbrakel.widgetbox-clocks/
│   ├── com.nielsvanbrakel.widgetbox-weather/
│   ├── com.nielsvanbrakel.widgetbox-layout/
│   ├── com.nielsvanbrakel.widgetbox-video/
│   ├── com.nielsvanbrakel.aquarium/
│   └── sandbox/             # Local preview of every widget with a mocked Homey API
├── tests/                   # Playwright end-to-end tests against the sandbox
├── turbo.json               # Turborepo task definitions
├── pnpm-workspace.yaml      # pnpm workspace configuration
└── biome.json               # Linting and formatting
```

Each app is a standalone Homey app that can be developed, validated and published on its own. The monorepo uses [Turborepo](https://turborepo.dev/) with [pnpm](https://pnpm.io/) workspaces.

## Development

### Prerequisites

- **Node.js** 26 (see `.nvmrc`)
- **pnpm** (version pinned in `package.json`, `corepack enable` picks it up)
- **Homey CLI** (installed as a dev dependency, run it with `pnpm exec homey`)

### Common commands

```bash
pnpm install
pnpm sandbox       # Preview all widgets in the browser
pnpm lint          # Biome
pnpm test          # Unit tests (Vitest)
pnpm test:e2e      # End-to-end tests (Playwright)
pnpm validate      # homey app validate --level publish for every app
```

### Running an app on a Homey

```bash
cd apps/com.nielsvanbrakel.widgetbox-clocks
homey app run
```

> **Note:** Only one app can run in dev mode at a time. Use `homey app install` to put several apps on a Homey at once.

### Publishing

Apps are versioned and published independently. Publish one app at a time from its own folder:

```bash
cd apps/com.nielsvanbrakel.widgetbox-weather
homey app validate --level publish
homey app publish
```

The CLI asks whether to bump the version and what is new, and updates `app.json`, `.homeycompose/app.json`, `package.json` and `.homeychangelog.json` for you.

## Store assets

Each app has its own line icon (`assets/icon.svg`, 960×960, transparent), store images (`assets/images/{small,large,xlarge}.jpg`, 250×175 / 500×350 / 1000×700) showing the app's widgets on a dashboard, a `README.txt` with a Dutch `README.nl.txt`, and a brand color with enough contrast for a white icon.

## Philosophy

1. **Native feel.** Widgets use Homey's design tokens and respect light and dark mode, so they look like they belong on the dashboard.
2. **Customizable, not complicated.** Meaningful settings (size, color, alignment, format) with sensible defaults.
3. **Small and purposeful.** Every widget should solve a real dashboard need, and every app should stay light on a Homey's storage.

## License

[MIT](LICENSE) © 2026 Niels van Brakel
