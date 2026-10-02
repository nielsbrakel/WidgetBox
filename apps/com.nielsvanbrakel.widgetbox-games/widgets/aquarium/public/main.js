/*
 * Aquarium widget entry point: wires Homey, the engine, the scene and the UI together.
 *
 * Actions are applied to a local copy of the save immediately (so taps feel instant), queued,
 * and sent to the widget API in small batches. Every server response replaces the local save
 * and replays any actions that were not yet sent, so the server stays the source of truth.
 */
((root) => {
  // biome-ignore lint/suspicious/noRedundantUseStrict: loaded as a classic script, not a module
  "use strict";

  const E = root.AquaEngine;
  const SILENT_ERRORS = new Set(["gone", "tired", "noBits", "invalid", "notReady", "unknown"]);
  const REFRESH_MS = 5 * 60 * 1000;

  class Game {
    constructor(homey) {
      this.homey = homey;
      this.widgetId = "default";
      this.settings = {};
      this.save = null;
      this.offset = 0;
      this.queue = [];
      this.sending = false;
      this.failures = 0;
      this.lastInput = Date.now();
      this.lastSync = 0;
      // Bumped by every local change and every reset; a response that started before the
      // latest bump is stale and must not overwrite newer local state.
      this.gen = 0;
      this.epoch = 0;
      this.inflight = null;
    }

    now() {
      return Date.now() + this.offset;
    }

    async api(method, body) {
      const t0 = Date.now();
      const res = await this.homey.api(
        method,
        `/?widgetId=${encodeURIComponent(this.widgetId)}`,
        body,
      );
      if (res && typeof res === "object") res.t0 = t0;
      return res;
    }

    async init() {
      try {
        const id = await this.homey.getWidgetInstanceId();
        if (id) this.widgetId = id;
      } catch (_) {
        // Older Homey versions and the sandbox may not expose an instance id.
      }
      try {
        this.settings = (await this.homey.getSettings()) || {};
      } catch (_) {
        this.settings = {};
      }
      try {
        this.homey.ready();
      } catch (_) {
        // Not fatal: Homey shows the widget anyway once loaded.
      }

      const canvas = document.getElementById("tank");
      this.scene = new root.AquaScene(canvas, {
        onEat: (fish, food) => this.do({ type: "eat", tank: this.save.active, fish, food }),
        onWaste: (n) => this.do({ type: "waste", tank: this.save.active, n }),
        onPlay: (fish) => {
          const r = this.do({ type: "play", tank: this.save.active, fish });
          if (r.ok) this.ui.renderTray();
        },
      });
      this.scene.lightMode = this.settings.day_night || "auto";
      this.scene.fps = this.settings.motion === "battery" ? 30 : 60;
      this.ui = new root.AquaUI.UI(this);

      const res = await this.loadState();
      this.scene.resize();
      this.applyServer(res);
      this.checkTimezone();
      document.getElementById("app").classList.remove("is-loading");
      this.ui.welcome(res.away, res.created);
      this.setupInput(canvas);
      this.scene.start();

      setInterval(() => this.tick(), 1000);
      setInterval(() => {
        if (!document.hidden) this.refreshFromServer();
      }, REFRESH_MS);
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) return;
        this.checkTimezone();
        if (Date.now() - this.lastSync > 30000) this.refreshFromServer();
      });
      // Rebuilding the backdrop and sprites is costly, so wait until resizing settles.
      let resizeTimer = null;
      const ro = new ResizeObserver(() => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          this.scene.resize();
          this.scene.sync(this.save, this.now(), this.save.active);
          if (this.ui.sheet) this.ui.renderSheet();
        }, 120);
      });
      ro.observe(document.getElementById("app"));
    }

    // The daily reset follows local midnight, which moves with daylight saving time.
    checkTimezone() {
      const tz = new Date().getTimezoneOffset();
      if (this.save && this.save.tz !== tz) this.do({ type: "setTz", tz });
    }

    async loadState() {
      for (let attempt = 0; ; attempt++) {
        try {
          return await this.api("GET");
        } catch (err) {
          if (attempt >= 2) throw err;
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        }
      }
    }

    applyServer(res) {
      if (!res || !res.save) return;
      const mid = res.t0 ? (res.t0 + Date.now()) / 2 : Date.now();
      this.offset = res.now - mid;
      const save = res.save;
      // Replay actions the server has not seen yet so local progress is not lost.
      for (const a of this.queue) E.apply(save, a, this.now());
      this.save = save;
      this.lastSync = Date.now();
      this.scene.sync(save, this.now(), save.active);
      this.ui.refresh();
      if (this.ui.sheet) this.ui.renderSheet();
    }

    async refreshFromServer() {
      if (this.sending || this.queue.length) return;
      const gen = this.gen;
      try {
        const res = await this.api("GET");
        if (gen === this.gen && !this.sending && !this.queue.length) this.applyServer(res);
      } catch (_) {
        // Offline: keep playing locally; the next action retries.
      }
    }

    /*
     * Apply an action locally and queue it for the server.
     * Returns the engine result so the UI can react immediately.
     */
    do(action, quiet) {
      const r = E.apply(this.save, action, this.now());
      if (r.ok) {
        this.gen += 1;
        this.queue.push(action);
        this.scheduleFlush();
      } else if (!quiet && !SILENT_ERRORS.has(r.error)) {
        this.ui.showError(r.error);
      }
      this.ui.handleEvents(r.ev);
      this.scene.sync(this.save, this.now(), this.save.active);
      this.ui.refresh();
      if (this.ui.sheet && r.ok) this.ui.renderSheet();
      return r;
    }

    scheduleFlush(delay) {
      clearTimeout(this.flushTimer);
      this.flushTimer = setTimeout(() => this.flush(), delay ?? 400);
    }

    async flush() {
      if (this.sending || !this.queue.length) return;
      this.sending = true;
      const epoch = this.epoch;
      // A retry resends the same batch id, so the server never applies it twice.
      if (!this.inflight) {
        const actions = this.queue.slice(0, 50);
        const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
        this.inflight = { id, actions };
      }
      const batch = this.inflight;
      try {
        const res = await this.api("POST", { batch: batch.id, actions: batch.actions });
        this.sending = false;
        if (epoch !== this.epoch) return;
        this.inflight = null;
        this.queue = this.queue.filter((a) => !batch.actions.includes(a));
        this.failures = 0;
        this.gen += 1;
        this.applyServer(res);
      } catch (_) {
        this.sending = false;
        if (epoch !== this.epoch) return;
        this.failures += 1;
        if (this.failures >= 8) {
          // The server keeps refusing: drop the local changes and resync rather than jam.
          this.inflight = null;
          this.queue = [];
          this.failures = 0;
          this.refreshFromServer();
          return;
        }
        this.scheduleFlush(Math.min(30000, 1000 * 2 ** this.failures));
        return;
      }
      if (this.queue.length) this.scheduleFlush();
    }

    async reset() {
      this.queue = [];
      this.inflight = null;
      this.epoch += 1;
      this.gen += 1;
      clearTimeout(this.flushTimer);
      try {
        const res = await this.api("POST", { reset: true });
        this.scene.tankId = null;
        this.applyServer(res);
        this.ui.welcome(null, true);
      } catch (_) {
        this.ui.toast(this.ui.t("err.offline"), "err");
      }
    }

    // One tap from the welcome-back card gathers every coin in the tank.
    collectAll() {
      const scene = this.scene;
      const target = this.pillTarget();
      const spots = scene.drops.map((d) => scene.dropPos(d));
      const r = this.do({ type: "collect", tank: this.save.active });
      if (!r.ok || !r.result.coins) return;
      for (const p of spots) scene.coinFly(p.x, p.y, target.x, target.y, 1);
      this.ui.toast(`+${r.result.coins}`, "gold");
    }

    tick() {
      if (!this.save || document.hidden) return;
      const ev = [];
      E.simulate(this.save, this.now(), ev);
      if (ev.length) this.ui.handleEvents(ev);
      this.scene.sync(this.save, this.now(), this.save.active);
      this.ui.refresh();
      // Smooth motion while someone is playing, save battery when the tank is just on display.
      const idle = Date.now() - this.lastInput > 20000;
      const fps = this.settings.motion === "battery" || idle ? 30 : 60;
      if (this.scene.fps !== fps) this.scene.fps = fps;
    }

    interacted() {
      this.lastInput = Date.now();
      if (this.scene.fps < 60 && this.settings.motion !== "battery") this.scene.fps = 60;
    }

    // ── Input: taps only ─────────────────────────────────────────────

    setupInput(canvas) {
      let down = null;
      canvas.addEventListener("pointerdown", (e) => {
        down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
      });
      canvas.addEventListener("pointercancel", () => {
        down = null;
      });
      canvas.addEventListener("pointerup", (e) => {
        const d = down;
        down = null;
        if (!d || d.id !== e.pointerId) return;
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 14 || performance.now() - d.t > 800)
          return;
        const rect = canvas.getBoundingClientRect();
        this.tap(e.clientX - rect.left, e.clientY - rect.top);
      });
    }

    pillTarget() {
      const pill = document.getElementById("coinPill").getBoundingClientRect();
      const rect = document.getElementById("tank").getBoundingClientRect();
      return { x: pill.left - rect.left + 14, y: pill.top - rect.top + pill.height / 2 };
    }

    tap(x, y) {
      this.interacted();
      const ui = this.ui;
      const scene = this.scene;
      const tank = this.save.active;
      if (ui.sheet) return;

      if (ui.mode === "place" || ui.mode === "move") {
        const slot = scene.slotAt(x, y);
        if (slot < 0) return ui.toast(ui.t("hint.place"));
        const p = scene.locate("slot", slot);
        const r =
          ui.mode === "place"
            ? this.do({ type: "buyDecor", tank, d: ui.place.decor, slot })
            : this.do({ type: "moveDecor", tank, from: ui.place.from, to: slot });
        if (r.ok) scene.sparkle(p.x, p.y, "#ffffff", 14);
        ui.setMode("look");
        return;
      }

      const hit = scene.hitTest(x, y);
      if (hit.type === "drop") {
        // Coins lying close together come along with the one you tap.
        const reach = scene.W * 0.12;
        const near = scene.drops.filter((d) => {
          const p = scene.dropPos(d);
          return d.id === hit.id || Math.hypot(p.x - hit.x, p.y - hit.y) < reach;
        });
        const target = this.pillTarget();
        let total = 0;
        for (const d of near) {
          const p = scene.dropPos(d);
          const r = this.do({ type: "collect", tank, id: d.id });
          if (!r.ok) continue;
          total += r.result.coins;
          scene.coinFly(p.x, p.y, target.x, target.y, r.result.coins);
        }
        if (total) scene.floatText(hit.x, hit.y - 10, `+${total}`);
        return;
      }
      // Chores stay tappable while feeding or playing; only open water drops food or a toy.
      const chore = hit.type === "egg" || hit.type === "algae" || hit.type === "debris";
      if (ui.mode === "feed" && !chore) {
        const r = this.do({ type: "drop", tank, food: ui.food });
        if (r.ok) scene.dropFood(x, ui.food);
        ui.lastMode = Date.now();
        ui.renderTray();
        return;
      }
      if (ui.mode === "play" && !chore) {
        scene.placeToy(x, y);
        ui.lastMode = Date.now();
        return;
      }

      switch (hit.type) {
        case "egg": {
          // A failed hatch opens the egg card, which already explains why.
          const r = this.do({ type: "hatch", tank, id: hit.id }, true);
          if (r.ok) {
            scene.sparkle(hit.x, hit.y, "#fff2b0", 16);
            ui.toast(ui.t("hatched", { n: r.result.born.length }), "gold");
          } else ui.showCard("egg", hit.id, hit.x);
          break;
        }
        case "algae": {
          const r = this.do({ type: "scrub", tank, id: hit.id });
          if (r.ok) {
            scene.scrubFx(hit.x, hit.y);
            if (r.result.coins) {
              scene.floatText(hit.x, hit.y - 8, `+${r.result.coins}`);
              const target = this.pillTarget();
              scene.coinFly(hit.x, hit.y, target.x, target.y, r.result.coins);
            }
          }
          break;
        }
        case "debris": {
          const r = this.do({ type: "vacuum", tank, id: hit.id });
          if (r.ok) {
            scene.vacuumFx(hit.x, hit.y);
            scene.floatText(hit.x, hit.y - 8, `+${r.result.coins}`);
          }
          break;
        }
        case "fish":
          ui.showCard("fish", hit.id, hit.x);
          scene.hearts(hit.id);
          break;
        case "decor":
          ui.showCard("decor", hit.slot, hit.x);
          break;
        default:
          ui.hideCard();
          scene.ripple(x, y, "#ffffff");
      }
    }
  }

  async function onHomeyReady(homey) {
    if (homey) root.Homey = homey;
    const game = new Game(root.Homey);
    root.__aquarium = game;
    try {
      await game.init();
    } catch (err) {
      const loading = document.getElementById("loading");
      if (loading)
        loading.innerHTML = `<div style="padding:16px;text-align:center;font-weight:700">${game.ui?.t("err.load") || "Could not load the aquarium."}</div>`;
      console.error(err);
    }
  }

  root.onHomeyReady = onHomeyReady;
  root.AquaGame = Game;
})(typeof self !== "undefined" ? self : this);
