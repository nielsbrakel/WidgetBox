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

| App | ID | Widgets |
|-----|----|---------|
| Clocks | `com.nielsvanbrakel.widgetbox-clocks` | analog-clock, digital-clock, binary-clock, flip-clock, date, word-clock-grid, word-clock-sentence |
| Buienradar | `com.nielsvanbrakel.widgetbox-buienradar` | buienradar, buienradar-map, buientabel |
| Windy | `com.nielsvanbrakel.widgetbox-windy` | windy |
| Utilities | `com.nielsvanbrakel.widgetbox-utilities` | spacer, stopwatch, timer |
| YouTube | `com.nielsvanbrakel.widgetbox-youtube` | youtube |

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
    { "id": "xsmall", "label": { "en": "Extra Small", "nl": "Extra Klein" } },
    { "id": "small", "label": { "en": "Small", "nl": "Klein" } },
    { "id": "medium", "label": { "en": "Medium", "nl": "Gemiddeld" } },
    { "id": "large", "label": { "en": "Large", "nl": "Groot" } },
    { "id": "xlarge", "label": { "en": "Extra Large", "nl": "Extra Groot" } }
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

Map `"default"` to `var(--homey-text-color)` and named colors to `var(--homey-color-{name}-500)`.

### Horizontal Alignment

```json
{
  "id": "horizontalAlignment",
  "type": "dropdown",
  "label": { "en": "Horizontal Alignment", "nl": "Horizontale Uitlijning" },
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
| Utility widgets (spacer, stopwatch, timer) | `true` | Blend with dashboard |
| Embed widgets (buienradar, windy, youtube) | not set | Iframe handles its own background |

---

## Color Mapping Pattern

Map color setting IDs to CSS variables:

```javascript
function getColor(colorId) {
  if (colorId === 'default') return 'var(--homey-text-color)';
  if (colorId === 'white') return '#fff';
  if (colorId === 'black') return '#000';
  return `var(--homey-color-${colorId}-500)`;
}
```

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
