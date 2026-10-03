/*
 * Aquarium art: procedural vector drawing for fish, decor, backgrounds and effects.
 *
 * Everything is drawn with Canvas 2D paths so it stays crisp at any widget size.
 * Fish bodies are pre-rendered into small sprites (cached per species/variant/size);
 * only fins and tails are drawn live so they can move. Coordinates are CSS pixels.
 */
((root) => {
  // biome-ignore lint/suspicious/noRedundantUseStrict: loaded as a classic script, not a module
  "use strict";

  const TAU = Math.PI * 2;

  // ── Colour helpers ─────────────────────────────────────────────────

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgba(hex, a) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  }

  // amt -1..1: negative darkens, positive lightens.
  function shade(hex, amt) {
    const [r, g, b] = hexToRgb(hex);
    const f = (c) => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt);
    return `#${((1 << 24) | (f(r) << 16) | (f(g) << 8) | f(b)).toString(16).slice(1)}`;
  }

  function mix(a, b, t) {
    const x = hexToRgb(a);
    const y = hexToRgb(b);
    const f = (i) => Math.round(x[i] + (y[i] - x[i]) * t);
    return `#${((1 << 24) | (f(0) << 16) | (f(1) << 8) | f(2)).toString(16).slice(1)}`;
  }

  // Small deterministic PRNG for decorative detail (spots, pebbles…).
  // Fish read on tiny screens thanks to a dark ink outline in their own hue.
  // Size of one art pixel in CSS px; the scene sets it so outlines are exactly one pixel wide.
  let artPx = 1;
  function setArtPixel(px) {
    artPx = px;
  }

  // Pixel-art outline in a darker tone of the fill. Dark fish swim in dark water, so they get a
  // lighter rim instead.
  function ink(hex) {
    const [r, g, b] = hexToRgb(hex);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum < 0.3 ? shade(hex, 0.45) : shade(hex, -0.5);
  }

  function inkWidth() {
    return artPx;
  }

  // Below this length (CSS px) fine detail turns into noise, so patterns get bolder and simpler.
  const SMALL_FISH = 34;

  function prng(seed) {
    let s = seed >>> 0 || 1;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function strSeed(str) {
    let h = 7;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 2654435761) >>> 0;
    return h;
  }

  // ── Biomes ─────────────────────────────────────────────────────────

  const BIOMES = {
    pond: {
      top: "#7fd3d0",
      mid: "#3a9fae",
      deep: "#1d5e72",
      sand: "#dcc08a",
      sandDark: "#b39461",
      pebbles: ["#c9b089", "#a98f6a", "#e6d3ad", "#8f7b5f"],
      haze: "rgba(58,159,174,0.22)",
      silhouette: "#2a7e86",
      rays: 0.16,
    },
    amazon: {
      top: "#a7c48a",
      mid: "#5f8d63",
      deep: "#2a4a38",
      sand: "#8a6a45",
      sandDark: "#5e472e",
      pebbles: ["#7a5c3c", "#9b7a50", "#5a4330", "#b58d5a"],
      haze: "rgba(95,141,99,0.24)",
      silhouette: "#3c6446",
      rays: 0.12,
      leafLitter: true,
    },
    reef: {
      top: "#7fd8f5",
      mid: "#2f9fd8",
      deep: "#145a9c",
      sand: "#f2e8cf",
      sandDark: "#d4c39b",
      pebbles: ["#efe2c4", "#fbf5e6", "#d9c7a0", "#f6c9b5"],
      haze: "rgba(47,159,216,0.2)",
      silhouette: "#2a7cb8",
      rays: 0.2,
    },
    abyss: {
      top: "#1d3460",
      mid: "#0f1f42",
      deep: "#050b1e",
      sand: "#2a2f45",
      sandDark: "#181b2c",
      pebbles: ["#343a55", "#262b40", "#41476a", "#1e2236"],
      haze: "rgba(15,31,66,0.3)",
      silhouette: "#14244a",
      rays: 0.05,
      snow: true,
      dark: true,
    },
  };

  const SAND_TOP = 0.8;

  /*
   * Static background: water gradient, far silhouettes and the sand bed. Rendered once into
   * an offscreen canvas per size/biome.
   */
  function drawBackground(ctx, W, H, biomeId) {
    const b = BIOMES[biomeId];
    const sandY = H * SAND_TOP;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, b.top);
    g.addColorStop(0.45, b.mid);
    g.addColorStop(1, b.deep);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Surface shimmer line.
    const sg = ctx.createLinearGradient(0, 0, 0, H * 0.06);
    sg.addColorStop(0, "rgba(255,255,255,0.35)");
    sg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, W, H * 0.06);

    const rnd = prng(strSeed(biomeId));
    // Far silhouettes: soft hills and plant shapes in the water colour.
    ctx.fillStyle = rgba(b.silhouette, b.dark ? 0.5 : 0.45);
    ctx.beginPath();
    ctx.moveTo(0, sandY);
    for (let x = 0; x <= W; x += W / 8) {
      ctx.quadraticCurveTo(x + W / 16, sandY - H * (0.08 + rnd() * 0.12), x + W / 8, sandY);
    }
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();
    ctx.strokeStyle = rgba(b.silhouette, 0.5);
    ctx.lineCap = "round";
    for (let i = 0; i < 14; i++) {
      const x = rnd() * W;
      const h = H * (0.12 + rnd() * 0.22);
      ctx.lineWidth = 2 + rnd() * 3;
      ctx.beginPath();
      ctx.moveTo(x, sandY + 2);
      ctx.quadraticCurveTo(
        x + (rnd() - 0.5) * 30,
        sandY - h * 0.6,
        x + (rnd() - 0.5) * 20,
        sandY - h,
      );
      ctx.stroke();
    }

    // Sand bed with a soft rim and depth gradient.
    const sandG = ctx.createLinearGradient(0, sandY, 0, H);
    sandG.addColorStop(0, b.sand);
    sandG.addColorStop(1, b.sandDark);
    ctx.fillStyle = sandG;
    ctx.beginPath();
    ctx.moveTo(0, sandY + 4);
    for (let x = 0; x <= W; x += W / 6) {
      ctx.quadraticCurveTo(x + W / 12, sandY - 3 + rnd() * 6, x + W / 6, sandY + 2 + rnd() * 4);
    }
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(0, sandY + 2, W, 2);

    // Grains and pebbles.
    for (let i = 0; i < 220; i++) {
      const x = rnd() * W;
      const y = sandY + 6 + rnd() ** 0.8 * (H - sandY - 6);
      ctx.fillStyle = rgba(b.pebbles[i % b.pebbles.length], 0.55);
      ctx.fillRect(x, y, 1.2, 1.2);
    }
    for (let i = 0; i < 26; i++) {
      const x = rnd() * W;
      const y = sandY + 8 + rnd() * (H - sandY - 10);
      const r = 1.5 + rnd() * 3 * (y / H);
      ctx.fillStyle = b.pebbles[i % b.pebbles.length];
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.3, r, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.ellipse(x - r * 0.3, y - r * 0.35, r * 0.5, r * 0.3, 0, 0, TAU);
      ctx.fill();
    }
    if (b.leafLitter) {
      for (let i = 0; i < 16; i++) {
        const x = rnd() * W;
        const y = sandY + 6 + rnd() * (H - sandY - 8);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rnd() * TAU);
        ctx.fillStyle = ["#7a4a22", "#9b5f2a", "#5e3a1c"][i % 3];
        ctx.beginPath();
        ctx.ellipse(0, 0, 5 + rnd() * 4, 2 + rnd() * 1.5, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // Animated god rays from the surface.
  function drawRays(ctx, W, H, biomeId, t, light) {
    const b = BIOMES[biomeId];
    const alpha = b.rays * light;
    // Dim rays vanish under the night overlay but still cost a full blend pass.
    if (alpha < 0.01 || light < 0.35) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 5; i++) {
      const x = W * (0.1 + i * 0.21) + Math.sin(t * 0.13 + i * 1.7) * W * 0.04;
      const w = W * (0.05 + 0.03 * Math.sin(t * 0.21 + i));
      const a = alpha * (0.6 + 0.4 * Math.sin(t * 0.3 + i * 2.1));
      const g = ctx.createLinearGradient(0, 0, 0, H * SAND_TOP);
      g.addColorStop(0, `rgba(255,255,240,${a})`);
      g.addColorStop(1, "rgba(255,255,240,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.4, 0);
      ctx.lineTo(x + w * 0.4, 0);
      ctx.lineTo(x + w * 1.6 + W * 0.06, H * SAND_TOP);
      ctx.lineTo(x - w * 0.2 + W * 0.06, H * SAND_TOP);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // Caustic light dancing on the sand.
  function drawCaustics(ctx, W, H, t, light) {
    if (light < 0.05) return;
    const sandY = H * SAND_TOP;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(255,255,230,${0.07 * light})`;
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 12; i++) {
      const x = ((i * 97 + t * 8 * (i % 2 ? 1 : -1)) % (W + 40)) - 20;
      const y = sandY + 8 + ((i * 37) % Math.max(1, H - sandY - 12));
      const r = 6 + (i % 4) * 3 + Math.sin(t + i) * 2;
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.8, r * 0.45, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── Fish definitions ───────────────────────────────────────────────

  /*
   * Generic fish shape parameters (relative to body length L):
   *  len   body length multiplier against the base fish size
   *  top/belly  body height above/below the midline
   *  nose  0 blunt .. 1 pointed
   *  tail  fan | fork | veil | round | double | lunate
   *  dorsal/anal  none | small | tall | long | sail | fringe | double
   *  pattern  see drawPattern
   * pal: three colour variants matching catalog VARIANTS.
   */
  const FISH = {
    guppy: {
      len: 0.66,
      top: 0.16,
      belly: 0.18,
      nose: 0.6,
      tail: "veil",
      tailSize: 0.4,
      dorsal: "flag",
      anal: "small",
      pattern: "tailspots",
      pal: [
        { body: "#b8c6cc", belly: "#eef3f3", fin: "#ff8a3d", accent: "#2f8cff" },
        { body: "#9fbf6c", belly: "#e2efc8", fin: "#e8c63a", accent: "#2e4a26", pattern: "snake" },
        { body: "#f4e8e4", belly: "#ffffff", fin: "#ff5d73", accent: "#ffffff", eye: "#d0283c" },
      ],
    },
    danio: {
      len: 0.56,
      top: 0.11,
      belly: 0.12,
      nose: 0.7,
      tail: "fork",
      tailSize: 0.42,
      dorsal: "small",
      anal: "small",
      pattern: "stripesH",
      pal: [
        { body: "#efe6bd", belly: "#fbf7e6", fin: "#e9dfb0", accent: "#2d58ad" },
        { body: "#efe3b0", belly: "#fbf7e6", fin: "#e9dfb0", accent: "#4b3b26", pattern: "spots" },
        { body: "#ff7ac0", belly: "#ffd6ec", fin: "#ff9ccf", accent: "#c4007a", glow: "#ff7ac0" },
      ],
    },
    platy: {
      len: 0.6,
      top: 0.2,
      belly: 0.2,
      nose: 0.4,
      tail: "fan",
      tailSize: 0.45,
      dorsal: "small",
      anal: "small",
      pattern: "none",
      pal: [
        { body: "#ff6d2e", belly: "#ffb46b", fin: "#ff8f3c", accent: "#d94a1a" },
        { body: "#ffc93c", belly: "#fff0b0", fin: "#ffd56a", accent: "#1b1b1b", pattern: "mickey" },
        { body: "#f4f4f2", belly: "#ffffff", fin: "#26262b", accent: "#26262b", pattern: "panda" },
      ],
    },
    goldfish: {
      len: 0.9,
      top: 0.3,
      belly: 0.3,
      nose: 0.3,
      tail: "double",
      tailSize: 0.5,
      dorsal: "tall",
      anal: "small",
      pattern: "scales",
      pal: [
        { body: "#ff8a1c", belly: "#ffc874", fin: "#ffa640", accent: "#e06a08" },
        {
          body: "#f4efe7",
          belly: "#ffffff",
          fin: "#f7d9c4",
          accent: "#ff7b1c",
          accent2: "#262626",
          pattern: "calico",
        },
        { body: "#2b2c35", belly: "#4a4b57", fin: "#3a3b46", accent: "#1b1c23", eye: "#111" },
      ],
    },
    neon: {
      len: 0.5,
      top: 0.14,
      belly: 0.13,
      nose: 0.6,
      tail: "fork",
      tailSize: 0.38,
      dorsal: "small",
      anal: "small",
      pattern: "neon",
      pal: [
        {
          body: "#6f8196",
          belly: "#e6edf3",
          fin: "#d6e2ec",
          accent: "#22d8ff",
          accent2: "#ff2d4f",
          glow: "#22d8ff",
        },
        {
          body: "#c9b98a",
          belly: "#f2ecd6",
          fin: "#e8dcb6",
          accent: "#ffd23d",
          accent2: "#ff7a2d",
          glow: "#ffd23d",
        },
        {
          body: "#c8d4e0",
          belly: "#f6fbff",
          fin: "#e8f2fa",
          accent: "#e9fdff",
          accent2: "#7fe9ff",
          glow: "#bff6ff",
        },
      ],
    },
    cory: {
      len: 0.6,
      top: 0.24,
      belly: 0.13,
      nose: 0.25,
      tail: "fork",
      tailSize: 0.4,
      dorsal: "tall",
      anal: "small",
      pattern: "spots",
      barbels: true,
      pal: [
        { body: "#b9a487", belly: "#e9dcc4", fin: "#cdbb9c", accent: "#5a4a3a" },
        { body: "#f1ede4", belly: "#ffffff", fin: "#e7e2d8", accent: "#1f1f24", pattern: "panda" },
        { body: "#f5ddcf", belly: "#fff1e8", fin: "#f7e2d6", accent: "#f0c6b4", eye: "#d0283c" },
      ],
    },
    angelfish: {
      len: 0.72,
      top: 0.3,
      belly: 0.3,
      nose: 0.55,
      tail: "fan",
      tailSize: 0.4,
      dorsal: "tall",
      anal: "tall",
      feelers: true,
      pattern: "bars",
      pal: [
        { body: "#e2e5e8", belly: "#f7f8f9", fin: "#d5d9de", accent: "#2b2b31" },
        { body: "#f2f2f2", belly: "#ffffff", fin: "#e3e3e3", accent: "#1f1f24", pattern: "marble" },
        { body: "#ffd56e", belly: "#fff0c4", fin: "#ffe39a", accent: "#ffb733", pattern: "none" },
      ],
    },
    betta: {
      len: 0.66,
      top: 0.17,
      belly: 0.17,
      nose: 0.5,
      tail: "veil",
      tailSize: 0.6,
      dorsal: "small",
      anal: "long",
      pattern: "none",
      pal: [
        { body: "#c41a2e", belly: "#e0414f", fin: "#d81f37", accent: "#5a0b3e" },
        {
          body: "#f6f2ef",
          belly: "#ffffff",
          fin: "#ff7b2e",
          accent: "#262626",
          accent2: "#ff7b2e",
          pattern: "calico",
        },
        { body: "#c7cdd4", belly: "#e8ecf0", fin: "#d31d2a", accent: "#9aa3ad", pattern: "scales" },
      ],
    },
    pleco: {
      len: 0.95,
      top: 0.15,
      belly: 0.09,
      nose: 0.2,
      tail: "fork",
      tailSize: 0.42,
      dorsal: "sail",
      anal: "small",
      pattern: "spots",
      sucker: true,
      pal: [
        { body: "#6b5a3e", belly: "#8a7656", fin: "#5e4f37", accent: "#d9c79a" },
        { body: "#f2d9b8", belly: "#fbecd8", fin: "#ecd0ab", accent: "#fffaf0", eye: "#d0283c" },
        { body: "#f0f0ec", belly: "#ffffff", fin: "#e8e8e4", accent: "#1d1d22", pattern: "zebra" },
      ],
    },
    discus: {
      len: 0.86,
      top: 0.42,
      belly: 0.42,
      nose: 0.25,
      tail: "fan",
      tailSize: 0.3,
      dorsal: "fringe",
      anal: "fringe",
      pattern: "wavy",
      pal: [
        { body: "#c8572c", belly: "#e07a46", fin: "#b5482a", accent: "#3fc7dc" },
        { body: "#f4e9d4", belly: "#fffaf0", fin: "#f0d8b0", accent: "#e0452c", pattern: "pepper" },
        { body: "#2a7ad1", belly: "#5aa3e8", fin: "#2468b5", accent: "#9ae6ff" },
      ],
    },
    chromis: {
      len: 0.5,
      top: 0.19,
      belly: 0.16,
      nose: 0.5,
      tail: "fork",
      tailSize: 0.5,
      dorsal: "small",
      anal: "small",
      pattern: "shimmer",
      pal: [
        { body: "#62dcbc", belly: "#c4fff0", fin: "#8ff0d4", accent: "#bffcff" },
        { body: "#3d8dff", belly: "#a9d0ff", fin: "#69a9ff", accent: "#d4ecff" },
        { body: "#ffd25a", belly: "#fff1bf", fin: "#ffe28a", accent: "#fff8dc" },
      ],
    },
    clownfish: {
      len: 0.58,
      top: 0.21,
      belly: 0.19,
      nose: 0.35,
      tail: "round",
      tailSize: 0.36,
      dorsal: "double",
      anal: "small",
      pattern: "clown",
      pal: [
        {
          body: "#ff7a1a",
          belly: "#ff9a45",
          fin: "#ff8526",
          accent: "#ffffff",
          accent2: "#1a1a1f",
        },
        {
          body: "#ff7a1a",
          belly: "#ff9a45",
          fin: "#ff8526",
          accent: "#ffffff",
          accent2: "#1a1a1f",
          pattern: "snowflake",
        },
        {
          body: "#1d1e26",
          belly: "#2b2c36",
          fin: "#24252e",
          accent: "#f2f2f2",
          accent2: "#ff7a1a",
          pattern: "clown",
        },
      ],
    },
    gramma: {
      len: 0.58,
      top: 0.17,
      belly: 0.16,
      nose: 0.55,
      tail: "fork",
      tailSize: 0.42,
      dorsal: "long",
      anal: "small",
      pattern: "split",
      pal: [
        { body: "#8a3fd1", belly: "#a865e6", fin: "#9b50dd", accent: "#ffd23a" },
        { body: "#ff5f3d", belly: "#ff8a64", fin: "#ff7350", accent: "#ffd23a" },
        { body: "#cdd8e8", belly: "#eef3fa", fin: "#dbe4f0", accent: "#ffffff" },
      ],
    },
    tang: {
      len: 0.95,
      top: 0.32,
      belly: 0.3,
      nose: 0.5,
      tail: "lunate",
      tailSize: 0.42,
      dorsal: "long",
      anal: "long",
      pattern: "tang",
      pal: [
        {
          body: "#1f6fe0",
          belly: "#3d8cf0",
          fin: "#1a5fc4",
          accent: "#101423",
          tailFin: "#ffd400",
        },
        {
          body: "#ffd60a",
          belly: "#ffe45c",
          fin: "#ffcc00",
          accent: "#ffffff",
          pattern: "none",
          tailFin: "#ffd60a",
        },
        {
          body: "#5ab4ff",
          belly: "#8ccaff",
          fin: "#ffd400",
          accent: "#1b2340",
          pattern: "powder",
          tailFin: "#5ab4ff",
        },
      ],
    },
    lantern: {
      len: 0.5,
      top: 0.14,
      belly: 0.15,
      nose: 0.4,
      tail: "fork",
      tailSize: 0.42,
      dorsal: "small",
      anal: "small",
      pattern: "photophores",
      bigEye: true,
      pal: [
        { body: "#5f7aa3", belly: "#9ab0cf", fin: "#7d95ba", accent: "#67e8ff", glow: "#67e8ff" },
        { body: "#8a5f52", belly: "#c19484", fin: "#a77a6a", accent: "#ff9a3d", glow: "#ff9a3d" },
        {
          body: "#5a5f99",
          belly: "#8d92c4",
          fin: "#7378b0",
          accent: "#9dff7a",
          accent2: "#ff7ae8",
          glow: "#b8ffa0",
        },
      ],
    },
    hatchet: {
      len: 0.46,
      top: 0.1,
      belly: 0.42,
      nose: 0.5,
      tail: "fork",
      tailSize: 0.34,
      dorsal: "small",
      anal: "small",
      pattern: "silver",
      bigEye: true,
      pal: [
        { body: "#b8c7d9", belly: "#e6eef7", fin: "#c9d6e6", accent: "#8fdcff", glow: "#8fdcff" },
        { body: "#e5c36a", belly: "#fff0c0", fin: "#efd590", accent: "#ffe9a3", glow: "#ffd76a" },
        { body: "#2c3a57", belly: "#4a5d82", fin: "#3a4b6d", accent: "#4f8bff", glow: "#4f8bff" },
      ],
    },
    angler: {
      len: 1.05,
      top: 0.32,
      belly: 0.34,
      nose: 0.05,
      tail: "round",
      tailSize: 0.32,
      dorsal: "small",
      anal: "small",
      pattern: "spots",
      lure: true,
      teeth: true,
      pal: [
        { body: "#3a2f3f", belly: "#4b3e50", fin: "#332838", accent: "#4f4255", glow: "#9fffe0" },
        { body: "#1a1f3a", belly: "#262c4f", fin: "#161a33", accent: "#2b3260", glow: "#6aa8ff" },
        { body: "#e8e0f0", belly: "#f7f2fb", fin: "#ddd3e8", accent: "#cfc3dc", glow: "#ffd36b" },
      ],
    },
  };

  // Special body types use dedicated drawers but share the palette structure.
  const SPECIAL = {
    snail: {
      len: 0.48,
      pal: [
        { body: "#e8c69a", shell: "#a8662e", accent: "#5e3417" },
        { body: "#f4dfb0", shell: "#f0b62e", accent: "#a87512" },
        { body: "#f1ece4", shell: "#f6f1ea", accent: "#cfc4b4" },
      ],
    },
    shrimp: {
      len: 0.6,
      pal: [
        { body: "#ffd84a", accent: "#e8262e", accent2: "#ffffff" },
        { body: "#e01e2a", accent: "#ff6a5a", accent2: "#ffd0c8" },
        { body: "#e9f4ff", accent: "#bcd8f0", accent2: "#ffffff", ghost: true },
      ],
    },
    isopod: {
      len: 0.72,
      pal: [
        { body: "#cbbba3", accent: "#9e8d75" },
        { body: "#c8576b", accent: "#953d50" },
        { body: "#f2eef7", accent: "#d2c9e0" },
      ],
    },
    moray: {
      len: 3.2,
      pal: [
        { body: "#8c9c34", belly: "#c9c86a", accent: "#4c5a1c" },
        { body: "#f0e6d6", belly: "#ffffff", accent: "#5b3b22", pattern: "bands" },
        { body: "#d5dbe6", belly: "#f3f6fa", accent: "#b6bfcf" },
      ],
    },
    jelly: {
      len: 0.9,
      pal: [
        { body: "#a8c8ff", accent: "#d8e6ff", glow: "#a8c8ff" },
        { body: "#c7a8ff", accent: "#8affd8", accent2: "#ff9ae0", glow: "#c0b0ff" },
        { body: "#ff6a86", accent: "#ffc2cf", glow: "#ff6a86" },
      ],
    },
  };

  function speciesArt(id) {
    return FISH[id] || SPECIAL[id];
  }

  function palette(id, variant) {
    const a = speciesArt(id);
    return a.pal[variant] || a.pal[0];
  }

  // ── Generic fish drawing ───────────────────────────────────────────

  function bodyPath(L, def) {
    const top = def.top * L;
    const bot = def.belly * L;
    const nx = L * 0.5;
    const tx = -L * 0.38;
    const ty = Math.min(top, bot) * 0.32;
    const n = def.nose;
    const p = new Path2D();
    p.moveTo(nx, bot * 0.05);
    p.bezierCurveTo(
      nx - L * (0.05 + 0.1 * (1 - n)),
      -top * (0.6 + 0.4 * (1 - n)),
      L * 0.18,
      -top,
      0,
      -top,
    );
    p.bezierCurveTo(-L * 0.18, -top, -L * 0.3, -ty * 1.4, tx, -ty);
    p.lineTo(tx, ty);
    p.bezierCurveTo(-L * 0.3, ty * 1.4, -L * 0.18, bot, 0, bot);
    p.bezierCurveTo(
      L * 0.2,
      bot,
      nx - L * (0.04 + 0.1 * (1 - n)),
      bot * (0.55 + 0.4 * (1 - n)),
      nx,
      bot * 0.05,
    );
    p.closePath();
    return p;
  }

  function drawPattern(ctx, def, pal, L, seed) {
    const top = def.top * L;
    const bot = def.belly * L;
    const pattern = pal.pattern || def.pattern;
    const rnd = prng(seed);
    const small = L < SMALL_FISH;
    switch (pattern) {
      case "stripesH": {
        ctx.fillStyle = pal.accent;
        for (let i = -1; i <= 2; i++) {
          const y = i * (top + bot) * 0.17;
          const w = small ? L * 0.05 : L * 0.026;
          ctx.fillRect(-L * 0.45, y - w / 2, L * 0.88, w);
        }
        break;
      }
      case "neon": {
        ctx.fillStyle = pal.accent2;
        ctx.beginPath();
        ctx.rect(-L * 0.42, 0, L * 0.45, bot);
        ctx.fill();
        ctx.fillStyle = pal.accent;
        ctx.fillRect(-L * 0.42, -top * 0.28, L * 0.85, top * (small ? 0.4 : 0.3));
        break;
      }
      case "spots": {
        ctx.fillStyle = pal.accent;
        for (let i = 0, n = small ? 7 : 18; i < n; i++) {
          const x = (rnd() - 0.5) * L * 0.85;
          const y = (rnd() - 0.55) * (top + bot);
          ctx.beginPath();
          ctx.arc(x, y, L * ((small ? 0.04 : 0.015) + rnd() * 0.02), 0, TAU);
          ctx.fill();
        }
        break;
      }
      case "snake": {
        ctx.strokeStyle = pal.accent;
        ctx.lineWidth = L * (small ? 0.04 : 0.018);
        for (let i = 0; i < 9; i++) {
          ctx.beginPath();
          ctx.arc(-L * 0.4 + i * L * 0.1, (i % 2 ? 1 : -1) * top * 0.2, L * 0.05, 0, Math.PI * 1.4);
          ctx.stroke();
        }
        break;
      }
      case "tailspots":
        ctx.fillStyle = rgba(pal.accent, 0.6);
        ctx.beginPath();
        ctx.ellipse(-L * 0.22, top * 0.1, L * 0.07, top * 0.35, 0, 0, TAU);
        ctx.fill();
        break;
      case "mickey":
        ctx.fillStyle = pal.accent;
        ctx.beginPath();
        ctx.arc(-L * 0.32, 0, L * 0.06, 0, TAU);
        ctx.arc(-L * 0.36, -L * 0.06, L * 0.035, 0, TAU);
        ctx.arc(-L * 0.36, L * 0.06, L * 0.035, 0, TAU);
        ctx.fill();
        break;
      case "panda":
        ctx.fillStyle = pal.accent;
        ctx.beginPath();
        ctx.ellipse(L * 0.3, -top * 0.15, L * 0.08, top * 0.55, 0.2, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(-L * 0.3, 0, L * 0.09, (top + bot) * 0.35, 0, 0, TAU);
        ctx.fill();
        break;
      case "scales": {
        if (small) break;
        ctx.strokeStyle = rgba(pal.accent, 0.45);
        ctx.lineWidth = Math.max(0.6, L * 0.012);
        const r = L * 0.05;
        for (let x = -L * 0.3; x < L * 0.3; x += r * 1.3) {
          for (let y = -top; y < bot; y += r * 1.2) {
            ctx.beginPath();
            ctx.arc(x + ((y / r) % 2 ? r * 0.6 : 0), y, r, -0.9, 0.9);
            ctx.stroke();
          }
        }
        break;
      }
      case "calico": {
        const colors = [pal.accent, pal.accent2 || pal.accent];
        for (let i = 0; i < 9; i++) {
          ctx.fillStyle = colors[i % 2];
          ctx.beginPath();
          ctx.ellipse(
            (rnd() - 0.5) * L * 0.8,
            (rnd() - 0.5) * (top + bot),
            L * (0.04 + rnd() * 0.07),
            L * (0.03 + rnd() * 0.05),
            rnd() * 3,
            0,
            TAU,
          );
          ctx.fill();
        }
        break;
      }
      case "bars":
        ctx.fillStyle = rgba(pal.accent, 0.85);
        for (const x of [0.22, -0.02, -0.25]) {
          ctx.fillRect(L * x - L * 0.025, -top * 1.4, L * 0.05, (top + bot) * 1.4);
        }
        break;
      case "marble":
        ctx.strokeStyle = pal.accent;
        ctx.lineWidth = L * 0.04;
        ctx.lineCap = "round";
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo((rnd() - 0.5) * L, (rnd() - 0.5) * top * 2);
          ctx.bezierCurveTo(
            (rnd() - 0.5) * L,
            (rnd() - 0.5) * top * 2,
            (rnd() - 0.5) * L,
            (rnd() - 0.5) * top * 2,
            (rnd() - 0.5) * L,
            (rnd() - 0.5) * top * 2,
          );
          ctx.stroke();
        }
        break;
      case "zebra":
        ctx.fillStyle = pal.accent;
        for (let i = 0; i < 7; i++) {
          const x = -L * 0.38 + i * L * 0.13;
          ctx.beginPath();
          ctx.moveTo(x, -top * 1.2);
          ctx.lineTo(x + L * 0.05, -top * 1.2);
          ctx.lineTo(x + L * 0.09, bot * 1.2);
          ctx.lineTo(x + L * 0.04, bot * 1.2);
          ctx.fill();
        }
        break;
      case "wavy":
        ctx.strokeStyle = pal.accent;
        ctx.lineWidth = L * 0.022;
        for (let i = -3; i <= 3; i++) {
          ctx.beginPath();
          for (let x = -L * 0.4; x <= L * 0.42; x += L * 0.04) {
            const y = i * top * 0.24 + Math.sin(x / (L * 0.06) + i) * L * 0.015;
            if (x === -L * 0.4) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        break;
      case "pepper":
        ctx.fillStyle = pal.accent;
        for (let i = 0, n = small ? 14 : 60, d = small ? 0.045 : 0.018; i < n; i++) {
          ctx.fillRect((rnd() - 0.5) * L * 0.9, (rnd() - 0.5) * (top + bot), L * d, L * d);
        }
        break;
      case "shimmer": {
        const g = ctx.createLinearGradient(-L / 2, -top, L / 2, bot);
        g.addColorStop(0, rgba(pal.accent, 0));
        g.addColorStop(0.5, rgba(pal.accent, 0.5));
        g.addColorStop(1, rgba(pal.accent, 0));
        ctx.fillStyle = g;
        ctx.fillRect(-L / 2, -top, L, top + bot);
        break;
      }
      case "clown":
      case "snowflake": {
        const xs = [0.27, 0.0, -0.3];
        ctx.lineWidth = L * 0.022;
        xs.forEach((x, i) => {
          const w = L * (i === 2 ? 0.05 : 0.08);
          ctx.fillStyle = pal.accent;
          ctx.strokeStyle = pal.accent2;
          ctx.beginPath();
          if (pattern === "snowflake") {
            ctx.ellipse(
              L * x,
              (rnd() - 0.5) * top * 0.4,
              w * (1.2 + rnd() * 0.8),
              top * 1.3,
              (rnd() - 0.5) * 0.6,
              0,
              TAU,
            );
          } else {
            ctx.ellipse(L * x, 0, w, top * 1.3, 0, 0, TAU);
          }
          ctx.fill();
          ctx.stroke();
        });
        if (pal.body === "#1d1e26") {
          ctx.fillStyle = pal.accent2;
          ctx.beginPath();
          ctx.ellipse(L * 0.45, 0, L * 0.12, top, 0, 0, TAU);
          ctx.fill();
        }
        break;
      }
      case "split": {
        const g = ctx.createLinearGradient(L * 0.1, 0, -L * 0.15, 0);
        g.addColorStop(0, rgba(pal.accent, 0));
        g.addColorStop(1, pal.accent);
        ctx.fillStyle = g;
        ctx.fillRect(-L * 0.5, -top * 1.2, L * 0.62, (top + bot) * 1.3);
        break;
      }
      case "tang":
        ctx.fillStyle = pal.accent;
        ctx.beginPath();
        ctx.moveTo(L * 0.28, -top * 0.55);
        ctx.bezierCurveTo(L * 0.05, -top * 0.95, -L * 0.25, -top * 0.5, -L * 0.36, -top * 0.05);
        ctx.bezierCurveTo(-L * 0.2, -top * 0.2, -L * 0.05, top * 0.15, L * 0.1, top * 0.05);
        ctx.bezierCurveTo(-L * 0.05, -top * 0.3, L * 0.15, -top * 0.3, L * 0.28, -top * 0.55);
        ctx.fill();
        break;
      case "powder":
        ctx.fillStyle = pal.accent;
        ctx.beginPath();
        ctx.ellipse(L * 0.42, 0, L * 0.1, top * 0.9, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(L * 0.38, bot * 0.55, L * 0.08, bot * 0.35, 0, 0, TAU);
        ctx.fill();
        break;
      case "photophores":
        ctx.fillStyle = pal.accent;
        for (let i = 0, n = small ? 5 : 8; i < n; i++) {
          ctx.beginPath();
          ctx.arc(L * 0.3 - i * L * (0.72 / n), bot * 0.6, L * (small ? 0.04 : 0.026), 0, TAU);
          ctx.fill();
        }
        break;
      case "silver": {
        const g = ctx.createLinearGradient(0, -top, 0, bot);
        g.addColorStop(0, "rgba(255,255,255,0)");
        g.addColorStop(0.5, "rgba(255,255,255,0.45)");
        g.addColorStop(1, "rgba(255,255,255,0.1)");
        ctx.fillStyle = g;
        ctx.fillRect(-L / 2, -top, L, top + bot);
        ctx.fillStyle = pal.accent;
        for (let i = 0; i < 6; i++) {
          ctx.beginPath();
          ctx.arc(L * 0.2 - i * L * 0.08, bot * 0.75, L * 0.02, 0, TAU);
          ctx.fill();
        }
        break;
      }
      default:
        break;
    }
  }

  // Pre-rendered static body (shape, gradient, pattern, eye) for one species/variant/size.
  const spriteCache = new Map();

  function bodySprite(id, variant, L, dpr) {
    const key = `${id}|${variant}|${Math.round(L * 2)}|${dpr}`;
    let sprite = spriteCache.get(key);
    if (sprite) return sprite;
    const def = FISH[id];
    const pal = def.pal[variant] || def.pal[0];
    const top = def.top * L;
    const bot = def.belly * L;
    const pad = Math.ceil(L * 0.1) + 2;
    const w = Math.ceil(L + pad * 2);
    const h = Math.ceil(top + bot + pad * 2);
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(w * dpr);
    canvas.height = Math.ceil(h * dpr);
    const c = canvas.getContext("2d");
    c.scale(dpr, dpr);
    c.translate(pad + L / 2, pad + top);
    const body = bodyPath(L, def);
    const g = c.createLinearGradient(0, -top, 0, bot);
    g.addColorStop(0, shade(pal.body, -0.18));
    g.addColorStop(0.45, pal.body);
    g.addColorStop(1, pal.belly);
    c.fillStyle = g;
    c.fill(body);
    c.save();
    c.clip(body);
    drawPattern(c, def, pal, L, strSeed(id + variant));
    // Soft top highlight and bottom shadow give the body volume.
    const hl = c.createRadialGradient(L * 0.1, -top * 0.45, 0, L * 0.1, -top * 0.45, L * 0.45);
    hl.addColorStop(0, "rgba(255,255,255,0.35)");
    hl.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = hl;
    c.fillRect(-L / 2, -top, L, top + bot);
    const sh = c.createLinearGradient(0, 0, 0, bot);
    sh.addColorStop(0.6, "rgba(0,0,0,0)");
    sh.addColorStop(1, "rgba(0,0,0,0.18)");
    c.fillStyle = sh;
    c.fillRect(-L / 2, 0, L, bot);
    c.restore();
    c.lineWidth = inkWidth(L);
    c.strokeStyle = ink(pal.body);
    c.stroke(body);

    // Gill line.
    c.strokeStyle = rgba(shade(pal.body, -0.4), 0.35);
    c.lineWidth = Math.max(0.5, L * 0.012);
    c.beginPath();
    c.arc(L * 0.22, 0, Math.min(top, bot) * 0.75, -1.1, 1.1);
    c.stroke();

    if (def.teeth) {
      c.fillStyle = "#1a0d14";
      c.beginPath();
      c.moveTo(L * 0.5, -top * 0.1);
      c.lineTo(L * 0.2, bot * 0.25);
      c.lineTo(L * 0.48, bot * 0.5);
      c.closePath();
      c.fill();
      c.fillStyle = "#f4f0e6";
      for (let i = 0; i < 5; i++) {
        const x = L * (0.46 - i * 0.05);
        c.beginPath();
        c.moveTo(x, -top * 0.06 + i * bot * 0.05);
        c.lineTo(x - L * 0.015, bot * 0.12 + i * bot * 0.05);
        c.lineTo(x - L * 0.03, -top * 0.04 + i * bot * 0.05);
        c.fill();
      }
    }

    // Eye.
    const eyeR = Math.max(artPx * 0.8, L * (def.bigEye ? 0.07 : 0.045));
    const ex = L * (def.teeth ? 0.25 : 0.33);
    const ey = -top * 0.28;
    // A real fish eye: a thin metallic iris around a large dark pupil, with one glint.
    c.fillStyle = pal.eye ? shade(pal.eye, 0.4) : "#c9b57a";
    c.beginPath();
    c.arc(ex, ey, eyeR, 0, TAU);
    c.fill();
    c.fillStyle = pal.eye || "#101014";
    c.beginPath();
    c.arc(ex + eyeR * 0.1, ey, eyeR * 0.72, 0, TAU);
    c.fill();
    c.fillStyle = "rgba(255,255,255,0.85)";
    c.fillRect(ex + eyeR * 0.15, ey - eyeR * 0.55, artPx, artPx);

    if (def.barbels || def.sucker) {
      c.strokeStyle = rgba(shade(pal.body, -0.3), 0.8);
      c.lineWidth = Math.max(0.5, L * 0.012);
      c.beginPath();
      c.moveTo(L * 0.47, bot * 0.2);
      c.quadraticCurveTo(L * 0.55, bot * 0.5, L * 0.5, bot * 0.75);
      c.stroke();
    }

    sprite = { canvas, w, h, ox: pad + L / 2, oy: pad + top };
    if (spriteCache.size > 300) spriteCache.clear();
    spriteCache.set(key, sprite);
    return sprite;
  }

  function finPath(ctx, kind, L, top, bot, wave, upper) {
    const s = upper ? -1 : 1;
    const base = upper ? top : bot;
    ctx.beginPath();
    switch (kind) {
      case "small":
        ctx.moveTo(L * 0.12, s * base * 0.9);
        ctx.quadraticCurveTo(
          -L * 0.02,
          s * (base + L * 0.1),
          -L * 0.14 + wave,
          s * (base + L * 0.06),
        );
        ctx.lineTo(-L * 0.12, s * base * 0.8);
        break;
      case "flag":
        ctx.moveTo(L * 0.05, s * base * 0.9);
        ctx.quadraticCurveTo(
          -L * 0.12,
          s * (base + L * 0.16),
          -L * 0.3 + wave,
          s * (base + L * 0.1),
        );
        ctx.lineTo(-L * 0.2, s * base * 0.6);
        break;
      case "tall":
        ctx.moveTo(L * 0.16, s * base * 0.9);
        ctx.bezierCurveTo(
          L * 0.05,
          s * (base + L * 0.18),
          -L * 0.1,
          s * (base + L * 0.32),
          -L * 0.26 + wave,
          s * (base + L * 0.34),
        );
        ctx.quadraticCurveTo(-L * 0.15, s * (base + L * 0.1), -L * 0.18, s * base * 0.7);
        break;
      case "long":
        ctx.moveTo(L * 0.15, s * base * 0.9);
        ctx.bezierCurveTo(
          -L * 0.05,
          s * (base + L * 0.22),
          -L * 0.28,
          s * (base + L * 0.18),
          -L * 0.36 + wave * 1.4,
          s * (base + L * 0.1),
        );
        ctx.quadraticCurveTo(-L * 0.3, s * base * 0.8, -L * 0.24, s * base * 0.5);
        break;
      case "sail":
        ctx.moveTo(L * 0.25, s * base * 0.9);
        ctx.quadraticCurveTo(
          L * 0.15,
          s * (base + L * 0.3),
          -L * 0.15 + wave,
          s * (base + L * 0.18),
        );
        ctx.lineTo(-L * 0.1, s * base * 0.8);
        break;
      case "fringe":
        ctx.moveTo(L * 0.35, s * base * 0.55);
        ctx.quadraticCurveTo(0, s * (base + L * 0.14), -L * 0.38 + wave, s * base * 0.3);
        ctx.lineTo(-L * 0.3, s * base * 0.4);
        ctx.quadraticCurveTo(0, s * base * 1.02, L * 0.3, s * base * 0.6);
        break;
      case "double":
        ctx.moveTo(L * 0.18, s * base * 0.9);
        ctx.lineTo(L * 0.05, s * (base + L * 0.1));
        ctx.lineTo(-L * 0.02, s * base * 0.9);
        ctx.quadraticCurveTo(-L * 0.12, s * (base + L * 0.12), -L * 0.24 + wave, s * base * 0.7);
        break;
      default:
        return false;
    }
    ctx.closePath();
    return true;
  }

  function drawTail(ctx, kind, size, top, pal, wave, L) {
    const T = L * size;
    const fin = pal.tailFin || pal.fin;
    ctx.fillStyle = rgba(fin, 0.8);
    ctx.strokeStyle = ink(fin);
    ctx.lineWidth = inkWidth(L);
    ctx.beginPath();
    const h = Math.max(top * 0.9, T * 0.55);
    switch (kind) {
      case "fork":
        ctx.moveTo(0, -top * 0.25);
        ctx.quadraticCurveTo(-T * 0.5, -h * 0.5, -T, -h + wave);
        ctx.quadraticCurveTo(-T * 0.55, 0, -T, h + wave);
        ctx.quadraticCurveTo(-T * 0.5, h * 0.5, 0, top * 0.25);
        break;
      case "lunate":
        ctx.moveTo(0, -top * 0.25);
        ctx.quadraticCurveTo(-T * 0.6, -h * 0.4, -T, -h * 1.1 + wave);
        ctx.quadraticCurveTo(-T * 0.45, 0, -T, h * 1.1 + wave);
        ctx.quadraticCurveTo(-T * 0.6, h * 0.4, 0, top * 0.25);
        break;
      case "round":
        ctx.moveTo(0, -top * 0.3);
        ctx.bezierCurveTo(-T * 0.6, -h * 0.9, -T * 1.2, -h * 0.4 + wave, -T * 1.1, wave);
        ctx.bezierCurveTo(-T * 1.2, h * 0.4 + wave, -T * 0.6, h * 0.9, 0, top * 0.3);
        break;
      case "veil":
        ctx.moveTo(0, -top * 0.3);
        ctx.bezierCurveTo(
          -T * 0.4,
          -h * 0.9,
          -T * 0.9,
          -h * 1.0 + wave,
          -T * 1.05,
          -h * 0.6 + wave * 1.6,
        );
        ctx.quadraticCurveTo(-T * 1.15, wave * 2, -T * 1.05, h * 0.6 + wave * 1.6);
        ctx.bezierCurveTo(-T * 0.9, h * 1.0 + wave, -T * 0.4, h * 0.9, 0, top * 0.3);
        break;
      case "double":
        ctx.moveTo(0, -top * 0.25);
        ctx.bezierCurveTo(-T * 0.5, -h * 1.1, -T * 1.1, -h * 0.9 + wave, -T, -h * 0.15 + wave);
        ctx.quadraticCurveTo(-T * 0.7, wave * 0.5, -T * 0.95, h * 0.2 + wave);
        ctx.bezierCurveTo(-T * 1.1, h * 0.95 + wave, -T * 0.5, h * 1.1, 0, top * 0.25);
        break;
      default:
        ctx.moveTo(0, -top * 0.3);
        ctx.quadraticCurveTo(-T * 0.7, -h, -T, -h * 0.8 + wave);
        ctx.quadraticCurveTo(-T * 0.85, wave, -T, h * 0.8 + wave);
        ctx.quadraticCurveTo(-T * 0.7, h, 0, top * 0.3);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Fin rays.
    ctx.strokeStyle = rgba(shade(fin, -0.3), 0.6);
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * top * 0.1);
      ctx.lineTo(-T * 0.85, i * h * 0.32 + wave);
      ctx.stroke();
    }
  }

  /*
   * Draw a fish of length L centred at the origin, facing +x.
   * o.phase drives tail and fin motion, o.effort 0..1 scales the beat amplitude.
   */
  function drawFish(ctx, id, variant, L, o) {
    if (SPECIAL[id]) return SPECIAL_DRAW[id](ctx, variant, L, o);
    const def = FISH[id];
    const pal = def.pal[variant] || def.pal[0];
    const top = def.top * L;
    const bot = def.belly * L;
    const wave = Math.sin(o.phase) * L * (0.035 + 0.05 * o.effort);
    const finWave = Math.sin(o.phase * 0.7 + 1) * L * 0.03;
    ctx.save();
    ctx.rotate(Math.sin(o.phase) * 0.03 * (0.5 + o.effort));
    // Dorsal and anal fins sit behind the body.
    ctx.fillStyle = rgba(pal.fin, 0.8);
    ctx.strokeStyle = ink(pal.fin);
    ctx.lineWidth = inkWidth(L);
    if (finPath(ctx, def.dorsal, L, top, bot, finWave, true)) {
      ctx.fill();
      ctx.stroke();
    }
    if (finPath(ctx, def.anal, L, top, bot, finWave, false)) {
      ctx.fill();
      ctx.stroke();
    }
    if (def.feelers) {
      ctx.strokeStyle = rgba(pal.fin, 0.9);
      ctx.lineWidth = Math.max(0.6, L * 0.015);
      ctx.beginPath();
      ctx.moveTo(L * 0.12, bot * 0.8);
      ctx.quadraticCurveTo(L * 0.02, bot + L * 0.3, -L * 0.1 + finWave, bot + L * 0.55);
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(-L * 0.33, 0);
    ctx.rotate(Math.sin(o.phase) * (0.2 + 0.25 * o.effort));
    drawTail(ctx, def.tail, def.tailSize, Math.min(top, bot), pal, wave * 0.6, L);
    ctx.restore();

    const sprite = bodySprite(id, variant, L, o.dpr || 1);
    ctx.drawImage(sprite.canvas, -sprite.ox, -sprite.oy, sprite.w, sprite.h);

    // Pectoral fin flutters in front of the body.
    ctx.fillStyle = rgba(shade(pal.fin, 0.15), 0.6);
    ctx.save();
    ctx.translate(L * 0.16, bot * 0.25);
    ctx.rotate(0.6 + Math.sin(o.phase * 1.6) * 0.35);
    ctx.beginPath();
    ctx.ellipse(-L * 0.06, 0, L * 0.08, L * 0.03, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    if (def.lure) {
      const lx = L * 0.55 + Math.sin(o.phase * 0.3) * L * 0.04;
      const ly = -top - L * 0.25;
      ctx.strokeStyle = rgba(pal.fin, 0.9);
      ctx.lineWidth = Math.max(0.8, L * 0.02);
      ctx.beginPath();
      ctx.moveTo(L * 0.2, -top * 0.95);
      ctx.quadraticCurveTo(L * 0.45, -top - L * 0.35, lx, ly);
      ctx.stroke();
      ctx.fillStyle = pal.glow;
      ctx.beginPath();
      ctx.arc(lx, ly, L * 0.045, 0, TAU);
      ctx.fill();
    }
    if (o.mouth > 0) {
      ctx.fillStyle = "rgba(20,10,20,0.7)";
      ctx.beginPath();
      ctx.ellipse(L * 0.49, bot * 0.08, L * 0.02 * o.mouth, L * 0.03 * o.mouth, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // Additive glow pass for bioluminescent species (drawn after the night overlay).
  function drawFishGlow(ctx, id, variant, L, o) {
    const pal = palette(id, variant);
    if (!pal.glow) return;
    const def = speciesArt(id);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const pulse = 0.65 + 0.35 * Math.sin(o.phase * 0.25);
    const glowAt = (x, y, r, a) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(pal.glow, a * pulse));
      g.addColorStop(1, rgba(pal.glow, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    if (def.lure) glowAt(L * 0.55, -def.top * L - L * 0.25, L * 0.3, 0.9);
    else if (id === "jelly") glowAt(0, -L * 0.1, L * 0.7, 0.35);
    else if (def.pattern === "photophores" || def.pattern === "silver") {
      for (let i = 0; i < 4; i++)
        glowAt(L * 0.25 - i * L * 0.16, def.belly * L * 0.65, L * 0.14, 0.55);
    } else glowAt(0, 0, L * 0.7, 0.28);
    ctx.restore();
  }

  // ── Special bodies ─────────────────────────────────────────────────

  const SPECIAL_DRAW = {
    snail(ctx, variant, L, o) {
      const pal = SPECIAL.snail.pal[variant];
      const stretch = 1 + Math.sin(o.phase * 0.5) * 0.05 * o.effort;
      // Foot.
      ctx.fillStyle = pal.body;
      ctx.beginPath();
      ctx.moveTo(-L * 0.45, 0);
      ctx.quadraticCurveTo(-L * 0.4, -L * 0.2, L * 0.2 * stretch, -L * 0.18);
      ctx.quadraticCurveTo(L * 0.55 * stretch, -L * 0.18, L * 0.55 * stretch, 0);
      ctx.closePath();
      ctx.fill();
      // Eye stalks.
      ctx.strokeStyle = pal.body;
      ctx.lineWidth = L * 0.05;
      ctx.lineCap = "round";
      const wob = Math.sin(o.phase * 0.4) * L * 0.04;
      for (const dx of [0.42, 0.5]) {
        ctx.beginPath();
        ctx.moveTo(L * dx * stretch, -L * 0.12);
        ctx.lineTo(L * (dx + 0.1) * stretch + wob, -L * 0.42);
        ctx.stroke();
        ctx.fillStyle = "#1b1b1f";
        ctx.beginPath();
        ctx.arc(L * (dx + 0.1) * stretch + wob, -L * 0.42, L * 0.035, 0, TAU);
        ctx.fill();
      }
      // Shell spiral.
      const sx = -L * 0.08;
      const sy = -L * 0.42;
      const sg = ctx.createRadialGradient(sx - L * 0.1, sy - L * 0.1, L * 0.05, sx, sy, L * 0.38);
      sg.addColorStop(0, shade(pal.shell, 0.35));
      sg.addColorStop(1, pal.shell);
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(sx, sy, L * 0.36, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = L * 0.035;
      ctx.beginPath();
      for (let a = 0; a < TAU * 2.2; a += 0.2) {
        const r = L * 0.3 * (1 - a / (TAU * 2.5));
        const x = sx + Math.cos(a) * r;
        const y = sy + Math.sin(a) * r;
        if (a === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    },

    shrimp(ctx, variant, L, o) {
      const pal = SPECIAL.shrimp.pal[variant];
      ctx.globalAlpha *= pal.ghost ? 0.55 : 1;
      // Legs.
      ctx.strokeStyle = rgba(pal.accent2, 0.85);
      ctx.lineWidth = Math.max(0.6, L * 0.025);
      for (let i = 0; i < 5; i++) {
        const x = L * (0.2 - i * 0.1);
        const k = Math.sin(o.phase * 2 + i) * L * 0.04 * o.effort;
        ctx.beginPath();
        ctx.moveTo(x, -L * 0.1);
        ctx.lineTo(x + k, L * 0.02);
        ctx.stroke();
      }
      // Antennae.
      ctx.strokeStyle = rgba(pal.accent2, 0.9);
      ctx.lineWidth = Math.max(0.5, L * 0.012);
      for (const k of [1, 0.6]) {
        ctx.beginPath();
        ctx.moveTo(L * 0.4, -L * 0.2);
        ctx.bezierCurveTo(
          L * 0.8,
          -L * 0.6 * k,
          L * 1.0,
          -L * 0.3 * k + Math.sin(o.phase) * L * 0.08,
          L * 1.2,
          -L * 0.5 * k,
        );
        ctx.stroke();
      }
      // Curved segmented body, arched like a real cleaner shrimp.
      ctx.fillStyle = pal.body;
      ctx.beginPath();
      ctx.moveTo(L * 0.48, -L * 0.2);
      ctx.quadraticCurveTo(L * 0.2, -L * 0.56, -L * 0.25, -L * 0.42);
      ctx.quadraticCurveTo(-L * 0.52, -L * 0.32, -L * 0.58, -L * 0.1);
      ctx.lineTo(-L * 0.38, -L * 0.06);
      ctx.quadraticCurveTo(0, L * 0.02, L * 0.48, -L * 0.08);
      ctx.fill();
      // Segment lines.
      ctx.strokeStyle = rgba(shade(pal.body, -0.35), 0.8);
      ctx.lineWidth = Math.max(artPx, L * 0.025);
      for (let i = 0; i < 4; i++) {
        const x = -L * (0.36 - i * 0.12);
        ctx.beginPath();
        ctx.moveTo(x, -L * (0.42 - Math.abs(i - 1.5) * 0.03));
        ctx.lineTo(x + L * 0.02, -L * 0.05);
        ctx.stroke();
      }
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = L * 0.1;
      ctx.beginPath();
      ctx.moveTo(L * 0.42, -L * 0.3);
      ctx.quadraticCurveTo(L * 0.12, -L * 0.52, -L * 0.42, -L * 0.33);
      ctx.stroke();
      ctx.strokeStyle = pal.accent2;
      ctx.lineWidth = Math.max(artPx, L * 0.03);
      ctx.stroke();
      // Tail fan.
      ctx.fillStyle = pal.accent;
      ctx.beginPath();
      ctx.moveTo(-L * 0.5, -L * 0.1);
      ctx.lineTo(-L * 0.68, -L * 0.2);
      ctx.lineTo(-L * 0.66, 0.0);
      ctx.fill();
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.arc(L * 0.4, -L * 0.26, L * 0.05, 0, TAU);
      ctx.fill();
    },

    isopod(ctx, variant, L, o) {
      const pal = SPECIAL.isopod.pal[variant];
      ctx.strokeStyle = shade(pal.accent, -0.3);
      ctx.lineWidth = Math.max(0.7, L * 0.025);
      for (let i = 0; i < 7; i++) {
        const x = L * (0.3 - i * 0.1);
        const k = Math.sin(o.phase * 2 + i * 0.8) * L * 0.03 * o.effort;
        ctx.beginPath();
        ctx.moveTo(x, -L * 0.06);
        ctx.lineTo(x + k, L * 0.02);
        ctx.stroke();
      }
      const g = ctx.createLinearGradient(0, -L * 0.35, 0, 0);
      g.addColorStop(0, shade(pal.body, 0.2));
      g.addColorStop(1, pal.accent);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-L * 0.5, -L * 0.04);
      ctx.bezierCurveTo(-L * 0.45, -L * 0.42, L * 0.4, -L * 0.42, L * 0.5, -L * 0.06);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rgba(shade(pal.accent, -0.4), 0.6);
      ctx.lineWidth = Math.max(0.6, L * 0.015);
      for (let i = 1; i < 8; i++) {
        const x = -L * 0.5 + i * L * 0.125;
        ctx.beginPath();
        ctx.moveTo(x, -L * 0.05);
        ctx.quadraticCurveTo(x + L * 0.02, -L * 0.25, x, -L * 0.33 * Math.sin((i / 8) * Math.PI));
        ctx.stroke();
      }
      ctx.strokeStyle = shade(pal.accent, -0.2);
      ctx.beginPath();
      ctx.moveTo(L * 0.48, -L * 0.1);
      ctx.quadraticCurveTo(L * 0.7, -L * 0.3, L * 0.8, -L * 0.2 + Math.sin(o.phase) * L * 0.03);
      ctx.stroke();
      ctx.fillStyle = "#101014";
      ctx.beginPath();
      ctx.arc(L * 0.4, -L * 0.15, L * 0.03, 0, TAU);
      ctx.fill();
    },

    jelly(ctx, variant, L, o) {
      const pal = SPECIAL.jelly.pal[variant];
      const pulse = Math.sin(o.phase * 0.5);
      const bw = L * (0.42 + pulse * 0.06);
      const bh = L * (0.34 - pulse * 0.05);
      // Tentacles trail below the bell.
      ctx.strokeStyle = rgba(pal.accent, 0.55);
      ctx.lineWidth = Math.max(0.6, L * 0.015);
      for (let i = 0; i < 7; i++) {
        const x0 = -bw * 0.8 + (i / 6) * bw * 1.6;
        ctx.beginPath();
        ctx.moveTo(x0, 0);
        for (let k = 1; k <= 6; k++) {
          ctx.lineTo(x0 + Math.sin(o.phase * 0.6 + k * 0.8 + i) * L * 0.06, k * L * 0.14);
        }
        ctx.stroke();
      }
      // Oral arms.
      ctx.strokeStyle = rgba(pal.accent2 || pal.accent, 0.7);
      ctx.lineWidth = Math.max(1, L * 0.04);
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * bw * 0.15, 0);
        ctx.bezierCurveTo(
          s * bw * 0.3,
          L * 0.25,
          -s * bw * 0.2,
          L * 0.4,
          s * bw * 0.1 + Math.sin(o.phase * 0.4) * L * 0.05,
          L * 0.6,
        );
        ctx.stroke();
      }
      const g = ctx.createRadialGradient(0, -bh * 0.4, 0, 0, -bh * 0.2, bw * 1.1);
      g.addColorStop(0, rgba("#ffffff", 0.75));
      g.addColorStop(0.5, rgba(pal.body, 0.5));
      g.addColorStop(1, rgba(pal.body, 0.15));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-bw, 0);
      ctx.bezierCurveTo(-bw, -bh * 1.3, bw, -bh * 1.3, bw, 0);
      ctx.quadraticCurveTo(0, -bh * 0.2, -bw, 0);
      ctx.fill();
      ctx.strokeStyle = rgba(pal.body, 0.8);
      ctx.lineWidth = Math.max(0.6, L * 0.015);
      ctx.stroke();
      ctx.strokeStyle = rgba(pal.accent, 0.6);
      ctx.beginPath();
      for (let i = 0; i < 4; i++)
        ctx.ellipse(0, -bh * 0.35, bw * 0.2, bh * 0.16, (i / 4) * Math.PI, 0, TAU);
      ctx.stroke();
    },
  };

  /*
   * Moray eel: a tapered ribbon along a list of spine points (head first).
   * Points come from the eel's movement trail so the body follows the head's path.
   */
  function drawEel(ctx, variant, pts, W, o) {
    const pal = SPECIAL.moray.pal[variant];
    if (pts.length < 2) return;
    const left = [];
    const right = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const k = i / ((o.total || pts.length) - 1);
      const w = W * (k < 0.15 ? 0.75 + k * 1.6 : 1 - (k - 0.15) * 0.95);
      left.push([pts[i].x + nx * w, pts[i].y + ny * w]);
      right.push([pts[i].x - nx * w, pts[i].y - ny * w]);
    }
    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    for (let i = 1; i < left.length; i++) ctx.lineTo(left[i][0], left[i][1]);
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    const head = pts[0];
    const tail = pts[pts.length - 1];
    const g = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y);
    g.addColorStop(0, shade(pal.body, 0.08));
    g.addColorStop(1, shade(pal.body, -0.15));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = rgba(shade(pal.body, -0.5), 0.5);
    ctx.lineWidth = 1;
    ctx.stroke();
    // Mottling or bands along the spine.
    ctx.fillStyle = rgba(pal.accent, 0.55);
    for (let i = 2; i < pts.length - 1; i += pal.pattern === "bands" ? 2 : 1) {
      const p = pts[i];
      const r = W * 0.45 * (1 - i / pts.length);
      ctx.beginPath();
      if (pal.pattern === "bands")
        ctx.ellipse(
          p.x,
          p.y,
          r * 0.5,
          r * 1.6,
          Math.atan2(pts[i - 1].y - p.y, pts[i - 1].x - p.x),
          0,
          TAU,
        );
      else
        ctx.ellipse(p.x + ((i * 7) % 5) - 2, p.y + ((i * 3) % 3) - 1, r * 0.6, r * 0.45, i, 0, TAU);
      ctx.fill();
    }
    // Dorsal ridge.
    ctx.strokeStyle = rgba(shade(pal.body, 0.25), 0.6);
    ctx.lineWidth = Math.max(1, W * 0.25);
    ctx.beginPath();
    for (let i = 2; i < left.length; i++) {
      const p = left[i];
      if (i === 2) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke();
    // Head: eye and the slowly opening jaw morays are known for.
    const n = pts[1];
    const ang = Math.atan2(head.y - n.y, head.x - n.x);
    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.rotate(ang);
    const jaw = 0.5 + 0.5 * Math.sin(o.phase * 0.35);
    // Rounded snout so the head doesn't end in a flat cut.
    ctx.fillStyle = shade(pal.body, 0.08);
    ctx.beginPath();
    ctx.ellipse(W * 0.15, 0, W * 1.05, W * 0.78, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba(shade(pal.body, -0.5), 0.5);
    ctx.lineWidth = 1;
    ctx.stroke();
    // Gill slit.
    ctx.strokeStyle = rgba(shade(pal.body, -0.45), 0.7);
    ctx.lineWidth = Math.max(1, W * 0.12);
    ctx.beginPath();
    ctx.arc(-W * 0.85, 0, W * 0.45, -0.9, 0.9);
    ctx.stroke();
    ctx.fillStyle = "#2a0f12";
    ctx.beginPath();
    ctx.moveTo(W * 0.9, 0);
    ctx.lineTo(-W * 0.4, W * 0.15);
    ctx.lineTo(W * 0.8, W * (0.25 + jaw * 0.45));
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff8e0";
    ctx.beginPath();
    ctx.arc(-W * 0.05, -W * 0.38, W * 0.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#151515";
    ctx.beginPath();
    ctx.arc(-W * 0.02, -W * 0.38, W * 0.12, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // ── Decor ──────────────────────────────────────────────────────────

  /*
   * Each decor item draws at anchor (x, y = its base on the sand) with scale s
   * (s = 1 at a 360 px tall tank). Items with a cave opening return a `hole` ellipse and
   * an `outline` Path2D so fish can be drawn "inside" them (see Scene).
   * Layered items (anemone, rock cave) split into back and front passes.
   */

  function sway(t, x, amt) {
    return Math.sin(t * 0.9 + x * 0.05) * amt;
  }

  function leafBlade(ctx, x, y, h, w, bend, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y);
    ctx.quadraticCurveTo(x - w * 0.6 + bend * 0.5, y - h * 0.55, x + bend, y - h);
    ctx.quadraticCurveTo(x + w * 0.6 + bend * 0.5, y - h * 0.55, x + w / 2, y);
    ctx.closePath();
    ctx.fill();
  }

  function leaf(ctx, x, y, len, wid, ang, color, vein) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.5, -wid, len, 0);
    ctx.quadraticCurveTo(len * 0.5, wid, 0, 0);
    ctx.fill();
    if (vein) {
      ctx.strokeStyle = vein;
      ctx.lineWidth = Math.max(0.5, wid * 0.12);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(len * 0.9, 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  // A small flower: round petals around a contrasting centre.
  function flower(ctx, x, y, r, petal, centre, petals) {
    if (r <= 0) return;
    ctx.fillStyle = petal;
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * TAU - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7, r * 0.6, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = centre;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.38, 0, TAU);
    ctx.fill();
  }

  function rockBlob(ctx, x, y, rx, ry, color, seed) {
    const rnd = prng(seed);
    const g = ctx.createLinearGradient(x, y - ry, x, y + ry);
    g.addColorStop(0, shade(color, 0.18));
    g.addColorStop(1, shade(color, -0.25));
    ctx.fillStyle = g;
    ctx.beginPath();
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const a = Math.PI + (i / n) * Math.PI;
      const r = 0.85 + rnd() * 0.25;
      const px = x + Math.cos(a) * rx * r;
      const py = y + Math.sin(a) * ry * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.ellipse(x - rx * 0.25, y - ry * 0.6, rx * 0.35, ry * 0.18, -0.2, 0, TAU);
    ctx.fill();
  }

  /*
   * Hardscape. Stones are angular polygons shaded in three flat tones (lit face, body, shadow
   * side) like hand-placed pixel art; wood is built from tapered limbs with a lit upper edge.
   */
  const STONE = {
    seiryu: { light: "#b4b9bd", mid: "#7f858b", dark: "#4b5056", vein: "#e2e5e6" },
    dragon: { light: "#c49c68", mid: "#97724a", dark: "#5c432c", vein: "#6c4f33" },
    river: { light: "#c9bba0", mid: "#9a8c76", dark: "#625747", vein: null },
    river2: { light: "#a9a6a0", mid: "#7c7973", dark: "#4f4c48", vein: null },
    live: { light: "#bcae9c", mid: "#8e8274", dark: "#564c44", vein: null },
  };

  function stonePath(x, y, w, h, seed, lean, sides) {
    const rnd = prng(seed);
    const p = new Path2D();
    const n = sides || 8;
    let peak = null;
    for (let i = 0; i <= n; i++) {
      const a = Math.PI + (i / n) * Math.PI;
      const r = i === 0 || i === n ? 1 : 0.82 + rnd() * 0.26;
      const py = y + Math.sin(a) * h * r;
      const px = x + Math.cos(a) * (w / 2) * r + ((y - py) / h) * lean * w;
      if (i > 0 && i < n && (!peak || py < peak.y)) peak = { x: px, y: py };
      if (i === 0) p.moveTo(px, y);
      else p.lineTo(px, i === n ? y : py);
    }
    p.closePath();
    return { path: p, peak };
  }

  function stone(ctx, x, y, w, h, pal, seed, opts = {}) {
    const lean = opts.lean || 0;
    const { path, peak } = stonePath(x, y, w, h, seed, lean, opts.sides);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(x + w * 0.08, y, w * 0.58, Math.max(artPx, h * 0.08), 0, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.clip(path);
    ctx.fillStyle = pal.mid;
    ctx.fillRect(x - w, y - h * 1.2, w * 2, h * 1.3);
    // Lit face on the upper left, shadow side on the right.
    ctx.fillStyle = pal.light;
    ctx.beginPath();
    ctx.moveTo(x - w, y - h * 1.3);
    ctx.lineTo(peak.x + w * 0.04, y - h * 1.3);
    ctx.lineTo(peak.x - w * 0.02, peak.y + h * 0.1);
    ctx.lineTo(x - w * 0.12 + lean * w * 0.3, y - h * 0.45);
    ctx.lineTo(x - w, y - h * 0.3);
    ctx.fill();
    ctx.fillStyle = pal.dark;
    ctx.beginPath();
    ctx.moveTo(peak.x + w * 0.12, y - h * 1.3);
    ctx.lineTo(x + w, y - h * 1.3);
    ctx.lineTo(x + w, y + 1);
    ctx.lineTo(x + w * 0.22, y + 1);
    ctx.lineTo(x + w * 0.18 + lean * w * 0.4, y - h * 0.55);
    ctx.fill();
    // Grounded base.
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(x - w, y - h * 0.12, w * 2, h * 0.14);
    const rnd = prng(seed + 7);
    if (pal.vein) {
      // Calcite veins and cracks running across the stone.
      ctx.strokeStyle = pal.vein;
      ctx.lineWidth = Math.max(artPx, w * 0.02);
      for (let i = 0; i < 3; i++) {
        const vy = y - h * (0.25 + rnd() * 0.55);
        ctx.beginPath();
        ctx.moveTo(x - w * 0.6, vy + rnd() * h * 0.1);
        ctx.lineTo(x - w * (0.1 - rnd() * 0.2), vy - h * (0.04 + rnd() * 0.1));
        ctx.lineTo(x + w * 0.6, vy - h * (0.1 + rnd() * 0.15));
        ctx.stroke();
      }
    }
    if (opts.holes) {
      // Dragon stone: weathered pockets with a lit lower rim.
      for (let i = 0; i < opts.holes; i++) {
        const hx = x + (rnd() - 0.5) * w * 0.7;
        const hy = y - h * (0.2 + rnd() * 0.6);
        const r = w * (0.04 + rnd() * 0.05);
        ctx.fillStyle = pal.light;
        ctx.beginPath();
        ctx.ellipse(hx + artPx, hy + artPx, r, r * 0.7, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "#2e2016";
        ctx.beginPath();
        ctx.ellipse(hx, hy, r, r * 0.7, 0, 0, TAU);
        ctx.fill();
      }
    }
    if (opts.coralline) {
      for (let i = 0; i < opts.coralline; i++) {
        ctx.fillStyle = ["#a8508a", "#c97aa8", "#7a4aa0"][i % 3];
        ctx.beginPath();
        ctx.ellipse(
          x + (rnd() - 0.5) * w * 0.8,
          y - h * (0.15 + rnd() * 0.7),
          w * (0.06 + rnd() * 0.06),
          h * 0.06,
          rnd(),
          0,
          TAU,
        );
        ctx.fill();
      }
    }
    if (opts.moss) {
      ctx.fillStyle = "#4f8a3a";
      for (let i = 0; i < opts.moss; i++) {
        const mx = peak.x + (rnd() - 0.6) * w * 0.5;
        const my = peak.y + rnd() * h * 0.25;
        ctx.fillRect(mx, my, w * 0.08, Math.max(artPx, h * 0.05));
      }
    }
    ctx.restore();
  }

  // Sample a quadratic curve into points.
  function curve(x0, y0, cx, cy, x1, y1, n) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const u = 1 - k;
      out.push([
        u * u * x0 + 2 * u * k * cx + k * k * x1,
        u * u * y0 + 2 * u * k * cy + k * k * y1,
      ]);
    }
    return out;
  }

  // A tapered branch along pts, lit on its upper side, with bark grain.
  function limb(ctx, pts, w0, w1, pal) {
    const left = [];
    const right = [];
    const n = pts.length - 1;
    for (let i = 0; i <= n; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(n, i + 1)];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const nx = -(b[1] - a[1]) / len;
      const ny = (b[0] - a[0]) / len;
      const w = (w0 + (w1 - w0) * (i / n)) / 2;
      left.push([pts[i][0] + nx * w, pts[i][1] + ny * w]);
      right.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
    }
    // The lit edge is whichever side faces up.
    const upIsLeft = left[0][1] + left[n][1] < right[0][1] + right[n][1];
    const strip = (from, to, k, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const x = from[i][0] + (to[i][0] - from[i][0]) * k;
        const y = from[i][1] + (to[i][1] - from[i][1]) * k;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      for (let i = n; i >= 0; i--) ctx.lineTo(from[i][0], from[i][1]);
      ctx.fill();
    };
    strip(left, right, 1, pal.mid);
    strip(upIsLeft ? left : right, upIsLeft ? right : left, 0.3, pal.light);
    strip(upIsLeft ? right : left, upIsLeft ? left : right, 0.3, pal.dark);
    if (w0 > artPx * 4) {
      ctx.strokeStyle = pal.dark;
      ctx.lineWidth = artPx;
      ctx.beginPath();
      for (let i = 1; i < n; i++) {
        const x = left[i][0] + (right[i][0] - left[i][0]) * 0.55;
        const y = left[i][1] + (right[i][1] - left[i][1]) * 0.55;
        if (i === 1) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  const WOOD = {
    drift: { light: "#a47c52", mid: "#76563a", dark: "#46321f" },
    spider: { light: "#d2b48c", mid: "#a5845b", dark: "#6a5236" },
  };

  // Java moss clinging to wood and stone.
  function mossTuft(ctx, x, y, r, seed) {
    const rnd = prng(seed);
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = i % 3 ? "#3f7d32" : "#62a246";
      const a = rnd() * Math.PI + Math.PI;
      const d = rnd() * r;
      ctx.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6, r * 0.5, r * 0.35);
    }
  }

  // Tentacles of a bubble-tip anemone fanning out from the oral disc.
  function anemoneTentacles(ctx, x, y, s, t, back) {
    const n = back ? 19 : 11;
    const disc = y - 20 * s;
    for (let i = 0; i < n; i++) {
      const f = n === 1 ? 0.5 : i / (n - 1);
      const a = Math.PI + 0.15 + f * (Math.PI - 0.3);
      const r0 = (back ? 16 : 20) * s;
      const bx = x + Math.cos(a) * r0;
      const by = disc + (back ? -3 * s : 3 * s) + Math.sin(a) * r0 * 0.25;
      const len = ((back ? 22 : 15) + Math.sin(i * 2.3) * 4) * s;
      const wave = Math.sin(t * 1.3 + i * 0.8) * 3 * s;
      const ex = bx + Math.cos(a) * len * 0.75 + wave;
      const ey = by + Math.sin(a) * len * (back ? 1 : 0.8);
      ctx.strokeStyle = back ? "#b4475e" : "#d4607a";
      ctx.lineWidth = 4.2 * s;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + wave * 0.5, (by + ey) / 2, ex, ey);
      ctx.stroke();
      // Swollen bubble tip with a pale end.
      ctx.fillStyle = back ? "#d86a86" : "#ee86a0";
      ctx.beginPath();
      ctx.arc(ex, ey, 3 * s, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#ffd2dc";
      ctx.fillRect(ex - s, ey - 2.4 * s, 1.8 * s, 1.6 * s);
    }
  }

  function glowDot(ctx, x, y, r, color, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(color, a));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  const DECOR = {
    vallisneria(ctx, x, y, s, t) {
      // Runners add blades as the plant spreads; blades lengthen as it matures.
      const rnd = prng(11 + look.seed);
      const n = 3 + Math.round(look.g * 6);
      const tall = 0.3 + 0.7 * look.g;
      for (let i = 0; i < n; i++) {
        const bx = x + (i - (n - 1) / 2) * 5 * s;
        const h = (70 + rnd() * 60) * s * tall;
        const c = i % 2 ? "#3f9a4a" : "#57b55a";
        const bend = sway(t + i * 0.4, bx, 10 * s) + (i - n / 2) * 4 * s * tall;
        leafBlade(ctx, bx, y, h, 5 * s, bend, c);
      }
      // Female flowers ride a thin spiral stalk up to the light.
      if (look.bloom > 0) {
        const fx = x + 3 * s + sway(t, x, 6 * s);
        const fy = y - 150 * s * (0.6 + 0.4 * look.bloom);
        ctx.strokeStyle = "#7cbf6a";
        ctx.lineWidth = s;
        ctx.beginPath();
        ctx.moveTo(x + 3 * s, y);
        ctx.quadraticCurveTo(x - 6 * s, (y + fy) / 2, fx, fy);
        ctx.stroke();
        flower(ctx, fx, fy, 6 * s * look.bloom, "#f4f0ff", "#f2d14a", 3);
      }
    },
    anubias(ctx, x, y, s, t) {
      ctx.strokeStyle = "#2f5e2f";
      ctx.lineWidth = 2 * s;
      const rnd = prng(12 + look.seed);
      const n = 2 + Math.round(look.g * 4);
      const k = 0.55 + 0.45 * look.g;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.4 + sway(t, x + i, 0.06);
        const len = (14 + rnd() * 10) * s * k;
        const ex = x + Math.cos(a) * len;
        const ey = y - 4 * s + Math.sin(a) * len;
        ctx.beginPath();
        ctx.moveTo(x, y - 2 * s);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        leaf(ctx, ex, ey, 16 * s * k, 7 * s * k, a, i % 2 ? "#2e7a3a" : "#3a8f45", "#5fb86a");
      }
      // A white spathe on its own stalk, like a small peace lily.
      if (look.bloom > 0) {
        const fx = x + 4 * s;
        const fy = y - 30 * s;
        ctx.strokeStyle = "#4f8a46";
        ctx.lineWidth = 1.4 * s;
        ctx.beginPath();
        ctx.moveTo(x + 2 * s, y - 3 * s);
        ctx.quadraticCurveTo(x + 6 * s, y - 18 * s, fx, fy);
        ctx.stroke();
        leaf(ctx, fx, fy, 14 * s * look.bloom, 7 * s * look.bloom, -1.25, "#f5f2e6", "#d8d3c0");
        ctx.fillStyle = "#e8d27a";
        ctx.fillRect(fx + 1 * s, fy - 9 * s * look.bloom, 2.2 * s, 7 * s * look.bloom);
      }
      rockBlob(ctx, x, y, 12 * s, 6 * s, "#7d7a70", 3);
    },
    pebbles(ctx, x, y, s) {
      // Rounded river stones half sunk in the sand.
      stone(ctx, x - 10 * s, y, 24 * s, 13 * s, STONE.river, 1, { sides: 11 });
      stone(ctx, x + 10 * s, y + 1, 18 * s, 9 * s, STONE.river2, 2, { sides: 11 });
      stone(ctx, x + 1 * s, y + 2, 12 * s, 6 * s, STONE.river, 3, { sides: 9 });
    },
    hairgrass(ctx, x, y, s, t) {
      // Dwarf hairgrass spreads by runners from a few tufts into a dense lawn.
      const rnd = prng(51 + look.seed);
      const w = (16 + 34 * look.g) * s;
      const n = 10 + Math.round(look.g * 34);
      const cols = ["#4f9e3c", "#6cbb4a", "#3d8030", "#86cc5a"];
      ctx.lineWidth = artPx;
      for (let i = 0; i < n; i++) {
        const bx = x + (rnd() - 0.5) * w;
        const by = y + rnd() * 3 * s;
        const h = (6 + 14 * look.g) * s * (0.7 + rnd() * 0.6);
        const lean = (rnd() - 0.5) * 5 * s + sway(t, bx, 1.6 * s);
        ctx.strokeStyle = cols[i % 4];
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + lean, by - h);
        ctx.stroke();
      }
    },
    seiryu_stone(ctx, x, y, s) {
      // A small iwagumi: a tall main stone with two companions.
      stone(ctx, x + 3 * s, y, 40 * s, 64 * s, STONE.seiryu, 5, { lean: 0.14, sides: 7, moss: 3 });
      stone(ctx, x - 22 * s, y + 1, 22 * s, 24 * s, STONE.seiryu, 9, { lean: -0.12, sides: 6 });
      stone(ctx, x + 25 * s, y + 2, 16 * s, 13 * s, STONE.seiryu, 12, { sides: 6 });
    },
    moss_ball(ctx, x, y, s, t) {
      const r = 11 * s * (0.45 + 0.55 * look.g);
      const cy = y - r * 0.9 + Math.sin(t * 0.5) * 0.6 * s;
      const g = ctx.createRadialGradient(x - r * 0.3, cy - r * 0.3, r * 0.2, x, cy, r);
      g.addColorStop(0, "#7cc46a");
      g.addColorStop(1, "#2f6b2a");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, cy, r, 0, TAU);
      ctx.fill();
      const rnd = prng(13);
      ctx.fillStyle = "rgba(160,220,120,0.5)";
      for (let i = 0; i < 26; i++) {
        const a = rnd() * TAU;
        const d = rnd() * r;
        ctx.fillRect(x + Math.cos(a) * d, cy + Math.sin(a) * d, 1.2 * s, 1.2 * s);
      }
    },
    chest(ctx, x, y, s, t, golden) {
      const w = 34 * s;
      const h = 18 * s;
      const wood = golden ? "#e8b72e" : "#8a5a2b";
      const band = golden ? "#fff0a8" : "#4a3220";
      const open = Math.max(0, Math.sin(t * 0.35)) ** 6;
      // Body.
      ctx.fillStyle = wood;
      ctx.fillRect(x - w / 2, y - h, w, h);
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      for (let i = 1; i < 4; i++) ctx.fillRect(x - w / 2, y - h + (i * h) / 4, w, 0.8 * s);
      ctx.fillStyle = band;
      ctx.fillRect(x - w / 2 + 3 * s, y - h, 3 * s, h);
      ctx.fillRect(x + w / 2 - 6 * s, y - h, 3 * s, h);
      if (open > 0.05) {
        ctx.fillStyle = "#ffd84a";
        ctx.beginPath();
        ctx.ellipse(x, y - h, w * 0.4, 4 * s * open, 0, Math.PI, TAU);
        ctx.fill();
        glowDot(ctx, x, y - h - 4 * s, 18 * s * open, "#ffe9a0", 0.6 * open);
      }
      // Lid hinged at the back.
      ctx.save();
      ctx.translate(x - w / 2, y - h);
      ctx.rotate(-open * 0.9);
      ctx.fillStyle = shade(wood, 0.1);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(w / 2, -12 * s, w, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = band;
      ctx.fillRect(3 * s, -6 * s, 3 * s, 6 * s);
      ctx.fillRect(w - 6 * s, -6 * s, 3 * s, 6 * s);
      ctx.restore();
      ctx.fillStyle = golden ? "#ffffff" : "#d8b44a";
      ctx.fillRect(x - 2.5 * s, y - h + 2 * s, 5 * s, 6 * s);
      if (golden) {
        const sp = (t * 1.3) % 3;
        if (sp < 1) glowDot(ctx, x + 10 * s, y - h * 0.6, 6 * s, "#ffffff", 1 - sp);
      }
    },
    golden_chest(ctx, x, y, s, t) {
      DECOR.chest(ctx, x, y, s, t, true);
    },
    driftwood(ctx, x, y, s) {
      // A big weathered branch: a log on the sand with a limb reaching up to the light.
      const P = WOOD.drift;
      limb(
        ctx,
        curve(x - 72 * s, y - 2 * s, x - 5 * s, y - 16 * s, x + 55 * s, y - 3 * s, 10),
        13 * s,
        8 * s,
        P,
      );
      limb(
        ctx,
        curve(x - 50 * s, y - 6 * s, x - 2 * s, y - 24 * s, x + 30 * s, y - 92 * s, 12),
        15 * s,
        6 * s,
        P,
      );
      limb(
        ctx,
        curve(x - 14 * s, y - 34 * s, x - 38 * s, y - 52 * s, x - 46 * s, y - 92 * s, 8),
        7 * s,
        2.5 * s,
        P,
      );
      limb(
        ctx,
        curve(x + 22 * s, y - 72 * s, x + 46 * s, y - 84 * s, x + 66 * s, y - 112 * s, 8),
        5 * s,
        2 * s,
        P,
      );
      limb(
        ctx,
        curve(x + 30 * s, y - 92 * s, x + 28 * s, y - 108 * s, x + 20 * s, y - 126 * s, 6),
        4.5 * s,
        1.5 * s,
        P,
      );
      limb(
        ctx,
        curve(x + 40 * s, y - 6 * s, x + 56 * s, y - 20 * s, x + 64 * s, y - 34 * s, 5),
        5 * s,
        2 * s,
        P,
      );
      mossTuft(ctx, x - 44 * s, y - 6 * s, 6 * s, 3);
      mossTuft(ctx, x - 26 * s, y - 52 * s, 5 * s, 4);
      mossTuft(ctx, x + 18 * s, y - 72 * s, 5 * s, 5);
    },
    spider_wood(ctx, x, y, s) {
      // Fine branching spider wood, reaching high behind the fish.
      const P = WOOD.spider;
      const rnd = prng(61);
      const branch = (x0, y0, ang, len, w, depth) => {
        const x1 = x0 + Math.cos(ang) * len;
        const y1 = y0 + Math.sin(ang) * len;
        const bend = (rnd() - 0.5) * len * 0.5;
        const cx = (x0 + x1) / 2 - Math.sin(ang) * bend;
        const cy = (y0 + y1) / 2 + Math.cos(ang) * bend;
        limb(ctx, curve(x0, y0, cx, cy, x1, y1, 6), w, w * 0.6, P);
        if (depth > 0) {
          branch(x1, y1, ang - 0.3 - rnd() * 0.35, len * 0.74, w * 0.62, depth - 1);
          branch(x1, y1, ang + 0.3 + rnd() * 0.35, len * 0.68, w * 0.58, depth - 1);
        }
      };
      branch(x - 4 * s, y, -Math.PI / 2 - 0.42, 46 * s, 10 * s, 3);
      branch(x + 6 * s, y, -Math.PI / 2 + 0.38, 42 * s, 9 * s, 3);
      branch(x, y, -Math.PI / 2 - 0.05, 30 * s, 7 * s, 2);
      limb(
        ctx,
        curve(x - 26 * s, y, x - 8 * s, y - 10 * s, x + 2 * s, y - 2 * s, 5),
        6 * s,
        9 * s,
        P,
      );
      limb(ctx, curve(x + 26 * s, y + 1, x + 10 * s, y - 8 * s, x, y - 2 * s, 5), 5 * s, 9 * s, P);
      mossTuft(ctx, x - 2 * s, y - 6 * s, 6 * s, 6);
    },
    castle: {
      outline(x, y, s) {
        const p = new Path2D();
        p.rect(x - 38 * s, y - 70 * s, 76 * s, 70 * s);
        p.rect(x - 50 * s, y - 95 * s, 24 * s, 95 * s);
        p.rect(x + 26 * s, y - 85 * s, 24 * s, 85 * s);
        return p;
      },
      hole(x, y, s) {
        return { x, y: y - 16 * s, rx: 12 * s, ry: 16 * s };
      },
      back(ctx, x, y, s) {
        const hole = DECOR.castle.hole(x, y, s);
        ctx.fillStyle = "#14151c";
        ctx.beginPath();
        ctx.ellipse(hole.x, hole.y, hole.rx, hole.ry, 0, 0, TAU);
        ctx.fill();
      },
      front(ctx, x, y, s, t) {
        const stone = "#b9b2a6";
        const tower = (cx, top, w) => {
          const g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
          g.addColorStop(0, shade(stone, -0.15));
          g.addColorStop(0.5, stone);
          g.addColorStop(1, shade(stone, -0.3));
          ctx.fillStyle = g;
          ctx.fillRect(cx - w / 2, top, w, y - top);
          for (let i = 0; i < 3; i++)
            ctx.fillRect(cx - w / 2 + i * (w / 2.5), top - 6 * s, w / 5, 6 * s);
          ctx.fillStyle = "#2a2a33";
          ctx.fillRect(cx - 2 * s, top + 12 * s, 4 * s, 8 * s);
        };
        tower(x - 38 * s, y - 95 * s, 24 * s);
        tower(x + 38 * s, y - 85 * s, 24 * s);
        const g = ctx.createLinearGradient(0, y - 70 * s, 0, y);
        g.addColorStop(0, shade(stone, 0.05));
        g.addColorStop(1, shade(stone, -0.25));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.rect(x - 28 * s, y - 70 * s, 56 * s, 70 * s);
        const h = DECOR.castle.hole(x, y, s);
        ctx.moveTo(h.x + h.rx, h.y + h.ry);
        ctx.lineTo(h.x + h.rx, h.y);
        ctx.ellipse(h.x, h.y, h.rx, h.ry, 0, 0, Math.PI, true);
        ctx.lineTo(h.x - h.rx, h.y + h.ry);
        ctx.fill("evenodd");
        for (let i = 0; i < 4; i++) ctx.fillRect(x - 28 * s + i * 15 * s, y - 76 * s, 9 * s, 6 * s);
        ctx.strokeStyle = "rgba(0,0,0,0.15)";
        ctx.lineWidth = 1;
        for (let r = 0; r < 6; r++) {
          ctx.beginPath();
          ctx.moveTo(x - 28 * s, y - r * 11 * s - 8 * s);
          ctx.lineTo(x + 28 * s, y - r * 11 * s - 8 * s);
          ctx.stroke();
        }
        ctx.fillStyle = "#e05a4a";
        ctx.beginPath();
        const wave = Math.sin(t * 2) * 3 * s;
        ctx.moveTo(x - 38 * s, y - 101 * s);
        ctx.lineTo(x - 38 * s, y - 120 * s);
        ctx.lineTo(x - 22 * s, y - 115 * s + wave);
        ctx.lineTo(x - 38 * s, y - 110 * s);
        ctx.fill();
        ctx.fillStyle = "rgba(60,120,50,0.6)";
        ctx.beginPath();
        ctx.ellipse(x - 18 * s, y - 2 * s, 14 * s, 5 * s, 0, 0, TAU);
        ctx.fill();
      },
    },
    java_fern(ctx, x, y, s, t) {
      const n = 3 + Math.round(look.g * 5);
      const k = 0.45 + 0.55 * look.g;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.25 + sway(t, x + i * 9, 0.08);
        leaf(
          ctx,
          x + (i - (n - 1) / 2) * 2 * s,
          y,
          (26 + (i % 3) * 7) * s * k,
          4 * s,
          a,
          i % 2 ? "#2f6d34" : "#3b8240",
          "#1f4f24",
        );
      }
    },
    sword_plant(ctx, x, y, s, t) {
      const n = 5 + 2 * Math.round(look.g * 3);
      const k = 0.35 + 0.65 * look.g;
      const mid = (n - 1) / 2;
      // A long flower stalk with whorls of small white flowers, drawn behind the leaves.
      if (look.bloom > 0) {
        const top = y - 120 * s * (0.5 + 0.5 * look.bloom);
        const bend = sway(t, x, 8 * s);
        ctx.strokeStyle = "#5f9a4a";
        ctx.lineWidth = 1.3 * s;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x, (y + top) / 2, x + bend, top);
        ctx.stroke();
        for (let w = 0; w < 3; w++) {
          const f = 0.62 + w * 0.17;
          const wx = x + bend * f * f;
          const wy = y + (top - y) * f;
          flower(ctx, wx - 4 * s, wy, 4 * s * look.bloom, "#ffffff", "#f0d25a", 3);
          flower(ctx, wx + 4 * s, wy, 4 * s * look.bloom, "#ffffff", "#f0d25a", 3);
        }
      }
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i - mid) * 0.2 + sway(t, x + i * 5, 0.06);
        leaf(
          ctx,
          x,
          y,
          (48 + (mid - Math.abs(i - mid)) * 9) * s * k,
          7 * s * (0.6 + 0.4 * k),
          a,
          i % 2 ? "#3f9f3a" : "#4fb447",
          "#2c7a2a",
        );
      }
    },
    monte_carlo(ctx, x, y, s) {
      // A low cushion of tiny round leaves that creeps outwards as it grows.
      const rnd = prng(71 + look.seed);
      const w = (12 + 30 * look.g) * s;
      const h = (4 + 7 * look.g) * s;
      const n = 14 + Math.round(look.g * 60);
      const pts = [];
      for (let i = 0; i < n; i++) {
        const u = rnd() - 0.5;
        const top = h * Math.sqrt(Math.max(0, 1 - 4 * u * u));
        pts.push([x + u * w, y + 1 * s - rnd() * top, rnd()]);
      }
      pts.sort((a, b) => b[1] - a[1]);
      for (const [px, py, k] of pts) {
        const up = (y - py) / (h || 1);
        ctx.fillStyle = up > 0.6 ? "#8ad055" : k > 0.5 ? "#5cad3e" : "#41892f";
        ctx.beginPath();
        ctx.arc(px, py, 2.1 * s, 0, TAU);
        ctx.fill();
      }
    },
    dragon_stone(ctx, x, y, s) {
      stone(ctx, x - 2 * s, y, 46 * s, 56 * s, STONE.dragon, 21, {
        lean: -0.16,
        sides: 9,
        holes: 6,
      });
      stone(ctx, x + 26 * s, y + 1, 24 * s, 25 * s, STONE.dragon, 23, { sides: 7, holes: 2 });
      stone(ctx, x - 26 * s, y + 2, 14 * s, 10 * s, STONE.dragon, 25, { sides: 6 });
    },
    rotala(ctx, x, y, s, t) {
      // Rotala: a bunch of stems with paired leaves that turn orange and pink towards the light.
      const rnd = prng(81 + look.seed);
      const n = 3 + Math.round(look.g * 4);
      for (let i = 0; i < n; i++) {
        const bx = x + (i - (n - 1) / 2) * 6 * s + (rnd() - 0.5) * 3 * s;
        const h = (32 + 78 * look.g) * s * (0.8 + rnd() * 0.3);
        const steps = Math.max(4, Math.round(h / (5 * s)));
        let tip = [bx, y];
        for (let k = 1; k <= steps; k++) {
          const f = k / steps;
          const px = bx + sway(t + i, bx, 5 * s) * f * f + (i - n / 2) * 3 * s * f;
          const py = y - h * f;
          ctx.strokeStyle = "#5b7d38";
          ctx.lineWidth = Math.max(artPx, 1.2 * s);
          ctx.beginPath();
          ctx.moveTo(tip[0], tip[1]);
          ctx.lineTo(px, py);
          ctx.stroke();
          ctx.fillStyle =
            f < 0.45 ? "#4f9a3e" : f < 0.75 ? "#c48a3a" : f < 0.9 ? "#e2703c" : "#f08aa0";
          const lw = (f > 0.85 ? 3 : 4.5) * s;
          for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.ellipse(px + side * lw * 0.7, py, lw, 1.6 * s, side * 0.4, 0, TAU);
            ctx.fill();
          }
          tip = [px, py];
        }
        if (look.bloom > 0 && i % 2 === 0)
          flower(ctx, tip[0], tip[1] - 3 * s, 3.6 * s * look.bloom, "#f7b8d8", "#fff2a0", 4);
      }
    },
    root(ctx, x, y, s, t) {
      ctx.lineCap = "round";
      const rnd = prng(21);
      for (let i = 0; i < 7; i++) {
        const x0 = x + (rnd() - 0.5) * 70 * s;
        ctx.strokeStyle = i % 2 ? "#4a3220" : "#5c3f28";
        ctx.lineWidth = (4 + rnd() * 5) * s;
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.bezierCurveTo(
          x0 + (rnd() - 0.5) * 50 * s,
          y - 40 * s,
          x0 + (rnd() - 0.5) * 70 * s,
          y - 70 * s,
          x0 + (rnd() - 0.5) * 60 * s,
          y - (90 + rnd() * 30) * s,
        );
        ctx.stroke();
      }
      for (let i = 0; i < 6; i++) {
        leaf(
          ctx,
          x + (rnd() - 0.5) * 60 * s,
          y - (60 + rnd() * 50) * s,
          10 * s,
          4 * s,
          rnd() * TAU + sway(t, i, 0.2),
          "#4f9a46",
          null,
        );
      }
    },
    stump: {
      hole(x, y, s) {
        return { x: x + 2 * s, y: y - 13 * s, rx: 10 * s, ry: 12 * s };
      },
      outline(x, y, s) {
        const p = new Path2D();
        p.rect(x - 26 * s, y - 58 * s, 52 * s, 58 * s);
        return p;
      },
      back(ctx, x, y, s) {
        const h = DECOR.stump.hole(x, y, s);
        ctx.fillStyle = "#120c08";
        ctx.beginPath();
        ctx.ellipse(h.x, h.y, h.rx, h.ry, 0, 0, TAU);
        ctx.fill();
      },
      front(ctx, x, y, s) {
        const g = ctx.createLinearGradient(x - 26 * s, 0, x + 26 * s, 0);
        g.addColorStop(0, "#4b3424");
        g.addColorStop(0.5, "#7a5638");
        g.addColorStop(1, "#3e2a1c");
        ctx.fillStyle = g;
        const h = DECOR.stump.hole(x, y, s);
        ctx.beginPath();
        ctx.moveTo(x - 26 * s, y);
        ctx.lineTo(x - 22 * s, y - 55 * s);
        ctx.lineTo(x - 8 * s, y - 50 * s);
        ctx.lineTo(x + 4 * s, y - 58 * s);
        ctx.lineTo(x + 22 * s, y - 52 * s);
        ctx.lineTo(x + 26 * s, y);
        ctx.closePath();
        ctx.ellipse(h.x, h.y, h.rx, h.ry, 0, 0, TAU);
        ctx.fill("evenodd");
        ctx.strokeStyle = "rgba(30,18,10,0.5)";
        ctx.lineWidth = 1.2 * s;
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.moveTo(x - 20 * s + i * 10 * s, y - 50 * s);
          ctx.lineTo(x - 22 * s + i * 11 * s, y - 2 * s);
          ctx.stroke();
        }
        ctx.fillStyle = "#4f8f3e";
        ctx.beginPath();
        ctx.ellipse(x - 10 * s, y - 52 * s, 12 * s, 4 * s, 0.1, 0, TAU);
        ctx.fill();
      },
    },
    ludwigia(ctx, x, y, s, t) {
      const stems = 2 + Math.round(look.g * 2);
      for (let st = 0; st < stems; st++) {
        const bx = x + (st - (stems - 1) / 2) * 9 * s;
        const h = (60 + st * 12) * s * (0.3 + 0.7 * look.g);
        const bend = sway(t + st, bx, 6 * s);
        ctx.strokeStyle = "#7a3b2a";
        ctx.lineWidth = 1.5 * s;
        ctx.beginPath();
        ctx.moveTo(bx, y);
        ctx.quadraticCurveTo(bx, y - h / 2, bx + bend, y - h);
        ctx.stroke();
        for (let k = 1; k < 9; k++) {
          const f = k / 9;
          const lx = bx + bend * f * f;
          const ly = y - h * f;
          const c = mix("#5f9a3a", "#e0452c", f);
          leaf(ctx, lx, ly, 8 * s, 3 * s, -0.5, c, null);
          leaf(ctx, lx, ly, 8 * s, 3 * s, Math.PI + 0.5, c, null);
        }
        if (look.bloom > 0 && st % 2 === 0) {
          flower(ctx, bx + bend, y - h - 3 * s, 5 * s * look.bloom, "#ffd84a", "#e08a1a", 4);
        }
      }
    },
    clay_cave: {
      hole(x, y, s) {
        return { x: x + 14 * s, y: y - 9 * s, rx: 6 * s, ry: 8 * s };
      },
      outline(x, y, s) {
        const p = new Path2D();
        p.rect(x - 20 * s, y - 20 * s, 40 * s, 20 * s);
        return p;
      },
      back(ctx, x, y, s) {
        const h = DECOR.clay_cave.hole(x, y, s);
        ctx.fillStyle = "#1a0d08";
        ctx.beginPath();
        ctx.ellipse(h.x, h.y, h.rx, h.ry, 0, 0, TAU);
        ctx.fill();
      },
      front(ctx, x, y, s) {
        const g = ctx.createLinearGradient(0, y - 20 * s, 0, y);
        g.addColorStop(0, "#d27a4a");
        g.addColorStop(1, "#8f4626");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x - 20 * s, y);
        ctx.quadraticCurveTo(x - 22 * s, y - 20 * s, x, y - 19 * s);
        ctx.lineTo(x + 12 * s, y - 18 * s);
        ctx.lineTo(x + 12 * s, y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#b5603a";
        ctx.beginPath();
        const h = DECOR.clay_cave.hole(x, y, s);
        ctx.ellipse(h.x - 1 * s, h.y, h.rx + 3 * s, h.ry + 2 * s, 0, 0, TAU);
        ctx.ellipse(h.x, h.y, h.rx, h.ry, 0, 0, TAU);
        ctx.fill("evenodd");
      },
    },
    idol(ctx, x, y, s, t) {
      const g = ctx.createLinearGradient(x - 20 * s, 0, x + 20 * s, 0);
      g.addColorStop(0, "#6f7a6a");
      g.addColorStop(0.5, "#a3ad9a");
      g.addColorStop(1, "#5c6658");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - 18 * s, y);
      ctx.lineTo(x - 20 * s, y - 52 * s);
      ctx.quadraticCurveTo(x, y - 66 * s, x + 20 * s, y - 52 * s);
      ctx.lineTo(x + 18 * s, y);
      ctx.fill();
      ctx.fillStyle = "#3a4236";
      ctx.fillRect(x - 12 * s, y - 44 * s, 8 * s, 5 * s);
      ctx.fillRect(x + 4 * s, y - 44 * s, 8 * s, 5 * s);
      ctx.fillRect(x - 9 * s, y - 26 * s, 18 * s, 4 * s);
      const glow = 0.5 + 0.5 * Math.sin(t * 0.8);
      glowDot(ctx, x - 8 * s, y - 41 * s, 6 * s, "#7dffb0", 0.6 * glow);
      glowDot(ctx, x + 8 * s, y - 41 * s, 6 * s, "#7dffb0", 0.6 * glow);
      ctx.fillStyle = "rgba(80,150,60,0.75)";
      ctx.beginPath();
      ctx.ellipse(x - 10 * s, y - 56 * s, 12 * s, 4 * s, -0.3, 0, TAU);
      ctx.fill();
    },
    anemone: {
      // Bubble-tip anemone: a short column, the oral disc and a dome of swollen tentacles.
      // Clownfish nestle between the back and front tentacles.
      back(ctx, x, y, s, t) {
        ctx.fillStyle = "#7e3236";
        ctx.beginPath();
        ctx.moveTo(x - 13 * s, y);
        ctx.lineTo(x - 17 * s, y - 20 * s);
        ctx.lineTo(x + 17 * s, y - 20 * s);
        ctx.lineTo(x + 13 * s, y);
        ctx.fill();
        ctx.fillStyle = "#a4474a";
        ctx.fillRect(x - 12 * s, y - 19 * s, 7 * s, 18 * s);
        anemoneTentacles(ctx, x, y, s, t, true);
        ctx.fillStyle = "#c4606a";
        ctx.beginPath();
        ctx.ellipse(x, y - 20 * s, 18 * s, 5 * s, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "#6e2a34";
        ctx.fillRect(x - 2 * s, y - 21 * s, 4 * s, 2 * s);
      },
      front(ctx, x, y, s, t) {
        anemoneTentacles(ctx, x, y, s, t, false);
      },
    },
    brain_coral(ctx, x, y, s) {
      const r = 22 * s;
      const g = ctx.createRadialGradient(
        x - r * 0.3,
        y - r * 0.9,
        r * 0.2,
        x,
        y - r * 0.5,
        r * 1.1,
      );
      g.addColorStop(0, "#f5d58a");
      g.addColorStop(1, "#b98a3a");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y - 2 * s, r, r * 0.85, 0, Math.PI, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(120,80,30,0.55)";
      ctx.lineWidth = 1.4 * s;
      const rnd = prng(31);
      for (let i = 0; i < 9; i++) {
        ctx.beginPath();
        let px = x + (rnd() - 0.5) * r * 1.4;
        let py = y - 4 * s - rnd() * r * 0.7;
        ctx.moveTo(px, py);
        for (let k = 0; k < 5; k++) {
          px += (rnd() - 0.5) * 8 * s;
          py += (rnd() - 0.5) * 5 * s;
          ctx.lineTo(px, Math.min(py, y - 3 * s));
        }
        ctx.stroke();
      }
    },
    staghorn(ctx, x, y, s, t) {
      ctx.lineCap = "round";
      const grow = (x0, y0, len, ang, w, d) => {
        const x1 = x0 + Math.cos(ang) * len;
        const y1 = y0 + Math.sin(ang) * len;
        ctx.strokeStyle = d % 2 ? "#d9a07a" : "#e8b48f";
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        if (d > 0) {
          grow(x1, y1, len * 0.75, ang - 0.45, w * 0.75, d - 1);
          grow(x1, y1, len * 0.7, ang + 0.4, w * 0.7, d - 1);
        } else {
          ctx.fillStyle = "#b8e0ff";
          ctx.beginPath();
          ctx.arc(x1, y1, w * 0.5 * (1 + 0.2 * Math.sin(t * 2 + x1)), 0, TAU);
          ctx.fill();
        }
      };
      grow(x, y, 26 * s, -Math.PI / 2, 6 * s, 3);
      grow(x - 8 * s, y, 18 * s, -Math.PI / 2 - 0.5, 5 * s, 2);
      grow(x + 8 * s, y, 18 * s, -Math.PI / 2 + 0.5, 5 * s, 2);
    },
    sea_fan(ctx, x, y, s, t) {
      const b = sway(t, x, 0.04);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(b);
      ctx.strokeStyle = "#a83a6a";
      ctx.lineWidth = 1.2 * s;
      for (let i = 0; i < 28; i++) {
        const a = -Math.PI / 2 + (i / 27 - 0.5) * 2.2;
        ctx.beginPath();
        ctx.moveTo(0, -6 * s);
        ctx.quadraticCurveTo(
          Math.cos(a) * 40 * s,
          -6 * s + Math.sin(a) * 50 * s,
          Math.cos(a) * 60 * s,
          Math.sin(a) * 92 * s,
        );
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(220,90,140,0.7)";
      for (let r = 1; r < 7; r++) {
        ctx.beginPath();
        ctx.ellipse(0, -6 * s, r * 10 * s, r * 14 * s, 0, Math.PI + 0.35, TAU - 0.35);
        ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = "#6a2a4a";
      ctx.fillRect(x - 3 * s, y - 8 * s, 6 * s, 8 * s);
    },
    rock_cave: {
      outline(x, y, s) {
        // Lumpy silhouette of three stacked boulders.
        const pts = [
          [-63, -10],
          [-64, -28],
          [-58, -48],
          [-42, -58],
          [-32, -78],
          [-10, -92],
          [12, -88],
          [30, -76],
          [46, -64],
          [60, -44],
          [65, -18],
          [62, -6],
        ];
        const p = new Path2D();
        p.moveTo(x - 57 * s, y + 2);
        for (const [px, py] of pts) p.lineTo(x + px * s, y + py * s);
        p.lineTo(x + 55 * s, y + 2);
        p.closePath();
        return p;
      },
      hole(x, y, s) {
        return { x: x - 6 * s, y: y - 24 * s, rx: 20 * s, ry: 18 * s };
      },
      back(ctx, x, y, s) {
        const h = DECOR.rock_cave.hole(x, y, s);
        ctx.fillStyle = "#1c222c";
        ctx.beginPath();
        ctx.ellipse(h.x, h.y, h.rx, h.ry, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "#07090e";
        ctx.beginPath();
        ctx.ellipse(h.x + 2 * s, h.y + 1 * s, h.rx * 0.78, h.ry * 0.74, 0, 0, TAU);
        ctx.fill();
      },
      front(ctx, x, y, s) {
        // Stacked live rock around a dark opening, crusted with coralline algae.
        const P = STONE.live;
        const outline = DECOR.rock_cave.outline(x, y, s);
        const h = DECOR.rock_cave.hole(x, y, s);
        const p = new Path2D();
        p.addPath(outline);
        p.ellipse(h.x, h.y, h.rx, h.ry, 0, 0, TAU);
        ctx.save();
        ctx.clip(p, "evenodd");
        ctx.fillStyle = P.mid;
        ctx.fillRect(x - 70 * s, y - 100 * s, 140 * s, 104 * s);
        ctx.fillStyle = P.light;
        ctx.beginPath();
        ctx.moveTo(x - 70 * s, y - 100 * s);
        ctx.lineTo(x + 6 * s, y - 100 * s);
        ctx.lineTo(x - 18 * s, y - 62 * s);
        ctx.lineTo(x - 44 * s, y - 46 * s);
        ctx.lineTo(x - 70 * s, y - 30 * s);
        ctx.fill();
        ctx.fillStyle = P.dark;
        ctx.beginPath();
        ctx.moveTo(x + 30 * s, y - 100 * s);
        ctx.lineTo(x + 70 * s, y - 100 * s);
        ctx.lineTo(x + 70 * s, y + 4);
        ctx.lineTo(x + 30 * s, y + 4);
        ctx.lineTo(x + 40 * s, y - 50 * s);
        ctx.fill();
        // Seams between the stacked boulders.
        ctx.strokeStyle = "#3e3530";
        ctx.lineWidth = 2 * s;
        ctx.beginPath();
        ctx.moveTo(x - 64 * s, y - 50 * s);
        ctx.quadraticCurveTo(x - 30 * s, y - 60 * s, x - 6 * s, y - 52 * s);
        ctx.quadraticCurveTo(x + 24 * s, y - 44 * s, x + 30 * s, y - 70 * s);
        ctx.moveTo(x + 24 * s, y + 2);
        ctx.quadraticCurveTo(x + 18 * s, y - 24 * s, x + 32 * s, y - 48 * s);
        ctx.stroke();
        const rnd = prng(41);
        for (let i = 0; i < 14; i++) {
          const px = x + (rnd() - 0.5) * 110 * s;
          const py = y - rnd() * 86 * s;
          const pr = (3 + rnd() * 5) * s;
          const dx = (px - h.x) / (h.rx + pr);
          const dy = (py - h.y) / (h.ry + pr);
          if (dx * dx + dy * dy < 1) continue;
          ctx.fillStyle = ["#a8508a", "#c97aa8", "#7a4aa0", "#c8a07a"][i % 4];
          ctx.beginPath();
          ctx.ellipse(px, py, pr, pr * 0.6, rnd(), 0, TAU);
          ctx.fill();
        }
        ctx.restore();
        // Dark lip around the opening.
        ctx.strokeStyle = "#2a2422";
        ctx.lineWidth = 2.5 * s;
        ctx.beginPath();
        ctx.ellipse(h.x, h.y, h.rx + 1 * s, h.ry + 1 * s, 0, Math.PI * 0.85, Math.PI * 2.15);
        ctx.stroke();
      },
    },
    live_rock(ctx, x, y, s) {
      // Live rock stacked into a reef wall, with coralline crusts and zoanthid polyps.
      const P = STONE.live;
      const o = { sides: 9, coralline: 5 };
      stone(ctx, x - 30 * s, y, 62 * s, 46 * s, P, 31, o);
      stone(ctx, x + 30 * s, y, 56 * s, 38 * s, P, 33, o);
      stone(ctx, x - 4 * s, y - 34 * s, 52 * s, 42 * s, P, 35, o);
      stone(ctx, x + 14 * s, y - 68 * s, 30 * s, 26 * s, P, 37, { sides: 7, coralline: 3 });
      const rnd = prng(39);
      for (let i = 0; i < 12; i++) {
        const px = x - 40 * s + rnd() * 80 * s;
        const py = y - 10 * s - rnd() * 60 * s;
        ctx.fillStyle = i % 3 ? "#5ad08a" : "#ff9a4a";
        ctx.fillRect(px, py, 2.4 * s, 2.4 * s);
        ctx.fillStyle = "#2a4a3a";
        ctx.fillRect(px + 0.8 * s, py + 0.8 * s, 0.8 * s, 0.8 * s);
      }
    },
    giant_clam(ctx, x, y, s, t) {
      const open = 0.5 + 0.5 * Math.sin(t * 0.4);
      ctx.fillStyle = "#d8d0bc";
      ctx.beginPath();
      ctx.ellipse(x, y - 4 * s, 22 * s, 9 * s, 0, 0, Math.PI);
      ctx.fill();
      ctx.fillStyle = "#2a7ad8";
      ctx.beginPath();
      ctx.ellipse(x, y - 6 * s, 19 * s, 3 + 6 * s * open, 0, Math.PI, TAU);
      ctx.fill();
      ctx.fillStyle = "rgba(140,230,255,0.7)";
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(x - 14 * s + i * 5.6 * s, y - 7 * s - 3 * s * open, 1.4 * s, 0, TAU);
        ctx.fill();
      }
      ctx.save();
      ctx.translate(x, y - 6 * s);
      ctx.scale(1, -0.4 - 0.4 * (1 - open));
      ctx.fillStyle = "#e8e0cc";
      ctx.beginPath();
      ctx.ellipse(0, 0, 22 * s, 18 * s, 0, 0, Math.PI);
      ctx.fill();
      ctx.restore();
      if (open > 0.6) {
        ctx.fillStyle = "#fbf7ff";
        ctx.beginPath();
        ctx.arc(x, y - 9 * s, 3.5 * s, 0, TAU);
        ctx.fill();
        glowDot(ctx, x, y - 9 * s, 10 * s, "#ffffff", (open - 0.6) * 1.5);
      }
    },
    glow_crystal(ctx, x, y, s) {
      const shards = [
        [-10, 34, -0.25],
        [0, 46, 0],
        [9, 30, 0.3],
        [16, 20, 0.5],
        [-16, 18, -0.5],
      ];
      for (const [dx, h, a] of shards) {
        ctx.save();
        ctx.translate(x + dx * s, y);
        ctx.rotate(a);
        const g = ctx.createLinearGradient(-5 * s, 0, 5 * s, 0);
        g.addColorStop(0, "#5a3fd0");
        g.addColorStop(0.5, "#b9a8ff");
        g.addColorStop(1, "#3f2aa0");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-5 * s, 0);
        ctx.lineTo(-5 * s, -h * s * 0.8);
        ctx.lineTo(0, -h * s);
        ctx.lineTo(5 * s, -h * s * 0.8);
        ctx.lineTo(5 * s, 0);
        ctx.fill();
        ctx.restore();
      }
    },
    tube_worms(ctx, x, y, s, t) {
      for (let i = 0; i < 7; i++) {
        const bx = x + (i - 3) * 6 * s;
        const h = (30 + ((i * 13) % 25)) * s;
        const b = sway(t + i, bx, 3 * s);
        ctx.strokeStyle = "#e8e2d4";
        ctx.lineWidth = 5 * s;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(bx, y);
        ctx.quadraticCurveTo(bx, y - h / 2, bx + b, y - h);
        ctx.stroke();
        const open = 0.6 + 0.4 * Math.sin(t * 0.7 + i * 1.3);
        ctx.fillStyle = "#e0263a";
        ctx.beginPath();
        ctx.ellipse(bx + b, y - h - 4 * s * open, 4.5 * s, 5 * s * open, 0, 0, TAU);
        ctx.fill();
      }
    },
    whale_bone(ctx, x, y, s) {
      ctx.lineCap = "round";
      ctx.strokeStyle = "#e7e0cf";
      ctx.lineWidth = 7 * s;
      ctx.beginPath();
      ctx.moveTo(x - 62 * s, y - 6 * s);
      ctx.quadraticCurveTo(x, y - 16 * s, x + 62 * s, y - 4 * s);
      ctx.stroke();
      ctx.lineWidth = 4.5 * s;
      for (let i = 0; i < 7; i++) {
        const bx = x - 48 * s + i * 15 * s;
        const h = (70 - Math.abs(i - 3) * 9) * s;
        ctx.strokeStyle = i % 2 ? "#d7d0bf" : "#e7e0cf";
        ctx.beginPath();
        ctx.moveTo(bx, y - 11 * s);
        ctx.bezierCurveTo(bx - 14 * s, y - h * 0.6, bx + 6 * s, y - h, bx + 20 * s, y - h * 0.85);
        ctx.stroke();
      }
      ctx.fillStyle = "#d9d2c0";
      ctx.beginPath();
      ctx.ellipse(x + 58 * s, y - 12 * s, 16 * s, 11 * s, -0.2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#1a1a24";
      ctx.beginPath();
      ctx.arc(x + 62 * s, y - 15 * s, 3.5 * s, 0, TAU);
      ctx.fill();
    },
    sea_lily(ctx, x, y, s, t) {
      const h = 64 * s;
      const b = sway(t, x, 5 * s);
      ctx.strokeStyle = "#c0a9e8";
      ctx.lineWidth = 2.5 * s;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x, y - h / 2, x + b, y - h);
      ctx.stroke();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i - 4.5) * 0.32 + Math.sin(t * 0.9 + i) * 0.12;
        const len = 26 * s;
        ctx.strokeStyle = i % 2 ? "#ffd27a" : "#ffb34a";
        ctx.lineWidth = 1.6 * s;
        ctx.beginPath();
        ctx.moveTo(x + b, y - h);
        const ex = x + b + Math.cos(a) * len;
        const ey = y - h + Math.sin(a) * len;
        ctx.quadraticCurveTo(
          x + b + Math.cos(a) * len * 0.5,
          y - h + Math.sin(a) * len * 0.3 - 6 * s,
          ex,
          ey,
        );
        ctx.stroke();
        for (let k = 1; k < 5; k++) {
          const px = x + b + Math.cos(a) * len * (k / 5);
          const py = y - h + Math.sin(a) * len * (k / 5) - 2 * s;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + 3 * s, py - 3 * s);
          ctx.stroke();
        }
      }
    },
    vent(ctx, x, y, s, t) {
      const g = ctx.createLinearGradient(x - 20 * s, 0, x + 20 * s, 0);
      g.addColorStop(0, "#2a2226");
      g.addColorStop(0.5, "#4a3a38");
      g.addColorStop(1, "#201a1c");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - 30 * s, y);
      ctx.lineTo(x - 14 * s, y - 70 * s);
      ctx.lineTo(x - 8 * s, y - 92 * s);
      ctx.lineTo(x + 8 * s, y - 92 * s);
      ctx.lineTo(x + 16 * s, y - 64 * s);
      ctx.lineTo(x + 32 * s, y);
      ctx.fill();
      ctx.fillStyle = "#3a2e2e";
      ctx.beginPath();
      ctx.moveTo(x + 14 * s, y - 40 * s);
      ctx.lineTo(x + 30 * s, y - 52 * s);
      ctx.lineTo(x + 34 * s, y - 40 * s);
      ctx.lineTo(x + 22 * s, y - 20 * s);
      ctx.fill();
      // Glowing mineral cracks.
      const glow = 0.6 + 0.4 * Math.sin(t * 1.7);
      ctx.strokeStyle = `rgba(255,120,40,${0.7 * glow})`;
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      ctx.moveTo(x - 6 * s, y - 88 * s);
      ctx.lineTo(x - 2 * s, y - 60 * s);
      ctx.lineTo(x - 8 * s, y - 30 * s);
      ctx.moveTo(x + 4 * s, y - 70 * s);
      ctx.lineTo(x + 10 * s, y - 40 * s);
      ctx.stroke();
      glowDot(ctx, x, y - 92 * s, 18 * s, "#ff8a3a", 0.35 * glow);
      // Smoke plume.
      for (let i = 0; i < 9; i++) {
        const k = (t * 0.25 + i / 9) % 1;
        const py = y - 92 * s - k * 120 * s;
        const px = x + Math.sin(k * 6 + t) * 8 * s * k;
        ctx.fillStyle = `rgba(60,52,62,${0.22 * (1 - k)})`;
        ctx.beginPath();
        ctx.arc(px, py, (6 + k * 18) * s, 0, TAU);
        ctx.fill();
      }
    },
    relic(ctx, x, y, s, t) {
      const g = ctx.createLinearGradient(0, y - 70 * s, 0, y);
      g.addColorStop(0, "#4a5068");
      g.addColorStop(1, "#262a3c");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - 22 * s, y);
      ctx.lineTo(x - 18 * s, y - 50 * s);
      ctx.quadraticCurveTo(x, y - 74 * s, x + 18 * s, y - 50 * s);
      ctx.lineTo(x + 22 * s, y);
      ctx.fill();
      const glow = 0.5 + 0.5 * Math.sin(t * 0.9);
      ctx.strokeStyle = `rgba(110,240,255,${0.5 + 0.5 * glow})`;
      ctx.lineWidth = 1.6 * s;
      ctx.beginPath();
      ctx.arc(x, y - 44 * s, 9 * s, 0, TAU);
      ctx.moveTo(x, y - 35 * s);
      ctx.lineTo(x, y - 12 * s);
      ctx.moveTo(x - 8 * s, y - 22 * s);
      ctx.lineTo(x + 8 * s, y - 22 * s);
      ctx.stroke();
      glowDot(ctx, x, y - 44 * s, 20 * s, "#6ef0ff", 0.35 * glow);
    },
  };

  // Glow pass for decor that emits light (drawn additively after the night overlay).
  const DECOR_GLOW = {
    glow_crystal(ctx, x, y, s, t) {
      glowDot(ctx, x, y - 26 * s, 42 * s, "#a890ff", 0.35 + 0.15 * Math.sin(t * 1.3));
    },
    tube_worms(ctx, x, y, s, t) {
      glowDot(ctx, x, y - 40 * s, 30 * s, "#ff4a5a", 0.18 + 0.08 * Math.sin(t));
    },
    sea_lily(ctx, x, y, s, t) {
      glowDot(ctx, x, y - 64 * s, 34 * s, "#ffc35a", 0.25 + 0.1 * Math.sin(t * 0.8));
    },
    vent(ctx, x, y, s, t) {
      glowDot(ctx, x, y - 70 * s, 50 * s, "#ff7a2a", 0.22 + 0.08 * Math.sin(t * 1.7));
    },
    relic(ctx, x, y, s, t) {
      glowDot(ctx, x, y - 44 * s, 36 * s, "#6ef0ff", 0.25 + 0.15 * Math.sin(t * 0.9));
    },
    idol(ctx, x, y, s, t) {
      glowDot(ctx, x, y - 41 * s, 20 * s, "#7dffb0", 0.2 + 0.1 * Math.sin(t * 0.8));
    },
    chest(ctx, x, y, s, t) {
      const open = Math.max(0, Math.sin(t * 0.35)) ** 6;
      if (open > 0.05) glowDot(ctx, x, y - 22 * s, 26 * s, "#ffe08a", 0.5 * open);
    },
  };
  DECOR_GLOW.golden_chest = DECOR_GLOW.chest;

  // Bounding size used for hit testing and slot previews (in units of s).
  const DECOR_BOX = { S: { w: 44, h: 40 }, M: { w: 60, h: 100 }, L: { w: 120, h: 110 } };

  // Growth state of the item being drawn: g 0..1 from sprout to mature, bloom 0..1 while it
  // flowers. Plants read it to add leaves and flowers; other living decor (coral) just scales.
  const MATURE = { g: 1, bloom: 0, seed: 0 };
  let look = MATURE;
  const GROWS_BY_ITSELF = new Set([
    "vallisneria",
    "anubias",
    "moss_ball",
    "java_fern",
    "sword_plant",
    "ludwigia",
    "hairgrass",
    "monte_carlo",
    "rotala",
  ]);

  function drawDecor(ctx, id, x, y, s, t, pass, state) {
    const d = DECOR[id];
    if (!d) return;
    look = state || MATURE;
    if (typeof d === "function") {
      if (pass === "back") return;
      if (look.g < 1 && !GROWS_BY_ITSELF.has(id)) {
        const k = 0.4 + 0.6 * look.g;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(k, k);
        d(ctx, 0, 0, s, t);
        ctx.restore();
      } else d(ctx, x, y, s, t);
      look = MATURE;
      return;
    }
    if (pass === "back" || pass === "all") d.back(ctx, x, y, s, t);
    if (pass === "front" || pass === "all") d.front(ctx, x, y, s, t);
  }

  function decorHole(id, x, y, s) {
    const d = DECOR[id];
    return d?.hole ? d.hole(x, y, s) : null;
  }

  function decorOutline(id, x, y, s) {
    const d = DECOR[id];
    return d?.outline ? d.outline(x, y, s) : null;
  }

  function drawDecorGlow(ctx, id, x, y, s, t) {
    if (DECOR_GLOW[id]) DECOR_GLOW[id](ctx, x, y, s, t);
  }

  // ── Items & effects ────────────────────────────────────────────────

  // Coin size and colour grow with value so piles read at a glance.
  function drawCoin(ctx, x, y, r, t, value) {
    const tier = value >= 500 ? 3 : value >= 100 ? 2 : value >= 20 ? 1 : 0;
    const colors = [
      ["#ffe27a", "#e0a81e", "#9c6c08"],
      ["#fff0a8", "#f2b824", "#a5700a"],
      ["#d6fbff", "#5fd7f0", "#16809a"],
      ["#ffd6f6", "#e86ad0", "#8a1f78"],
    ][tier];
    const spin = Math.cos(t * 2.2);
    const w = r * (0.35 + 0.65 * Math.abs(spin));
    ctx.fillStyle = colors[2];
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.12, w, r, 0, 0, TAU);
    ctx.fill();
    const g = ctx.createLinearGradient(x - w, y - r, x + w, y + r);
    g.addColorStop(0, colors[0]);
    g.addColorStop(1, colors[1]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, w, r, 0, 0, TAU);
    ctx.fill();
    if (w > r * 0.5) {
      ctx.strokeStyle = rgba(colors[2], 0.5);
      ctx.lineWidth = Math.max(0.8, r * 0.12);
      ctx.beginPath();
      ctx.ellipse(x, y, w * 0.62, r * 0.62, 0, 0, TAU);
      ctx.stroke();
    }
    const glint = (t * 0.7 + x * 0.01) % 2.5;
    if (glint < 0.4) {
      const a = 1 - glint / 0.4;
      ctx.strokeStyle = `rgba(255,255,255,${a})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.4 - r * 0.5, y - r * 0.6);
      ctx.lineTo(x + w * 0.4 + r * 0.5, y - r * 0.6);
      ctx.moveTo(x + w * 0.4, y - r * 1.1);
      ctx.lineTo(x + w * 0.4, y - r * 0.1);
      ctx.stroke();
    }
  }

  // Algae smear on the front glass: soft green blotch made of overlapping puffs.
  /*
   * Algae film stuck on the front glass: a flat, lumpy patch with darker spots and a few
   * hair-like strands. Each scrub (hp) shrinks and fades it.
   */
  function drawAlgae(ctx, x, y, r, hp, max, seed, t) {
    const rnd = prng(seed);
    const k = 0.5 + 0.5 * (hp / max);
    const R = r * (0.6 + 0.4 * k);
    ctx.save();
    // Lumpy outline.
    const n = 11;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const d = R * (0.7 + rnd() * 0.35);
      pts.push([x + Math.cos(a) * d, y + Math.sin(a) * d * 0.85]);
    }
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[(i + 1) % n];
      if (i === 0) ctx.moveTo((x0 + x1) / 2, (y0 + y1) / 2);
      else ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
    }
    const [fx, fy] = pts[0];
    const [sx, sy] = pts[1];
    ctx.quadraticCurveTo(fx, fy, (fx + sx) / 2, (fy + sy) / 2);
    ctx.fillStyle = `rgba(78,128,46,${0.42 * k})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(150,196,90,${0.35 * k})`;
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.stroke();
    // Darker colonies inside the film.
    ctx.fillStyle = `rgba(46,92,30,${0.45 * k})`;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.ellipse(
        x + (rnd() - 0.5) * R * 1.1,
        y + (rnd() - 0.5) * R * 0.9,
        R * (0.1 + rnd() * 0.14),
        R * (0.08 + rnd() * 0.1),
        rnd() * TAU,
        0,
        TAU,
      );
      ctx.fill();
    }
    // Strands drifting a little in the current.
    ctx.strokeStyle = `rgba(110,170,70,${0.4 * k})`;
    ctx.lineWidth = Math.max(0.8, r * 0.035);
    ctx.lineCap = "round";
    for (let i = 0; i < 5; i++) {
      const a = rnd() * TAU;
      const bx = x + Math.cos(a) * R * 0.75;
      const by = y + Math.sin(a) * R * 0.65;
      const len = R * (0.14 + rnd() * 0.16);
      const sway = Math.sin(t * 1.2 + i + seed) * len * 0.25;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(
        bx + Math.cos(a) * len * 0.6 + sway,
        by + Math.sin(a) * len * 0.6,
        bx + Math.cos(a) * len + sway * 1.5,
        by + Math.sin(a) * len + len * 0.2,
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawDebris(ctx, x, y, r, seed) {
    const rnd = prng(seed);
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = ["#5a4630", "#6e5a3a", "#4a3a28", "#7a6a48"][i % 4];
      ctx.beginPath();
      ctx.ellipse(
        x + (rnd() - 0.5) * r * 2,
        y - rnd() * r * 0.4,
        r * (0.25 + rnd() * 0.3),
        r * (0.15 + rnd() * 0.15),
        rnd() * 3,
        0,
        TAU,
      );
      ctx.fill();
    }
  }

  function drawEggs(ctx, x, y, r, ready, t, m) {
    if (m) return drawShopEgg(ctx, x, y, r, ready, t, m === 2);
    const rnd = prng(Math.round(x * 31));
    for (let i = 0; i < 9; i++) {
      const ex = x + (rnd() - 0.5) * r * 1.8;
      const ey = y + (rnd() - 0.5) * r;
      const g = ctx.createRadialGradient(ex - r * 0.08, ey - r * 0.08, 0, ex, ey, r * 0.26);
      g.addColorStop(0, "rgba(255,255,240,0.95)");
      g.addColorStop(1, ready ? "rgba(255,200,120,0.85)" : "rgba(230,220,190,0.75)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ex, ey, r * 0.24, 0, TAU);
      ctx.fill();
      if (ready) {
        ctx.fillStyle = "#222";
        ctx.beginPath();
        ctx.arc(ex + r * 0.05, ey, r * 0.06, 0, TAU);
        ctx.fill();
      }
    }
    if (ready) glowDot(ctx, x, y, r * 1.6, "#fff2b0", 0.25 + 0.15 * Math.sin(t * 3));
  }

  // A single bought egg resting on the sand, rocking gently once it is ready to hatch.
  function drawShopEgg(ctx, x, y, r, ready, t, gold) {
    const rock = ready ? Math.sin(t * 6) * 0.12 * Math.max(0, Math.sin(t * 1.3)) : 0;
    ctx.save();
    ctx.translate(x, y + r * 0.2);
    ctx.rotate(rock);
    const h = r * 0.95;
    const w = r * 0.7;
    const g = ctx.createRadialGradient(-w * 0.3, -h * 0.5, 0, 0, -h * 0.3, h * 1.1);
    if (gold) {
      g.addColorStop(0, "#fff6c8");
      g.addColorStop(0.5, "#f5c542");
      g.addColorStop(1, "#a8741a");
    } else {
      g.addColorStop(0, "#fffdf4");
      g.addColorStop(1, "#d9cca8");
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -h);
    ctx.bezierCurveTo(w, -h, w, 0, w * 0.95, -h * 0.05);
    ctx.bezierCurveTo(w * 0.9, h * 0.3, -w * 0.9, h * 0.3, -w * 0.95, -h * 0.05);
    ctx.bezierCurveTo(-w, 0, -w, -h, 0, -h);
    ctx.fill();
    if (!gold) {
      ctx.fillStyle = "rgba(90,140,160,0.55)";
      for (const [dx, dy, dr] of [
        [-0.3, -0.55, 0.09],
        [0.25, -0.35, 0.07],
        [-0.1, -0.15, 0.06],
        [0.35, -0.7, 0.05],
      ]) {
        ctx.beginPath();
        ctx.arc(dx * w * 1.4, dy * h, dr * r, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
    if (gold || ready)
      glowDot(
        ctx,
        x,
        y - r * 0.2,
        r * 1.8,
        gold ? "#ffd75a" : "#fff2b0",
        (gold ? 0.3 : 0.2) + 0.15 * Math.sin(t * 3),
      );
  }

  const FOOD_COLORS = {
    flakes: ["#f2a03a", "#e8d24a", "#d8603a"],
    pellets: ["#a8642e", "#8f5426"],
    worms: ["#c8283a", "#a01e30"],
    brine: ["#ff8a6a", "#ffb08a"],
    krill: ["#ff5a3a", "#ffa07a"],
  };

  function drawFood(ctx, kind, x, y, r, seed, t) {
    const cols = FOOD_COLORS[kind] || FOOD_COLORS.flakes;
    ctx.fillStyle = cols[seed % cols.length];
    if (kind === "flakes") {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * 1.5 + seed);
      ctx.beginPath();
      ctx.moveTo(-r, -r * 0.3);
      ctx.lineTo(r * 0.6, -r * 0.7);
      ctx.lineTo(r, r * 0.4);
      ctx.lineTo(-r * 0.4, r * 0.6);
      ctx.fill();
      ctx.restore();
    } else if (kind === "worms") {
      ctx.strokeStyle = cols[0];
      ctx.lineWidth = r * 0.6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x - r, y);
      ctx.quadraticCurveTo(x, y - r * Math.sin(t * 4 + seed), x + r, y);
      ctx.stroke();
    } else if (kind === "brine" || kind === "krill") {
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.45, Math.sin(t * 3 + seed) * 0.4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#222";
      ctx.fillRect(x + r * 0.5, y - r * 0.2, r * 0.25, r * 0.25);
    } else {
      ctx.beginPath();
      ctx.arc(x, y, r * 0.75, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.beginPath();
      ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.25, 0, TAU);
      ctx.fill();
    }
  }

  function drawBubble(ctx, x, y, r) {
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = Math.max(0.6, r * 0.18);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.22, 0, TAU);
    ctx.fill();
  }

  // Play toy: a glowing light ball.
  function drawToy(ctx, x, y, r, t) {
    glowDot(ctx, x, y, r * 3.2, "#fff3a0", 0.45 + 0.15 * Math.sin(t * 6));
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(1, "#ffcf3a");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  /*
   * Render a small preview of a species or decor item into a data URL, used in the shop
   * and Fishdex. Results are cached.
   */
  const previewCache = new Map();

  const PREVIEW_PIXELS = 56;

  // Snap anti-aliased edges to whole pixels; translucent areas keep one partial alpha step.
  function hardenEdges(ctx, w, h) {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 3; i < d.length; i += 4) {
      const a = d[i];
      if (a === 0 || a === 255) continue;
      d[i] = a < 90 ? 0 : a > 200 ? 255 : 170;
    }
    ctx.putImageData(img, 0, 0);
  }

  function preview(kind, id, variant, size, opts) {
    const silhouette = opts?.silhouette;
    const key = `${kind}|${id}|${variant}|${size}|${silhouette ? 1 : 0}`;
    if (previewCache.has(key)) return previewCache.get(key);
    // Previews are pixel art too: a small grid the page scales up with image-rendering: pixelated.
    const dpr = PREVIEW_PIXELS / size;
    const canvas = document.createElement("canvas");
    canvas.width = PREVIEW_PIXELS;
    canvas.height = PREVIEW_PIXELS;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;
    const tankPx = artPx;
    artPx = 1 / dpr;
    if (kind === "fish") {
      const art = speciesArt(id);
      if (id === "moray") {
        const pts = [];
        for (let i = 0; i < 16; i++)
          pts.push({
            x: size * 0.85 - i * size * 0.05,
            y: size * 0.5 + Math.sin(i * 0.7) * size * 0.08,
          });
        drawEel(ctx, variant, pts, size * 0.06, { phase: 1 });
      } else {
        // Big veil tails reach far behind the body, so shrink those fish and shift them forward.
        const tail = Math.max(1, art.tailSize || 0);
        const L = (size * 0.62 * Math.min(1.25, Math.max(0.8, art.len))) / (1 + (tail - 1) * 1.6);
        const x = id === "jelly" ? 0.5 : 0.56 + (tail - 1) * 0.6;
        ctx.translate(size * x, size * (id === "jelly" ? 0.4 : SPECIAL[id] ? 0.66 : 0.52));
        drawFish(ctx, id, variant, L, { phase: 1.2, effort: 0, dpr });
      }
    } else if (kind === "decor") {
      const box = DECOR_BOX[opts.size];
      const s = Math.min((size * 0.9) / box.w, (size * 0.9) / box.h);
      drawDecor(ctx, id, size / 2, size * 0.94, s, 1, "all");
    }
    artPx = tankPx;
    hardenEdges(ctx, PREVIEW_PIXELS, PREVIEW_PIXELS);
    if (silhouette) {
      ctx.globalCompositeOperation = "source-in";
      ctx.fillStyle = "rgba(20,40,60,0.55)";
      ctx.fillRect(0, 0, size, size);
    }
    const url = canvas.toDataURL();
    previewCache.set(key, url);
    return url;
  }

  root.AquaArt = {
    setArtPixel,
    hardenEdges,
    BIOMES,
    SAND_TOP,
    FISH,
    SPECIAL,
    DECOR_BOX,
    speciesArt,
    palette,
    rgba,
    shade,
    drawBackground,
    drawRays,
    drawCaustics,
    drawFish,
    drawFishGlow,
    drawEel,
    drawDecor,
    drawDecorGlow,
    decorHole,
    decorOutline,
    drawCoin,
    drawAlgae,
    drawDebris,
    drawEggs,
    drawFood,
    drawBubble,
    drawToy,
    glowDot,
    preview,
  };
})(typeof self !== "undefined" ? self : this);
