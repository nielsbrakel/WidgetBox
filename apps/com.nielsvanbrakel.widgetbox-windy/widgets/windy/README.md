# Windy Widget

**Directory**: `widgets/windy`

Embeds the powerful Windy.com visualization map.

> **⚠️ iOS Notice:** This widget does not work on iOS dashboards due to a limitation of the Homey app. It does work on Android and web devices.

## Features
*   **Layers**: View Wind, Temperature, Rain, Clouds, or Pressure.
*   **Models**: Switch between ECMWF, GFS, and NAM forecast models.
*   **Height Levels**: View data at Surface, 10m, or 100m.
*   **Customization**: Toggle markers, pressure isolines, and units (metric/imperial).
*   **Detail View**: Optional detail/forecast view with separate coordinates.

## Settings (`widget.compose.json`)

| ID | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `openDetailsByDefault` | Checkbox | `false` | Show forecast detail view on load instead of the map. |
| `zoom` | Number | `5` | Initial zoom level. |
| `overlay` | Dropdown | `wind` | Active map layer (wind, temp, rain, clouds, pressure). |
| `product` | Dropdown | `ecmwf` | Forecast model (ECMWF, GFS, NAM). |
| `level` | Dropdown | `surface` | Atmosphere level (surface, 10m, 100m). |
| `pressure` | Checkbox | `false` | Show pressure isolines on the map. |
| `marker` | Checkbox | `true` | Show location marker on the map. |
| `message` | Checkbox | `true` | Hide Windy promo message. |
| `metricRain` | Dropdown | `default` | Rain units (default, mm, in). |
| `metricTemp` | Dropdown | `default` | Temperature units (default, °C, °F). |
| `metricWind` | Dropdown | `default` | Wind units (default, km/h, mph, m/s, knots). |
| `aspectRatio` | Dropdown | `16:9` | 1:1, 4:3, 16:9, 21:9, 3:1 (Panoramic). |

## Development Notes
*   **Standards**: Implements the **Aspect Ratio** standard.
*   **Integration**: Embeds Windy via iframe/API. Ensure the overlay options match valid Windy URL parameters.
*   **Touch Handling**: An overlay intercepts touch events to prevent dashboard scrolling. Tapping the overlay disables it for 10 seconds to allow map interaction.
*   **iOS**: Detects iOS via user agent and shows a fallback message. Testable in the sandbox via the "Simulate iOS" debug scenario.
