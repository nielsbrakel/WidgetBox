# Buien Tabel Widget

**Directory**: `widgets/buientabel`

A modern, graph-based rain forecast widget that displays precipitation intensity over time.

## Features
*   **Graph Visualization**: Displays rain forecast as a Bar or Line chart.
*   **Interaction**: Hover over data points to see specific time and rain intensity (mm/h).
*   **Status Overlay**: Clearly displays "No Rain" ("Geen regen") when the forecast is dry.
*   **Live Data**: Fetches data from Buienradar/GPSGadget.

## Settings (`widget.compose.json`)

| ID | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `graphStyle` | Dropdown | `bars` | Choose between 'Bars' or 'Line' (and 'Smooth Line' in logic). |
| `aspectRatio` | Dropdown | `16:9` | **Standard**: 1:1, 4:3, 16:9, 21:9. |
| `refreshInterval` | Dropdown | `300` | Auto-refresh interval (Manual, 5m, 15m, 30m, 1h). |
| `hideRefreshButton` | Checkbox | `false` | Option to hide the on-screen refresh button. |
| `lat` / `lon` | Text | - | Latitude and Longitude for the forecast location. |

## Development Notes
*   **Standards**: Fully implements the **Aspect Ratio** and **Fresh Button** placement standards.
*   **Styling**: Uses Homey colors (`--homey-color-blue-500` for rain).
*   **Logic**: Uses a custom `ChartRenderer` class to handle SVG/HTML chart drawing.
