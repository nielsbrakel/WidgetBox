# Header widget

**Directory**: `widgets/header`

A transparent, single-line section title for grouping widgets on a dashboard. Text that does not fit ends with an ellipsis.

## Settings

| ID | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `text` | Text | `Section` | The title text. |
| `size` | Dropdown | `medium` | `xsmall` to `xlarge`, mapped to `--homey-font-size-small` … `--homey-font-size-xxlarge`. The widget height follows the size (24 to 56 px). |
| `fontWeight` | Dropdown | `bold` | `thin`, `normal` or `bold`. |
| `horizontalAlignment` | Dropdown | `left` | `left`, `center` or `right`. |
| `color` | Dropdown | `default` | `default` (Homey text color), `blue`, `green`, `orange`, `red` or `purple` (`--homey-color-*-500` with hex fallbacks). |
