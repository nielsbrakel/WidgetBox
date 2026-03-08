# Separator Widget

**Directory**: `widgets/separator`

A horizontal line to visually separate widgets on a dashboard.

## Features
*   **Color**: Any hex color.
*   **Thickness**: 1–4px.
*   **Style**: Solid, dashed, or dotted.
*   **Side Margin**: Horizontal inset from the edges.
*   **Transparent**: Only the line is visible.

## Settings (`widget.compose.json`)

| ID | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `color` | Text | `#CCCCCC` | Hex color code for the line. |
| `thickness` | Dropdown | `1` | Line thickness in pixels (1–4). |
| `style` | Dropdown | `solid` | Line style (solid, dashed, dotted). |
| `margin` | Number | `16` | Horizontal margin on each side (0–200px). |
