# Analog Clock Widget

**Directory**: `widgets/analog-clock`

A classic analog clock face that supports multiple styling patterns, from minimalist to Swiss railway designs.

## Features
*   **Multiple Styles**: Switch between Minimal, Modern, Classic, and Swiss Railway designs.
*   **Theming**: Customizing the accent color.
*   **Sizing**: Adjustable size from Small (64px) to Extra Large (256px).
*   **Toggles**: Option to show/hide the second hand and date.
*   **Alignment**: Full control over horizontal and vertical alignment.

## Settings (`widget.compose.json`)

| ID | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `style` | Dropdown | `modern` | Visual style of the face (minimal, modern, classic, swiss). |
| `color` | Dropdown | `default` | Accent color for hands/markers. |
| `size` | Dropdown | `medium` | Size preset (small, medium, large, xlarge). |
| `showSeconds` | Checkbox | `true` | Show/hide the second hand. |
| `showDate` | Checkbox | `true` | Show/hide the date window. |
| `horizontalAlignment` | Dropdown | `center` | Left, Center, Right. |
| `verticalAlignment` | Dropdown | `center` | Top, Center, Bottom. |
| `transparentBackground` | Checkbox | `false` | Enable/disable transparent background. |

## Development Notes
*   Uses SVG or Canvas for rendering the clock face to ensure sharpness at any size.
*   Date display should adapt its position based on the selected style.
