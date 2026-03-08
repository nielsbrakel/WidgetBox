---
name: widget-settings-conventions
description: Canonical conventions for shared widget settings across WidgetBox apps (Homey Pro). Covers standardized setting IDs, labels, dropdown options, and translations for commonly reused settings like size, font weight, horizontal alignment, and color. Use this when creating or modifying widget settings to ensure consistency across apps.
---

# Widget Settings Conventions

Shared settings used across multiple WidgetBox apps must follow canonical naming conventions. The **clocks app** (`widgetbox-clocks`) is the reference implementation. Any new widget that uses the same conceptual setting must match these conventions exactly.

## When to Use

- Creating a new widget that has size, alignment, font weight, or color settings
- Modifying existing widget settings (IDs, labels, options)
- Reviewing widget settings for consistency across apps
- Adding a new shared setting type to the canonical list
- Setting up the CSS for a new widget

## Global CSS Conventions

### Font Family

All widgets **must** use the Homey CSS variable for font-family. Homey injects `--homey-font-family` at runtime which resolves to **Nunito** with system font fallbacks.

```css
body {
  font-family: var(--homey-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
}
```

**Never** hardcode a font stack without the CSS variable — that will not match the native Homey UI.

### Available Homey CSS Variables

| Variable | Value |
|---|---|
| `--homey-font-family` | `'Nunito', -apple-system, ...` |
| `--homey-font-size-xxlarge` | 32px |
| `--homey-font-size-xlarge` | 24px |
| `--homey-font-size-large` | 20px |
| `--homey-font-size-default` | 17px |
| `--homey-font-size-small` | 14px |
| `--homey-font-weight-bold` | 700 |
| `--homey-font-weight-medium` | 500 |
| `--homey-font-weight-regular` | 400 |
| `--homey-text-color` | Text color (adapts to theme) |

## Canonical Shared Settings

### Size

5-tier size system. Default value depends on the widget.

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

### Font Weight

Setting ID is `fontWeight` (NOT `weight`). Label is "Font Weight" / "Letterdikte".

```json
{
  "id": "fontWeight",
  "type": "dropdown",
  "label": { "en": "Font Weight", "nl": "Letterdikte" },
  "value": "normal",
  "values": [
    { "id": "thin", "label": { "en": "Thin", "nl": "Dun" } },
    { "id": "normal", "label": { "en": "Normal", "nl": "Normaal" } },
    { "id": "bold", "label": { "en": "Bold", "nl": "Vetgedrukt" } }
  ]
}
```

CSS mapping in widget HTML:
```js
const WEIGHT_MAP = { thin: '300', normal: 'normal', bold: 'bold' };
```

### Horizontal Alignment

Setting ID is `horizontalAlignment` (NOT `align`). Label is "Horizontal Alignment" / "Horizontale Uitlijning".

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

### Color

6-option color dropdown. Uses hex values mapped in the widget HTML.

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

CSS mapping in widget HTML:
```js
const COLOR_MAP = {
  default: '',  // Uses --homey-text-color CSS variable
  blue: '#3B82F6',
  green: '#22C55E',
  orange: '#F97316',
  red: '#EF4444',
  purple: '#A855F7',
};
```

## Files That Must Stay in Sync

When a widget uses shared settings, these 3 files must all have identical setting definitions:

1. **`widgets/<name>/widget.compose.json`** — Source of truth for the widget
2. **`app.json`** — Generated/maintained app manifest (must match compose)
3. **`apps/sandbox/src/registry.json`** — Sandbox testing registry (must match compose)

## Widgets Using These Conventions

| Widget | App | size | fontWeight | horizontalAlignment | color |
|--------|-----|------|------------|---------------------|-------|
| digital-clock | widgetbox-clocks | ✅ | ✅ | ✅ | ❌ |
| analog-clock | widgetbox-clocks | ✅ | ❌ | ❌ | ❌ |
| flip-clock | widgetbox-clocks | ✅ | ❌ | ✅ | ❌ |
| binary-clock | widgetbox-clocks | ✅ | ❌ | ❌ | ❌ |
| word-clock-grid | widgetbox-clocks | ✅ | ❌ | ❌ | ❌ |
| word-clock-sentence | widgetbox-clocks | ✅ | ✅ | ✅ | ❌ |
| header | widgetbox-layout | ✅ | ✅ | ✅ | ✅ |
| separator | widgetbox-layout | ❌ | ❌ | ❌ | ✅ |
