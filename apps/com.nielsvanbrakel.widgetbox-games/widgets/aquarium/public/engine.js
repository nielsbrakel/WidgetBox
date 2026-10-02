/*
 * Aquarium engine: pure game rules.
 *
 * The same file runs in three places:
 *  - the widget API (api.js) where it is authoritative and persists the save,
 *  - the widget page, which applies actions optimistically so taps feel instant,
 *  - the sandbox mock, so development uses the real rules.
 *
 * Everything is deterministic: randomness comes from hashing the save seed with an id or a
 * timestamp, never from Math.random, so client and server reach the same result.
 * Functions never read the clock; callers pass `now` (ms).
 */
((root, factory) => {
  if (typeof module === "object" && module.exports)
    module.exports = factory(require("./catalog.js"));
  else root.AquaEngine = factory(root.AquaCatalog);
})(typeof self !== "undefined" ? self : this, (C) => {
  // biome-ignore lint/suspicious/noRedundantUseStrict: loaded as a classic script, not a module
  "use strict";

  const SAVE_VERSION = 2;
  const HOUR = 3600000;
  const DAY = 24 * HOUR;
  const TANK_IDS = Object.keys(C.TANKS).sort((a, b) => C.TANKS[a].order - C.TANKS[b].order);
  const STAGE = { FRY: 0, JUVENILE: 1, ADULT: 2 };
  const SIZE_RANK = { S: 0, M: 1, L: 2 };
  const STEP = 10 * 60000;

  // ── Deterministic helpers ──────────────────────────────────────────

  function hash(...parts) {
    let h = 2166136261 >>> 0;
    for (const p of parts) {
      const s = String(p);
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
      }
      h ^= 0x9e3779b9;
      h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    }
    h ^= h >>> 13;
    h = Math.imul(h, 3266489909) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
  }

  // Uniform float in [0, 1) derived from the inputs.
  function rand(...parts) {
    return hash(...parts) / 4294967296;
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function round2(v) {
    return Math.round(v * 100) / 100;
  }

  function nextId(save, prefix) {
    save.nextId += 1;
    return prefix + save.nextId;
  }

  // ── Save creation & migration ──────────────────────────────────────

  function emptyTank(id, unlocked, now) {
    return {
      id,
      unlocked,
      fish: [],
      decor: C.SLOTS.map(() => null),
      up: { size: 0, filter: 0, feeder: 0, chest: 0 },
      drops: [],
      pending: 0,
      algae: [],
      debris: [],
      eggs: [],
      breed: {},
      bits: 0,
      bitsAt: 0,
      waste: 0,
      crew: { algae: 0, debris: 0 },
      autoFed: [],
      nextAlgae: now + C.RULES.algaeEveryHours * HOUR * 0.5,
      nextDebris: now + C.RULES.debrisEveryHours * HOUR,
    };
  }

  function createSave(now, seed) {
    const save = {
      v: SAVE_VERSION,
      seed: (seed ?? hash("seed", now)) >>> 0,
      nextId: 0,
      createdAt: now,
      t: now,
      tz: 0,
      coins: C.RULES.startCoins,
      pearls: 0,
      xp: 0,
      level: 1,
      food: { ...C.RULES.startFood },
      active: "pond",
      tanks: {},
      stats: { coinsEarned: 0, hatched: 0, scrubbed: 0, vacuumed: 0, played: 0, fed: 0, bought: 0 },
      dex: {},
      ach: [],
      tut: 0,
      tutProg: 0,
      daily: { day: -1, goals: [], bonus: false, streak: 0, lastFull: -1, visited: [] },
    };
    for (const id of TANK_IDS) save.tanks[id] = emptyTank(id, id === "pond", now);

    const pond = save.tanks.pond;
    pond.decor[1] = { id: nextId(save, "d"), d: "vallisneria" };
    pond.decor[5] = { id: nextId(save, "d"), d: "pebbles" };
    for (let i = 0; i < 2; i++) addFish(save, pond, "guppy", 0, STAGE.JUVENILE, now);
    // Starters arrive peckish so the feeding lesson has hungry mouths to fill.
    for (const f of pond.fish) f.fed = 45;
    // A first algae spot and a coin so the tutorial has something to tap.
    spawnAlgae(save, pond, now);
    pond.drops.push({ id: nextId(save, "c"), x: 0.42, v: 5 });
    pond.algae[0].hp = 1;
    pond.algae[0].max = 1;
    return save;
  }

  /*
   * Bring any stored save up to date with the current catalog. Unknown IDs (content
   * removed from the catalog) are dropped so the game never crashes on old data; the
   * catalog rule is to never remove or rename IDs, so this is a last resort.
   */
  function migrate(save, now) {
    if (!save || typeof save !== "object" || save.v !== SAVE_VERSION || !save.tanks) {
      return createSave(now);
    }
    const num = (v, d = 0) => (Number.isFinite(v) ? v : d);
    const list = (v) => (Array.isArray(v) ? v : []);
    save.seed = num(save.seed) >>> 0;
    save.nextId = num(save.nextId);
    save.t = num(save.t, now);
    save.tz = num(save.tz);
    save.coins = Math.max(0, num(save.coins));
    save.pearls = Math.max(0, num(save.pearls));
    save.xp = Math.max(0, num(save.xp));
    save.level = clamp(Math.floor(num(save.level, 1)), 1, C.RULES.maxLevel);
    save.tut = clamp(Math.floor(num(save.tut)), 0, C.TUTORIAL.length);
    save.tutProg = num(save.tutProg);
    save.batches = list(save.batches);
    save.food = save.food && typeof save.food === "object" ? save.food : {};
    for (const k of Object.keys(save.food)) {
      if (!Object.hasOwn(C.FOODS, k)) delete save.food[k];
      else save.food[k] = Math.max(0, num(save.food[k]));
    }
    save.stats = {
      coinsEarned: 0,
      hatched: 0,
      scrubbed: 0,
      vacuumed: 0,
      played: 0,
      fed: 0,
      bought: 0,
      ...save.stats,
    };
    save.dex = save.dex && typeof save.dex === "object" ? save.dex : {};
    for (const k of Object.keys(save.dex)) if (!Object.hasOwn(C.SPECIES, k)) delete save.dex[k];
    const achIds = new Set(C.ACHIEVEMENTS.map((a) => a.id));
    save.ach = list(save.ach).filter((id) => achIds.has(id));
    save.daily = {
      day: -1,
      goals: [],
      bonus: false,
      streak: 0,
      lastFull: -1,
      visited: [],
      ...save.daily,
    };
    save.daily.goals = list(save.daily.goals).filter((g) => g && Object.hasOwn(C.GOALS, g.k));
    save.daily.visited = list(save.daily.visited);
    for (const id of TANK_IDS) {
      const base = emptyTank(id, id === "pond", save.t || now);
      const tank = { ...base, ...save.tanks[id] };
      save.tanks[id] = tank;
      tank.up = { ...base.up, ...tank.up };
      tank.crew = { ...base.crew, ...tank.crew };
      const species = (s) => typeof s === "string" && Object.hasOwn(C.SPECIES, s);
      tank.fish = list(tank.fish).filter((f) => f && species(f.s) && C.SPECIES[f.s].tank === id);
      tank.eggs = list(tank.eggs).filter((e) => e && species(e.s));
      for (const key of ["drops", "algae", "debris", "autoFed"]) tank[key] = list(tank[key]);
      const decor = C.SLOTS.map((_, i) => list(tank.decor)[i] || null);
      tank.decor = decor.map((d, i) =>
        d &&
        typeof d.d === "string" &&
        Object.hasOwn(C.DECOR, d.d) &&
        C.DECOR[d.d].tank === id &&
        slotFits(i, d.d)
          ? d
          : null,
      );
      tank.waste = clamp(num(tank.waste), 0, 3);
      for (const key of Object.keys(tank.up)) {
        const max = maxUpgrade(key);
        tank.up[key] = clamp(tank.up[key] | 0, 0, max);
      }
    }
    if (!TANK_IDS.includes(save.active) || !save.tanks[save.active].unlocked) save.active = "pond";
    return save;
  }

  // ── Derived values (never persisted) ───────────────────────────────

  function xpFor(level) {
    return Math.round(25 * level ** 1.9);
  }

  function maxUpgrade(kind) {
    return C.UPGRADES[kind].cost.length;
  }

  function capacity(tank) {
    return C.TANKS[tank.id].capacity + tank.up.size * C.UPGRADES.size.perLevel;
  }

  function usedSpace(tank) {
    let used = 0;
    for (const f of tank.fish) used += C.SPECIES[f.s].space;
    return used;
  }

  function decorTags(tank) {
    const tags = new Set();
    for (const slot of tank.decor) if (slot) for (const t of C.DECOR[slot.d].tags) tags.add(t);
    return tags;
  }

  function tankBonus(tank) {
    let bonus = 0;
    for (const slot of tank.decor) if (slot) bonus += C.DECOR[slot.d].bonus || 0;
    return bonus;
  }

  // Water quality 0..100, lowered by algae on the glass and debris on the sand.
  function waterQuality(tank) {
    let q = 100;
    for (const a of tank.algae) q -= 3 + 2 * a.hp;
    q -= 6 * tank.debris.length;
    return clamp(q, 0, 100);
  }

  /*
   * Happiness 0..100 and the reasons behind it, so the fish card can explain every point.
   */
  function happiness(fish, tank, now, tags) {
    const sp = C.SPECIES[fish.s];
    const reasons = [];
    let h = 50;
    const fed = fish.fed;
    const fedPts = fed >= 60 ? 20 : fed >= 30 ? 5 : fed >= 10 ? -15 : -35;
    h += fedPts;
    reasons.push({ k: "fed", v: fedPts });
    const wq = waterQuality(tank);
    const wqPts = Math.round((wq - 50) * 0.3);
    h += wqPts;
    reasons.push({ k: "water", v: wqPts });
    tags = tags || decorTags(tank);
    let likePts = 0;
    if (sp.likes?.length) {
      for (const t of sp.likes) if (tags.has(t)) likePts += 8;
      likePts = Math.min(16, likePts);
    } else likePts = 8;
    h += likePts;
    reasons.push({ k: "decor", v: likePts });
    if (sp.needs && !tags.has(sp.needs)) {
      h -= 30;
      reasons.push({ k: "home", v: -30 });
    }
    if (fish.buff > now) reasons.push({ k: "playful", v: 0 });
    return { value: clamp(Math.round(h), 0, 100), reasons };
  }

  function incomeMult(h) {
    return clamp((h - 20) / 60, 0, 1);
  }

  // Coins per hour for one fish right now.
  function fishIncome(fish, tank, now, tags, bonus) {
    const sp = C.SPECIES[fish.s];
    const h = happiness(fish, tank, now, tags).value;
    const buff = fish.buff > now ? 1.25 : 1;
    const b = bonus ?? tankBonus(tank);
    return sp.income * C.RULES.stageIncome[fish.stage] * incomeMult(h) * buff * (1 + b);
  }

  function tankIncome(tank, now) {
    const tags = decorTags(tank);
    const bonus = tankBonus(tank);
    let sum = 0;
    for (const f of tank.fish) sum += fishIncome(f, tank, now, tags, bonus);
    return sum;
  }

  // Best-case income: what the tank makes when every fish is fed and happy. Used for caps.
  function potentialIncome(tank) {
    const bonus = tankBonus(tank);
    let sum = 0;
    for (const f of tank.fish)
      sum += C.SPECIES[f.s].income * C.RULES.stageIncome[f.stage] * (1 + bonus);
    return sum;
  }

  function coinCap(tank) {
    const hours = C.UPGRADES.chest.hours[tank.up.chest];
    return Math.max(30, Math.round(potentialIncome(tank) * hours));
  }

  function uncollected(tank) {
    let sum = 0;
    for (const d of tank.drops) sum += d.v;
    return sum;
  }

  function fishSellPrice(fish) {
    const sp = C.SPECIES[fish.s];
    return Math.max(
      1,
      Math.round(
        sp.price *
          C.RULES.sellReturn *
          C.RULES.stageSell[fish.stage] *
          C.RULES.variantSellMult[fish.v],
      ),
    );
  }

  function upgradeCost(tank, kind) {
    const lvl = tank.up[kind];
    const list = C.UPGRADES[kind].cost;
    if (lvl >= list.length) return null;
    return Math.round(list[lvl] * C.TANKS[tank.id].costMult);
  }

  function slotFits(slotIndex, decorId) {
    const slot = C.SLOTS[slotIndex];
    return !!slot && SIZE_RANK[C.DECOR[decorId].size] <= SIZE_RANK[slot.size];
  }

  // Scales coin rewards for chores so late tanks stay worth cleaning.
  function choreMult(tank) {
    return Math.max(1, Math.round(Math.sqrt(C.TANKS[tank.id].costMult) * 2) / 2);
  }

  function localDay(save, now) {
    return Math.floor((now - (save.tz || 0) * 60000) / DAY);
  }

  function eggReady(egg, now) {
    return now >= egg.at + C.RULES.eggHatchHours * HOUR;
  }

  function hatchVariant(save, egg, i) {
    const roll = rand(save.seed, egg.id, "variant", i);
    if (egg.m === 2) {
      if (egg.v) return egg.v;
      return roll < C.EGGS.golden.epicChance ? 2 : 1;
    }
    const boost = egg.m === 1 ? C.EGGS.mystery.boost : 1;
    const epic = C.VARIANT_ODDS[2] * boost;
    return roll < epic ? 2 : roll < epic + C.VARIANT_ODDS[1] * boost ? 1 : 0;
  }

  function eggPrice(tank, kind) {
    const egg = C.EGGS[kind];
    return egg.pearls
      ? { pearls: egg.pearls }
      : { coins: Math.round(egg.price * C.TANKS[tank.id].costMult) };
  }

  function playReady(fish, now) {
    return !fish.played || now - fish.played >= C.RULES.playCooldownHours * HOUR;
  }

  // ── Mutating helpers ───────────────────────────────────────────────

  function addFish(save, tank, speciesId, variant, stage, now) {
    const fish = {
      id: nextId(save, "f"),
      s: speciesId,
      v: variant,
      born: now,
      stage,
      growth: 0,
      fed: 80,
      played: 0,
      buff: 0,
    };
    tank.fish.push(fish);
    return fish;
  }

  function addXp(save, amount, ev) {
    if (save.level >= C.RULES.maxLevel) return;
    save.xp += amount;
    while (save.level < C.RULES.maxLevel && save.xp >= xpFor(save.level)) {
      save.xp -= xpFor(save.level);
      save.level += 1;
      const coins = save.level * 25;
      save.coins += coins;
      save.pearls += 1;
      ev.push({ t: "level", level: save.level, coins, pearls: 1 });
    }
    if (save.level >= C.RULES.maxLevel) save.xp = 0;
  }

  function earn(save, coins) {
    save.coins += coins;
    save.stats.coinsEarned += coins;
  }

  function discover(save, speciesId, variant, ev) {
    const mask = save.dex[speciesId] | 0;
    const bit = 1 << variant;
    if (mask & bit) return;
    save.dex[speciesId] = mask | bit;
    let pearls = variant === 0 && !mask ? C.DEX_PEARLS.species : 0;
    if (variant > 0) pearls += C.DEX_PEARLS.rare;
    if (!mask && variant > 0) pearls += C.DEX_PEARLS.species;
    const tankId = C.SPECIES[speciesId].tank;
    const complete = Object.keys(C.SPECIES)
      .filter((s) => C.SPECIES[s].tank === tankId)
      .every((s) => (save.dex[s] | 0) === 7);
    if (complete) pearls += C.DEX_PEARLS.tankComplete;
    save.pearls += pearls;
    ev.push({ t: "dex", s: speciesId, v: variant, pearls, complete });
  }

  function spawnAlgae(save, tank, at) {
    const id = nextId(save, "a");
    const r = (k) => rand(save.seed, id, k);
    const hp = 1 + Math.floor(r("hp") * 3);
    tank.algae.push({
      id,
      x: round2(0.07 + r("x") * 0.74),
      y: round2(0.14 + r("y") * 0.5),
      hp,
      max: hp,
      at,
    });
  }

  function spawnDebris(save, tank, at) {
    const id = nextId(save, "w");
    tank.debris.push({ id, x: round2(0.06 + rand(save.seed, id, "x") * 0.76), at });
  }

  function spawnDrop(save, tank, value) {
    if (tank.drops.length < C.RULES.maxDrops) {
      const id = nextId(save, "c");
      tank.drops.push({ id, x: round2(0.06 + rand(save.seed, id, "x") * 0.76), v: value });
    } else {
      let smallest = tank.drops[0];
      for (const d of tank.drops) if (d.v < smallest.v) smallest = d;
      smallest.v += value;
    }
  }

  // Cleanup crew fish slowly eat algae/debris and get a little food from it.
  function runCrew(tank, kind, dt) {
    let rate = 0;
    const crew = [];
    for (const f of tank.fish) {
      const c = C.SPECIES[f.s].cleans;
      if (c?.[kind]) {
        rate += c[kind] * (f.stage === STAGE.FRY ? 0.5 : 1);
        crew.push(f);
      }
    }
    if (!rate) {
      tank.crew[kind] = 0;
      return;
    }
    tank.crew[kind] += rate * dt;
    const list = kind === "algae" ? tank.algae : tank.debris;
    while (tank.crew[kind] >= 1 && list.length) {
      tank.crew[kind] -= 1;
      if (kind === "algae") {
        list[0].hp -= 1;
        if (list[0].hp <= 0) list.shift();
      } else list.shift();
      let hungriest = crew[0];
      for (const f of crew) if (f.fed < hungriest.fed) hungriest = f;
      hungriest.fed = Math.min(100, hungriest.fed + 12);
    }
    if (!list.length) tank.crew[kind] = Math.min(tank.crew[kind], 1);
  }

  function spawnInterval(tank, base, kind) {
    const filter = 1 - tank.up.filter * C.UPGRADES.filter.perLevel;
    const load = clamp(usedSpace(tank) / capacity(tank), 0, 1);
    const factor = kind === "algae" ? 0.7 + 0.3 * load : 0.25 + 0.75 * load;
    return (base * HOUR) / Math.max(0.05, filter * factor);
  }

  function autoFeed(save, tank, now, ev) {
    const level = tank.up.feeder;
    if (!level || !tank.fish.length) return;
    tank.autoFed = tank.autoFed.filter((t) => now - t < DAY);
    if (tank.autoFed.length >= level) return;
    let avg = 0;
    for (const f of tank.fish) avg += f.fed;
    avg /= tank.fish.length;
    if (avg >= C.RULES.autoFeedBelow) return;
    // Pick the food in stock that the most fish accept.
    let best = null;
    let bestCount = 0;
    for (const foodId of Object.keys(C.FOODS)) {
      if (!(save.food[foodId] > 0)) continue;
      const count = tank.fish.filter((f) => C.SPECIES[f.s].eats.includes(foodId)).length;
      if (count > bestCount) {
        best = foodId;
        bestCount = count;
      }
    }
    if (!best) return;
    const food = C.FOODS[best];
    const portions = Math.min(save.food[best], Math.ceil(bestCount / food.portion));
    let bitsLeft = portions * food.portion;
    save.food[best] -= portions;
    const eaters = tank.fish
      .filter((f) => C.SPECIES[f.s].eats.includes(best))
      .sort((a, b) => a.fed - b.fed);
    for (const f of eaters) {
      if (!bitsLeft) break;
      f.fed = Math.min(100, f.fed + food.restore);
      bitsLeft -= 1;
    }
    tank.autoFed.push(now);
    ev.push({ t: "autofeed", tank: tank.id, food: best, portions });
  }

  function tryBreed(save, tank, dt, now, tags, ev) {
    const adults = {};
    for (const f of tank.fish) {
      if (f.stage !== STAGE.ADULT) continue;
      if (happiness(f, tank, now, tags).value < 70) continue;
      adults[f.s] = (adults[f.s] || 0) + 1;
    }
    for (const s of Object.keys(adults)) {
      if (adults[s] < 2) continue;
      if (tank.eggs.some((e) => e.s === s)) continue;
      tank.breed[s] = (tank.breed[s] || 0) + dt;
      if (tank.breed[s] >= C.SPECIES[s].breed && tank.eggs.length < C.RULES.maxEggClutches) {
        tank.breed[s] = 0;
        const id = nextId(save, "e");
        tank.eggs.push({ id, s, at: now, x: round2(0.1 + rand(save.seed, id, "x") * 0.7) });
        ev.push({ t: "eggs", tank: tank.id, s });
      }
    }
  }

  // ── Simulation ─────────────────────────────────────────────────────

  /*
   * Advance every unlocked tank from save.t to now. Idle time is capped at a week.
   * Returns a summary of what happened, used for the "while you were away" card.
   */
  function simulate(save, now, ev = []) {
    const start = save.t || now;
    // Time only advances on a fixed clock grid, so the page (ticking every second) and the
    // server (catching up hours at once) take exactly the same steps and reach the same save.
    const end = Math.floor(now / STEP) * STEP;
    const summary = { hours: 0, coins: 0, algae: 0, debris: 0, eggs: 0, ev };
    if (end <= start) return summary;
    summary.hours = (now - start) / HOUR;
    const from = Math.max(start, end - C.RULES.maxIdleHours * HOUR);
    for (const id of TANK_IDS) {
      const tank = save.tanks[id];
      if (!tank.unlocked) continue;
      const before = {
        coins: uncollected(tank) + tank.pending,
        algae: tank.algae.length,
        debris: tank.debris.length,
        eggs: tank.eggs.length,
      };
      // Food left drifting in the water when the widget closed turns into waste.
      if (tank.bits > 0 && end - tank.bitsAt > 2 * 60000) {
        tank.waste += tank.bits;
        tank.bits = 0;
      }
      wasteToDebris(save, tank, end);
      tank.nextAlgae = Math.max(tank.nextAlgae, from);
      tank.nextDebris = Math.max(tank.nextDebris, from);
      let t = from;
      while (t < end) {
        const t2 = Math.min(end, (Math.floor(t / STEP) + 1) * STEP);
        stepTank(save, tank, t, t2, ev);
        t = t2;
      }
      summary.coins += Math.max(0, Math.floor(uncollected(tank) + tank.pending - before.coins));
      summary.algae += Math.max(0, tank.algae.length - before.algae);
      summary.debris += Math.max(0, tank.debris.length - before.debris);
      summary.eggs += Math.max(0, tank.eggs.length - before.eggs);
    }
    save.t = end;
    ensureDaily(save, ev);
    checkAchievements(save, ev);
    return summary;
  }

  function wasteToDebris(save, tank, at) {
    while (tank.waste >= 3 && tank.debris.length < C.RULES.maxDebris) {
      tank.waste -= 3;
      spawnDebris(save, tank, at);
    }
    // With the sand full of debris, extra waste has nowhere to go.
    tank.waste = Math.min(tank.waste, 3);
  }

  function stepTank(save, tank, t, t2, ev) {
    const dt = (t2 - t) / HOUR;
    const tags = decorTags(tank);
    const bonus = tankBonus(tank);

    while (tank.nextAlgae <= t2) {
      if (tank.algae.length < C.RULES.maxAlgae) spawnAlgae(save, tank, tank.nextAlgae);
      tank.nextAlgae += spawnInterval(tank, C.RULES.algaeEveryHours, "algae");
    }
    while (tank.nextDebris <= t2) {
      if (tank.fish.length && tank.debris.length < C.RULES.maxDebris)
        spawnDebris(save, tank, tank.nextDebris);
      tank.nextDebris += spawnInterval(tank, C.RULES.debrisEveryHours, "debris");
    }
    runCrew(tank, "algae", dt);
    runCrew(tank, "debris", dt);

    // Income uses happiness at the start of the step.
    let income = 0;
    for (const f of tank.fish) income += fishIncome(f, tank, t, tags, bonus);
    tank.pending += income * dt;
    const unit = Math.max(1, Math.round(potentialIncome(tank) / 3));
    const cap = coinCap(tank);
    while (tank.pending >= unit) {
      tank.pending -= unit;
      if (uncollected(tank) + unit <= cap) spawnDrop(save, tank, unit);
    }
    if (uncollected(tank) >= cap) tank.pending = 0;

    for (const f of tank.fish) {
      const sp = C.SPECIES[f.s];
      f.fed = Math.max(0, f.fed - sp.hunger * dt);
      if (f.fed > 30 && f.stage < STAGE.ADULT) {
        f.growth += dt;
        if (f.growth >= sp.grow) {
          f.growth = 0;
          f.stage += 1;
          ev.push({ t: "grow", tank: tank.id, fish: f.id, stage: f.stage });
        }
      }
    }
    autoFeed(save, tank, t2, ev);
    tryBreed(save, tank, dt, t2, tags, ev);
  }

  // ── Goals, tutorial, achievements ──────────────────────────────────

  function dailyIncome(save, now) {
    let sum = 0;
    for (const id of TANK_IDS) if (save.tanks[id].unlocked) sum += tankIncome(save.tanks[id], now);
    return sum * 24;
  }

  function ensureDaily(save, ev) {
    if (save.tut < C.TUTORIAL.length) return;
    const now = save.t;
    const day = localDay(save, now);
    const d = save.daily;
    // Never go back to an earlier day (a timezone change could otherwise re-open a bonus).
    if (day <= d.day) return;
    if (d.lastFull < day - 1) d.streak = 0;
    d.day = day;
    d.bonus = false;
    d.visited = [save.active];
    const unlocked = TANK_IDS.filter((id) => save.tanks[id].unlocked).length;
    const pool = Object.keys(C.GOALS).filter((k) => {
      if (C.GOALS[k].min > save.level) return false;
      if (k === "visit" && unlocked < 2) return false;
      return true;
    });
    const goals = [];
    let i = 0;
    while (goals.length < C.RULES.goalsPerDay && pool.length) {
      const k = pool.splice(Math.floor(rand(save.seed, day, "goal", i++) * pool.length), 1)[0];
      const [lo, hi] = C.GOALS[k].n;
      let n = lo + Math.floor(rand(save.seed, day, k) * (hi - lo + 1));
      if (k === "collect") n = Math.max(30, Math.round((dailyIncome(save, now) * 0.25) / 10) * 10);
      // Visiting counts tanks other than the one you start the day in.
      if (k === "visit") n = Math.min(n, unlocked - 1);
      goals.push({ k, n, p: 0, done: false });
    }
    d.goals = goals;
    ev.push({ t: "daily", day });
  }

  function goalReward(save) {
    return Math.max(25, Math.round((dailyIncome(save, save.t) * 0.12) / 5) * 5);
  }

  /*
   * Report progress on an activity. Drives the tutorial and the daily goals.
   * kind: collect | feed | scrub | vacuum | play | hatch | buyFish | buyDecor | visit
   */
  function progress(save, kind, amount, now, ev) {
    if (save.tut < C.TUTORIAL.length) {
      const step = C.TUTORIAL[save.tut];
      const match =
        step.id === kind ||
        (step.id === "buy_decor" && kind === "buyDecor") ||
        (step.id === "buy_fish" && kind === "buyFish");
      if (match) {
        save.tutProg += amount;
        if (save.tutProg >= step.target) {
          save.tut += 1;
          save.tutProg = 0;
          earn(save, step.coins);
          ev.push({ t: "tutorial", id: step.id, coins: step.coins });
          addXp(save, 15, ev);
          if (save.tut >= C.TUTORIAL.length) ensureDaily(save, ev);
        }
      }
      return;
    }
    ensureDaily(save, ev);
    const d = save.daily;
    const goalKind = kind === "buyFish" || kind === "buyDecor" ? "buy" : kind;
    for (const g of d.goals) {
      if (g.done || g.k !== goalKind) continue;
      g.p = Math.min(g.n, g.p + amount);
      if (g.p >= g.n) {
        g.done = true;
        const coins = goalReward(save);
        earn(save, coins);
        ev.push({ t: "goal", k: g.k, coins });
        addXp(save, C.RULES.xp.goal, ev);
      }
    }
    if (!d.bonus && d.goals.length && d.goals.every((g) => g.done)) {
      d.bonus = true;
      d.streak = d.lastFull === d.day - 1 ? d.streak + 1 : 1;
      d.lastFull = d.day;
      let pearls = C.RULES.goalsBonusPearls;
      if (d.streak % 7 === 0) pearls += C.RULES.streakPearls;
      save.pearls += pearls;
      ev.push({ t: "allgoals", pearls, streak: d.streak });
    }
  }

  function statValue(save, stat) {
    switch (stat) {
      case "fishOwned":
        return TANK_IDS.reduce((n, id) => n + save.tanks[id].fish.length, 0);
      case "tanksUnlocked":
        return TANK_IDS.filter((id) => save.tanks[id].unlocked).length;
      case "speciesFound":
        return Object.values(save.dex).filter((m) => m > 0).length;
      case "raresFound":
        return Object.values(save.dex).reduce((n, m) => n + ((m >> 1) & 1) + ((m >> 2) & 1), 0);
      case "level":
        return save.level;
      default:
        return save.stats[stat] || 0;
    }
  }

  function checkAchievements(save, ev) {
    for (const a of C.ACHIEVEMENTS) {
      if (save.ach.includes(a.id)) continue;
      if (statValue(save, a.stat) >= a.n) {
        save.ach.push(a.id);
        save.pearls += a.pearls;
        ev.push({ t: "ach", id: a.id, pearls: a.pearls });
      }
    }
  }

  // ── Actions ────────────────────────────────────────────────────────

  function fail(error) {
    return { ok: false, error, ev: [] };
  }

  function getTank(save, id) {
    const key = id || save.active;
    const tank = TANK_IDS.includes(key) ? save.tanks[key] : null;
    return tank?.unlocked ? tank : null;
  }

  /*
   * Actions arrive from the network, so every field is checked against the catalog (own keys
   * only, so names like "constructor" never reach a lookup) before any handler runs.
   */
  const PARAM_CHECKS = {
    tank: (v) => TANK_IDS.includes(v),
    food: (v) => typeof v === "string" && Object.hasOwn(C.FOODS, v),
    s: (v) => typeof v === "string" && Object.hasOwn(C.SPECIES, v),
    d: (v) => typeof v === "string" && Object.hasOwn(C.DECOR, v),
    kind: (v) =>
      typeof v === "string" && (Object.hasOwn(C.UPGRADES, v) || Object.hasOwn(C.EGGS, v)),
    id: (v) => typeof v === "string" && v.length < 24,
    fish: (v) => typeof v === "string" && v.length < 24,
    slot: (v) => Number.isInteger(v) && v >= 0 && v < C.SLOTS.length,
    from: (v) => Number.isInteger(v) && v >= 0 && v < C.SLOTS.length,
    to: (v) => Number.isInteger(v) && v >= 0 && v < C.SLOTS.length,
    n: (v) => Number.isInteger(v) && v >= 0 && v <= 1000,
    tz: (v) => Number.isFinite(v),
    sell: (v) => typeof v === "boolean",
  };

  function validAction(action) {
    if (!action || typeof action !== "object" || typeof action.type !== "string") return false;
    if (!Object.hasOwn(ACTIONS, action.type)) return false;
    for (const key of Object.keys(action)) {
      if (key === "type" || action[key] == null) continue;
      const check = PARAM_CHECKS[key];
      if (!check || !check(action[key])) return false;
    }
    return true;
  }

  function findFish(tank, id) {
    return tank.fish.find((f) => f.id === id);
  }

  const ACTIONS = {
    collect(save, p, now, ev) {
      const tank = getTank(save, p.tank);
      if (!tank) return "tank";
      const ids = p.id ? [p.id] : tank.drops.map((d) => d.id);
      let total = 0;
      for (const id of ids) {
        const i = tank.drops.findIndex((d) => d.id === id);
        if (i < 0) continue;
        total += tank.drops[i].v;
        tank.drops.splice(i, 1);
      }
      if (!total) return "gone";
      earn(save, total);
      addXp(save, Math.max(1, Math.round(total * C.RULES.xp.collect)), ev);
      progress(save, "collect", total, now, ev);
      return { coins: total };
    },

    drop(save, p, now) {
      const tank = getTank(save, p.tank);
      const food = C.FOODS[p.food];
      if (!tank || !food) return "invalid";
      if (!(save.food[p.food] > 0)) return "noFood";
      save.food[p.food] -= 1;
      tank.bits += food.portion;
      tank.bitsAt = now;
      return { bits: food.portion };
    },

    eat(save, p, now, ev) {
      const tank = getTank(save, p.tank);
      const food = C.FOODS[p.food];
      if (!tank || !food) return "invalid";
      const fish = findFish(tank, p.fish);
      if (!fish || !C.SPECIES[fish.s].eats.includes(p.food)) return "invalid";
      if (tank.bits <= 0) return "noBits";
      tank.bits -= 1;
      fish.fed = Math.min(100, fish.fed + food.restore);
      if (food.growth && fish.stage < STAGE.ADULT) fish.growth += food.growth;
      save.stats.fed += 1;
      addXp(save, C.RULES.xp.eat, ev);
      progress(save, "feed", 1, now, ev);
      return {};
    },

    waste(save, p, now) {
      const tank = getTank(save, p.tank);
      if (!tank) return "invalid";
      const n = Math.min(tank.bits, Math.max(0, p.n | 0));
      tank.bits -= n;
      tank.waste += n;
      wasteToDebris(save, tank, now);
      return {};
    },

    scrub(save, p, now, ev) {
      const tank = getTank(save, p.tank);
      if (!tank) return "invalid";
      const a = tank.algae.find((x) => x.id === p.id);
      if (!a) return "gone";
      a.hp -= 1;
      if (a.hp > 0) return { hp: a.hp };
      tank.algae.splice(tank.algae.indexOf(a), 1);
      const coins = C.RULES.scrubCoins * choreMult(tank) * a.max;
      earn(save, coins);
      save.stats.scrubbed += 1;
      addXp(save, C.RULES.xp.scrub, ev);
      progress(save, "scrub", 1, now, ev);
      return { coins, hp: 0 };
    },

    vacuum(save, p, now, ev) {
      const tank = getTank(save, p.tank);
      if (!tank) return "invalid";
      const i = tank.debris.findIndex((x) => x.id === p.id);
      if (i < 0) return "gone";
      tank.debris.splice(i, 1);
      const coins = C.RULES.vacuumCoins * choreMult(tank);
      earn(save, coins);
      save.stats.vacuumed += 1;
      addXp(save, C.RULES.xp.vacuum, ev);
      progress(save, "vacuum", 1, now, ev);
      return { coins };
    },

    play(save, p, now, ev) {
      const tank = getTank(save, p.tank);
      if (!tank) return "invalid";
      const fish = findFish(tank, p.fish);
      if (!fish) return "invalid";
      if (!playReady(fish, now)) return "tired";
      fish.played = now;
      fish.buff = now + C.RULES.playBuffHours * HOUR;
      save.stats.played += 1;
      addXp(save, C.RULES.xp.play, ev);
      progress(save, "play", 1, now, ev);
      return {};
    },

    hatch(save, p, now, ev) {
      const tank = getTank(save, p.tank);
      if (!tank) return "invalid";
      const egg = tank.eggs.find((e) => e.id === p.id);
      if (!egg) return "gone";
      if (!eggReady(egg, now)) return "notReady";
      const sp = C.SPECIES[egg.s];
      // Bought eggs hold a single fish; laid clutches hold one to three.
      const count = egg.m ? 1 : 1 + Math.floor(rand(save.seed, egg.id, "n") * 3);
      const free = capacity(tank) - usedSpace(tank);
      const sameCount = tank.fish.filter((f) => f.s === egg.s).length;
      const room = Math.min(
        count,
        Math.floor(free / sp.space),
        sp.max ? Math.max(0, sp.max - sameCount) : count,
      );
      if (room <= 0 && !p.sell) return "full";
      tank.eggs.splice(tank.eggs.indexOf(egg), 1);
      const born = [];
      let soldFor = 0;
      for (let i = 0; i < count; i++) {
        const variant = hatchVariant(save, egg, i);
        discover(save, egg.s, variant, ev);
        if (i < room) {
          const fish = addFish(save, tank, egg.s, variant, STAGE.FRY, now);
          born.push({ id: fish.id, v: variant });
        } else {
          soldFor += fishSellPrice({ s: egg.s, v: variant, stage: STAGE.FRY });
        }
      }
      if (soldFor) earn(save, soldFor);
      save.stats.hatched += 1;
      addXp(save, C.RULES.xp.hatch, ev);
      progress(save, "hatch", 1, now, ev);
      return { born, soldFor };
    },

    buyFish(save, p, now, ev) {
      const tank = getTank(save, p.tank);
      const sp = C.SPECIES[p.s];
      if (!tank || !sp || sp.tank !== tank.id) return "invalid";
      if (save.level < sp.level) return "level";
      if (sp.max && tank.fish.filter((f) => f.s === p.s).length >= sp.max) return "max";
      if (usedSpace(tank) + sp.space > capacity(tank)) return "space";
      if (save.coins < sp.price) return "coins";
      save.coins -= sp.price;
      const fish = addFish(save, tank, p.s, 0, STAGE.JUVENILE, now);
      save.stats.bought += 1;
      discover(save, p.s, 0, ev);
      addXp(save, C.RULES.xp.buy, ev);
      progress(save, "buyFish", 1, now, ev);
      return { fish: fish.id };
    },

    buyEgg(save, p, now, ev) {
      const tank = getTank(save, p.tank);
      const egg = C.EGGS[p.kind];
      if (!tank || !Object.hasOwn(C.EGGS, p.kind)) return "invalid";
      if (save.level < egg.level) return "level";
      if (tank.eggs.length >= C.RULES.maxEggClutches) return "eggsFull";
      const price = eggPrice(tank, p.kind);
      if (price.coins && save.coins < price.coins) return "coins";
      if (price.pearls && save.pearls < price.pearls) return "pearls";
      const id = nextId(save, "e");
      const pool = Object.keys(C.SPECIES).filter(
        (s) => C.SPECIES[s].tank === tank.id && C.SPECIES[s].level <= save.level,
      );
      if (!pool.length) return "invalid";
      const m = p.kind === "golden" ? 2 : 1;
      let s = pool[Math.floor(rand(save.seed, id, "sp") * pool.length)];
      let v = 0;
      if (m === 2) {
        // Golden eggs aim for a colour the player is still missing.
        const missing = [];
        for (const sp of pool)
          for (const bit of [1, 2]) if (!((save.dex[sp] | 0) & (1 << bit))) missing.push([sp, bit]);
        if (missing.length)
          [s, v] = missing[Math.floor(rand(save.seed, id, "miss") * missing.length)];
      }
      save.coins -= price.coins || 0;
      save.pearls -= price.pearls || 0;
      tank.eggs.push({
        id,
        s,
        at: now,
        x: round2(0.1 + rand(save.seed, id, "x") * 0.7),
        m,
        ...(v ? { v } : {}),
      });
      addXp(save, C.RULES.xp.buy, ev);
      progress(save, "buyFish", 1, now, ev);
      return { egg: id };
    },

    sellFish(save, p) {
      const tank = getTank(save, p.tank);
      if (!tank) return "invalid";
      const fish = findFish(tank, p.fish);
      if (!fish) return "gone";
      const coins = fishSellPrice(fish);
      tank.fish.splice(tank.fish.indexOf(fish), 1);
      save.coins += coins;
      return { coins };
    },

    buyDecor(save, p, now, ev) {
      const tank = getTank(save, p.tank);
      const item = C.DECOR[p.d];
      if (!tank || !item || item.tank !== tank.id) return "invalid";
      if (save.level < item.level) return "level";
      const slot = p.slot | 0;
      if (slot < 0 || slot >= C.SLOTS.length || tank.decor[slot]) return "slot";
      if (!slotFits(slot, p.d)) return "fit";
      if (item.pearls) {
        if (save.pearls < item.pearls) return "pearls";
        save.pearls -= item.pearls;
      } else {
        if (save.coins < item.price) return "coins";
        save.coins -= item.price;
      }
      tank.decor[slot] = { id: nextId(save, "d"), d: p.d };
      addXp(save, C.RULES.xp.buy, ev);
      progress(save, "buyDecor", 1, now, ev);
      return {};
    },

    moveDecor(save, p) {
      const tank = getTank(save, p.tank);
      if (!tank) return "invalid";
      const from = p.from | 0;
      const to = p.to | 0;
      const a = tank.decor[from];
      const b = tank.decor[to];
      if (!a || from === to || to < 0 || to >= C.SLOTS.length) return "invalid";
      if (!slotFits(to, a.d) || (b && !slotFits(from, b.d))) return "fit";
      tank.decor[to] = a;
      tank.decor[from] = b;
      return {};
    },

    sellDecor(save, p) {
      const tank = getTank(save, p.tank);
      if (!tank) return "invalid";
      const slot = tank.decor[p.slot | 0];
      if (!slot) return "gone";
      const item = C.DECOR[slot.d];
      tank.decor[p.slot | 0] = null;
      if (item.pearls) {
        const pearls = Math.floor(item.pearls * C.RULES.decorSellReturn);
        save.pearls += pearls;
        return { pearls };
      }
      const coins = Math.round(item.price * C.RULES.decorSellReturn);
      save.coins += coins;
      return { coins };
    },

    buyFood(save, p) {
      const food = C.FOODS[p.food];
      if (!food) return "invalid";
      if (save.level < food.level) return "level";
      if (save.coins < food.price) return "coins";
      save.coins -= food.price;
      save.food[p.food] = (save.food[p.food] || 0) + food.pack;
      return {};
    },

    upgrade(save, p) {
      const tank = getTank(save, p.tank);
      if (!tank || !Object.hasOwn(C.UPGRADES, p.kind)) return "invalid";
      const cost = upgradeCost(tank, p.kind);
      if (cost == null) return "max";
      if (save.coins < cost) return "coins";
      save.coins -= cost;
      tank.up[p.kind] += 1;
      return {};
    },

    unlockTank(save, p, now, ev) {
      if (!TANK_IDS.includes(p.tank)) return "invalid";
      const def = C.TANKS[p.tank];
      const tank = save.tanks[p.tank];
      if (tank.unlocked) return "invalid";
      if (save.level < def.unlockLevel) return "level";
      if (save.coins < def.unlockCost) return "coins";
      save.coins -= def.unlockCost;
      tank.unlocked = true;
      tank.nextAlgae = save.t + C.RULES.algaeEveryHours * HOUR;
      tank.nextDebris = save.t + C.RULES.debrisEveryHours * HOUR;
      save.active = p.tank;
      ev.push({ t: "tank", id: p.tank });
      return {};
    },

    setTank(save, p, now, ev) {
      if (!getTank(save, p.tank)) return "invalid";
      save.active = p.tank;
      const d = save.daily;
      if (save.tut >= C.TUTORIAL.length && d.visited && !d.visited.includes(p.tank)) {
        d.visited.push(p.tank);
        progress(save, "visit", 1, now, ev);
      }
      return {};
    },

    setTz(save, p) {
      const tz = Number(p.tz);
      if (!Number.isFinite(tz) || Math.abs(tz) > 900) return "invalid";
      save.tz = Math.round(tz);
      return {};
    },
  };

  /*
   * Apply one player action. Simulates up to `now` first so state is current.
   * Returns { ok, error?, result?, ev } and mutates the save in place.
   */
  function apply(save, action, now) {
    const ev = [];
    simulate(save, now, ev);
    if (!action || !Object.hasOwn(ACTIONS, action.type)) return fail("unknown");
    if (!validAction(action)) return fail("invalid");
    const result = ACTIONS[action.type](save, action, now, ev);
    if (typeof result === "string") return { ok: false, error: result, ev };
    checkAchievements(save, ev);
    return { ok: true, result, ev };
  }

  // ── Read models for the UI ─────────────────────────────────────────

  function stageOf(fish) {
    return ["fry", "juvenile", "adult"][fish.stage];
  }

  function fishInfo(save, tankId, fishId, now) {
    const tank = save.tanks[tankId];
    const fish = tank && findFish(tank, fishId);
    if (!fish) return null;
    const sp = C.SPECIES[fish.s];
    const h = happiness(fish, tank, now);
    return {
      fish,
      species: sp,
      happiness: h.value,
      reasons: h.reasons,
      income: fishIncome(fish, tank, now),
      sell: fishSellPrice(fish),
      stage: stageOf(fish),
      growPct: fish.stage < STAGE.ADULT ? clamp(fish.growth / sp.grow, 0, 1) : 1,
      playReady: playReady(fish, now),
      playful: fish.buff > now,
    };
  }

  function tankInfo(save, tankId, now) {
    const tank = save.tanks[tankId];
    const tags = decorTags(tank);
    let hungry = 0;
    let happy = 0;
    for (const f of tank.fish) {
      if (f.fed < 30) hungry += 1;
      happy += happiness(f, tank, now, tags).value;
    }
    return {
      tank,
      capacity: capacity(tank),
      used: usedSpace(tank),
      water: waterQuality(tank),
      income: tankIncome(tank, now),
      cap: coinCap(tank),
      uncollected: uncollected(tank),
      hungry,
      happiness: tank.fish.length ? Math.round(happy / tank.fish.length) : 100,
      eggsReady: tank.eggs.filter((e) => eggReady(e, now)).length,
      bonus: tankBonus(tank),
    };
  }

  // Why an item can't be bought right now, or null.
  function speciesBlock(save, tank, id) {
    const sp = C.SPECIES[id];
    if (save.level < sp.level) return "level";
    if (sp.max && tank.fish.filter((f) => f.s === id).length >= sp.max) return "max";
    if (usedSpace(tank) + sp.space > capacity(tank)) return "space";
    if (save.coins < sp.price) return "coins";
    return null;
  }

  function decorBlock(save, tank, id) {
    const item = C.DECOR[id];
    if (save.level < item.level) return "level";
    if (!freeSlots(tank, id).length) return "slot";
    if (item.pearls ? save.pearls < item.pearls : save.coins < item.price)
      return item.pearls ? "pearls" : "coins";
    return null;
  }

  function freeSlots(tank, decorId) {
    const out = [];
    tank.decor.forEach((d, i) => {
      if (!d && slotFits(i, decorId)) out.push(i);
    });
    return out;
  }

  function speciesFor(tankId) {
    return Object.keys(C.SPECIES)
      .filter((s) => C.SPECIES[s].tank === tankId)
      .sort(
        (a, b) =>
          C.SPECIES[a].level - C.SPECIES[b].level || C.SPECIES[a].price - C.SPECIES[b].price,
      );
  }

  function decorFor(tankId) {
    return Object.keys(C.DECOR)
      .filter((d) => C.DECOR[d].tank === tankId)
      .sort(
        (a, b) => !!C.DECOR[a].pearls - !!C.DECOR[b].pearls || C.DECOR[a].level - C.DECOR[b].level,
      );
  }

  function nextUnlock(save) {
    let best = null;
    const consider = (kind, id, level) => {
      if (level > save.level && (!best || level < best.level)) best = { kind, id, level };
    };
    for (const id of Object.keys(C.SPECIES)) consider("fish", id, C.SPECIES[id].level);
    for (const id of TANK_IDS) consider("tank", id, C.TANKS[id].unlockLevel);
    return best;
  }

  return {
    SAVE_VERSION,
    HOUR,
    DAY,
    TANK_IDS,
    STAGE,
    C,
    hash,
    rand,
    createSave,
    migrate,
    simulate,
    apply,
    xpFor,
    capacity,
    usedSpace,
    waterQuality,
    happiness,
    fishIncome,
    tankIncome,
    coinCap,
    fishSellPrice,
    upgradeCost,
    slotFits,
    freeSlots,
    eggReady,
    playReady,
    eggPrice,
    fishInfo,
    tankInfo,
    speciesBlock,
    decorBlock,
    speciesFor,
    decorFor,
    nextUnlock,
    goalReward,
    localDay,
    statValue,
    actions: Object.keys(ACTIONS),
  };
});
