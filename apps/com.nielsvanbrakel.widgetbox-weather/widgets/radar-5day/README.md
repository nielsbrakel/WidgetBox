# Buienradar Widget

**Directory**: `widgets/buienradar`

Traditional rain radar widget that identifies precipitation over a map area using Buienradar data.

## Features
*   **Radar Loop**: Visualizes rain movement over the Netherlands.
*   **Flexible Modes**: Toggle between a 5-day forecast view or a zoomable map centered on a specific location.

## Settings (`widget.compose.json`)

| ID | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `gadgetType` | - | - | Determined by logic (radarfivedays vs zoommap). |
| `zoomLevel` | - | - | Zoom level for the map (Country, Province, Region, City). |
| `postcode` | Text | - | Postcode to center the map on. |
| `mapSize` | - | - | Size of the iframe map. |

## Development Notes
*   Relies on embedding external Buienradar iframes.
*   Ensure the iframe resizes correctly within the widget container.
*   **Standard Compliance**: Should check if this widget supports the standard Aspect Ratio setting (Action Item: Verify/Update if missing).
