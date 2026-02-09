# Timer Widget

**Directory**: `widgets/timer`

A countdown timer widget with support for multiple concurrent timers.

## Features
*   **iOS-style Picker**: Custom scrolling value picker for setting Hours, Minutes, and Seconds.
*   **Visual Feedback**: Progress bar background fills as time elapses.
*   **Animations**: "Shake" animation when timer completes.
*   **Multiple Timers**: Support for adding/removing timer instances dynamically.

## Settings (`widget.compose.json`)

| ID | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `initialTimers` | Number | `1` | Number of timers to show on load. |
| `maxTimers` | Number | `5` | Maximum allowed timers. |
| `allowAddingTimers` | Checkbox | `true` | Allow user to add new timers. |
| `defaultHours` | Number | `0` | Default start value (Hours). |
| `defaultMinutes` | Number | `5` | Default start value (Minutes). |
| `defaultSeconds` | Number | `0` | Default start value (Seconds). |

## Development Notes
*   **Standards**: User Close button adheres to positioning standards.
*   **Interaction**: The time picker requires touch/mouse event handling for the scroll effect.
*   **Vibration**: Uses `navigator.vibrate` on supported devices when timer finishes.
