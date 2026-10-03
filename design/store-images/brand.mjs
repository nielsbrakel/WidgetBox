/**
 * Per-app brand tokens. One hue per app, spread around the colour wheel so the apps
 * are easy to tell apart side by side in the Homey App Store.
 *
 * `color` is the app's `brandColor` (Homey draws the white line icon on it, so it keeps
 * at least 4.5:1 contrast with white). `glow` is a lighter tint of the same hue used
 * for text accents on dark store images. `theme` is the dashboard mood of the store
 * images: dark for the evening apps (clocks, video), light for the daytime ones.
 *
 * Keep `color` in sync with `brandColor` in each app's `.homeycompose/app.json`.
 */
export const BRAND = {
  "com.nielsvanbrakel.widgetbox-clocks": {
    key: "clocks",
    color: "#6236D9",
    glow: "#A48BFF",
    theme: "dark",
  },
  "com.nielsvanbrakel.widgetbox-weather": {
    key: "weather",
    color: "#0A6FC2",
    glow: "#5DB2FF",
    theme: "light",
  },
  "com.nielsvanbrakel.widgetbox-layout": {
    key: "layout",
    color: "#0F7A5C",
    glow: "#4FD1A5",
    theme: "light",
  },
  "com.nielsvanbrakel.widgetbox-video": {
    key: "video",
    color: "#D1401A",
    glow: "#FF8A5C",
    theme: "dark",
  },
};
