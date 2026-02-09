# Digital Clock Widget

**Directory**: `widgets/digital-clock`

A clean, legible digital clock display with optional date integration.

## Features
*   **Time Formats**: Support for 12-hour (AM/PM) and 24-hour formats.
*   **Seconds**: Optional display of seconds.
*   **Date Integration**: Can display the date inline or below the time.
*   **Animations**: Optional blinking colon separator.
*   **Styling**: Adjustable size, weight, color, and alignment.

## Settings (`widget.compose.json`)

| ID | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `clockFormat` | Dropdown | `24` | 12h or 24h mode. |
| `showSeconds` | Checkbox | `false` | Toggle seconds display. |
| `showDate` | Checkbox | `true` | Toggle date display. |
| `dateFormat` | Dropdown | `weekday-short` | Format for the date (if shown). |
| `blinkSeparator` | Checkbox | `false` | Animate the colon separator. |
| `color` | Dropdown | `default` | Text color. |
| `size` | Dropdown | `medium` | Font size. |
| `horizontalAlignment` | Dropdown | `center` | Left, Center, Right. |
| `verticalAlignment` | Dropdown | `center` | Top, Center, Bottom. |
| `transparentBackground` | Checkbox | `false` | Background transparency. |
| `fontWeight` | Dropdown | `normal` | Font weight options. |

## Development Notes
*   Uses a high-frequency tick (or efficient timeout) to ensure accurate timekeeping, especially when seconds are enabled.
