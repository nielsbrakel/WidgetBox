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

function decor(save, tankId, ids) {
  save.tanks[tankId].decor = C.SLOTS.map((_, i) =>
    ids[i] ? { id: `d${++save.nextId}`, d: ids[i] } : null,
  );
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
  decor(save, tankId, [
    L[0],
    M[0],
    M[1] || S[2],
    L[1] || M[2],
    S[0],
    S[1],
    M[2] ? S[2] : null,
    S[3] || null,
  ]);
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
      "anemone",
      "staghorn",
      "sea_fan",
      "brain_coral",
      null,
      "giant_clam",
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
