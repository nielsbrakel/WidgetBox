# Stopwatch widget

One or more stopwatches with optional lap times. State lives on Homey, so the same widget shows the
same stopwatches on every device.

## Settings

| ID | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `showMilliseconds` | Checkbox | `true` | Show hundredths of a second (ticks at 20 Hz while running instead of 1 Hz). |
| `showLaps` | Checkbox | `false` | Show the lap button and the three most recent laps (max 99 laps, fastest/slowest marked). |
| `allowAddingStopwatches` | Checkbox | `true` | Show the add and remove buttons. When off, the count is fixed to `initialStopwatches`. |
| `initialStopwatches` | Number 1-10 | `1` | Stopwatches shown when the widget is first added. |
| `maxStopwatches` | Number 1-10 | `3` | The add button is hidden at this count. |

## State and sync

- `api.js` (`GET` / `PUT /state?widgetId=<instance id>`) is built on `lib/widgetState.js` and stores
  `{ items: [{ id, elapsedMs, startedAt, laps }], updatedAt }` under `stopwatch_<instance id>`.
  Bodies are validated and size capped; `app.js` prunes states not written for 180 days.
- Times are stored as timestamps (Homey clock, offset from `serverNow`), so nothing is saved while a
  stopwatch runs; only actions are saved (debounced 300 ms).
- Every save is broadcast as the realtime event `stopwatch:state`; other devices apply it, and every
  device reloads the state when it becomes visible again.

## Layout

Rows switch to a stacked layout below 340 px. Height follows the content via `ResizeObserver` and
`Homey.setHeight` (no fixed height in the compose file). Ticking stops while the page is hidden.
