# Brand

The apps are one family that each look like themselves. They share a drawing style and a store image layout; they differ in hue, mood and subject.

## Family rules

- **Icons** (`apps/*/assets/icon.svg`): a 960×960 line drawing, `stroke-width="44"`, round caps and joins, `fill="none"`, content inside 40–920 so it uses the canvas. At most one small solid dot as an accent (the clock pivot, the header bullet, the video playhead). No text, no backgrounds. Homey draws the icon white on the brand color. `design/app-icons/preview.html` shows every icon that way at 240, 64 and 32 px.
- **Store images** (`apps/*/assets/images`): the app's real widgets on a Homey-style dashboard, tinted with the app's brand color. Room title on the left with a short mood line in the brand color. `small.jpg` is a close-up of one or two widgets because a whole dashboard is unreadable at 250×175. Rendered by `design/store-images/render.mjs`.
- **Widgets themselves** keep Homey's own colors, fonts and spacing. Brand colors live around the widgets (store listing, icon, store images), never inside them, so they still feel native on the dashboard.

## Palette

One hue per app, spread around the wheel so they are easy to tell apart side by side. Every brand color has at least 4.5:1 contrast with white for the icon. The source of truth is `design/store-images/brand.mjs`; `brandColor` in each app's `.homeycompose/app.json` matches it.

| App | Brand color | Contrast with white | Store image mood |
|-----|-------------|---------------------|------------------|
| Clocks & Timers | `#6236D9` violet | 6.9:1 | dark, bedroom in the morning |
| Weather | `#0A6FC2` sky blue | 5.2:1 | light, hallway before heading out |
| Layout | `#0F7A5C` green | 5.3:1 | light, calm sectioned dashboard |
| Video | `#D1401A` red-orange | 4.7:1 | dark, living room movie night |
| Games | `#C21E6E` magenta (suggested) | 5.7:1 | left to the aquarium rebuild |

The previous colors (purple, blue, slate, deep orange, teal) had two near neighbours (blue and teal) and a slate that read as greyed out in the store list.

## Name

"WidgetBox" describes the container, not what the apps do, and "box" fights the idea of separate focused apps. Homey limits names to four words, forbids "Homey" and "Athom", and the earlier cleanup ruled out third-party brands.

| Name | Store names | For | Against |
|------|-------------|-----|---------|
| **Glance** (pick) | Glance Clocks & Timers, Glance Weather, Glance Layout, Glance Video | Says what a dashboard widget is for: information at a glance. One syllable, same in English and Dutch. | Common word, so search alone won't find it. |
| Mosaic | Mosaic Clocks & Timers, Mosaic Weather, … | The dashboard as a mosaic of tiles; ties to the Layout app. | Longer; less about what you get. |
| Nook | Nook Clocks & Timers, Nook Weather, … | Cozy, homely, short. | Says nothing about widgets; Barnes & Noble used it for e-readers. |
| WidgetBox | (unchanged) | Already used in the Homey community topic. | Generic and container-like. |

App ids (`com.nielsvanbrakel.widgetbox-*`) stay as they are: users never see them, and changing them after a release would split installs.
