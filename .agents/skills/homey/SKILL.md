---
name: homey
description: |
  Homey widget development for dashboard apps. Triggers on: Homey CLI, widgets,
  widget settings, widget styling, widget debugging, homey app create, homey app run,
  homey app publish, dashboard widgets, Homey App SDK.

  Use when user: creates widgets, configures widget settings, styles widgets with Homey CSS,
  debugs widgets on Android/iOS, publishes to Homey App Store, or works with Homey apps.
---

# Homey Widget Development Skill

Build custom dashboard widgets for Homey smart home platform. Widgets are webviews (HTML/CSS/JS) displayed on user dashboards with access to the Homey API.

> **Compatibility**: Widgets require Homey Pro with SDK `>=12.3.0`. Not available on Homey Cloud.

## Prerequisites

1. **Node.js** v18 or higher
2. **Docker** (required for Homey Cloud and Homey Pro Early 2023)
3. **Homey CLI**: `pnpm add -g homey`

## Quick Decision Trees

### "I need to create a Homey app"

```
Create app?
├─ New app from scratch → homey app create
├─ Add widget to existing app → homey app widget create
├─ Run app on Homey → homey app run
├─ Install without terminal → homey app install
└─ Publish to App Store → homey app publish
```

### "I need to configure widget settings"

```
Widget settings?
├─ Text input → type: "text"
├─ Multi-line text → type: "textarea"
├─ Number input → type: "number" (with optional min/max)
├─ Selection dropdown → type: "dropdown"
├─ Toggle option → type: "checkbox"
└─ Search with suggestions → type: "autocomplete"
```

### "I need to style a widget"

```
Styling?
├─ Text styling → Use .homey-text-* classes
├─ Colors → Use --homey-color-* variables
├─ Light/dark mode → Automatic, or force with .homey-dark-mode
├─ Spacing → Use --homey-space-* units
└─ Icons → Use .homey-icon class with custom SVG
```

---

## CLI Commands Reference

### App Management

```bash
# Create new Homey app (interactive)
homey app create

# Run app on Homey (dev mode with hot reload for public/ files)
homey app run

# Install app without keeping terminal open
homey app install

# Validate app before publishing
homey app validate

# Publish to Homey App Store
homey app publish
```

### Widget Management

```bash
# Create a new widget (run from app directory)
homey app widget create
```

### Authentication & Selection

```bash
# Login to Athom account
homey login

# Logout
homey logout

# Select different Homey device
homey select

# View all commands
homey --help
homey app --help
```

---

## Widget Structure

When you run `homey app widget create`, it creates:

```
widgets/<widgetId>/
├── widget.compose.json    # Widget definition and settings
├── public/
│   └── index.html         # Widget entry point (and other assets)
├── api.js                  # Backend API implementation
├── preview-dark.png        # Preview image for dark mode (1024x1024)
└── preview-light.png       # Preview image for light mode (1024x1024)
```

### widget.compose.json

```json
{
  "name": { "en": "My Widget" },
  "settings": [
    {
      "id": "my-setting",
      "type": "dropdown",
      "title": { "en": "Select Option" },
      "value": "option1",
      "values": [
        { "id": "option1", "title": { "en": "Option 1" } },
        { "id": "option2", "title": { "en": "Option 2" } }
      ]
    }
  ],
  "height": 200,
  "transparent": false,
  "api": {
    "getData": { "method": "GET", "path": "/" },
    "setData": { "method": "POST", "path": "/" }
  }
}
```

**Key Properties:**
- `height`: Initial height in pixels, or percentage (e.g., `"100%"` = square)
- `transparent`: Set `true` for transparent background
- `api`: Define endpoints accessible via `Homey.api`
- `deprecated`: Set `true` to hide from widget picker (existing instances still work)

### Setting Types

| Type | Value | Description |
|------|-------|-------------|
| `text` | `string \| null` | Single line text, optional `pattern` for regex validation |
| `textarea` | `string \| null` | Multi-line text |
| `number` | `number \| null` | Numeric input, optional `min`/`max` |
| `dropdown` | `string \| null` | Select from predefined `values` array |
| `checkbox` | `boolean \| null` | Toggle true/false |
| `autocomplete` | `object \| null` | Search with suggestions |

---

## Widget View API

In your `index.html`, use the global `Homey` object:

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://apps-sdk.developer.homey.app/css/homey.widgets.css">
  <script src="https://apps-sdk.developer.homey.app/js/homey.widgets.js"></script>
</head>
<body>
  <div id="content"></div>
  <script>
    async function init() {
      // Get user settings
      const settings = await Homey.getSettings();
      
      // Call your backend API
      const data = await Homey.api('GET', '/');
      
      // Listen for app events
      Homey.on('update', (data) => {
        console.log('Received update:', data);
      });
      
      // Set dynamic height
      Homey.setHeight(250);
      
      // Translation
      const text = Homey.__('settings.title');
      
      // Signal widget is ready (removes loading state)
      Homey.ready();
    }
    
    init();
  </script>
</body>
</html>
```

### API Methods

| Method | Description |
|--------|-------------|
| `Homey.ready({ height?: number })` | Signal widget is ready, optionally set height |
| `Homey.api(method, path, body?)` | Call widget API endpoints |
| `Homey.on(event, callback)` | Listen for app-emitted events |
| `Homey.__(key, tokens?)` | Translate string from `/locales/*.json` |
| `Homey.getWidgetInstanceId()` | Get unique instance ID |
| `Homey.getSettings()` | Get user-configured settings |
| `Homey.setHeight(height)` | Change widget height at runtime |
| `Homey.popup(url)` | Open in-app browser |
| `Homey.hapticFeedback()` | Trigger haptic feedback (call after touch event) |

---

## Widget Styling

Always include the Homey CSS:

```html
<link rel="stylesheet" href="https://apps-sdk.developer.homey.app/css/homey.widgets.css">
```

### Text Presets

```css
.homey-text-bold       /* Titles, important text */
.homey-text-medium     /* Subtitles, emphasis */
.homey-text-regular    /* Default body text */
.homey-text-small      /* Small standalone text */
.homey-text-small-light /* Small text next to other text */
```

### Font Variables

```css
/* Font sizes */
--homey-font-size-xxlarge  /* 32px - numbers only */
--homey-font-size-xlarge   /* 24px - short phrases */
--homey-font-size-large    /* 20px - numbers only */
--homey-font-size-default  /* 17px - most text */
--homey-font-size-small    /* 14px - captions */

/* Line heights (match with font size) */
--homey-line-height-xxlarge  /* 40px */
--homey-line-height-xlarge   /* 32px */
--homey-line-height-large    /* 28px */
--homey-line-height-default  /* 24px */
--homey-line-height-small    /* 20px */

/* Font weights */
--homey-font-weight-bold     /* Titles */
--homey-font-weight-medium   /* Emphasis */
--homey-font-weight-regular  /* Default */
```

### Color Palette

```css
/* Semantic colors */
--homey-text-color
--homey-background-color
--homey-color-highlight
--homey-color-success
--homey-color-warning
--homey-color-danger

/* Grayscale (000=white to 1000=black in light mode) */
--homey-color-mono-000 to --homey-color-mono-1000

/* Accent colors (050-900) */
--homey-color-blue-500
--homey-color-green-500
--homey-color-orange-500
--homey-color-red-500
```

### Light/Dark Mode

```css
/* Force dark mode */
.homey-dark-mode

/* Check if dark mode (in CSS) */
.homey-dark-mode .my-element { ... }
```

### Spacing

```css
--homey-space-10-5   /* 0.5 units */
--homey-space-11     /* 1 unit */
--homey-space-11-5   /* 1.5 units */
--homey-space-12     /* 2 units */
/* etc. */

/* Widget padding */
--homey-widget-padding
```

---

## Backend API (api.js)

```javascript
'use strict';

module.exports = {
  async getData({ homey, params, query, body }) {
    // Access Homey instance
    const devices = await homey.devices.getDevices();
    
    // Return data to widget
    return { devices: Object.keys(devices) };
  },
  
  async setData({ homey, params, query, body }) {
    // Handle POST data
    homey.log('Received:', body);
    return { success: true };
  }
};
```

---

## Debugging

### Development Mode

```bash
# Run with hot reload for public/ folder
homey app run
```

A refresh button appears to reload `index.html` without full restart.

### Android Debugging

1. Enable USB debugging on Android device
2. Connect via USB or same WiFi network
3. Open `chrome://inspect` in Chrome
4. Find and inspect your widget webview

### iOS Debugging

1. Enable Web Inspector in iOS Settings → Safari → Advanced
2. Connect device to Mac
3. Open Safari → Develop → [Device] → [Widget]

---

## App Store Publishing

### Required Assets

| Asset | Size | Format |
|-------|------|--------|
| App icon | 1024x1024 | PNG (transparent bg) | Required for install |
| App image small | 250x175 | JPG/PNG | **Required for publish validation** |
| App image large | 500x350 | JPG/PNG | **Required for publish validation** |
| App image xlarge | 1000x700 | JPG/PNG | Optional but recommended |
| Widget preview | 1024x1024 | PNG (transparent bg) | Required for widget list |

### Validation Levels

```bash
# Debug level (development)
homey app validate --level debug

# Publish level (Homey Pro)
homey app validate --level publish

# Verified level (Homey Cloud)
homey app validate --level verified
```

### Publishing Process

1. Validate app: `homey app validate --level publish`
2. Publish: `homey app publish`
    - **Interactive**: This command will prompt you to select a new version (Patch/Minor/Major) or confirm the current one.
    - **Monorepo**: In a script, you may need to handle this interactivity (e.g. via `turbo` with concurrency 1).
3. Go to [tools.developer.homey.app](https://tools.developer.homey.app)
4. Submit for Test or Live certification
5. Wait for Athom review

### Widget Preview Guidelines

- Use [Figma template](https://www.figma.com/community/file/1392859749687789493/widget-previews-template)
- Transparent background
- Simple shapes, no text
- Both light and dark versions
- 1024x1024 dimensions

### README.txt (Store Page Description)

The `README.txt` file is a **plain-text story** displayed on the App Store page below the app name and description. It describes what the app does in a friendly, non-technical way.

**Format rules:**
- Plain text only — **no markdown**, no URLs, no changelogs
- Do not repeat the app name (it already shows above the README on the store)
- Describe the app's possibilities, not its technical implementation
- Write in a friendly, engaging tone aimed at end users
- **Avoid specific counts**: Use "multiple" or "various" instead of exact numbers (e.g. "7 widgets") so the text stays accurate long-term

**Description field (`app.json`):**
- The `description` field is a short, catchy tagline shown below the app name
- Be specific (avoid generic phrases like "adds support for X")
- Always include both `en` and `nl` translations

---

## Homey Compose

Homey Compose splits the app manifest into modular files that get merged into the root `app.json` during pre-processing.

### How it works

1. **`.homeycompose/app.json`** — The **source** manifest with base app metadata (id, name, description, compatibility, etc.)
2. **`widgets/<id>/widget.compose.json`** — Individual widget definitions
3. **Root `app.json`** — The **generated** output, merged from the above files

> **IMPORTANT**: Both `.homeycompose/app.json` AND root `app.json` must exist. The CLI reads `.homeycompose/app.json` as the source and writes the merged result (with widgets, drivers, etc.) to root `app.json`. Deleting root `app.json` causes errors.

> **WARNING**: If `.homeycompose/app.json` is missing but root `app.json` exists, the CLI shows:
> `Warning: Could not find a Homey Compose app.json manifest!`
> Always create `.homeycompose/app.json` with the base metadata.

### Creating a Compose app

```
my-app/
├── .homeycompose/
│   └── app.json          # Source manifest (base metadata only, no widgets)
├── app.json              # Generated (copy of .homeycompose/app.json + merged widgets)
├── app.js                # App entry point
├── package.json
├── widgets/
│   └── my-widget/
│       ├── widget.compose.json
│       └── public/
│           └── index.html
└── locales/
    └── en.json
```

### .homeycompose/app.json example

```json
{
  "id": "com.example.myapp",
  "version": "1.0.0",
  "compatibility": ">=12.3.0",
  "sdk": 3,
  "platforms": ["local"],
  "name": { "en": "My App" },
  "description": { "en": "App description" },
  "category": ["tools"],
  "brandColor": "#00B8FF",
  "permissions": [],
  "images": {
    "small": "/assets/images/small.png",
    "large": "/assets/images/large.png",
    "xlarge": "/assets/images/xlarge.png"
  },
  "author": { "name": "Your Name", "email": "you@example.com" }
}
```

**Key rules:**
- Widget apps require `"compatibility": ">=12.3.0"` (widgets need SDK 12.3+)
- Widget apps must use `"platforms": ["local"]` (widgets are not available on Homey Cloud)
- Do NOT include `"widgets"` in `.homeycompose/app.json` — they are auto-merged from `widget.compose.json` files

---

## Translations (Locales)

Homey uses per-language JSON files in `locales/` for runtime translations.

### File structure

```
locales/
├── en.json    # English (required)
└── nl.json    # Dutch (or any other language)
```

### Format rules

- Each file contains translations for **one language** — the filename IS the language
- Do NOT nest under a language key (wrong: `{"en": {"title": "..."}}`)
- Widget translations go under `widgets.<widgetId>.<key>`

```json
{
  "widgets": {
    "my-widget": {
      "loading": "Loading...",
      "error": "Something went wrong"
    }
  }
}
```

### Usage in widgets

```javascript
// Direct call
const text = Homey.__('widgets.my-widget.loading');

// Helper pattern (recommended)
const __ = (key) => Homey.__(`widgets.my-widget.${key}`) ?? key;
const text = __('loading');
```

> **IMPORTANT**: If a translation key is missing, `Homey.__()` returns the key path as a string. Always populate both `en.json` and `nl.json` with all keys used in widget code.

---

## Common Patterns

### Dynamic Height Based on Content

```javascript
function updateHeight() {
  const height = document.body.scrollHeight;
  Homey.setHeight(height);
}

// Call after content changes
updateHeight();
```

### Refresh Data Periodically

```javascript
async function refresh() {
  const data = await Homey.api('GET', '/');
  renderData(data);
}

// Initial load
refresh();

// Refresh every 5 minutes
setInterval(refresh, 5 * 60 * 1000);
```

### Listen for Setting Changes

```javascript
Homey.on('settings.set', (key, value) => {
  settings[key] = value;
  renderWidget();
});
```

---

## File Structure for Monorepo

When building multiple Homey apps in a monorepo:

```
my-monorepo/
├── apps/
│   ├── com.example.app-one/
│   │   ├── .homeycompose/
│   │   │   └── app.json       # Source manifest
│   │   ├── app.json            # Generated manifest
│   │   ├── app.js
│   │   ├── package.json
│   │   └── widgets/
│   │       └── my-widget/
│   └── com.example.app-two/
│       └── ...
├── pnpm-workspace.yaml
└── turbo.json
```

Each Homey app is a standalone package that can be developed and published independently.

### Turbo Integration

Add these scripts to each app's `package.json`:

```json
{
  "scripts": {
    "homey:run": "echo 'Only one app can run in dev mode at a time. Run directly: homey app run'",
    "homey:install": "homey app install",
    "homey:build": "homey app build",
    "homey:publish": "homey app publish"
  }
}
```

Add matching tasks to `turbo.json`:

```json
{
  "tasks": {
    "homey:run": { "cache": false, "persistent": true },
    "homey:install": { "cache": false },
    "homey:build": {},
    "homey:publish": { "cache": false }
  }
}
```

Usage:
```bash
turbo run homey:install   # Install all apps to Homey
turbo run homey:build     # Build all apps
turbo run homey:publish   # Publish all apps
```

> **WARNING**: `homey app run` (dev mode) uses port 9229 for debugging.
> Only ONE app can run in dev mode at a time. Running multiple apps
> simultaneously causes a port conflict. Use `homey:install` to deploy
> all apps, and `homey app run` directly for single-app debugging.
