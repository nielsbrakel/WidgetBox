# Stopwatch Widget

**Directory**: `widgets/stopwatch`

A multi-instance stopwatch widget with lap functionality.

## Features
*   **Multiple Instances**: Run multiple stopwatches simultaneously (up to a limit).
*   **Laps**: specific support for recording lap times.
*   **Persistance**: State is maintained via `Homey.settings` functionality (conceptually, depends on implementation).
*   **Dynamic Height**: Widget grows as stopwatches are added.

## Settings (`widget.compose.json`)

| ID | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `maxStopwatches` | Number | `1` | Max number of stopwatch instances. |
| `allowAddingStopwatches` | Checkbox | `false` | Enable/disable "Add" button. |
| `showMilliseconds` | Checkbox | `true` | Toggle millisecond precision display. |
| `showLaps` | Checkbox | `false` | Enable/disable lap functionality. |

## Development Notes
*   **Standards**: Implements **Button Placement** for the per-stopwatch Close button (`top-right` of the item).
*   **Performance**: Uses a tick loop for updating the display; ensure this is paused when no stopwatches are running.
