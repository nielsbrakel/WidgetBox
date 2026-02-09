# Date Widget

**Directory**: `widgets/date`

A simple, highly customizable text-based date display.

## Features
*   **Extensive Formatting**: Supports standard formats (DD/MM/YYYY) and natural language formats (Wednesday, January 28).
*   **Custom Styling**: Control over text color, font weight, and size.
*   **Positioning**: Full control over horizontal and vertical alignment.

## Settings (`widget.compose.json`)

| ID | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `dateFormat` | Dropdown | `long` | Format string (e.g., 'long', 'short', 'weekday-only', 'dmy'). |
| `color` | Dropdown | `default` | Text color. |
| `fontWeight` | Dropdown | `normal` | Font weight (thin, normal, bold). |
| `size` | Dropdown | `medium` | Text size (xsmall to xlarge). |
| `horizontalAlignment` | Dropdown | `center` | Left, Center, Right. |
| `verticalAlignment` | Dropdown | `center` | Top, Center, Bottom. |
| `transparentBackground` | Checkbox | `false` | Enable/disable transparent background. |
| `uppercase` | Checkbox | `false` | Force uppercase text. |

## Development Notes
*   Should use locale-aware date formatting where possible.
*   Ensure text scales correctly without wrapping awkwardly on smaller widget sizes.
