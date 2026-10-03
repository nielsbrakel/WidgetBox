/*
 * Aquarium request handling, shared by the Homey widget API (api.js) and the sandbox mock so
 * both persist saves the same way. `store` is anything with get(key), set(key, value) and
 * unset(key), such as homey.settings.
 *
 *  GET   catch up idle time; write back only when the save is new or something changed
 *  POST  { batch, actions: [...] } apply actions in order; a batch id seen before is not
 *        applied again, so a retry after a lost response can't double-buy
 *        { reset: true } start over
 */
((root, factory) => {
  if (typeof module === "object" && module.exports)
    module.exports = factory(require("./engine.js"));
  else root.AquaServer = factory(root.AquaEngine);
})(typeof self !== "undefined" ? self : this, (E) => {
  // biome-ignore lint/suspicious/noRedundantUseStrict: loaded as a classic script, not a module
  "use strict";

  const MAX_ACTIONS = 50;
  const PERSIST_AFTER_HOURS = 0.5;
  const REMEMBER_BATCHES = 8;

  function keys(query) {
    const raw = String(query?.widgetId || "default");
    const id = raw.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64) || "default";
    return { key: `aquarium2_${id}`, legacyKey: `aquarium_${id}`, backupKey: `aquarium2bad_${id}` };
  }

  function load(store, query, now) {
    const { key, legacyKey, backupKey } = keys(query);
    const stored = store.get(key);
    if (stored) {
      try {
        return { key, save: E.migrate(stored, now) };
      } catch (_) {
        // A save the engine can't read is kept aside rather than lost, and play starts over.
        store.set(backupKey, stored);
      }
    }
    const save = E.createSave(now);
    // Players of the first version get a fresh tank plus a gift.
    if (store.get(legacyKey)) {
      save.coins += 250;
      save.pearls += 5;
    }
    if (stored || store.get(legacyKey)) store.unset(legacyKey);
    return { key, save, created: true };
  }

  function getState(store, query, now) {
    const { key, save, created } = load(store, query, now);
    const away = E.simulate(save, now);
    if (created || away.hours >= PERSIST_AFTER_HOURS || away.ev.length) store.set(key, save);
    return {
      save,
      now,
      away: {
        hours: away.hours,
        coins: away.coins,
        algae: away.algae,
        debris: away.debris,
        eggs: away.eggs,
      },
      created: !!created,
    };
  }

  function doAction(store, query, body, now) {
    const { key, save } = load(store, query, now);
    if (body?.reset) {
      const fresh = E.createSave(now);
      store.set(key, fresh);
      return { save: fresh, now, results: [] };
    }
    const batch = typeof body?.batch === "string" ? body.batch.slice(0, 32) : null;
    if (batch && save.batches?.includes(batch)) return { save, now, results: [], duplicate: true };
    const actions = Array.isArray(body?.actions) ? body.actions.slice(0, MAX_ACTIONS) : [];
    E.simulate(save, now);
    const results = actions.map((action) => {
      try {
        const r = E.apply(save, action, now);
        return r.ok ? { ok: true } : { ok: false, error: r.error };
      } catch (_) {
        // One bad action must not cost the player the rest of the batch.
        return { ok: false, error: "invalid" };
      }
    });
    if (batch) save.batches = [...(save.batches || []), batch].slice(-REMEMBER_BATCHES);
    store.set(key, save);
    return { save, now, results };
  }

  return { getState, doAction, MAX_ACTIONS };
});
