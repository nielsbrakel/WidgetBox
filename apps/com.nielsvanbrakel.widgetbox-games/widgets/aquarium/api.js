"use strict";

/*
 * Aquarium widget API. Thin persistence layer around the shared engine: every request
 * loads the save for this widget instance, catches up idle time, applies the posted
 * actions and stores the result. All game rules live in public/engine.js.
 */
const Engine = require("./public/engine.js");

const MAX_ACTIONS_PER_REQUEST = 50;
// Reads only write back when catch-up actually changed something worth keeping.
const PERSIST_AFTER_HOURS = 0.5;

function storeKey(query) {
  const id = String((query && query.widgetId) || "default").slice(0, 80);
  return { key: `aquarium2_${id}`, legacyKey: `aquarium_${id}` };
}

// Saves from the first (unreleased) version are replaced by a fresh v2 save with a gift.
function load(homey, query, now) {
  const { key, legacyKey } = storeKey(query);
  const stored = homey.settings.get(key);
  if (stored) return { key, save: Engine.migrate(stored, now) };

  const save = Engine.createSave(now);
  if (homey.settings.get(legacyKey)) {
    save.coins += 250;
    save.pearls += 5;
    homey.settings.unset(legacyKey);
  }
  return { key, save, created: true };
}

module.exports = {
  async getState({ homey, query }) {
    const now = Date.now();
    const { key, save, created } = load(homey, query, now);
    const away = Engine.simulate(save, now);
    if (created || away.hours >= PERSIST_AFTER_HOURS || away.ev.length) homey.settings.set(key, save);
    return { save, now, away: { hours: away.hours, coins: away.coins, algae: away.algae, debris: away.debris, eggs: away.eggs }, created: !!created };
  },

  async doAction({ homey, query, body }) {
    const now = Date.now();
    const { key, save } = load(homey, query, now);
    if (body && body.reset) {
      const fresh = Engine.createSave(now);
      homey.settings.set(key, fresh);
      return { save: fresh, now, results: [] };
    }
    const actions = Array.isArray(body && body.actions) ? body.actions.slice(0, MAX_ACTIONS_PER_REQUEST) : [];
    Engine.simulate(save, now);
    const results = actions.map((action) => {
      const r = Engine.apply(save, action, now);
      return { ok: r.ok, error: r.error };
    });
    homey.settings.set(key, save);
    return { save, now, results };
  },
};
