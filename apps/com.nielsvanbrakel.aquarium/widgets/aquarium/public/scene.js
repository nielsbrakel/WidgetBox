/*
 * Aquarium scene: the animated tank.
 *
 * Owns the canvas, the render loop and every purely visual entity (fish movement, food
 * bits, bubbles, effects). Game state comes in through sync(); things the player causes in
 * the tank (a fish eating, food dissolving, a fish catching the toy) go out through hooks.
 * Nothing here changes the save directly.
 */
((root) => {
  // biome-ignore lint/suspicious/noRedundantUseStrict: loaded as a classic script, not a module
  "use strict";

  const A = root.AquaArt;
  const C = root.AquaCatalog;
  const E = root.AquaEngine;
  const TAU = Math.PI * 2;
  // Fry, juvenile and adult size relative to the adult.
  const STAGE_SCALE = [0.45, 0.72, 1];
  // Smallest fish in art pixels, so even fry keep an eye and a tail.
  const MIN_FISH_ART = 5;
  const ZONES = { top: [0.1, 0.38], mid: [0.22, 0.62], low: [0.5, 0.74] };
  const BOTTOM_MOVERS = { crawl: true, bottom: true };

  function rnd01(id, k) {
    return E.rand(id, k);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function dist(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }

  // The tank is painted into a small buffer of about this many rows and scaled up with hard
  // edges, which gives the high-resolution pixel-art look.
  const PIXEL_ROWS = 110;
  // Where each decor layer stands on the sand (0 waterline .. 1 front glass) and how big it is.
  // spread staggers pieces within a layer so a densely planted tank doesn't stand in a line.
  const ROWS = {
    back: { y: 0.1, scale: 1.1, spread: 0.12 },
    mid: { y: 0.45, scale: 1.12, spread: 0.18 },
    front: { y: 0.8, scale: 1, spread: 0.14 },
  };
  const LAYER_ORDER = ["back", "mid", "front"];
  // Colour levels per channel after ordered dithering; fewer levels look more retro.
  const COLOR_LEVELS = 12;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16 - 0.5);

  class Scene {
    constructor(canvas, hooks) {
      this.canvas = canvas;
      this.out = canvas.getContext("2d");
      this.lo = document.createElement("canvas");
      this.ctx = this.lo.getContext("2d", { willReadFrequently: true });
      this.layer = document.createElement("canvas");
      this.lctx = this.layer.getContext("2d", { willReadFrequently: true });
      this.hooks = hooks;
      this.W = 0;
      this.H = 0;
      this.dpr = 1;
      this.t = 0;
      this.fps = 60;
      this.light = 1;
      this.lightMode = "auto";
      this.mode = "look";
      this.tankId = null;
      this.agents = new Map();
      this.food = [];
      this.bubbles = [];
      this.motes = [];
      this.fx = [];
      this.drops = [];
      this.dropSeen = new Map();
      this.algae = [];
      this.debris = [];
      this.eggs = [];
      this.decor = [];
      this.placing = null;
      this.toy = null;
      this.pointer = null;
      this.tankInfo = null;
      this.bg = null;
      this.foodSeq = 0;
      this.running = false;
      this.lastFrame = 0;
      this.frame = this.frame.bind(this);
    }

    // ── Layout ───────────────────────────────────────────────────────

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const W = Math.max(1, Math.round(rect.width));
      const H = Math.max(1, Math.round(rect.height));
      const screen = Math.min(3, window.devicePixelRatio || 1);
      // Whole device pixels per art pixel keep every art pixel the same size on screen.
      const dev = Math.max(2, Math.round((H * screen) / PIXEL_ROWS));
      if (W === this.W && H === this.H && dev === this.dev && screen === this.screen) return;
      const sx = this.W ? W / this.W : 1;
      const sy = this.H ? H / this.H : 1;
      this.W = W;
      this.H = H;
      this.screen = screen;
      this.dev = dev;
      // Art pixels per CSS pixel: everything below draws in CSS units at this scale.
      this.dpr = screen / dev;
      A.setArtPixel(1 / this.dpr);
      this.lo.width = Math.ceil(W * this.dpr);
      this.lo.height = Math.ceil(H * this.dpr);
      this.layer.width = this.lo.width;
      this.layer.height = this.lo.height;
      this.canvas.width = Math.round(W * screen);
      this.canvas.height = Math.round(H * screen);
      this.bg = null;
      for (const a of this.agents.values()) {
        a.x *= sx;
        a.y *= sy;
        this.sizeAgent(a);
        if (a.trail) a.trail = null;
      }
      // Homes hold positions in pixels, so they follow the new size.
      this.assignHomes();
    }

    get sandY() {
      return this.H * A.SAND_TOP;
    }

    // Decor scale: 1 at a 360 px tall tank.
    get s() {
      return this.H / 360;
    }

    get unit() {
      return Math.min(this.W, (this.H * 4) / 3) * 0.12;
    }

    // Where a piece of decor stands: its own x, its layer's depth plus a small stagger.
    decorPos(d) {
      const depth = this.H - this.sandY;
      const row = ROWS[d.row] || ROWS.back;
      const k = (E.hash(d.id) % 1000) / 1000 - 0.5;
      return {
        x: d.x * this.W,
        y: this.sandY + depth * (row.y + k * row.spread),
        scale: this.s * row.scale * (1 + k * 0.08),
      };
    }

    layerPoint(row, x) {
      const r = ROWS[row] || ROWS.back;
      return {
        x: x * this.W,
        y: this.sandY + (this.H - this.sandY) * r.y,
        scale: this.s * r.scale,
      };
    }

    decorBox(d) {
      const p = this.decorPos(d);
      const box = A.DECOR_BOX[C.DECOR[d.d].size];
      const w = box.w * p.scale;
      const h = box.h * p.scale;
      return { x: p.x - w / 2, y: p.y - h, w, h };
    }

    // Decor of one layer in drawing order, back to front.
    layerDecor(row) {
      return this.decor
        .filter((d) => d.row === row)
        .map((d) => ({ d, p: this.decorPos(d) }))
        .sort((a, b) => a.p.y - b.p.y);
    }

    // ── State sync ───────────────────────────────────────────────────

    /*
     * Bring visual entities in line with the save. Existing fish keep their position;
     * new fish splash in from the surface, removed fish fade out.
     */
    sync(save, now, tankId) {
      const tank = save.tanks[tankId];
      const switching = tankId !== this.tankId;
      if (switching) {
        this.tankId = tankId;
        this.bg = null;
        this.agents.clear();
        this.food = [];
        this.bubbles = [];
        this.fx = [];
        this.toy = null;
        this.dropSeen.clear();
        this.motes = [];
      }
      this.tankInfo = E.tankInfo(save, tankId, now);
      this.decor = tank.decor.map((d) => ({ ...d, look: E.decorGrowth(d, now) }));

      const seen = new Set();
      tank.fish.forEach((f, index) => {
        seen.add(f.id);
        let a = this.agents.get(f.id);
        if (!a) {
          a = this.createAgent(f, switching);
          this.agents.set(f.id, a);
        }
        a.index = index;
        if (a.stage !== f.stage || a.v !== f.v) {
          a.stage = f.stage;
          a.v = f.v;
          this.sizeAgent(a);
        }
        a.fed = f.fed;
        a.playReady = E.playReady(f, now);
        a.playful = f.buff > now;
        a.leaving = false;
      });
      for (const a of this.agents.values()) if (!seen.has(a.id)) a.leaving = true;
      this.assignHomes();

      const drops = [];
      for (const d of tank.drops) {
        drops.push(d);
        if (!this.dropSeen.has(d.id)) this.dropSeen.set(d.id, switching ? 0 : this.t);
      }
      this.drops = drops;
      this.algae = tank.algae.slice();
      this.debris = tank.debris.slice();
      this.eggs = tank.eggs.map((e) => ({ ...e, ready: E.eggReady(e, now) }));
    }

    createAgent(f, instant) {
      const sp = C.SPECIES[f.s];
      const art = A.speciesArt(f.s);
      const zone = ZONES[sp.zone] || ZONES.mid;
      const a = {
        id: f.id,
        s: f.s,
        v: f.v,
        stage: f.stage,
        sp,
        art,
        move: sp.move,
        zone,
        speedK: 0.75 + rnd01(f.id, "spd") * 0.5,
        z: 0.84 + rnd01(f.id, "z") * 0.16,
        x: (0.12 + rnd01(f.id, "x") * 0.76) * this.W,
        y: lerp(zone[0], zone[1], rnd01(f.id, "y")) * this.H,
        vx: 0,
        vy: 0,
        dir: rnd01(f.id, "dir") < 0.5 ? -1 : 1,
        face: 1,
        phase: rnd01(f.id, "ph") * TAU,
        tx: 0,
        ty: 0,
        timer: 0,
        pause: 0,
        effort: 0.3,
        mouth: 0,
        alpha: instant ? 1 : 0,
        fed: f.fed,
        target: null,
        home: null,
        hidden: 0,
        state: "wander",
      };
      a.face = a.dir;
      if (BOTTOM_MOVERS[a.move]) a.y = this.sandY + 3;
      if (!instant) a.y = Math.min(a.y, this.H * 0.12);
      this.sizeAgent(a);
      this.pickTarget(a);
      return a;
    }

    sizeAgent(a) {
      // Sizes follow real adult lengths, in art pixels so a fish looks the same on any widget:
      // a 2 cm ember tetra is about 6 pixels long, a 24 cm tang about 24. The curve is
      // flattened a little so nano fish stay readable and big fish don't crowd the tank.
      const cm = a.sp.cm || 6;
      const art = (4 + 1.15 * cm ** 0.85) * STAGE_SCALE[a.stage];
      const jitter = 0.94 + rnd01(a.id, "size") * 0.12;
      a.L = Math.max(MIN_FISH_ART, art * jitter * a.z) / this.dpr;
      if (a.move === "eel") a.L = this.unit * 2.4 * STAGE_SCALE[a.stage];
    }

    // Find decor that works as a home: caves for the eel, the anemone for clownfish.
    assignHomes() {
      for (const a of this.agents.values()) {
        a.home = null;
        const wants = a.sp.needs || (a.sp.likes || []).find((t) => t === "cave");
        if (!wants) continue;
        for (const d of this.decor) {
          if (d.row === "front") continue;
          const tags = C.DECOR[d.d].tags;
          if (!tags.includes(wants)) continue;
          const p = this.decorPos(d);
          const hole = A.decorHole(d.d, p.x, p.y, p.scale);
          if (wants === "anemone") {
            a.home = { slot: d.id, kind: "anemone", x: p.x, y: p.y - 34 * p.scale, s: p.scale };
            break;
          }
          if (hole) {
            a.home = {
              slot: d.id,
              kind: "hole",
              decor: d.d,
              hole,
              outline: A.decorOutline(d.d, p.x, p.y, p.scale),
              s: p.scale,
            };
            break;
          }
        }
        if (a.move === "eel" && a.home?.kind !== "hole") a.home = null;
      }
    }

    // ── Modes & interaction ──────────────────────────────────────────

    setMode(mode) {
      this.mode = mode;
      if (mode !== "play") this.toy = null;
      if (mode !== "place" && mode !== "move") this.placing = null;
    }

    // Place or move mode: which piece, and the layer it will stand in.
    setPlacing(opts) {
      this.placing = opts ? { d: opts.d, id: opts.id || null, row: opts.row } : null;
    }

    setPointer(p) {
      this.pointer = p;
    }

    dropFood(x, foodId) {
      const food = C.FOODS[foodId];
      for (let i = 0; i < food.portion; i++) {
        const seed = ++this.foodSeq;
        this.food.push({
          seed,
          food: foodId,
          x: Math.max(6, Math.min(this.W - 6, x + (Math.random() - 0.5) * 26)),
          y: this.H * 0.035 + Math.random() * 4,
          vy: 0,
          float: foodId === "flakes" ? 0.8 + Math.random() : 0.1,
          settled: 0,
          age: 0,
        });
      }
      this.ripple(x, this.H * 0.04, "#ffffff");
    }

    placeToy(x, y) {
      this.toy = { x, y, born: this.t };
      this.ripple(x, y, "#fff3a0");
    }

    /*
     * What is under a tap at (x, y) in CSS pixels. Touch targets are padded so small
     * things like coins stay easy to hit with a finger.
     */
    hitTest(x, y) {
      const pad = Math.max(16, this.unit * 0.45);
      let best = null;
      let bestD = Infinity;
      const consider = (type, id, px, py, r) => {
        const d = dist(x, y, px, py);
        if (d <= r && d < bestD) {
          bestD = d;
          best = { type, id, x: px, y: py };
        }
      };
      for (const d of this.drops) {
        const p = this.dropPos(d);
        consider("drop", d.id, p.x, p.y, pad * 1.1);
      }
      if (best) return best;
      for (const e of this.eggs) {
        const p = this.eggPos(e);
        consider("egg", e.id, p.x, p.y, pad);
      }
      if (best) return best;
      for (const a of this.algae)
        consider("algae", a.id, a.x * this.W, a.y * this.H, Math.max(pad, this.algaeR(a)));
      if (best) return best;
      for (const d of this.debris) {
        const p = this.debrisPos(d);
        consider("debris", d.id, p.x, p.y, pad);
      }
      if (best) return best;
      for (const a of this.agents.values()) {
        if (a.leaving || a.hidden > 0.6) continue;
        const p = this.agentCenter(a);
        consider("fish", a.id, p.x, p.y, Math.max(pad, a.L * 0.6));
      }
      if (best) return best;
      for (const row of [...LAYER_ORDER].reverse()) {
        const list = this.layerDecor(row);
        for (let i = list.length - 1; i >= 0; i--) {
          const b = this.decorBox(list[i].d);
          if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)
            return { type: "decor", id: list[i].d.id, x: b.x + b.w / 2, y: b.y };
        }
      }
      return { type: "water", x, y };
    }

    locate(type, id) {
      if (type === "drop") {
        const d = this.drops.find((x) => x.id === id) || this.drops[0];
        return d ? this.dropPos(d) : null;
      }
      if (type === "algae") {
        const a = this.algae.find((x) => x.id === id) || this.algae[0];
        return a ? { x: a.x * this.W, y: a.y * this.H } : null;
      }
      if (type === "debris") {
        const d = this.debris.find((x) => x.id === id) || this.debris[0];
        return d ? this.debrisPos(d) : null;
      }
      if (type === "egg") {
        const e = this.eggs.find((x) => x.id === id) || this.eggs[0];
        return e ? this.eggPos(e) : null;
      }
      if (type === "fish") {
        const a = this.agents.get(id) || this.agents.values().next().value;
        return a ? this.agentCenter(a) : null;
      }
      if (type === "layer") return this.layerPoint(id.row, id.x);
      return null;
    }

    dropPos(d) {
      const depth = this.H - this.sandY;
      const base = this.sandY + depth * (0.32 + rnd01(d.id, "dy") * 0.3);
      const born = this.dropSeen.get(d.id) || 0;
      const k = Math.min(1, (this.t - born) / 0.8);
      const y = lerp(this.H * 0.45, base, k * k);
      return { x: d.x * this.W, y: y + Math.sin(this.t * 2 + d.x * 20) * 1.2 };
    }

    debrisPos(d) {
      const depth = this.H - this.sandY;
      return { x: d.x * this.W, y: this.sandY + depth * (0.2 + rnd01(d.id, "dy") * 0.15) };
    }

    eggPos(e) {
      return { x: e.x * this.W, y: this.sandY + (this.H - this.sandY) * 0.12 };
    }

    algaeR(a) {
      return this.unit * (0.42 + 0.14 * a.max);
    }

    agentCenter(a) {
      if (a.move === "eel" && a.pts) return { x: a.pts[0].x, y: a.pts[0].y };
      if (BOTTOM_MOVERS[a.move]) return { x: a.x, y: a.y - a.L * 0.2 };
      return { x: a.x, y: a.y };
    }

    // ── Effects ──────────────────────────────────────────────────────

    ripple(x, y, color) {
      this.fx.push({ kind: "ripple", x, y, color, t0: this.t, life: 0.6 });
    }

    floatText(x, y, text, color) {
      this.fx.push({ kind: "text", x, y, text, color: color || "#ffe27a", t0: this.t, life: 1.3 });
    }

    coinFly(x, y, tx, ty, value) {
      const n = Math.min(6, 1 + Math.floor(Math.log10(Math.max(1, value)) * 2));
      for (let i = 0; i < n; i++) {
        this.fx.push({
          kind: "coin",
          x,
          y,
          tx,
          ty,
          value,
          t0: this.t + i * 0.06,
          life: 0.7,
          ox: (Math.random() - 0.5) * 40,
        });
      }
    }

    sparkle(x, y, color, n) {
      for (let i = 0; i < (n || 8); i++) {
        const a = Math.random() * TAU;
        const sp = 20 + Math.random() * 40;
        this.fx.push({
          kind: "spark",
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          color: color || "#ffffff",
          t0: this.t,
          life: 0.5 + Math.random() * 0.3,
        });
      }
    }

    hearts(id) {
      const a = this.agents.get(id);
      if (!a) return;
      const p = this.agentCenter(a);
      this.fx.push({ kind: "heart", x: p.x, y: p.y - a.L * 0.3, t0: this.t, life: 1.2 });
    }

    scrubFx(x, y) {
      this.sparkle(x, y, "#e8ffe0", 10);
      for (let i = 0; i < 5; i++)
        this.bubbles.push({
          x: x + (Math.random() - 0.5) * 20,
          y,
          r: 1.5 + Math.random() * 2.5,
          vy: 20 + Math.random() * 20,
          ph: Math.random() * TAU,
        });
    }

    vacuumFx(x, y) {
      for (let i = 0; i < 10; i++) {
        this.fx.push({
          kind: "suck",
          x: x + (Math.random() - 0.5) * 24,
          y: y - Math.random() * 6,
          t0: this.t,
          life: 0.5,
          color: "#6e5a3a",
        });
      }
    }

    // ── Behaviour ────────────────────────────────────────────────────

    pickTarget(a) {
      const W = this.W;
      const H = this.H;
      const seed = `${a.id}:${Math.floor(this.t * 10)}`;
      const r = (k) => E.rand(seed, k);
      a.timer = 3 + r("t") * 6;
      if (BOTTOM_MOVERS[a.move]) {
        a.tx = (0.05 + r("x") * 0.9) * W;
        a.ty = a.move === "crawl" ? this.sandY + 3 : this.sandY - a.L * (0.12 + r("y") * 0.25);
        a.pause = r("p") < 0.45 ? 1.5 + r("pp") * 4 : 0;
        return;
      }
      if (a.home && a.home.kind === "anemone" && r("h") < 0.85) {
        a.tx = a.home.x + (r("x") - 0.5) * 70 * a.home.s;
        a.ty = a.home.y + (r("y") - 0.5) * 40 * a.home.s;
        a.nestle = r("n") < 0.6;
        if (a.nestle) {
          // Settle into the tentacles for a while, like real clownfish.
          a.timer += 4;
          a.tx = a.home.x + (r("x") - 0.5) * 14 * a.home.s;
          a.ty = a.home.y + 6 * a.home.s;
        }
        return;
      }
      if (a.home && a.home.kind === "hole" && a.move !== "eel" && r("h") < 0.22) {
        a.state = "hide";
        a.tx = a.home.hole.x;
        a.ty = a.home.hole.y;
        a.timer = 10;
        return;
      }
      a.state = "wander";
      a.tx = (0.06 + r("x") * 0.88) * W;
      a.ty = lerp(a.zone[0], a.zone[1], r("y")) * H;
      if (a.fed < 30) a.ty = Math.min(this.sandY - a.L * 0.4, a.ty + H * 0.08);
      a.pause = a.move === "hover" ? 1 + r("p") * 4 : r("p") < 0.15 ? 0.6 + r("pp") * 1.6 : 0;
    }

    nearestFood(a) {
      if (a.fed >= 92) return null;
      let best = null;
      let bestD = Infinity;
      const eats = a.sp.eats;
      const bottom = BOTTOM_MOVERS[a.move];
      for (const f of this.food) {
        if (!eats.includes(f.food)) continue;
        if (bottom && f.y < this.sandY - this.H * 0.12) continue;
        if (a.move === "crawl" && !f.settled) continue;
        const d = dist(a.x, a.y, f.x, f.y);
        if (d < bestD) {
          bestD = d;
          best = f;
        }
      }
      return best;
    }

    updateAgent(a, dt) {
      const W = this.W;
      const H = this.H;
      a.alpha = a.leaving ? Math.max(0, a.alpha - dt * 1.5) : Math.min(1, a.alpha + dt * 1.2);
      a.mouth = Math.max(0, a.mouth - dt * 4);
      if (a.move === "eel") return this.updateEel(a, dt);

      const hungry = a.fed < 30;
      let base =
        this.unit *
        (a.move === "crawl" ? 0.25 : a.move === "bottom" ? 0.9 : a.move === "hover" ? 0.55 : 1.25) *
        a.speedK;
      if (hungry) base *= 0.7;
      if (a.playful) base *= 1.15;
      let tx = a.tx;
      let ty = a.ty;
      let speed = base;
      let chasing = false;

      const food = this.nearestFood(a);
      if (food) {
        // Aim the mouth, not the body centre, at the food.
        const side = food.x >= a.x ? 1 : -1;
        tx = food.x - side * a.L * 0.4;
        ty = a.move === "crawl" ? this.sandY + 3 : food.y;
        speed = base * 1.9;
        chasing = true;
        a.pause = 0;
        const mouthX = a.x + a.face * a.L * 0.45;
        const reach = Math.max(8, a.L * 0.4);
        if (dist(mouthX, a.y, food.x, food.y) < reach || dist(a.x, a.y, food.x, food.y) < reach) {
          this.food.splice(this.food.indexOf(food), 1);
          a.mouth = 1;
          a.fed = Math.min(100, a.fed + (C.FOODS[food.food].restore || 30));
          this.sparkle(food.x, food.y, "#fff2c0", 3);
          this.hooks.onEat(a.id, food.food);
        }
      } else if (this.toy && a.playReady && a.move !== "crawl") {
        tx = this.toy.x;
        ty = BOTTOM_MOVERS[a.move] ? a.y : this.toy.y;
        speed = base * 2.2;
        chasing = true;
        a.pause = 0;
        if (dist(a.x, a.y, this.toy.x, this.toy.y) < Math.max(10, a.L * 0.5)) {
          a.playReady = false;
          a.playful = true;
          this.hearts(a.id);
          this.hooks.onPlay(a.id);
        }
      } else if (a.move === "school") {
        // Shoaling: the lowest-index fish leads and wanders; the others steer towards the
        // middle of the group and the leader, match the group's heading and keep a body
        // length apart, so the school moves as one tight, shifting cloud.
        const leader = this.schoolLeader(a);
        if (leader && leader !== a) {
          let n = 0;
          let cx = 0;
          let cy = 0;
          let vx = 0;
          let vy = 0;
          let sx = 0;
          let sy = 0;
          const room = a.L * 1.3;
          for (const b of this.agents.values()) {
            if (b === a || b.s !== a.s || b.leaving) continue;
            n++;
            cx += b.x;
            cy += b.y;
            vx += b.vx;
            vy += b.vy;
            const d = dist(a.x, a.y, b.x, b.y);
            if (d < room && d > 0.01) {
              sx += ((a.x - b.x) / d) * (room - d);
              sy += ((a.y - b.y) / d) * (room - d);
            }
          }
          cx /= n;
          cy /= n;
          vx /= n;
          vy /= n;
          const wobble = Math.sin(this.t * 0.9 + a.index * 1.7) * a.L * 0.6;
          tx = (cx + leader.x) / 2 + vx * 0.5 + sx * 1.6 - leader.face * a.L * 0.8;
          ty = (cy + leader.y) / 2 + vy * 0.3 + sy * 1.6 + wobble * 0.5;
          const far = dist(a.x, a.y, tx, ty);
          speed = base * (far > a.L * 4 ? 1.7 : far > a.L * 1.5 ? 1.2 : 0.9);
          a.pause = 0;
          a.timer = 5;
        } else if (leader === a) {
          speed = base * 0.75;
        }
      }

      if (!chasing && a.pause > 0) {
        a.pause -= dt;
        speed = 0;
      } else if (!chasing) {
        a.timer -= dt;
        if (a.state === "hide") {
          const near = dist(a.x, a.y, a.tx, a.ty) < a.L * 0.3;
          a.hidden = near ? Math.min(1, a.hidden + dt * 0.8) : Math.max(0, a.hidden - dt * 2);
          speed = base * (near ? 0.15 : 0.8);
          if (a.timer <= 0) {
            a.state = "wander";
            this.pickTarget(a);
          }
        } else {
          a.hidden = Math.max(0, a.hidden - dt * 1.5);
          if (a.timer <= 0 || dist(a.x, a.y, tx, ty) < Math.max(4, a.L * 0.3)) this.pickTarget(a);
        }
      }

      if (a.move === "jelly") {
        // Pulse upward, drift down.
        a.phase += dt * 2.4;
        const pulse = Math.max(0, Math.sin(a.phase * 0.5));
        a.vy = lerp(a.vy, -pulse * this.unit * 1.2 + this.unit * 0.25, dt * 2);
        a.vx = lerp(a.vx, Math.sign(tx - a.x) * this.unit * 0.25, dt * 0.5);
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        a.y = Math.max(H * 0.12, Math.min(this.sandY - a.L * 0.7, a.y));
        a.x = Math.max(a.L * 0.5, Math.min(W - a.L * 0.5, a.x));
        a.face = 1;
        return;
      }

      const dx = tx - a.x;
      const dy = ty - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const arrive = chasing ? 1 : Math.min(1, d / (a.L * 1.2));
      const desiredX = (dx / d) * speed * arrive;
      const desiredY = (dy / d) * speed * arrive * (BOTTOM_MOVERS[a.move] ? 0.5 : 0.7);
      const steer = Math.min(1, dt * (chasing ? 4 : 1.8));
      a.vx += (desiredX - a.vx) * steer;
      a.vy += (desiredY - a.vy) * steer;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      if (a.move === "crawl") a.y = this.sandY + 3;
      a.x = Math.max(a.L * 0.3, Math.min(W - a.L * 0.3, a.x));
      a.y = Math.max(
        H * 0.07,
        Math.min(BOTTOM_MOVERS[a.move] ? this.sandY + 4 : this.sandY - a.L * 0.15, a.y),
      );

      if (Math.abs(a.vx) > this.unit * 0.08) a.dir = a.vx > 0 ? 1 : -1;
      a.face += (a.dir - a.face) * Math.min(1, dt * 5);
      const sp = Math.hypot(a.vx, a.vy) / (this.unit * 1.25);
      a.effort = lerp(a.effort, Math.min(1, sp), dt * 3);
      a.phase += dt * (3 + a.effort * 9) * (a.move === "crawl" ? 0.5 : 1);
    }

    schoolLeader(a) {
      let leader = null;
      for (const b of this.agents.values()) {
        if (b.s !== a.s || b.leaving) continue;
        if (!leader || b.index < leader.index) leader = b;
      }
      return leader;
    }

    /*
     * Moray eel. At home it peeks out of its cave with the body hidden inside the rock;
     * now and then it slides out, patrols the bottom and returns. The body follows the
     * head's path so it flows out of the cave opening like a real eel.
     */
    updateEel(a, dt) {
      const seg = a.L / 17;
      const N = 18;
      a.phase += dt * 2;
      const home = a.home;
      if (!a.state || a.state === "wander") a.state = home ? "home" : "roam";
      if (a.state === "home" && !home) a.state = "roam";

      if (a.state === "home") {
        const h = home.hole;
        const out = { x: -1, y: 0.15 };
        a.peekT = (a.peekT ?? -1.2) + 0;
        const target =
          a.fed < 30 || this.food.some((f) => a.sp.eats.includes(f.food))
            ? 2.2
            : 1.45 + 0.4 * Math.sin(this.t * 0.4 + a.speedK * 5);
        a.peek = lerp(a.peek ?? 0.8, target, dt * 0.8);
        const hx = h.x + out.x * h.rx * a.peek;
        const hy = h.y + out.y * h.rx * a.peek + Math.sin(this.t * 1.5) * h.ry * 0.12;
        // Body folds back into the rock interior, where it is hidden by the cave clip.
        const inner = [
          { x: h.x + 40 * home.s, y: h.y },
          { x: h.x + 40 * home.s, y: h.y - 30 * home.s },
          { x: h.x - 8 * home.s, y: h.y - 34 * home.s },
        ];
        const pts = [{ x: hx, y: hy }];
        let px = hx;
        let py = hy;
        let wi = 0;
        let w = { x: h.x, y: h.y };
        for (let i = 1; i < N; i++) {
          let remain = seg;
          while (remain > 0) {
            const d = dist(px, py, w.x, w.y);
            if (d < 0.01) {
              if (wi >= inner.length) break;
              w = inner[wi++];
              continue;
            }
            const step = Math.min(remain, d);
            px += ((w.x - px) / d) * step;
            py += ((w.y - py) / d) * step;
            remain -= step;
          }
          pts.push({ x: px + Math.sin(this.t * 2 + i) * 0.6, y: py });
        }
        a.pts = pts;
        a.trail = pts.slice().reverse();
        a.x = hx;
        a.y = hy;
        a.timer = (a.timer || 6 + Math.random() * 6) - dt;
        if (a.timer <= 0 && a.peek > 0.3) {
          a.state = "out";
          a.timer = 0;
          a.route = this.eelRoute(a);
        }
        return;
      }

      // Swim along route waypoints with a serpentine sway.
      if (!a.route?.length) a.route = this.eelRoute(a);
      const wp = a.route[0];
      const dx = wp.x - a.x;
      const dy = wp.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const speed = this.unit * 0.9 * (a.state === "enter" ? 0.7 : 1);
      a.heading = a.heading ?? Math.atan2(dy, dx);
      const want = Math.atan2(dy, dx);
      let diff = want - a.heading;
      while (diff > Math.PI) diff -= TAU;
      while (diff < -Math.PI) diff += TAU;
      // Inside the rock there is no room for wide turns: point straight at the next waypoint.
      a.heading += a.sunk != null ? diff : diff * Math.min(1, dt * 2.5);
      a.x += Math.cos(a.heading) * speed * dt;
      a.y += Math.sin(a.heading) * speed * dt;
      // Once the head is through the hole, keep swimming inside the rock until the whole
      // body has followed it in, so the tail never pops from the water into the cave.
      if (a.sunk != null) {
        a.sunk += speed * dt;
        if (a.sunk > a.L * 1.1) {
          a.sunk = null;
          a.route = [];
          a.state = "home";
          a.peek = -1.2;
          a.timer = 8 + Math.random() * 10;
          return;
        }
      }
      if (d < seg * 1.5) {
        if (wp.hole) a.sunk = 0;
        a.route.shift();
        if (!a.route.length && a.sunk != null && home) a.route = this.caveLoop(home);
        if (!a.route.length) {
          if (a.state === "enter" || (a.state === "out" && home)) {
            a.state = "home";
            a.peek = -1.2;
            a.timer = 8 + Math.random() * 10;
            return;
          }
          a.route = this.eelRoute(a);
        }
      }
      const sway = Math.sin(a.phase * 1.6) * seg * 0.6;
      const hx = a.x - Math.sin(a.heading) * sway;
      const hy = a.y + Math.cos(a.heading) * sway;
      a.trail = a.trail || [{ x: hx, y: hy }];
      const last = a.trail[a.trail.length - 1];
      if (dist(last.x, last.y, hx, hy) > seg * 0.3) a.trail.push({ x: hx, y: hy });
      if (a.trail.length > N * 6) a.trail.splice(0, a.trail.length - N * 6);
      // Sample body points at equal spacing back along the trail.
      const pts = [{ x: hx, y: hy }];
      let acc = 0;
      for (let i = a.trail.length - 1; i > 0 && pts.length < N; i--) {
        const p = a.trail[i];
        const q = a.trail[i - 1];
        const L = dist(p.x, p.y, q.x, q.y);
        acc += L;
        while (acc >= seg && pts.length < N) {
          acc -= seg;
          const k = L ? acc / L : 0;
          pts.push({ x: q.x + (p.x - q.x) * k, y: q.y + (p.y - q.y) * k });
        }
      }
      while (pts.length < N) pts.push({ ...pts[pts.length - 1] });
      a.pts = pts;
      a.face = Math.cos(a.heading) >= 0 ? 1 : -1;
      if (a.state === "out" && a.route.length === 0) a.state = "roam";
    }

    eelRoute(a) {
      const bottom = this.sandY - this.unit * 0.35;
      const r = (k) => E.rand(a.id, Math.floor(this.t), k);
      const route = [];
      const home = a.home;
      if (home && a.state === "out") {
        const h = home.hole;
        route.push({ x: h.x - h.rx * 1.6, y: h.y + h.ry * 0.3 });
      }
      const n = 2 + Math.floor(r("n") * 2);
      for (let i = 0; i < n; i++)
        route.push({
          x: (0.08 + r(`x${i}`) * 0.84) * this.W,
          y: bottom - r(`y${i}`) * this.H * 0.12,
        });
      if (home) {
        const h = home.hole;
        a.state = "enter";
        // Line up in open water first, so the final approach comes straight into the opening.
        route.push({ x: h.x - h.rx * 3.4, y: h.y - h.ry * 0.4 });
        route.push({ x: h.x - h.rx * 1.8, y: h.y + h.ry * 0.2 });
        route.push({ x: h.x, y: h.y, hole: true });
        route.push(...this.caveLoop(home));
      }
      return route;
    }

    // Waypoints inside the rock, hidden by the cave clip, that a returning eel coils along.
    caveLoop(home) {
      const h = home.hole;
      const s = home.s;
      return [
        { x: h.x + 30 * s, y: h.y - 2 * s },
        { x: h.x + 30 * s, y: h.y - 30 * s },
        { x: h.x, y: h.y - 34 * s },
        { x: h.x + 30 * s, y: h.y - 30 * s },
      ];
    }

    updateFood(dt) {
      const sandY = this.sandY;
      let wasted = 0;
      for (let i = this.food.length - 1; i >= 0; i--) {
        const f = this.food[i];
        f.age += dt;
        if (f.settled) {
          f.settled += dt;
          if (f.settled > 9) {
            this.food.splice(i, 1);
            wasted += 1;
          }
          continue;
        }
        if (f.float > 0) {
          f.float -= dt;
          f.x += Math.sin(this.t * 2 + f.seed) * dt * 4;
          continue;
        }
        const sink = C.FOODS[f.food].sink * this.H * 0.12;
        f.vy = lerp(f.vy, sink, dt * 2);
        f.y += f.vy * dt;
        f.x += Math.sin(this.t * 2.5 + f.seed) * dt * (f.food === "flakes" ? 10 : 3);
        const floor = sandY + 4 + (f.seed % 5) * 2;
        if (f.y >= floor) {
          f.y = floor;
          f.settled = 0.001;
        }
      }
      if (wasted) this.hooks.onWaste(wasted);
    }

    updateAmbient(dt) {
      const W = this.W;
      const H = this.H;
      // Air stone in the back corner.
      if (Math.random() < dt * 5) {
        this.bubbles.push({
          x: W * 0.035 + Math.random() * 4,
          y: this.sandY,
          r: 1 + Math.random() * 2.5,
          vy: 30 + Math.random() * 25,
          ph: Math.random() * TAU,
        });
      }
      // Decor that bubbles.
      this.decor.forEach((d) => {
        const p = this.decorPos(d);
        if (
          (d.d === "chest" || d.d === "golden_chest") &&
          Math.sin(this.t * 0.35) > 0.92 &&
          Math.random() < dt * 12
        ) {
          this.bubbles.push({
            x: p.x + (Math.random() - 0.5) * 10 * p.scale,
            y: p.y - 20 * p.scale,
            r: 1.5 + Math.random() * 2,
            vy: 35,
            ph: Math.random() * TAU,
          });
        }
        if (d.d === "castle" && Math.random() < dt * 0.8) {
          this.bubbles.push({
            x: p.x - 38 * p.scale,
            y: p.y - 100 * p.scale,
            r: 1.5 + Math.random() * 1.5,
            vy: 30,
            ph: Math.random() * TAU,
          });
        }
      });
      for (const a of this.agents.values()) {
        if (a.move !== "eel" && a.move !== "crawl" && Math.random() < dt * 0.03) {
          this.bubbles.push({
            x: a.x + a.face * a.L * 0.5,
            y: a.y - 2,
            r: 1 + Math.random(),
            vy: 25,
            ph: 0,
          });
        }
      }
      for (let i = this.bubbles.length - 1; i >= 0; i--) {
        const b = this.bubbles[i];
        b.y -= b.vy * dt;
        b.x += Math.sin(this.t * 3 + b.ph) * dt * 8;
        if (b.y < H * 0.03) this.bubbles.splice(i, 1);
      }
      if (this.bubbles.length > 80) this.bubbles.splice(0, this.bubbles.length - 80);
      // Floating motes, marine snow in the abyss.
      const want = A.BIOMES[this.tankId].snow ? 40 : 14;
      while (this.motes.length < want) {
        this.motes.push({
          x: Math.random() * W,
          y: Math.random() * this.sandY,
          r: 0.6 + Math.random() * 1.2,
          v: 2 + Math.random() * 5,
          ph: Math.random() * TAU,
        });
      }
      for (const m of this.motes) {
        m.y += m.v * dt;
        m.x += Math.sin(this.t * 0.5 + m.ph) * dt * 3;
        if (m.y > this.sandY) {
          m.y = 0;
          m.x = Math.random() * W;
        }
      }
    }

    // ── Rendering ────────────────────────────────────────────────────

    computeLight() {
      if (this.lightMode === "day") return 1;
      if (this.lightMode === "night") return 0.15;
      const d = new Date();
      const h = d.getHours() + d.getMinutes() / 60;
      // Dusk 20–22, dawn 6–8.
      if (h >= 8 && h < 20) return 1;
      if (h >= 22 || h < 6) return 0.15;
      if (h >= 20) return lerp(1, 0.15, (h - 20) / 2);
      return lerp(0.15, 1, (h - 6) / 2);
    }

    ensureBackground() {
      if (this.bg) return;
      const c = document.createElement("canvas");
      c.width = Math.round(this.W * this.dpr);
      c.height = Math.round(this.H * this.dpr);
      const g = c.getContext("2d");
      g.scale(this.dpr, this.dpr);
      A.drawBackground(g, this.W, this.H, this.tankId);
      this.bg = c;
    }

    drawAgent(ctx, a) {
      if (a.alpha <= 0) return;
      ctx.save();
      ctx.globalAlpha = a.alpha * (a.fed < 15 ? 0.8 : 1) * (1 - a.hidden * 0.6);
      if (a.move === "eel") {
        if (a.pts) A.drawEel(ctx, a.v, a.pts, a.L * 0.068, { phase: a.phase });
        ctx.restore();
        return;
      }
      ctx.translate(a.x, a.y);
      const tilt = BOTTOM_MOVERS[a.move]
        ? 0
        : Math.max(-0.35, Math.min(0.35, Math.atan2(a.vy, Math.abs(a.vx) + this.unit * 0.3)));
      ctx.scale(a.face, 1);
      ctx.rotate(tilt);
      A.drawFish(ctx, a.s, a.v, a.L, {
        phase: a.phase,
        effort: a.effort,
        mouth: a.mouth,
        dpr: this.dpr,
        stage: a.stage,
      });
      ctx.restore();
    }

    // Fish living in a cave are clipped so they only show outside the rock or in the opening.
    drawHomed(ctx, a) {
      const home = a.home;
      if (home.kind !== "hole" || !home.outline) return this.drawAgent(ctx, a);
      ctx.save();
      const clip = new Path2D();
      clip.rect(0, 0, this.W, this.H);
      clip.addPath(home.outline);
      const h = home.hole;
      clip.ellipse(h.x, h.y, h.rx, h.ry, 0, 0, TAU);
      ctx.clip(clip, "evenodd");
      this.drawAgent(ctx, a);
      // Shade the part of the body that is still inside the opening.
      const g = ctx.createRadialGradient(h.x + h.rx * 0.3, h.y, 0, h.x, h.y, h.rx);
      g.addColorStop(0, "rgba(4,6,12,0.75)");
      g.addColorStop(1, "rgba(4,6,12,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(h.x, h.y, h.rx, h.ry, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // A resting moray pushes its head out of the opening towards the viewer, so the neck is
    // drawn over the rock face: every body point up to the first one deep inside the hole.
    drawEelNeck(ctx, a) {
      if (a.move !== "eel" || a.state !== "home" || !a.pts) return;
      const h = a.home.hole;
      let n = 0;
      while (n < a.pts.length) {
        const p = a.pts[n++];
        const dx = (p.x - h.x) / h.rx;
        const dy = (p.y - h.y) / h.ry;
        if (dx * dx + dy * dy < 0.25) break;
      }
      if (n < 2) return;
      A.drawEel(ctx, a.v, a.pts.slice(0, n), a.L * 0.068, { phase: a.phase, total: a.pts.length });
    }

    isHomed(a) {
      if (!a.home) return false;
      if (a.move === "eel") {
        // Only clip the eel while part of it is in the cave; out in the open it swims in front.
        if (a.state === "home" || a.sunk != null) return true;
        const h = a.home.hole;
        return (a.pts || []).some((p) => {
          const dx = (p.x - h.x) / (h.rx * 1.6);
          const dy = (p.y - h.y) / (h.ry * 1.6);
          return dx * dx + dy * dy < 1;
        });
      }
      if (a.home.kind === "anemone")
        return dist(a.x, a.y, a.home.x, a.home.y + 6 * a.home.s) < 22 * a.home.s;
      return a.state === "hide" || a.hidden > 0;
    }

    render() {
      const ctx = this.ctx;
      const W = this.W;
      const H = this.H;
      const t = this.t;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      this.ensureBackground();
      ctx.drawImage(this.bg, 0, 0, W, H);
      const biome = A.BIOMES[this.tankId];
      const light = biome.dark ? Math.min(this.light, 0.3) : this.light;
      A.drawRays(ctx, W, H, this.tankId, t, light);
      A.drawCaustics(ctx, W, H, t, light * (biome.dark ? 0.3 : 1));

      const agents = Array.from(this.agents.values());
      const homed = new Map();
      for (const a of agents) {
        if (this.isHomed(a)) {
          if (!homed.has(a.home.slot)) homed.set(a.home.slot, []);
          homed.get(a.home.slot).push(a);
        }
      }

      // Back and mid layers, with homed fish between each item's back and front parts. A thin
      // veil of water between the layers gives the scape depth.
      for (const row of ["back", "mid"]) {
        this.crisp((c) => {
          for (const { d, p } of this.layerDecor(row)) {
            if (this.placing?.id === d.id) c.globalAlpha = 0.35;
            A.drawDecor(c, d.d, p.x, p.y, p.scale, t, "back", d.look);
            const list = homed.get(d.id);
            if (list) for (const a of list) this.drawHomed(c, a);
            A.drawDecor(c, d.d, p.x, p.y, p.scale, t, "front", d.look);
            if (list) for (const a of list) this.drawEelNeck(c, a);
            c.globalAlpha = 1;
          }
        });
        if (row === "back") {
          ctx.fillStyle = biome.haze;
          ctx.fillRect(0, 0, W, this.sandY + (H - this.sandY) * 0.3);
        }
      }
      this.crisp((c) => {
        for (const d of this.debris) {
          const p = this.debrisPos(d);
          A.drawDebris(c, p.x, p.y, this.unit * 0.22, E.hash(d.id));
        }
        for (const e of this.eggs) {
          const p = this.eggPos(e);
          A.drawEggs(c, p.x, p.y, this.unit * 0.25, e.ready, t, e.m);
        }
      });

      this.crisp((c) => {
        agents.sort((a, b) => a.z - b.z);
        for (const a of agents) if (!this.isHomed(a)) this.drawAgent(c, a);
        for (const f of this.food)
          A.drawFood(c, f.food, f.x, f.y, Math.max(1.6, this.unit * 0.06), f.seed, t);
      });

      this.crisp((c) => {
        for (const { d, p } of this.layerDecor("front")) {
          if (this.placing?.id === d.id) c.globalAlpha = 0.35;
          A.drawDecor(c, d.d, p.x, p.y, p.scale, t, "all", d.look);
          c.globalAlpha = 1;
        }
      });

      for (const b of this.bubbles) A.drawBubble(ctx, b.x, b.y, b.r);
      ctx.fillStyle = biome.dark ? "rgba(220,230,255,0.45)" : "rgba(255,255,255,0.35)";
      for (const m of this.motes) ctx.fillRect(m.x, m.y, m.r, m.r);
      if (this.toy) A.drawToy(ctx, this.toy.x, this.toy.y, Math.max(5, this.unit * 0.13), t);

      // Night and murky water overlays.
      const dark = biome.dark ? 0.35 + (1 - this.light) * 0.25 : (1 - light) * 0.62;
      if (dark > 0.01) {
        ctx.fillStyle = `rgba(6,12,38,${dark})`;
        ctx.fillRect(0, 0, W, H);
      }
      if (biome.dark || light < 0.9) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (const d of this.decor) {
          const p = this.decorPos(d);
          A.drawDecorGlow(ctx, d.d, p.x, p.y, p.scale, t);
        }
        for (const a of agents) {
          if (a.alpha <= 0 || a.move === "eel") continue;
          ctx.save();
          ctx.translate(a.x, a.y);
          ctx.scale(a.face, 1);
          A.drawFishGlow(ctx, a.s, a.v, a.L, { phase: a.phase + t });
          ctx.restore();
        }
        ctx.restore();
      }
      const wq = this.tankInfo ? this.tankInfo.water : 100;
      if (wq < 85) {
        ctx.fillStyle = `rgba(90,120,40,${((85 - wq) / 85) * 0.28})`;
        ctx.fillRect(0, 0, W, this.sandY + 6);
      }

      for (const a of this.algae)
        A.drawAlgae(ctx, a.x * W, a.y * H, this.algaeR(a), a.hp, a.max, E.hash(a.id), t);

      // Coins come after the night and murk overlays: they are what you tap, so they stay bright.
      for (const d of this.drops) {
        const p = this.dropPos(d);
        A.drawCoin(
          ctx,
          p.x,
          p.y,
          Math.max(6, this.unit * (0.16 + Math.min(0.12, Math.log10(d.v + 1) * 0.04))),
          t,
          d.v,
        );
      }

      // Glass reflection.
      if (!this.glass || this.glass.W !== W || this.glass.H !== H) {
        const g = ctx.createLinearGradient(0, 0, W * 0.5, H * 0.6);
        g.addColorStop(0, "rgba(255,255,255,0.08)");
        g.addColorStop(0.5, "rgba(255,255,255,0)");
        this.glass = { W, H, g };
      }
      // The sheen fades out halfway down, so only the top-left part needs painting.
      ctx.fillStyle = this.glass.g;
      ctx.fillRect(0, 0, W * 0.75, H * 0.9);

      if (this.placing) this.drawPlacing(ctx);
      this.drawFx(ctx);
      if (this.pointer) this.drawPointer(ctx);
      this.present();
    }

    // Draw into a scratch layer, then harden its anti-aliased edges into whole pixels before
    // compositing.
    crisp(draw) {
      const c = this.lctx;
      const w = this.layer.width;
      const h = this.layer.height;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, w, h);
      c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      c.imageSmoothingEnabled = false;
      draw(c);
      c.setTransform(1, 0, 0, 1, 0, 0);
      A.hardenEdges(c, w, h);
      const ctx = this.ctx;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(this.layer, 0, 0);
      ctx.restore();
    }

    // Snap the buffer to a limited palette with ordered dithering, then scale it up with hard
    // pixel edges.
    present() {
      const w = this.lo.width;
      const h = this.lo.height;
      const img = this.ctx.getImageData(0, 0, w, h);
      const d = img.data;
      const step = 255 / (COLOR_LEVELS - 1);
      for (let y = 0; y < h; y++) {
        const row = (y & 3) << 2;
        for (let x = 0; x < w; x++) {
          const bias = BAYER[row | (x & 3)] * step;
          const i = (y * w + x) << 2;
          d[i] = Math.round((d[i] + bias) / step) * step;
          d[i + 1] = Math.round((d[i + 1] + bias) / step) * step;
          d[i + 2] = Math.round((d[i + 2] + bias) / step) * step;
        }
      }
      this.ctx.putImageData(img, 0, 0);
      const out = this.out;
      out.setTransform(1, 0, 0, 1, 0, 0);
      out.imageSmoothingEnabled = false;
      out.drawImage(this.lo, 0, 0, w * this.dev, h * this.dev);
    }

    // Place and move mode: a glowing guide along the chosen layer of sand.
    drawPlacing(ctx) {
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 4);
      const depth = this.H - this.sandY;
      const row = ROWS[this.placing.row] || ROWS.back;
      const y = this.sandY + depth * row.y;
      const half = Math.max(3, depth * row.spread * 0.6);
      ctx.save();
      ctx.fillStyle = `rgba(150,235,255,${0.3 + 0.2 * pulse})`;
      ctx.fillRect(0, y - half, this.W, half * 2);
      ctx.setLineDash([5, 4]);
      ctx.lineDashOffset = -this.t * 12;
      ctx.strokeStyle = `rgba(255,255,255,${0.55 + 0.4 * pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.W, y);
      ctx.stroke();
      ctx.restore();
    }

    drawPointer(ctx) {
      const p = this.pointer;
      const k = (this.t * 1.2) % 1;
      ctx.strokeStyle = `rgba(255,255,255,${0.9 * (1 - k)})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10 + k * 22, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, TAU);
      ctx.fill();
    }

    drawFx(ctx) {
      for (let i = this.fx.length - 1; i >= 0; i--) {
        const f = this.fx[i];
        const k = (this.t - f.t0) / f.life;
        if (k < 0) continue;
        if (k >= 1) {
          this.fx.splice(i, 1);
          continue;
        }
        switch (f.kind) {
          case "ripple":
            ctx.strokeStyle = A.rgba(f.color, 0.8 * (1 - k));
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(f.x, f.y, 4 + k * 22, 0, TAU);
            ctx.stroke();
            break;
          case "text":
            ctx.font = `800 ${Math.round(13 * Math.max(0.9, this.s))}px var(--homey-font-family, sans-serif)`;
            ctx.textAlign = "center";
            ctx.lineWidth = 3;
            ctx.strokeStyle = `rgba(0,0,0,${0.45 * (1 - k)})`;
            ctx.fillStyle = A.rgba(f.color, 1 - k * k);
            ctx.strokeText(f.text, f.x, f.y - k * 26);
            ctx.fillText(f.text, f.x, f.y - k * 26);
            break;
          case "coin": {
            const e = k * k * (3 - 2 * k);
            const x = lerp(f.x, f.tx, e) + Math.sin(k * Math.PI) * f.ox;
            const y = lerp(f.y, f.ty, e) - Math.sin(k * Math.PI) * 30;
            A.drawCoin(
              ctx,
              x,
              y,
              Math.max(5, this.unit * 0.14) * (1 - k * 0.4),
              this.t * 3,
              f.value,
            );
            break;
          }
          case "spark":
            ctx.fillStyle = A.rgba(f.color, 1 - k);
            ctx.beginPath();
            ctx.arc(f.x + f.vx * k, f.y + f.vy * k, 1.8 * (1 - k) + 0.5, 0, TAU);
            ctx.fill();
            break;
          case "heart": {
            const y = f.y - k * 24;
            const sz = 5 + k * 3;
            ctx.fillStyle = `rgba(255,110,150,${1 - k})`;
            ctx.beginPath();
            ctx.moveTo(f.x, y + sz * 0.9);
            ctx.bezierCurveTo(
              f.x - sz * 1.6,
              y - sz * 0.2,
              f.x - sz * 0.5,
              y - sz * 1.3,
              f.x,
              y - sz * 0.4,
            );
            ctx.bezierCurveTo(
              f.x + sz * 0.5,
              y - sz * 1.3,
              f.x + sz * 1.6,
              y - sz * 0.2,
              f.x,
              y + sz * 0.9,
            );
            ctx.fill();
            break;
          }
          case "suck":
            ctx.fillStyle = A.rgba(f.color, 1 - k);
            ctx.beginPath();
            ctx.arc(f.x, f.y - k * 40, 2 * (1 - k) + 0.5, 0, TAU);
            ctx.fill();
            break;
        }
      }
    }

    // ── Loop ─────────────────────────────────────────────────────────

    start() {
      if (this.running) return;
      this.running = true;
      this.lastFrame = performance.now();
      requestAnimationFrame(this.frame);
    }

    stop() {
      this.running = false;
    }

    frame(now) {
      if (!this.running) return;
      requestAnimationFrame(this.frame);
      const minGap = 1000 / this.fps - 2;
      if (now - this.lastFrame < minGap) return;
      const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
      this.lastFrame = now;
      if (document.hidden || !this.W) return;
      this.step(dt);
      this.render();
    }

    step(dt) {
      this.t += dt;
      if (Math.floor(this.t) !== Math.floor(this.t - dt)) this.light = this.computeLight();
      for (const a of this.agents.values()) {
        this.updateAgent(a, dt);
        if (a.leaving && a.alpha <= 0) this.agents.delete(a.id);
      }
      this.updateFood(dt);
      this.updateAmbient(dt);
    }
  }

  root.AquaScene = Scene;
})(typeof self !== "undefined" ? self : this);
