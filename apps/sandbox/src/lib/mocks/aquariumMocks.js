/**
 * Sandbox backend for the Aquarium widget.
 *
 * Runs the real game engine (the same file the Homey API uses) against localStorage, so the
 * sandbox never drifts from production rules. Scenarios are just pre-built saves.
 */
import "/apps/com.nielsvanbrakel.aquarium/widgets/aquarium/public/catalog.js";
import "/apps/com.nielsvanbrakel.aquarium/widgets/aquarium/public/engine.js";
import "/apps/com.nielsvanbrakel.aquarium/widgets/aquarium/public/server.js";

const Engine = globalThis.AquaEngine;
const Server = globalThis.AquaServer;
const C = Engine.C;
const HOUR = Engine.HOUR;
const STORE_KEY = "aquarium2_sandbox";

// ── Scenario builders ────────────────────────────────────────────────

function base(now) {
  const save = Engine.createSave(now, 12345);
  save.tut = C.TUTORIAL.length;
  save.tanks.pond.algae = [];
  save.tanks.pond.drops = [];
  return save;
}

function unlock(save, tankId) {
  save.tanks[tankId].unlocked = true;
}

function fish(save, tankId, species, opts = {}) {
  const f = {
    id: `f${++save.nextId}`,
    s: species,
    v: opts.v ?? 0,
    born: save.t - 48 * HOUR,
    stage: opts.stage ?? 2,
    growth: 0,
    fed: opts.fed ?? 85,
    played: 0,
    buff: 0,
  };
  save.tanks[tankId].fish.push(f);
  save.dex[species] = save.dex[species] | 0 | (1 << f.v);
  return f;
}

// Lay out decor the way the old fixed slots did: ids[i] stands where slot i used to be.
function decor(save, tankId, ids) {
  save.tanks[tankId].decor = C.LEGACY_SLOTS.flatMap((slot, i) =>
    ids[i] ? [{ id: `d${++save.nextId}`, d: ids[i], at: 0, x: slot.x, row: slot.row }] : [],
  );
}

// A freely placed aquascape: [id, x, row, daysOld?, bloom?] per piece.
function scape(save, tankId, pieces, now) {
  save.tanks[tankId].decor = pieces
    .map(([d, x, row, days = 10, bloom = false]) => {
      const item = { id: `d${++save.nextId}`, d, at: now - days * Engine.DAY, x, row };
      for (let k = 0; bloom && k < 400 && !(Engine.decorGrowth(item, now).bloom > 0.6); k++)
        item.id = `d${++save.nextId}`;
      return item;
    })
    .filter(Boolean);
}

function drops(save, tankId, values) {
  for (const [i, v] of values.entries())
    save.tanks[tankId].drops.push({ id: `c${++save.nextId}`, x: 0.1 + i * 0.09, v });
}

function algae(save, tankId, n) {
  for (let i = 0; i < n; i++) {
    const hp = 1 + (i % 3);
    save.tanks[tankId].algae.push({
      id: `a${++save.nextId}`,
      x: 0.1 + ((i * 0.23) % 0.7),
      y: 0.18 + ((i * 0.17) % 0.45),
      hp,
      max: hp,
      at: save.t,
    });
  }
}

function debris(save, tankId, n) {
  for (let i = 0; i < n; i++)
    save.tanks[tankId].debris.push({ id: `w${++save.nextId}`, x: 0.12 + i * 0.14, at: save.t });
}

function eggs(save, tankId, species, ready) {
  save.tanks[tankId].eggs.push({
    id: `e${++save.nextId}`,
    s: species,
    at: save.t - (ready ? 3 : 0.5) * HOUR,
    x: 0.3,
  });
}

function gallery(save, tankId) {
  unlock(save, tankId);
  save.active = tankId;
  save.level = 30;
  save.tanks[tankId].up.size = 5;
  for (const s of Engine.speciesFor(tankId)) {
    const n = C.SPECIES[s].max ? 1 : 3;
    for (let v = 0; v < n; v++) fish(save, tankId, s, { v });
  }
  const items = Engine.decorFor(tankId);
  const L = items.filter((d) => C.DECOR[d].size === "L");
  const M = items.filter((d) => C.DECOR[d].size === "M");
  const S = items.filter((d) => C.DECOR[d].size === "S");
  // Back: tall pieces. Front: small ones. Mid: whatever large pieces are left.
  decor(save, tankId, [
    L[0],
    M[0],
    M[1],
    L[1] || M[3],
    S[0],
    S[1],
    S[2] || null,
    S[3] || null,
    L[2] || M[4] || null,
    M[2] || null,
    L[3] || M[5] || S[4] || null,
  ]);
}

// Plants at different ages: a fresh cutting, a half-grown one, mature ones and some in flower.
function garden(save, tankId, plan, now) {
  unlock(save, tankId);
  save.active = tankId;
  save.level = 30;
  save.tanks[tankId].decor = C.LEGACY_SLOTS.map((slot, i) => {
    const p = plan[i];
    if (!p) return null;
    const item = {
      id: `d${++save.nextId}`,
      d: p.d,
      at: now - p.days * Engine.DAY,
      x: slot.x,
      row: slot.row,
    };
    // Pick an id whose flowering window is open right now, so the scenario always shows blooms.
    for (let k = 0; p.bloom && k < 400 && !(Engine.decorGrowth(item, now).bloom > 0.6); k++)
      item.id = `d${++save.nextId}`;
    return item;
  }).filter(Boolean);
}

const SCENARIOS = {
  // No stored save: the handler creates one, exactly like a brand-new widget.
  default: () => null,
  "pond-day2": (now) => {
    const s = base(now);
    s.level = 3;
    s.coins = 180;
    s.food = { flakes: 14, pellets: 6 };
    for (const sp of ["guppy", "guppy", "danio", "danio", "danio", "platy"]) fish(s, "pond", sp);
    fish(s, "pond", "snail");
    decor(s, "pond", [null, "vallisneria", "moss_ball", null, "anubias", "pebbles", "chest", null]);
    drops(s, "pond", [4, 6, 12, 5]);
    algae(s, "pond", 3);
    debris(s, "pond", 2);
    return s;
  },
  amazon: (now) => {
    const s = base(now);
    unlock(s, "amazon");
    s.active = "amazon";
    s.level = 9;
    s.coins = 2400;
    s.food = { flakes: 20, pellets: 12, worms: 10 };
    for (let i = 0; i < 6; i++) fish(s, "amazon", "neon");
    fish(s, "amazon", "cory");
    fish(s, "amazon", "cory");
    fish(s, "amazon", "angelfish");
    fish(s, "amazon", "pleco");
    fish(s, "amazon", "betta");
    decor(s, "amazon", [
      "root",
      "sword_plant",
      "stump",
      null,
      "java_fern",
      "clay_cave",
      null,
      null,
    ]);
    s.tanks.amazon.up.size = 3;
    drops(s, "amazon", [30, 45]);
    return s;
  },
  reef: (now) => {
    const s = base(now);
    unlock(s, "amazon");
    unlock(s, "reef");
    s.active = "reef";
    s.level = 15;
    s.coins = 12000;
    s.pearls = 40;
    s.food = { flakes: 30, brine: 20 };
    fish(s, "reef", "moray");
    fish(s, "reef", "clownfish");
    fish(s, "reef", "clownfish");
    fish(s, "reef", "tang");
    fish(s, "reef", "gramma");
    for (let i = 0; i < 4; i++) fish(s, "reef", "chromis");
    fish(s, "reef", "shrimp");
    decor(s, "reef", [
      "rock_cave",
      "staghorn",
      "sea_fan",
      "live_rock",
      "brain_coral",
      null,
      "giant_clam",
      null,
      null,
      "anemone",
      null,
    ]);
    s.tanks.reef.up.size = 4;
    return s;
  },
  "abyss-night": (now) => {
    const s = base(now);
    for (const t of ["amazon", "reef", "abyss"]) unlock(s, t);
    s.active = "abyss";
    s.level = 21;
    s.coins = 60000;
    s.food = { krill: 20, brine: 20 };
    for (let i = 0; i < 5; i++) fish(s, "abyss", "lantern");
    fish(s, "abyss", "hatchet");
    fish(s, "abyss", "hatchet");
    fish(s, "abyss", "jelly");
    fish(s, "abyss", "jelly", { v: 1 });
    fish(s, "abyss", "angler");
    fish(s, "abyss", "isopod");
    decor(s, "abyss", [
      "whale_bone",
      "tube_worms",
      "sea_lily",
      "vent",
      "glow_crystal",
      null,
      "glow_crystal",
      null,
    ]);
    s.tanks.abyss.up.size = 3;
    return s;
  },
  eggs: (now) => {
    const s = base(now);
    s.level = 4;
    for (const sp of ["guppy", "guppy", "platy", "platy"]) fish(s, "pond", sp);
    decor(s, "pond", ["driftwood", "vallisneria", null, null, "anubias", null, null, null]);
    eggs(s, "pond", "guppy", true);
    eggs(s, "pond", "platy", false);
    return s;
  },
  "tank-full": (now) => {
    const s = base(now);
    s.level = 4;
    s.coins = 500;
    for (const sp of ["goldfish", "guppy", "guppy", "platy"]) fish(s, "pond", sp);
    decor(s, "pond", [
      "castle",
      "vallisneria",
      "vallisneria",
      "driftwood",
      "anubias",
      "pebbles",
      "chest",
      "moss_ball",
    ]);
    eggs(s, "pond", "guppy", true);
    return s;
  },
  neglected: (now) => {
    const s = base(now - 72 * HOUR);
    s.level = 3;
    for (const sp of ["guppy", "guppy", "danio", "platy"]) fish(s, "pond", sp, { fed: 60 });
    decor(s, "pond", [null, "vallisneria", null, null, null, "pebbles", null, null]);
    s.t = now - 72 * HOUR;
    return s;
  },
  rich: (now) => {
    const s = base(now);
    for (const t of Engine.TANK_IDS) unlock(s, t);
    s.level = 30;
    s.coins = 1000000;
    s.pearls = 500;
    for (const id of Object.keys(C.FOODS)) s.food[id] = 99;
    for (const sp of ["guppy", "platy", "goldfish"]) fish(s, "pond", sp);
    decor(s, "pond", [null, "vallisneria", null, null, "anubias", null, null, null]);
    return s;
  },
  "garden-pond": (now) => {
    const s = base(now);
    garden(
      s,
      "pond",
      [
        { d: "vallisneria", days: 10, bloom: true },
        { d: "vallisneria", days: 0.3 },
        { d: "vallisneria", days: 6 },
        { d: "driftwood", days: 10 },
        { d: "hairgrass", days: 10 },
        { d: "pebbles", days: 10 },
        { d: "hairgrass", days: 1 },
        { d: "moss_ball", days: 1 },
        { d: "spider_wood", days: 10 },
        { d: "seiryu_stone", days: 10 },
        { d: "anubias", days: 10, bloom: true },
      ],
      now,
    );
    for (let i = 0; i < 8; i++) fish(s, "pond", "white_cloud", { v: i === 3 ? 1 : 0 });
    for (const sp of ["guppy", "guppy", "platy", "goldfish"]) fish(s, "pond", sp);
    s.tanks.pond.up.size = 3;
    return s;
  },
  "garden-amazon": (now) => {
    const s = base(now);
    garden(
      s,
      "amazon",
      [
        { d: "sword_plant", days: 10, bloom: true },
        { d: "rotala", days: 10, bloom: true },
        { d: "ludwigia", days: 10, bloom: true },
        { d: "root", days: 10 },
        { d: "monte_carlo", days: 10 },
        { d: "java_fern", days: 8 },
        { d: "monte_carlo", days: 0.5 },
        null,
        { d: "dragon_stone", days: 10 },
        { d: "rotala", days: 1 },
        { d: "stump", days: 10 },
      ],
      now,
    );
    for (let i = 0; i < 10; i++) fish(s, "amazon", "ember");
    for (let i = 0; i < 7; i++) fish(s, "amazon", "neon");
    for (const sp of ["angelfish", "cory", "cory", "cory"]) fish(s, "amazon", sp);
    s.tanks.amazon.up.size = 4;
    return s;
  },
  // A densely planted Dutch-style tank: layered stems at the back, wood and stone in the
  // middle, carpets in front, with schools of tiny fish.
  "planted-amazon": (now) => {
    const s = base(now);
    unlock(s, "amazon");
    s.active = "amazon";
    s.level = 30;
    s.tanks.amazon.up.size = 5;
    scape(
      s,
      "amazon",
      [
        ["rotala", 0.06, "back", 10, true],
        ["sword_plant", 0.16, "back"],
        ["rotala", 0.26, "back"],
        ["ludwigia", 0.34, "back", 10, true],
        ["sword_plant", 0.46, "back", 10, true],
        ["rotala", 0.56, "back"],
        ["ludwigia", 0.66, "back"],
        ["rotala", 0.74, "back", 2],
        ["root", 0.3, "mid"],
        ["dragon_stone", 0.55, "mid"],
        ["java_fern", 0.46, "mid"],
        ["stump", 0.72, "mid"],
        ["sword_plant", 0.12, "mid", 1],
        ["monte_carlo", 0.06, "front"],
        ["monte_carlo", 0.2, "front"],
        ["monte_carlo", 0.34, "front"],
        ["java_fern", 0.44, "front"],
        ["monte_carlo", 0.55, "front", 1],
        ["monte_carlo", 0.68, "front"],
        ["monte_carlo", 0.8, "front", 0.4],
      ],
      now,
    );
    for (let i = 0; i < 12; i++) fish(s, "amazon", "ember");
    for (let i = 0; i < 9; i++) fish(s, "amazon", "neon");
    for (const sp of ["angelfish", "cory", "cory", "cory"]) fish(s, "amazon", sp);
    return s;
  },
  "planted-pond": (now) => {
    const s = base(now);
    s.level = 30;
    s.tanks.pond.up.size = 5;
    scape(
      s,
      "pond",
      [
        ["vallisneria", 0.04, "back", 10, true],
        ["vallisneria", 0.12, "back"],
        ["vallisneria", 0.2, "back", 3],
        ["vallisneria", 0.62, "back"],
        ["vallisneria", 0.7, "back", 10, true],
        ["vallisneria", 0.78, "back"],
        ["spider_wood", 0.4, "back"],
        ["driftwood", 0.62, "mid"],
        ["seiryu_stone", 0.28, "mid"],
        ["seiryu_stone", 0.4, "mid"],
        ["anubias", 0.34, "mid", 10, true],
        ["moss_ball", 0.5, "mid"],
        ["hairgrass", 0.05, "front"],
        ["hairgrass", 0.16, "front"],
        ["pebbles", 0.27, "front"],
        ["hairgrass", 0.38, "front"],
        ["hairgrass", 0.5, "front", 1],
        ["hairgrass", 0.62, "front"],
        ["hairgrass", 0.74, "front", 0.4],
      ],
      now,
    );
    for (let i = 0; i < 10; i++) fish(s, "pond", "white_cloud", { v: i === 3 ? 1 : 0 });
    for (let i = 0; i < 6; i++) fish(s, "pond", "danio");
    for (const sp of ["guppy", "guppy", "platy"]) fish(s, "pond", sp);
    return s;
  },
  // Every fish species at each life stage, side by side.
  "life-stages": (now) => {
    const s = base(now);
    unlock(s, "amazon");
    s.active = "amazon";
    s.level = 30;
    s.tanks.amazon.up.size = 5;
    for (const sp of ["discus", "angelfish", "neon", "ember"])
      for (const stage of [0, 1, 2]) fish(s, "amazon", sp, { stage });
    return s;
  },
  "gallery-pond": (now) => {
    const s = base(now);
    gallery(s, "pond");
    return s;
  },
  "gallery-amazon": (now) => {
    const s = base(now);
    gallery(s, "amazon");
    return s;
  },
  "gallery-reef": (now) => {
    const s = base(now);
    gallery(s, "reef");
    return s;
  },
  "gallery-abyss": (now) => {
    const s = base(now);
    gallery(s, "abyss");
    return s;
  },
};

export const AQUARIUM_SCENARIO_IDS = Object.keys(SCENARIOS);

// ── Persistence ──────────────────────────────────────────────────────

function read() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || null;
  } catch {
    return null;
  }
}

function write(scenario, save) {
  localStorage.setItem(STORE_KEY, JSON.stringify({ scenario, save }));
}

/**
 * Load a scenario's fresh save. Keeps the current save when the same scenario is already
 * loaded, so React re-renders and page reloads don't wipe sandbox progress.
 */
export function resetAquariumScenario(scenarioId, force = false) {
  const stored = read();
  if (!force && stored && stored.scenario === scenarioId) return;
  const build = SCENARIOS[scenarioId] || SCENARIOS.default;
  write(scenarioId, build(Date.now()));
}

// The real request handler, backed by localStorage instead of Homey settings.
const store = {
  get: (key) => (key === "aquarium2_sandbox" ? read()?.save || null : null),
  set: (key, value) => {
    if (key === "aquarium2_sandbox") write(read()?.scenario, value);
  },
  unset: () => {},
};

export function handleAquariumApi(widgetId, method, _endpoint, body, scenarioId) {
  if (widgetId !== "aquarium") return null;
  resetAquariumScenario(scenarioId);
  const query = { widgetId: "sandbox" };
  const now = Date.now();
  return method === "GET"
    ? Server.getState(store, query, now)
    : Server.doAction(store, query, body, now);
}
