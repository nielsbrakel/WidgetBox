# Windy Widget

**Directory**: `widgets/windy`

Embeds the powerful Windy.com visualization map.

## Features
*   **Layers**: View Wind, Temperature, Rain, Clouds, or Pressure.
*   **Models**: Switch between ECMWF, GFS, and NAM forecast models.
*   **Height Levels**: View data at Surface, 10m, or 100m.
*   **Customization**: Toggle markers, pressure isolines, and units (metric/imperial).

## Settings (`widget.compose.json`)

| ID | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `latitude` / `longitude` | Text | - | Map center location. |
| `zoom` | Number | `5` | Initial zoom level. |
| `overlay` | Dropdown | `wind` | Active map layer. |
| `product` | Dropdown | `ecmwf` | Forecast model. |
| `level` | Dropdown | `surface` | Atmosphere level. |
| `aspectRatio` | Dropdown | `16:9` | **Standard**: 1:1, 4:3, 16:9, 21:9. |
| `metricTemp` / `metricRain` / `metricWind` | Dropdown | `default` | Unit customization. |

## Development Notes
*   **Standards**: Implements the **Aspect Ratio** standard.
*   **Integration**: embeds Windy via iframe/API. Ensure the overlay options match valid Windy URL parameters.
