/**
 * Store image scenes: which real widgets each app shows, and where.
 *
 * Every scene is a dashboard in the app's own mood (see brand.mjs). `columns` stack
 * their items top to bottom with a 16px gap. An item is either a real widget captured
 * from the sandbox (`widget`, optional `settings` by setting id, optional `scenario`)
 * or a plain HTML card (`html` + `height`) for the ordinary Homey device tiles and
 * video frames around the widgets.
 *
 * `xlarge` is drawn at 1000x700 and also downscaled to the 500x350 `large` image.
 * `small` (250x175) is its own close-up, because a full dashboard is unreadable there.
 * A column `y` of "center" centres its stack vertically.
 */

const ICONS = {
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  thermo: '<path d="M14 14.5V5a2 2 0 0 0-4 0v9.5a4 4 0 1 0 4 0z"/><path d="M12 9v8"/>',
  blinds: '<path d="M4 4h16M5 4v12M19 4v12M5 8h14M5 12h14M5 16h14M12 16v4"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  door: '<path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M4 21h16"/><path d="M14 12h.01"/>',
  fan: '<circle cx="12" cy="12" r="1.5"/><path d="M12 10.5C12 6 14 3 16.5 4.5S15 10 12 10.5zM13.5 12c4.5 0 7.5 2 6 4.5S14 15 13.5 12zM12 13.5c0 4.5-2 7.5-4.5 6S9 14 12 13.5zM10.5 12C6 12 3 10 4.5 7.5S10 9 10.5 12z"/>',
  speaker:
    '<rect x="6" y="3" width="12" height="18" rx="2"/><circle cx="12" cy="14" r="3"/><path d="M12 7h.01"/>',
};

/** A Homey-style device tile. `on` paints the icon chip in Homey's amber. */
const tile = (icon, name, state, on = false) => ({
  height: 136,
  html: `<div class="tile">
    <div class="chip${on ? " on" : ""}"><svg viewBox="0 0 24 24">${ICONS[icon]}</svg></div>
    <div class="name">${name}</div><div class="state">${state}</div></div>`,
});

/** Two small device tiles side by side in one column slot. */
const pair = (a, b) => ({
  height: a.height,
  html: `<div class="pair">${a.html}${b.html}</div>`,
});

const LAKE = `<svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#3b2a63"/><stop offset=".55" stop-color="#c0607a"/><stop offset="1" stop-color="#f6a65a"/></linearGradient>
  <linearGradient id="lake" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#e88a6a"/><stop offset="1" stop-color="#3a2b55"/></linearGradient></defs>
  <rect width="160" height="90" fill="url(#sky)"/>
  <circle cx="112" cy="50" r="9" fill="#ffd9a0" opacity=".9"/>
  <path d="M0 56l22-18 14 9 22-21 24 22 16-10 26 16 20-13 16 15v34H0z" fill="#5b3f78"/>
  <path d="M0 58l30-10 22 8 30-12 30 13 26-8 22 9v32H0z" fill="#3e2c5c"/>
  <rect y="58" width="160" height="32" fill="url(#lake)"/>
  <path d="M100 64h24M104 68h16M108 72h8" stroke="#ffd9a0" stroke-width="1.2" opacity=".7"/>
  <path d="M0 80q40-6 80 0t80 0v10H0z" fill="#241a38"/></svg>`;

const BEACH = `<svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice">
  <defs><linearGradient id="night" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#0d1b3a"/><stop offset="1" stop-color="#27477a"/></linearGradient></defs>
  <rect width="160" height="90" fill="url(#night)"/>
  <circle cx="118" cy="22" r="9" fill="#f4f1de"/>
  <g fill="#fff" opacity=".8"><circle cx="20" cy="14" r=".7"/><circle cx="44" cy="26" r=".6"/><circle cx="70" cy="10" r=".7"/><circle cx="90" cy="30" r=".5"/><circle cx="140" cy="44" r=".6"/><circle cx="30" cy="38" r=".5"/></g>
  <rect y="52" width="160" height="22" fill="#1d3a6b"/>
  <path d="M108 58h20M112 62h12M115 66h6" stroke="#f4f1de" stroke-width="1" opacity=".6"/>
  <path d="M0 74q50-8 160-2v18H0z" fill="#d9c49a"/></svg>`;

/** A video widget frame (16:9) with the player's play button. */
const video = (scene, width) => ({
  height: Math.round((width * 9) / 16),
  html: `<div class="video">${scene}<div class="play"><svg viewBox="0 0 24 24"><path d="M9 7v10l8-5z"/></svg></div></div>`,
});

export const SCENES = {
  "com.nielsvanbrakel.widgetbox-clocks": {
    title: "Bedroom",
    subtitle: "Good morning",
    xlarge: [
      {
        x: 56,
        w: 280,
        items: [
          { widget: "analog-clock", settings: { size: "large" } },
          { widget: "digital-clock" },
          { widget: "binary-clock", settings: { color: "purple" } },
        ],
      },
      {
        x: 360,
        w: 280,
        items: [
          { widget: "word-clock-grid", settings: { color: "purple" } },
          { widget: "word-clock-sentence" },
          { widget: "stopwatch" },
        ],
      },
      {
        x: 664,
        w: 280,
        items: [{ widget: "flip-clock" }, { widget: "timer" }],
      },
    ],
    small: [
      { x: 40, w: 200, y: "center", items: [{ widget: "analog-clock" }] },
      {
        x: 256,
        w: 204,
        y: "center",
        items: [{ widget: "flip-clock" }, { widget: "digital-clock" }],
      },
    ],
  },
  "com.nielsvanbrakel.widgetbox-weather": {
    title: "Hallway",
    subtitle: "Before you head out",
    xlarge: [
      {
        x: 56,
        w: 436,
        items: [{ widget: "rain-graph" }, { widget: "station" }],
      },
      {
        x: 508,
        w: 436,
        items: [
          { widget: "forecast" },
          pair(tile("door", "Front door", "Locked"), tile("bulb", "Porch light", "On", true)),
        ],
      },
    ],
    small: [{ x: 40, w: 420, y: "center", items: [{ widget: "rain-graph" }] }],
  },
  "com.nielsvanbrakel.widgetbox-layout": {
    xlarge: [
      {
        x: 56,
        w: 888,
        y: 40,
        items: [
          { widget: "header", settings: { text: "Living room", size: "large" } },
          {
            height: 136,
            html: `<div class="row4">${[
              tile("bulb", "Ceiling light", "On · 80%", true),
              tile("bulb", "Floor lamp", "On · 40%", true),
              tile("thermo", "Thermostat", "21.5 °C"),
              tile("blinds", "Blinds", "Open"),
            ]
              .map((t) => t.html)
              .join("")}</div>`,
          },
          { widget: "separator", settings: { thickness: "2" } },
          { widget: "header", settings: { text: "Garden", size: "large" } },
          {
            height: 136,
            html: `<div class="row4">${[
              tile("bulb", "Terrace lights", "Off"),
              tile("drop", "Sprinkler", "Next run 06:00"),
              tile("sun", "Outdoor", "14.5 °C"),
              tile("door", "Shed door", "Closed"),
            ]
              .map((t) => t.html)
              .join("")}</div>`,
          },
        ],
      },
    ],
    small: [
      {
        x: 40,
        w: 420,
        y: "center",
        items: [
          { widget: "header", settings: { text: "Living room", size: "large" } },
          pair(tile("bulb", "Ceiling light", "On", true), tile("blinds", "Blinds", "Open")),
          { widget: "separator", settings: { thickness: "2" } },
        ],
      },
    ],
  },
  "com.nielsvanbrakel.widgetbox-video": {
    title: "Living room",
    subtitle: "Movie night",
    xlarge: [
      {
        x: 56,
        w: 580,
        items: [
          video(LAKE, 580),
          pair(
            tile("bulb", "TV lights", "Movie scene", true),
            tile("speaker", "Speaker", "Playing"),
          ),
        ],
      },
      {
        x: 660,
        w: 284,
        items: [
          video(BEACH, 284),
          tile("fan", "Fan", "Low"),
          tile("thermo", "Thermostat", "20.5 °C"),
        ],
      },
    ],
    small: [{ x: 40, w: 420, y: "center", items: [video(LAKE, 420)] }],
  },
};
