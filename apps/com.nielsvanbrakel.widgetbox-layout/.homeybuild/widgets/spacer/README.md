# Spacer Widget

**Directory**: `widgets/spacer`

A utility widget used to control layout and spacing between other widgets in vertical columns.

## Features
*   **Adjustable Height**: Create gaps of varying sizes to align widgets across columns or create visual breathing room.
*   **Transparent**: Invisible functionality.

## Settings (`widget.compose.json`)

| ID | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `heightMultiplier` | Number | `10` | Controls the height of the space (1-1000). |

## Development Notes
*   The `height` in `widget.compose.json` is a base value, but logical height is determined by the `heightMultiplier` setting.
