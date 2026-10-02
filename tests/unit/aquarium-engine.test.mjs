import { describe, expect, it } from "vitest";
import { C, E, visit } from "./aquarium-bot.mjs";

const T0 = Date.UTC(2026, 0, 1, 8);
const H = E.HOUR;
const clone = (o) => JSON.parse(JSON.stringify(o));

function tutorial(save, now) {
  const pond = save.tanks.pond;
  const act = (a) => E.apply(save, a, now);
  expect(act({ type: "collect", tank: "pond", id: pond.drops[0].id }).ok).toBe(true);
  let eaten = 0;
  for (const f of [...pond.fish, ...pond.fish]) {
    if (pond.bits <= 0) act({ type: "drop", tank: "pond", food: "flakes" });
    if (act({ type: "eat", tank: "pond", fish: f.id, food: "flakes" }).ok) eaten++;
  }
  expect(eaten).toBeGreaterThanOrEqual(3);
  expect(act({ type: "scrub", tank: "pond", id: pond.algae[0].id }).ok).toBe(true);
  expect(act({ type: "buyDecor", tank: "pond", d: "anubias", slot: 4 }).ok).toBe(true);
  expect(act({ type: "buyFish", tank: "pond", s: "guppy" }).ok).toBe(true);
}

describe("aquarium engine", () => {
  it("creates a small, playable starter save", () => {
    const save = E.createSave(T0, 7);
    const pond = save.tanks.pond;
    expect(save.v).toBe(E.SAVE_VERSION);
    expect(pond.unlocked).toBe(true);
    expect(pond.fish).toHaveLength(2);
    expect(pond.fish.every((f) => f.fed < 92)).toBe(true);
    expect(pond.drops).toHaveLength(1);
    expect(pond.algae).toHaveLength(1);
    expect(JSON.stringify(save).length).toBeLessThan(4096);
  });

  it("walks through the tutorial and then hands out daily goals", () => {
    const save = E.createSave(T0, 7);
    tutorial(save, T0 + 60000);
    expect(save.tut).toBe(C.TUTORIAL.length);
    expect(save.daily.goals).toHaveLength(C.RULES.goalsPerDay);
  });

  it("is deterministic for the same seed, actions and clock", () => {
    const run = () => {
      const save = E.createSave(T0, 99);
      tutorial(save, T0 + 1000);
      for (let d = 0; d < 5; d++) visit(save, T0 + d * E.DAY + 3 * H);
      return JSON.stringify(save);
    };
    expect(run()).toBe(run());
  });

  it("catches up idle time but caps coins at the chest and idle time at a week", () => {
    const save = E.createSave(T0, 3);
    const pond = save.tanks.pond;
    const away = E.simulate(save, T0 + 12 * H);
    expect(away.hours).toBeCloseTo(12);
    const stored = pond.drops.reduce((n, d) => n + d.v, 0);
    expect(stored).toBeLessThanOrEqual(E.coinCap(pond) + 5);
    expect(pond.drops.length).toBeLessThanOrEqual(C.RULES.maxDrops);

    const late = E.createSave(T0, 3);
    E.simulate(late, T0 + 400 * E.DAY);
    expect(late.t).toBe(T0 + 400 * E.DAY);
    expect(late.tanks.pond.algae.length).toBeLessThanOrEqual(C.RULES.maxAlgae);
    expect(late.tanks.pond.debris.length).toBeLessThanOrEqual(C.RULES.maxDebris);
  });

  it("does nothing when no time passed", () => {
    const save = E.createSave(T0, 3);
    const before = JSON.stringify(save);
    E.simulate(save, T0);
    expect(JSON.stringify(save)).toBe(before);
  });

  it("rejects bad actions without touching the save", () => {
    const save = E.createSave(T0, 3);
    E.simulate(save, T0 + H);
    const cases = [
      [{ type: "nope" }, "unknown"],
      [{ type: "__proto__" }, "unknown"],
      [{ type: "buyFish", tank: "pond", s: "moray" }, "invalid"],
      [{ type: "buyFish", tank: "pond", s: "goldfish" }, "level"],
      [{ type: "buyFish", tank: "reef", s: "clownfish" }, "invalid"],
      [{ type: "unlockTank", tank: "amazon" }, "level"],
      [{ type: "scrub", tank: "pond", id: "a999" }, "gone"],
      [{ type: "buyDecor", tank: "pond", d: "castle", slot: 0 }, "level"],
      [{ type: "buyDecor", tank: "pond", d: "vallisneria", slot: 1 }, "slot"],
      [{ type: "eat", tank: "pond", fish: save.tanks.pond.fish[0].id, food: "flakes" }, "noBits"],
      [{ type: "buyEgg", tank: "pond", kind: "golden" }, "level"],
    ];
    for (const [action, error] of cases) {
      const before = JSON.stringify(save);
      const r = E.apply(save, action, T0 + H);
      expect(r, JSON.stringify(action)).toMatchObject({ ok: false, error });
      expect(JSON.stringify(save)).toBe(before);
    }
  });

  it("migrates unknown or broken saves", () => {
    expect(E.migrate(null, T0).v).toBe(E.SAVE_VERSION);
    expect(E.migrate({ v: 1, coins: 5 }, T0).coins).toBe(C.RULES.startCoins);

    const save = E.createSave(T0, 3);
    save.tanks.pond.fish.push({ ...save.tanks.pond.fish[0], id: "fX", s: "removed_species" });
    delete save.stats;
    const out = E.migrate(clone(save), T0);
    expect(out.tanks.pond.fish.map((f) => f.s)).not.toContain("removed_species");
    expect(out.stats.fed).toBe(0);
  });

  it("sells mystery eggs for coins and golden eggs that hatch a missing rare", () => {
    const save = E.createSave(T0, 11);
    save.level = 5;
    save.coins = 1000;
    save.pearls = 50;
    let r = E.apply(save, { type: "buyEgg", tank: "pond", kind: "mystery" }, T0);
    expect(r.ok).toBe(true);
    expect(save.coins).toBe(1000 - C.EGGS.mystery.price);

    r = E.apply(save, { type: "buyEgg", tank: "pond", kind: "golden" }, T0);
    expect(r.ok).toBe(true);
    expect(save.pearls).toBe(50 - C.EGGS.golden.pearls);
    const golden = save.tanks.pond.eggs.find((e) => e.id === r.result.egg);
    expect(golden.m).toBe(2);

    expect(E.apply(save, { type: "hatch", tank: "pond", id: golden.id }, T0 + H).error).toBe(
      "notReady",
    );
    const hatched = E.apply(save, { type: "hatch", tank: "pond", id: golden.id }, T0 + 3 * H);
    expect(hatched.ok).toBe(true);
    expect(hatched.result.born).toHaveLength(1);
    expect(hatched.result.born[0].v).toBeGreaterThan(0);
    expect(save.dex[golden.s] & (1 << hatched.result.born[0].v)).toBeTruthy();

    E.apply(save, { type: "buyEgg", tank: "pond", kind: "mystery" }, T0 + 3 * H);
    E.apply(save, { type: "buyEgg", tank: "pond", kind: "mystery" }, T0 + 3 * H);
    expect(E.apply(save, { type: "buyEgg", tank: "pond", kind: "mystery" }, T0 + 3 * H).error).toBe(
      "eggsFull",
    );
  });

  it("paces a diligent player over weeks, not days", () => {
    const save = E.createSave(T0, 42);
    const at = (day) => {
      for (; at.d < day; at.d++) for (const h of [0, 6, 13]) visit(save, T0 + at.d * E.DAY + h * H);
      return save;
    };
    at.d = 0;
    expect(at(3).tanks.amazon.unlocked).toBe(false);
    expect(at(14).tanks.amazon.unlocked).toBe(true);
    expect(at(25).level).toBeLessThan(C.RULES.maxLevel);
    expect(E.statValue(save, "raresFound")).toBeLessThan(44);
    expect(at(90).level).toBe(C.RULES.maxLevel);
    expect(E.TANK_IDS.every((t) => save.tanks[t].unlocked)).toBe(true);
  });

  it("ignores inherited property names and wrong types in actions", () => {
    const save = E.createSave(T0, 3);
    E.simulate(save, T0 + H);
    const attacks = [
      { type: "unlockTank", tank: "constructor" },
      { type: "setTank", tank: "__proto__" },
      { type: "buyFood", food: "toString" },
      { type: "upgrade", tank: "pond", kind: "constructor" },
      { type: "buyFish", tank: "pond", s: "hasOwnProperty" },
      { type: "buyDecor", tank: "pond", d: "anubias", slot: "4" },
      { type: "waste", tank: "pond", n: 1e9 },
      { type: "collect", tank: ["pond"] },
      { type: "constructor" },
      "collect",
      null,
    ];
    for (const action of attacks) {
      const before = JSON.stringify(save);
      const r = E.apply(save, action, T0 + H);
      expect(r.ok, JSON.stringify(action)).toBe(false);
      expect(JSON.stringify(save)).toBe(before);
    }
    expect(Object.hasOwn(Object, "unlocked")).toBe(false);
    expect(E.tankInfo(save, "pond", T0 + H)).toBeTruthy();
  });

  it("repairs corrupt saves instead of crashing", () => {
    const save = E.createSave(T0, 3);
    Object.assign(save, { coins: null, level: "x", active: "constructor", ach: "nope" });
    save.tanks.pond.fish = null;
    save.tanks.pond.decor = [
      { id: "d1", d: "castle" },
      { id: "d2", d: "anemone" },
    ];
    const out = E.migrate(save, T0);
    expect(out.coins).toBe(0);
    expect(out.level).toBe(1);
    expect(out.active).toBe("pond");
    expect(out.tanks.pond.fish).toEqual([]);
    expect(out.tanks.pond.decor[0].d).toBe("castle");
    expect(out.tanks.pond.decor[1]).toBeNull();
    expect(() => E.simulate(out, T0 + 5 * H)).not.toThrow();
  });

  it("reaches the same save whether time passes in seconds or in one jump", () => {
    const a = E.createSave(T0, 21);
    const b = clone(a);
    tutorial(a, T0 + 1000);
    tutorial(b, T0 + 1000);
    for (let t = T0 + 1000; t <= T0 + 6 * H; t += 1000) E.simulate(a, t);
    E.simulate(b, T0 + 6 * H);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("only offers a visit goal that can be finished", () => {
    for (let seed = 1; seed < 40; seed++) {
      const save = E.createSave(T0, seed);
      tutorial(save, T0 + 1000);
      save.level = 6;
      save.tanks.amazon.unlocked = true;
      E.simulate(save, T0 + E.DAY);
      const visit = save.daily.goals.find((g) => g.k === "visit");
      if (visit) expect(visit.n).toBeLessThanOrEqual(1);
    }
  });
});
