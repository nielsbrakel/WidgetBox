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
| App icon | 1024x1024 | PNG (transparent bg) |
| App image small | 250x175 | JPG/PNG |
| App image large | 500x350 | JPG/PNG |
| App image xlarge | 1000x700 | JPG/PNG |
| Widget preview | 1024x1024 | PNG (transparent bg) |

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

1. Validate app: `homey app validate`
2. Publish: `homey app publish`
3. Go to [tools.developer.homey.app](https://tools.developer.homey.app)
4. Submit for Test or Live certification
5. Wait for Athom review

### Widget Preview Guidelines

- Use [Figma template](https://www.figma.com/community/file/1392859749687789493/widget-previews-template)
- Transparent background
- Simple shapes, no text
- Both light and dark versions
- 1024x1024 dimensions

---

## App Manifest (app.json)

Ensure compatibility for widgets:

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
  "author": { "name": "Your Name", "email": "you@example.com" }
}
```

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
// Settings are fetched once at init
// User must re-add widget for new settings
const settings = await Homey.getSettings();
```

---

## File Structure for Monorepo

When building multiple Homey apps in a monorepo:

```
my-monorepo/
├── apps/
│   ├── com.example.app-one/
│   │   ├── app.json
│   │   ├── app.js
│   │   └── widgets/
│   │       └── my-widget/
│   └── com.example.app-two/
│       └── ...
├── pnpm-workspace.yaml
└── turbo.json
```

Each Homey app is a standalone package that can be developed and published independently.
