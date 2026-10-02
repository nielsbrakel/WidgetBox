---
name: widgetbox
description: |
  WidgetBox-specific patterns and standards for building Homey dashboard widgets.
  Covers settings conventions, height strategies, init patterns, shared CSS,
  and code structure used across all WidgetBox apps.

  Use when: creating new widgets, modifying existing widgets, adding settings,
  handling height/sizing, styling with shared CSS, or standardizing code patterns.
---

# WidgetBox Widget Development Skill

Standards and patterns for all WidgetBox Homey dashboard widgets. This skill extends the `homey` skill with project-specific conventions.

> **Prerequisites**: Read the `homey` skill first for general Homey widget development.

## Apps Overview

Widgets are grouped into five apps by theme. Grouping keeps the number of installed apps (and their storage on a Homey) low, while each app stays focused on one concept (App Store guideline 2.1.3: no catch-all apps). Do not merge unrelated themes into one app, and keep third-party embeds out of apps that do not need them.

| App (en / nl) | ID | Widgets | Category | Brand color |
|---------------|----|---------|----------|-------------|
| WidgetBox Clocks & Timers / Klokken & Timers | `com.nielsvanbrakel.widgetbox-clocks` | analog-clock, binary-clock, digital-clock, flip-clock, word-clock-grid, word-clock-sentence, stopwatch, timer | tools | `#5E35B1` |
| WidgetBox Weather / Weer | `com.nielsvanbrakel.widgetbox-weather` | rain-graph, rain-radar, radar-5day, forecast, station (Buienradar data, NL/BE), weather-map (Windy embed) | internet | `#0277BD` |
| WidgetBox Layout / Lay-out | `com.nielsvanbrakel.widgetbox-layout` | header, separator, spacer | tools | `#546E7A` |
| WidgetBox Video | `com.nielsvanbrakel.widgetbox-video` | youtube (video player) | video | `#D84315` |
| WidgetBox Games / Spellen | `com.nielsvanbrakel.widgetbox-games` | aquarium | tools | `#00796B` |

Naming rules: never put a third-party brand (YouTube, Buienradar, Windy) in an app or widget name; "for YouTube videos" or "data from Buienradar" in text is fine. App names stay at four words or fewer and never contain "Homey" or "Athom".

---

## Publishing & Versioning

### Versioning

Every app has its **own, independent version**. Bump only the app you are releasing; the version lives in `package.json`, `app.json` and `.homeycompose/app.json` of that app and must match across those three files. Use semver: patch for fixes, minor for new widgets or settings, major for breaking setting changes.

### Workflow

Publish one app at a time from its folder:

```bash
cd apps/com.nielsvanbrakel.widgetbox-<app>
homey app validate --level publish
homey app publish
```

- The CLI asks `Do you want to update your app's version number?`. Answer **Yes** and pick patch/minor/major to let it bump all three files, or **No** if you already set the version yourself.
- It then asks "What's new?" and writes the answer to `.homeychangelog.json`. Give both `en` and `nl` text (edit the file afterwards if the prompt only stored English).
- `turbo run homey:publish --concurrency 1` still exists to step through every app interactively, but releasing per app is the normal flow.
- After publishing, submit the build for certification in the Homey Developer Tools and explain in the submission note why the app is separate from similar apps (for Weather: what it adds over the official Buienradar app).

### Asset Standards

`homey app validate --level publish` requires these per app:

- `assets/icon.svg`: one icon per app, line style (strokes, `fill="none"`, no background), 960x960 viewBox using the full canvas, `stroke-width="40"` with round caps and joins so all WidgetBox icons read as one family.
- `assets/images/small.jpg` (250x175), `large.jpg` (500x350), `xlarge.jpg` (1000x700): the app's real widgets on a realistic dashboard, no logos, no generic AI art. Export as JPG (quality about 82) to keep the app small on the Homey.
- `README.txt` plus `README.nl.txt` (the description is translated, so the README must be too), and `name`, `description` and `tags` in `en` and `nl`.
- `brandColor`: distinct per app, at least 3:1 contrast against white, not very bright.
- Widget previews (`preview-light.png`, `preview-dark.png`): 1024x1024, transparent, simple shapes and no text, made with the Athom Figma widget preview template.

The store images are rendered from the sandbox: capture each widget with Playwright, place the captures as cards on a soft dashboard background in a small HTML page, screenshot it at the three sizes and convert to JPG.

---

## Standard Settings

### Size Setting

Most widgets support a `size` dropdown with these standard values:

```json
{
  "id": "size",
  "type": "dropdown",
  "label": { "en": "Size", "nl": "Grootte" },
  "value": "medium",
  "values": [
    { "id": "xsmall", "label": { "en": "Extra Small", "nl": "Extra klein" } },
    { "id": "small", "label": { "en": "Small", "nl": "Klein" } },
    { "id": "medium", "label": { "en": "Medium", "nl": "Gemiddeld" } },
    { "id": "large", "label": { "en": "Large", "nl": "Groot" } },
    { "id": "xlarge", "label": { "en": "Extra Large", "nl": "Extra groot" } }
  ]
}
```

**Used by:** All clock widgets, date widget.

### Color Setting

Color dropdowns use Homey's built-in color palette:

```json
{
  "id": "color",
  "type": "dropdown",
  "label": { "en": "Color", "nl": "Kleur" },
  "value": "default",
  "values": [
    { "id": "default", "label": { "en": "Default", "nl": "Standaard" } },
    { "id": "blue", "label": { "en": "Blue", "nl": "Blauw" } },
    { "id": "green", "label": { "en": "Green", "nl": "Groen" } },
    { "id": "orange", "label": { "en": "Orange", "nl": "Oranje" } },
    { "id": "red", "label": { "en": "Red", "nl": "Rood" } },
    { "id": "purple", "label": { "en": "Purple", "nl": "Paars" } }
  ]
}
```

Map `"default"` to `var(--homey-text-color)` and named colors to `var(--homey-color-{name}-500, <hex fallback>)`. See "Color Mapping Pattern" below for the exact map.

### Horizontal Alignment

```json
{
  "id": "horizontalAlignment",
  "type": "dropdown",
  "label": { "en": "Horizontal Alignment", "nl": "Horizontale uitlijning" },
  "value": "center",
  "values": [
    { "id": "left", "label": { "en": "Left", "nl": "Links" } },
    { "id": "center", "label": { "en": "Center", "nl": "Midden" } },
    { "id": "right", "label": { "en": "Right", "nl": "Rechts" } }
  ]
}
```

### Clock Format

```json
{
  "id": "clockFormat",
  "type": "dropdown",
  "label": { "en": "Time Format", "nl": "Tijdformaat" },
  "value": "24",
  "values": [
    { "id": "24", "label": { "en": "24-hour", "nl": "24-uur" } },
    { "id": "12", "label": { "en": "12-hour", "nl": "12-uur" } }
  ]
}
```

### Aspect Ratio (for iframe/embed widgets)

```json
{
  "id": "aspectRatio",
  "type": "dropdown",
  "label": { "en": "Aspect Ratio", "nl": "Beeldverhouding" },
  "value": "16:9",
  "values": [
    { "id": "1:1", "label": { "en": "Square (1:1)" } },
    { "id": "4:3", "label": { "en": "4:3" } },
    { "id": "16:9", "label": { "en": "16:9 (Default)" } },
    { "id": "9:16", "label": { "en": "Portrait (9:16)" } },
    { "id": "21:9", "label": { "en": "Ultrawide (21:9)" } },
    { "id": "3:1", "label": { "en": "Panoramic (3:1)" } }
  ]
}
```

### Setting Hints

Use the `hint` property to add explanation text to settings that may not be immediately clear to the user. Always provide bilingual hints (en + nl). Use hints for:
- Text/number inputs where the expected format isn't obvious (e.g. coordinates, IDs)
- Settings whose effect is non-trivial or could be confusing
- Settings that interact with other settings

```json
{
  "id": "lat",
  "type": "text",
  "label": { "en": "Latitude", "nl": "Breedtegraad" },
  "hint": {
    "en": "Enter the latitude of your location (e.g. 52.1326)",
    "nl": "Voer de breedtegraad van je locatie in (bijv. 52.1326)"
  },
  "value": "52.1326"
}
```

> **Rule**: Always add a `hint` to `text` and `number` settings. For `dropdown` and `checkbox` settings, only add a hint if the label alone doesn't sufficiently explain what the setting does.

---

## Height Strategies

Widgets use one of three height patterns:

### 1. Content-Based Height (Clock Widgets)

Calculates height from DOM content. Used by all clock and date widgets.

```javascript
function calculateTotalHeight() {
  const widget = document.getElementById('widget');
  return widget ? widget.offsetHeight : 128;
}

Homey.ready({ height: calculateTotalHeight() });
new ResizeObserver(() => Homey.setHeight?.(calculateTotalHeight())).observe(document.body);
```

### 2. Aspect Ratio Height (Embed Widgets)

Calculates height as a percentage for iframe-based widgets. Used by youtube, windy, buientabel.

```javascript
function getAspectRatioPercentage(aspectRatio) {
  const ratios = {
    '1:1': '100%',
    '4:3': '75%',
    '16:9': '56.25%',
    '9:16': '177.78%',
    '21:9': '42.86%',
    '3:1': '33.33%'
  };
  return ratios[aspectRatio] || '56.25%';
}

Homey.ready({ height: getAspectRatioPercentage(settings.aspectRatio || '16:9') });
```

### 3. Fixed/Calculated Height (Utility Widgets)

Calculates from component count. Used by stopwatch, timer.

```javascript
const calcHeight = () => {
  const itemCount = items.length;
  const itemHeight = 60;
  const headerHeight = 40;
  return headerHeight + (itemCount * itemHeight) + padding;
};

Homey.ready({ height: calcHeight() });
```

---

## Init Pattern

All widgets follow this initialization flow:

```javascript
let currentSettings = {};

function onHomeyReady(Homey) {
  currentSettings = Homey.getSettings() || {};
  renderWidget();

  Homey.on('settings.set', (key, value) => {
    currentSettings[key] = value;
    renderWidget();
    Homey.setHeight?.(calculateTotalHeight());
  });

  // Start intervals (clocks: 1000ms, data: configurable)
  Homey.ready({ height: calculateTotalHeight() });
}
```

> **Variant**: Stopwatch/timer use `window.onHomeyReady = async (homey) => {}`, others use `function onHomeyReady(Homey) {}`. Both work.

---

## Shared CSS

Clock and utility widgets import shared styles:

```html
<link rel="stylesheet" href="../../_shared/shared-styles.css">
```

Located at `widgets/_shared/shared-styles.css`, providing:

| Class | Purpose |
|-------|---------|
| `.widget-container` | Flex column, centered, standard padding |
| `.widget-container--compact` | Reduced padding variant |
| `.widget-row` / `.widget-column` | Flex row/column layouts |
| `.widget-center` | Centered flex container |
| `.widget-button` | Standard button with hover/active states |
| `.widget-button--primary` | Blue primary button |
| `.widget-button--small` | Compact button |
| `.widget-text-display` | Large bold text (numbers) |
| `.widget-text-title` | Medium bold text |
| `.widget-text-body` | Default body text |
| `.widget-text-secondary` | Secondary/muted text |
| `.widget-text-small` | Small caption text |
| `.widget-text-mono` | Monospace font |
| `.widget-loading` | Loading spinner |
| `.widget-error` | Error message |
| `.widget-empty` | Empty state |
| `.widget-card` | Card background with shadow |
| `.widget-fade-in` | Fade-in animation |
| `.widget-pulse` | Pulse animation |
| `.widget-sr-only` | Screen reader only |

Always use `var(--homey-*)` variables for colors, fonts, and spacing.

---

## Widget Transparency

| Widget Type | `transparent` | Rationale |
|------------|--------------|-----------|
| Clock widgets | `false` | Card background for readability |
| Stopwatch, Timer | `false` | Card background for readability |
| Spacer | `true` | Invisible spacing element, blends with dashboard |
| Embed widgets (buienradar, windy, youtube) | not set | Iframe handles its own background |

---

## Color Mapping Pattern

WidgetBox has one color system: Homey palette variables with a hex fallback. The same map is in `.agents/skills/widget-settings-conventions/SKILL.md`; keep the two in sync.

```javascript
const COLOR_MAP = {
  default: "", // inherit var(--homey-text-color) from the stylesheet
  blue: "var(--homey-color-blue-500, #0099ff)",
  green: "var(--homey-color-green-500, #26c281)",
  orange: "var(--homey-color-orange-500, #ff9500)",
  red: "var(--homey-color-red-500, #ff3b30)",
  purple: "var(--homey-color-purple-500, #a855f7)",
};
```

- Homey has no purple palette variable, so purple always uses its fallback.
- For lines and borders, `default` is a mono step such as `var(--homey-color-mono-300, #b3b3b3)`, which flips with light and dark mode.
- Never hardcode Tailwind or Material hex values, and never use `prefers-color-scheme`; Homey sets the `homey-dark-mode` class and updates the variables.

---

## Translations

All runtime text in widgets must use `Homey.__()` with keys defined in `locales/en.json` and `locales/nl.json`.

### Translation key structure

Keys live under `widgets.<widgetId>.<key>`:

```json
{
  "widgets": {
    "buientabel": {
      "loading": "Loading...",
      "noRain": "No rain expected",
      "error": "Something went wrong"
    },
    "stopwatch": {
      "addStopwatch": "Add Stopwatch",
      "lap": "Lap"
    }
  }
}
```

### Helper pattern

```javascript
const __ = (key) => Homey.__(`widgets.my-widget.${key}`) ?? key;
```

### Rules

- **Never hardcode user-facing text** — always use translation calls
- **Both `en.json` and `nl.json` are required** in every app's `locales/` directory
- Each locale file contains translations for one language only (filename = language)
- Widgets without runtime text still need empty widget entries in locale files

---

## Documentation Maintenance

### When to update

| Trigger | What to update |
|---------|----------------|
| New widget added | App's `README.txt`, monorepo `README.md` apps table, this skill's Apps Overview table |
| Widget removed | App's `README.txt`, monorepo `README.md` apps table, this skill's Apps Overview table |
| Major feature change to a widget | App's `README.txt` (update feature description) |
| New app added to monorepo | New `README.txt`, monorepo `README.md`, this skill's Apps Overview table |
| App removed from monorepo | Remove `README.txt`, update monorepo `README.md`, this skill's Apps Overview table |

### README.txt format rules

- **Plain text only** — no markdown, no URLs, no changelogs
- **No app name** in the text — it already appears above the README on the store page
- **Describe possibilities** — write a friendly story, not a technical spec
- Every `README.txt` starts with the **shared WidgetBox intro sentence** (see below)
- Every `README.txt` has a natural Dutch `README.nl.txt` next to it
- One or two paragraphs, no feature or settings lists

### Shared intro sentence

Every app's README opens with this short sentence, followed directly (same paragraph) by what the app is about:

```
WidgetBox is a small family of widgets made to feel at home on your Homey dashboard.
```

Dutch (`README.nl.txt`):

```
WidgetBox is een kleine familie widgets die zich thuis voelen op je Homey-dashboard.
```

Keep the whole README to two short paragraphs.

### Description one-liners

The `description` field in `.homeycompose/app.json` is a catchy tagline shown below the app name on the store. Rules:
- Be specific about what the app does (avoid generic "adds support for X")
- Keep it short — one sentence
- Always provide both `en` and `nl` translations

---

### Writing Guidelines

- **Tone**: Friendly, functional, and humble. Avoid salesy or hyperbolic words like "premium", "stunning", "ultimate", "perfectly".
- **Generic Counts**: Use terms like "multiple", "various", or "collection of" instead of specific numbers (e.g., "7 widgets", "6 styles"). This ensures descriptions remain accurate as features are added or removed.
- **Shared Intro**: Always use the standard intro sentence defined above.

---

## New Widget Checklist

When creating a new WidgetBox widget:

1. **Directory structure**: `widgets/<id>/widget.compose.json` + `public/index.html`
2. **Import shared CSS** if using standard components: `../../_shared/shared-styles.css`
3. **Use standard settings** from this document (size, color, alignment, etc.)
4. **Include bilingual labels** (en + nl) for all settings
5. **Add `hint`** to all `text` and `number` settings (bilingual)
6. **Add translations** to `locales/en.json` and `locales/nl.json` for all runtime text
7. **Choose height strategy**: content-based, aspect-ratio, or fixed
8. **Follow init pattern**: getSettings → render → listen for changes → ready
9. **Set `transparent`** based on widget type (see table above)
10. **Add `ResizeObserver`** if height depends on content
11. **Use Homey CSS variables** for all colors, fonts, spacing
12. **Add preview images**: `preview-dark.png` and `preview-light.png` (1024x1024)
13. **Update documentation**: update the app's `README.txt`, monorepo `README.md`, and this skill's Apps Overview table

---

## Sandbox Architecture

The sandbox app (`apps/sandbox/`) is a Vite/React application for previewing and testing widgets locally with e2e tests via Playwright.

### File Structure

```
apps/sandbox/
├── scripts/
│   └── generate-registry.js    # Scans widget.compose.json files, outputs src/registry.json
├── src/
│   ├── components/
│   │   ├── Icons.jsx            # SVG icon components
│   │   ├── Sidebar.jsx          # Widget list grouped by app
│   │   ├── Toolbar.jsx          # Theme toggle, width presets, reload
│   │   ├── WidgetPreview.jsx    # Iframe preview with Homey card framing
│   │   └── SettingsPanel.jsx    # Settings controls + debug scenarios
│   ├── lib/
│   │   ├── MockHomey.js         # Mock Homey API (settings, height, translations, events)
│   │   ├── homeyStyles.js       # Injects Homey CSS variables into iframe
│   │   ├── scenarios.js         # Debug scenario definitions per widget
│   │   └── mocks/
│   │       └── buienradarMocks.js  # Buienradar-specific mock data + real fetch
│   ├── App.jsx                  # Root component (state + composition only)
│   ├── index.css                # All styles (no inline styles in components)
│   ├── main.jsx                 # React entry point
│   └── registry.json            # Generated (gitignored), do NOT commit
├── index.html
├── package.json
└── vite.config.js
```

### Adding Widget-Specific Mocks

To add mock data for a new widget:

1. Create `src/lib/mocks/<widgetName>Mocks.js` with a handler function
2. Import and call from `MockHomey.api()` method
3. Add debug scenarios in `src/lib/scenarios.js`

### Code Quality Rules

- **No inline styles** in JSX — use CSS classes in `index.css`
- **No icon SVGs** in component files — add to `Icons.jsx`
- **No widget-specific logic** in `MockHomey.js` — delegate to `mocks/` modules
- `registry.json` is **generated** — never edit manually, never commit
- The sandbox uses **Biome** for linting (no ESLint)

---

## E2E Testing

All widgets are tested via Playwright e2e tests against the sandbox.

### Structure

```
tests/
├── e2e/           # Test specs per app/feature
│   ├── widgets.spec.ts          # Sandbox loading tests
│   ├── clocks.spec.ts
│   ├── utilities.spec.ts
│   ├── windy.spec.ts
│   ├── video.spec.ts
│   ├── buienradar.spec.ts
│   ├── layout.spec.ts
│   └── sandbox-translations.spec.ts
├── pages/         # Page Object Model
│   ├── SandboxPage.ts           # Base page (goto, selectWidget, settings helpers)
│   ├── ClocksPage.ts
│   ├── UtilitiesPage.ts
│   ├── WindyPage.ts
│   ├── VideoPage.ts
│   ├── BuienradarPage.ts
│   └── LayoutPage.ts
```

### Running Tests

```bash
# Run all tests
pnpm test:e2e

# Run specific test file
npx playwright test tests/e2e/clocks.spec.ts
```

### Writing Tests

1. **Extend `SandboxPage`** for widget-specific page objects
2. **Use getters** for element selectors (e.g. `get flipClock()`)
3. **Use `SandboxPage` helpers** for common interactions:
   - `selectWidget(name)` — clicks widget in sidebar
   - `setSettingCheckbox(label, checked)` — toggles checkbox setting
   - `setSettingSelect(label, option)` — selects dropdown option
   - `setSettingInput(label, value)` — fills text/number input
4. **Import only what you need** from `@playwright/test` (avoid unused imports)
