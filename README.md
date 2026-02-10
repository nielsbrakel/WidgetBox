# WidgetBox

**Premium dashboard widgets for Homey Pro.**

WidgetBox is a collection of beautifully crafted, highly customizable widgets that extend the Homey dashboard beyond its built-in capabilities. Every widget is designed to feel native to Homey — respecting its design language, light/dark mode, and spacing conventions — while adding functionality that the default dashboard doesn't offer.

Whether you want a stylish clock face, a live precipitation forecast, an interactive weather map, or handy utilities like timers and stopwatches, WidgetBox has you covered.

## Apps

WidgetBox is organized as a monorepo with separate Homey apps, each focused on a specific category of widgets:

| App | Widgets | Description |
|-----|---------|-------------|
| **WidgetBox Clocks** | Analog Clock, Digital Clock, Flip Clock, Binary Clock, Word Clock Grid, Word Clock Sentence, Date | Seven distinct clock and date styles with size, color, alignment, and format options |
| **WidgetBox Buienradar** | Five-Day Radar, Location Zoom Map, Precipitation Forecast | Dutch precipitation data from Buienradar with charts, animated maps, and customizable locations |
| **WidgetBox Windy** | Windy | Interactive Windy.com weather map with overlays for wind, temperature, rain, clouds, and pressure |
| **WidgetBox Utilities** | Stopwatch, Timer | Dashboard timing tools with multi-instance support |
| **WidgetBox Layout** | Spacer | Dashboard layout control and spacing tools |
| **WidgetBox YouTube** | YouTube | Embed YouTube videos, livestreams, and playlists directly on your dashboard |

## Monorepo Structure

```
WidgetBox/
├── apps/
│   ├── com.nielsvanbrakel.widgetbox-clocks/
│   ├── com.nielsvanbrakel.widgetbox-buienradar/
│   ├── com.nielsvanbrakel.widgetbox-windy/
│   ├── com.nielsvanbrakel.widgetbox-utilities/
│   ├── com.nielsvanbrakel.widgetbox-youtube/
│   └── com.nielsvanbrakel.widgetbox-layout/
├── packages/                # Shared packages (if any)
├── turbo.json               # Turborepo task definitions
├── pnpm-workspace.yaml      # pnpm workspace configuration
└── biome.json               # Code formatting & linting
```

Each app is a standalone Homey app that can be developed, validated, and published independently. The monorepo uses [Turborepo](https://turborepo.dev/) with [pnpm](https://pnpm.io/) workspaces.

## Development

### Prerequisites

- **Node.js** v18+
- **pnpm** (`npm install -g pnpm`)
- **Homey CLI** (`pnpm add -g homey`)

### Running an app

```bash
# Navigate to the app directory and run in dev mode
cd apps/com.nielsvanbrakel.widgetbox-clocks
homey app run
```

> **Note:** Only one app can run in dev mode at a time (port 9229 conflict). Use `homey app install` to deploy multiple apps simultaneously.

### Publishing

```bash
# Validate before publishing
homey app validate --level publish

# Publish to the Homey App Store
homey app publish
```

## Philosophy

WidgetBox widgets are built on three principles:

1. **Native feel** — Every widget uses Homey's design tokens (colors, fonts, spacing) and respects light/dark mode automatically. Widgets should look and feel like they belong on the Homey dashboard.

2. **Customizable, not complicated** — Widgets offer meaningful settings (size, color, alignment, format) without overwhelming the user. Sensible defaults mean widgets look great out of the box.

3. **Quality over quantity** — Each widget is polished and purposeful. No filler widgets — every addition should solve a real dashboard need.
