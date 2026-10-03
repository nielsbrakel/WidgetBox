# WidgetBox glossary

Dashboard widgets for Homey Pro, shipped as a few small Homey apps grouped by concept. Use these
words in code, setting labels, translations and docs. _Avoid_ lists words that mean something
else here or that we replaced.

## Platform

- **App**: one Homey app in the store (Clocks & Timers, Weather, Layout, Video, Games), released
  and versioned on its own. _Avoid_: package, plugin.
- **Widget**: a kind of dashboard tile an app offers (Timer, Rain graph), identified by its
  **widget id**. _Avoid_: component, card.
- **Widget instance**: one placed copy of a widget on a dashboard, with its own settings and
  stored state, identified by its **instance id** (`Homey.getWidgetInstanceId()`). _Avoid_:
  widget id (for the instance).
- **Setting**: an option of a widget instance, edited in Homey's widget settings. _Avoid_: option,
  config, preference.
- **Shared setting**: a setting with the same id, values and labels in every widget that has it:
  size, color, horizontal alignment, font weight, time format.
- **Widget kit**: the small shared helpers in `packages/widget-kit`, copied into widgets as
  **vendored** files. _Avoid_: framework, library.
- **Sandbox**: the local browser preview of every widget with a **fake Homey**. A **scenario** is
  one canned situation (no data, an error, rain) a widget can be previewed in.

## Appearance

- **Size**: the scale step of a widget's text or graphics, xsmall to xlarge. _Avoid_: height
  (that is the Spacer's height or the tile's height).
- **Accent color**: the Homey palette color a widget highlights with. The option that follows the
  theme's text color is **Text color**. _Avoid_: default color, brand color.
- **Brand color**: the store color of an app; never used inside widgets.
- **Theme**: Homey's light or dark mode, followed automatically. _Avoid_: dark-mode setting.

## Time (Clocks & Timers)

- **Clock**: a widget that shows the current local time (analog, digital, flip, binary, word grid,
  word sentence).
- **Time format**: 12-hour or 24-hour. _Avoid_: clock format.
- **Timer**: a countdown from a duration to zero; a timer widget instance can hold several.
  _Avoid_: countdown widget, alarm.
- **Duration**: what a timer is set to, at most 23:59:59. **Remaining time**: what it has left.
- **Finished**: a running timer whose remaining time reached zero; derived, never stored.
  **Overtime**: the time since it finished, shown as −mm:ss. _Avoid_: done, expired.
- **Stopwatch**: counts elapsed time and records **laps**; a **split** is the time between two laps.
- **Idle / Running / Paused**: the states of a timer or stopwatch. Idle means untouched or reset.
- **Instance state**: the timers or stopwatches of one widget instance, stored on the Homey and
  synced to every screen. _Avoid_: localStorage state.

## Weather

- **Location**: a latitude/longitude pair from the widget settings, or else the Homey's own
  location. In code `{ lat, lon }`. _Avoid_: coordinates, position.
- **Place**: the named Buienradar forecast area a location resolves to.
- **Station**: a Buienradar weather station with live measurements. An **observation** is one set
  of its measurements with the time it was **observed**. _Avoid_: reading.
- **Rain forecast**: expected rain intensity for the next two hours in 5-minute steps (NL/BE).
  _Avoid_: nowcast, precipitation forecast.
- **Rain intensity**: rain in mm/h: light from 1, moderate from 4, heavy from 8.
- **Daily forecast**: min/max temperature, chance of rain and rain amount per day, up to 7 days.
  _Avoid_: forecast (on its own).
- **Rain radar**: the latest observed rain map. **Weather map**: the interactive worldwide map
  with a chosen layer.
- **Updated** vs **observed**: when WidgetBox fetched data vs when a station measured it.

## Layout

- **Header**: a text label that titles a dashboard section. _Avoid_: title widget, heading.
- **Separator**: a visible line between sections. _Avoid_: divider, rule.
- **Spacer**: invisible vertical space of a set height. _Avoid_: divider, gap.

## Video

- **Video source**: the video, playlist and start time a video widget plays, taken from a link or
  an id. _Avoid_: YouTube (in names), embed.
