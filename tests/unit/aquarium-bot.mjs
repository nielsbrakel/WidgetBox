// A simple player bot used by the pacing test: visits a few times a day, does every chore,
// feeds, plays, hatches, buys the best affordable fish/decor/upgrades and unlocks tanks.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const DIR = "../../apps/com.nielsvanbrakel.widgetbox-games/widgets/aquarium/public";
export const C = require(`${DIR}/catalog.js`);
export const E = require(`${DIR}/engine.js`);

export function visit(save, now) {
  const act = (a) => E.apply(save, a, now);
  E.simulate(save, now);
  for (const id of E.TANK_IDS) {
    if (!save.tanks[id].unlocked) {
      const r = act({ type: "unlockTank", tank: id });
      if (!r.ok) continue;
    }
    const tank = save.tanks[id];
    for (const d of [...tank.drops]) act({ type: "collect", tank: id, id: d.id });
    for (const a of [...tank.algae]) for (let i = 0; i < 6; i++) act({ type: "scrub", tank: id, id: a.id });
    for (const d of [...tank.debris]) act({ type: "vacuum", tank: id, id: d.id });
    for (const f of tank.fish) {
      const food = C.SPECIES[f.s].eats.find((k) => C.FOODS[k].level <= save.level);
      if (!food) continue;
      if (!(save.food[food] > 0)) act({ type: "buyFood", food });
      while (f.fed < 75 && save.food[food] > 0) {
        if (tank.bits <= 0) act({ type: "drop", tank: id, food });
        if (!act({ type: "eat", tank: id, fish: f.id, food }).ok) break;
      }
      act({ type: "play", tank: id, fish: f.id });
    }
    if (tank.bits > 0) act({ type: "waste", tank: id, n: tank.bits });
    for (const e of [...tank.eggs]) {
      if (!act({ type: "hatch", tank: id, id: e.id }).ok) act({ type: "hatch", tank: id, id: e.id, sell: true });
    }
    for (const kind of ["filter", "chest", "size", "feeder"]) act({ type: "upgrade", tank: id, kind });
    const species = Object.keys(C.SPECIES)
      .filter((s) => C.SPECIES[s].tank === id)
      .sort((a, b) => C.SPECIES[b].income / C.SPECIES[b].space - C.SPECIES[a].income / C.SPECIES[a].space);
    for (const s of species) while (act({ type: "buyFish", tank: id, s }).ok);
    if (save.pearls >= 40) act({ type: "buyEgg", tank: id, kind: "golden" });
    const mystery = E.eggPrice(tank, "mystery").coins;
    if (save.coins >= mystery * 5) act({ type: "buyEgg", tank: id, kind: "mystery" });
    for (const d of Object.keys(C.DECOR).filter((k) => C.DECOR[k].tank === id || !C.DECOR[k].tank)) {
      const slots = E.freeSlots(tank, d);
      if (slots && slots.length && C.DECOR[d].price) act({ type: "buyDecor", tank: id, d, slot: slots[0] });
    }
  }
}
