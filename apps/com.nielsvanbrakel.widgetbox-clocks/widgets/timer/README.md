# Timer widget

One or more countdown timers. The duration is set with tap-or-hold stepper buttons (no swiping), and a
finished timer stays visible (red, pulsing for a minute, counting the overtime) until you tap Done.
State lives on Homey, so the same widget shows the same timers on every device.

## Settings

| ID | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `defaultHours` / `defaultMinutes` / `defaultSeconds` | Number | `0` / `5` / `0` | Duration for new timers. Idle timers still on the old default follow a change. |
| `playSound` | Checkbox | `true` | Beep when time is up. Browsers only allow audio after a tap, so it beeps on devices where a timer button was pressed. |
| `allowAddingTimers` | Checkbox | `true` | Show the add and remove buttons. When off, the count is fixed to `initialTimers`. |
| `initialTimers` | Number 1-10 | `1` | Timers shown when the widget is first added. |
| `maxTimers` | Number 1-10 | `3` | The add button is hidden at this count. |

## State and sync

- `api.js` (`GET` / `PUT /state?widgetId=<instance id>`) is built on `lib/widgetState.js` and stores
  `{ items: [{ id, status, durationMs, remainingMs, startedAt }], updatedAt }` under
  `timer_<instance id>`. `status` is `idle`, `running` or `paused`; "finished" is derived from a
  running timer whose remaining time has passed.
- Remaining time is kept in milliseconds, so pausing, resuming or reloading never gains or loses time.
- Saves are broadcast as the realtime event `timer:state`; devices also reload state when visible.
- The alert (vibration where supported, optional beep) fires once per run, only when the timer
  finished within the last 5 seconds, so waking a tablet later does not replay it.

## Layout

Rows switch to a stacked layout below 360 px; the stepper fits in 170 px. Height follows the content
via `ResizeObserver` and `Homey.setHeight`. Ticks are aligned to whole seconds and stop while hidden.
