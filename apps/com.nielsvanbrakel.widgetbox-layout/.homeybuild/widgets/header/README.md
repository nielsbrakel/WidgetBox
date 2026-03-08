# Header Widget

**Directory**: `widgets/header`

A section title widget to visually organize dashboard groups.

## Features
*   **Custom Text**: Any label you want.
*   **Size**: Small (14px), Medium (18px), Large (24px).
*   **Weight**: Normal or Bold.
*   **Alignment**: Left, Center, or Right.
*   **Color**: Custom hex color or Homey's default text color.
*   **Transparent**: Only the text is visible.

## Settings (`widget.compose.json`)

| ID | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `text` | Text | `Section` | The header text to display. |
| `size` | Dropdown | `medium` | Font size (small, medium, large). |
| `weight` | Dropdown | `bold` | Font weight (normal, bold). |
| `align` | Dropdown | `left` | Text alignment (left, center, right). |
| `color` | Text | *(empty)* | Hex color code. Empty = Homey default text color. |
