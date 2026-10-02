/*
 * Aquarium UI: HUD, mode trays, info cards, sheets (shop, journal, tanks, help), toasts.
 *
 * Every control is a single tap. Lists are paged with arrow buttons instead of scrolling so
 * nothing depends on swipe gestures, which the Homey dashboard keeps for itself.
 */
(function (root) {
  "use strict";

  const C = root.AquaCatalog;
  const E = root.AquaEngine;
  const A = root.AquaArt;

  // ── Icons ──────────────────────────────────────────────────────────

  const S = (body, vb = "0 0 24 24") => `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  const ICONS = {
    coin: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#e8a91f"/><circle cx="12" cy="11.2" r="9" fill="#ffd85a"/><circle cx="12" cy="11.2" r="5.6" fill="none" stroke="#e8a91f" stroke-width="1.6"/></svg>`,
    pearl: `<svg viewBox="0 0 24 24" aria-hidden="true"><defs><radialGradient id="pg" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#b9b0ea"/></radialGradient></defs><circle cx="12" cy="12" r="9.5" fill="url(#pg)"/><circle cx="9" cy="8.5" r="2.2" fill="#fff" opacity=".9"/></svg>`,
    food: S('<path d="M5 9h14l-1.5 10a2 2 0 0 1-2 1.7h-7a2 2 0 0 1-2-1.7z"/><path d="M8 9V6a4 4 0 0 1 8 0v3"/><circle cx="10" cy="14" r=".6" fill="currentColor"/><circle cx="14" cy="15.5" r=".6" fill="currentColor"/>'),
    play: S('<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>'),
    shop: S('<path d="M4 8h16l-1 12H5z"/><path d="M9 8a3 3 0 0 1 6 0"/>'),
    menu: S('<path d="M4 7h16M4 12h16M4 17h16"/>'),
    close: S('<path d="M6 6l12 12M18 6L6 18"/>'),
    left: S('<path d="M15 5l-7 7 7 7"/>'),
    right: S('<path d="M9 5l7 7-7 7"/>'),
    lock: S('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
    check: S('<path d="M5 12l5 5 9-10"/>'),
    star: S('<path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.3l1-6.2L3 9.7l6.2-.9z"/>'),
    fish: S('<path d="M3 12c3-5 9-6 13-3l4-3v12l-4-3c-4 3-10 2-13-3z"/><circle cx="8" cy="11" r=".8" fill="currentColor"/>'),
    tank: S('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 15c3-2 5 1 9-1s6 1 9-1"/>'),
    book: S('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>'),
    help: S('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7v.5"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>'),
    trophy: S('<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/>'),
    egg: S('<path d="M12 3c3.5 0 6 6 6 10a6 6 0 0 1-12 0c0-4 2.5-10 6-10z"/>'),
    water: S('<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/>'),
    upgrade: S('<path d="M12 19V5M6 11l6-6 6 6"/>'),
    sparkle: S('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>'),
    move: S('<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>'),
    reset: S('<path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v4h4"/>'),
    plus: S('<path d="M12 5v14M5 12h14"/>'),
    flame: S('<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-7 1.5 1 2 2 3 3 0-2 0-4 0-6z"/>'),
  };

  function icon(name) {
    return `<span class="ico">${ICONS[name] || ""}</span>`;
  }

  function fmt(n) {
    n = Math.floor(n);
    if (n < 10000) return String(n);
    if (n < 1e6) return `${(n / 1000).toFixed(n < 1e5 ? 1 : 0).replace(/\.0$/, "")}k`;
    return `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  }

  function fmtRate(n) {
    return n < 10 ? n.toFixed(1).replace(/\.0$/, "") : fmt(n);
  }

  // Shop picture for a bought egg: a speckled one for mystery eggs, a shiny one for golden.
  function eggImage(kind) {
    const gold = kind === "golden";
    const fill = gold ? "url(#g)" : "#f3ead2";
    const dots = gold ? "" : '<circle cx="17" cy="16" r="1.6" fill="#7aa7b5"/><circle cx="23" cy="22" r="1.3" fill="#7aa7b5"/><circle cx="16" cy="25" r="1.1" fill="#7aa7b5"/>';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><defs><radialGradient id="g" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff6c8"/><stop offset=".5" stop-color="#f5c542"/><stop offset="1" stop-color="#b9831c"/></radialGradient></defs><path d="M20 5c6 0 11 10 11 17a11 11 0 0 1-22 0C9 15 14 5 20 5z" fill="${fill}" stroke="${gold ? "#8a5d10" : "#c9bb98"}" stroke-width="1.2"/>${dots}<text x="20" y="27" font-size="11" font-family="sans-serif" font-weight="700" text-anchor="middle" fill="${gold ? "#7a4d00" : "#5a7f8c"}">${gold ? "★" : "?"}</text></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }

  // Food names are lower case for use mid-sentence; capitalise them for titles.
  function cap(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  const NAMES = [
    "Bubbles", "Finn", "Coral", "Pip", "Nori", "Splash", "Mango", "Pebble", "Ziggy", "Luna", "Sunny", "Dot",
    "Kiwi", "Biscuit", "Wave", "Olive", "Peanut", "Jelly", "Sushi", "Taco", "Ruby", "Blue", "Marble", "Ripple",
    "Noodle", "Pixel", "Gus", "Mila", "Otto", "Fleur", "Tiki", "Bean", "Comet", "Echo", "Poppy", "Squid",
    "Nemo", "Dory", "Tango", "Fizz", "Bloop", "Clove", "Iris", "Juno", "Kai", "Lilo", "Moss", "Sprout",
  ];

  function fishName(id) {
    return NAMES[E.hash(id, "name") % NAMES.length];
  }

  const TANK_SWATCH = {
    pond: "linear-gradient(#7fd3d0, #1d5e72 75%, #dcc08a 76%)",
    amazon: "linear-gradient(#a7c48a, #2a4a38 75%, #8a6a45 76%)",
    reef: "linear-gradient(#7fd8f5, #145a9c 75%, #f2e8cf 76%)",
    abyss: "linear-gradient(#1d3460, #050b1e 75%, #2a2f45 76%)",
  };

  const FOOD_DOT = { flakes: "#f2a03a", pellets: "#a8642e", worms: "#c8283a", brine: "#ff8a6a", krill: "#ff5a3a" };

  // ── UI ─────────────────────────────────────────────────────────────

  class UI {
    constructor(game) {
      this.game = game;
      this.$ = (id) => document.getElementById(id);
      this.mode = "look";
      this.food = null;
      this.sheet = null;
      this.card = null;
      this.cardTimer = 0;
      this.confirm = null;
      this.lastMode = 0;
      this.place = null;
      document.querySelectorAll("[data-icon]").forEach((el) => {
        el.innerHTML = ICONS[el.dataset.icon] || "";
      });
      document.getElementById("app").addEventListener("click", (e) => this.onClick(e));
    }

    t(key, vars) {
      let s = null;
      try {
        s = root.Homey && root.Homey.__ ? root.Homey.__(`widgets.aquarium.${key}`) : null;
      } catch (_) {
        s = null;
      }
      if (typeof s !== "string" || !s || s.includes("widgets.aquarium")) s = key.split(".").pop();
      if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
      return s;
    }

    speciesName(id) {
      return this.t(`species.${id}`);
    }

    variantName(id, v) {
      const key = C.VARIANTS[id][v];
      return v === 0 ? this.speciesName(id) : `${this.t(`variant.${key}`)} ${this.speciesName(id)}`;
    }

    // ── Click routing ────────────────────────────────────────────────

    onClick(e) {
      const el = e.target.closest("[data-ui]");
      if (!el) return;
      const ui = el.dataset.ui;
      const arg = el.dataset.arg;
      this.game.interacted();
      switch (ui) {
        case "feed":
          this.setMode(this.mode === "feed" ? "look" : "feed");
          break;
        case "play":
          this.setMode(this.mode === "play" ? "look" : "play");
          break;
        case "shop":
          this.openSheet("shop", "fish");
          break;
        case "menu":
          this.openSheet("menu");
          break;
        case "journal":
          this.openSheet("journal", "goals");
          break;
        case "coins":
        case "pearls":
          this.openSheet("journal", "goals");
          break;
        case "close":
          this.closeSheet();
          break;
        case "tab":
          this.sheet.tab = arg;
          this.sheet.page = 0;
          this.sheet.sel = null;
          this.renderSheet();
          break;
        case "page":
          this.sheet.page += Number(arg);
          this.sheet.sel = null;
          this.renderSheet();
          break;
        case "sel":
          this.sheet.sel = this.sheet.sel === arg ? null : arg;
          this.renderSheet();
          break;
        case "go":
          this.openSheet(arg, el.dataset.tab);
          break;
        case "food":
          this.food = arg;
          this.renderTray();
          break;
        case "buyFood":
          this.openSheet("shop", "food");
          break;
        case "cancelPlace":
          this.setMode("look");
          break;
        case "action":
          this.sheetAction(arg, el);
          break;
        case "cardAction":
          this.cardAction(arg, el);
          break;
        case "chip":
          this.chipAction(arg);
          break;
        case "modalClose":
          this.$("modal").hidden = true;
          this.refresh();
          break;
      }
    }

    // Two-tap confirmation for destructive buttons.
    confirmed(el, key) {
      if (this.confirm && this.confirm.key === key && Date.now() - this.confirm.at < 3000) {
        this.confirm = null;
        return true;
      }
      this.confirm = { key, at: Date.now() };
      el.classList.add("confirm");
      el.dataset.label = el.innerHTML;
      el.innerHTML = this.t("confirmTap");
      setTimeout(() => {
        if (el.isConnected && el.dataset.label) {
          el.classList.remove("confirm");
          el.innerHTML = el.dataset.label;
          delete el.dataset.label;
        }
      }, 3000);
      return false;
    }

    // ── Modes ────────────────────────────────────────────────────────

    setMode(mode, opts) {
      this.mode = mode;
      this.lastMode = Date.now();
      this.place = mode === "place" || mode === "move" ? opts : null;
      this.game.scene.setMode(mode);
      if (mode === "place" || mode === "move") this.game.scene.highlightSlots(opts.slots);
      if (mode === "feed" && !this.food) this.food = this.pickFood();
      this.hideCard();
      document.querySelectorAll(".dock-btn").forEach((b) => {
        b.classList.toggle("on", b.dataset.ui === mode);
      });
      this.renderTray();
      this.refresh();
    }

    pickFood() {
      const save = this.game.save;
      const tank = save.tanks[save.active];
      let best = null;
      let bestCount = -1;
      for (const id of Object.keys(C.FOODS)) {
        if (C.FOODS[id].level > save.level) continue;
        const eaters = tank.fish.filter((f) => C.SPECIES[f.s].eats.includes(id)).length;
        const score = eaters * 10 + (save.food[id] > 0 ? 5 : 0);
        if (score > bestCount) {
          best = id;
          bestCount = score;
        }
      }
      return best || "flakes";
    }

    renderTray() {
      const tray = this.$("tray");
      const save = this.game.save;
      let html = "";
      if (this.mode === "feed") {
        const foods = Object.keys(C.FOODS).filter((id) => C.FOODS[id].level <= save.level);
        html += '<div class="tray-row">';
        for (const id of foods) {
          const n = save.food[id] || 0;
          html += `<button type="button" class="food-btn ${id === this.food ? "on" : ""} ${n ? "" : "empty"}" data-ui="food" data-arg="${id}"><svg viewBox="0 0 10 10" width="14" height="14"><circle cx="5" cy="5" r="4" fill="${FOOD_DOT[id]}"/></svg>${n}</button>`;
        }
        html += `<button type="button" class="food-btn" data-ui="buyFood">${icon("plus")}</button></div>`;
        const n = save.food[this.food] || 0;
        const tank = save.tanks[save.active];
        const eaters = tank.fish.filter((f) => C.SPECIES[f.s].eats.includes(this.food)).length;
        const hint = !n ? this.t("hint.noFood") : !eaters ? this.t("hint.noEaters", { food: this.t(`food.${this.food}`) }) : this.t("hint.feed", { food: this.t(`food.${this.food}`) });
        html += `<div class="tray-hint">${esc(hint)}</div>`;
      } else if (this.mode === "play") {
        const ready = this.game.save.tanks[save.active].fish.filter((f) => E.playReady(f, this.game.now())).length;
        html += `<div class="tray-hint">${esc(ready ? this.t("hint.play", { n: ready }) : this.t("hint.playTired"))}</div>`;
      } else if (this.mode === "place" || this.mode === "move") {
        html += `<div class="tray-row"><div class="tray-hint">${esc(this.t("hint.place"))}</div><button type="button" class="food-btn" data-ui="cancelPlace">${icon("close")}${esc(this.t("cancel"))}</button></div>`;
      }
      tray.innerHTML = html;
      tray.hidden = !html;
    }

    // ── HUD ──────────────────────────────────────────────────────────

    refresh() {
      const save = this.game.save;
      if (!save) return;
      const now = this.game.now();
      this.setNum("coinVal", save.coins);
      this.setNum("pearlVal", save.pearls);
      this.$("levelVal").textContent = save.level;
      const need = E.xpFor(save.level);
      const pct = save.level >= C.RULES.maxLevel ? 1 : Math.min(1, save.xp / need);
      this.$("levelRing").style.strokeDashoffset = String(97.4 * (1 - pct));
      const goalsOpen = save.tut < C.TUTORIAL.length || save.daily.goals.some((g) => !g.done);
      this.$("goalDot").hidden = !goalsOpen;

      const info = E.tankInfo(save, save.active, now);
      const chips = [];
      if (info.eggsReady) chips.push(["eggs", "good", "egg", this.t("chip.eggs")]);
      if (info.hungry) chips.push(["hungry", "warn", "food", this.t("chip.hungry", { n: info.hungry })]);
      if (info.water < 65) chips.push(["water", "warn", "water", `${Math.round(info.water)}%`]);
      if (info.uncollected >= info.cap && info.cap > 0) chips.push(["full", "warn", "coin", this.t("chip.full")]);
      const chipHtml = chips
        .slice(0, 2)
        .map(([id, cls, ic, label]) => `<button type="button" class="chip ${cls}" data-ui="chip" data-arg="${id}">${icon(ic)}${esc(label)}</button>`)
        .join("");
      const chipsEl = this.$("chips");
      if (chipsEl.dataset.html !== chipHtml) {
        chipsEl.innerHTML = chipHtml;
        chipsEl.dataset.html = chipHtml;
      }
      this.renderCoach();
      if (this.card) this.renderCard();
      if (this.mode !== "look" && this.mode !== "place" && this.mode !== "move" && Date.now() - this.lastMode > 25000) this.setMode("look");
    }

    setNum(id, value) {
      const el = this.$(id);
      const text = fmt(value);
      if (el.textContent !== text) {
        el.textContent = text;
        const pill = el.parentElement;
        pill.classList.add("bump");
        setTimeout(() => pill.classList.remove("bump"), 150);
      }
    }

    chipAction(id) {
      if (id === "hungry") this.setMode("feed");
      else if (id === "water") this.toast(this.t("hint.clean"));
      else if (id === "eggs") {
        const p = this.game.scene.locate("egg");
        if (p) this.flashPointer(p);
      } else if (id === "full") {
        const p = this.game.scene.locate("drop");
        if (p) this.flashPointer(p);
      }
    }

    flashPointer(p) {
      this.game.scene.setPointer(p);
      clearTimeout(this.pointerTimer);
      this.pointerTimer = setTimeout(() => this.renderCoach(), 2500);
    }

    renderCoach() {
      const save = this.game.save;
      const coach = this.$("coach");
      const scene = this.game.scene;
      document.querySelectorAll(".dock-btn").forEach((b) => b.classList.remove("hint"));
      if (save.tut >= C.TUTORIAL.length || this.sheet || this.mode === "place") {
        coach.hidden = true;
        if (!this.pointerTimer || this.pointerTimer._done) scene.setPointer(null);
        return;
      }
      const step = C.TUTORIAL[save.tut];
      let pointer = null;
      let text = this.t(`tut.${step.id}`);
      if (step.id === "collect") pointer = scene.locate("drop");
      if (step.id === "scrub") pointer = scene.locate("algae");
      if (step.id === "feed" && this.mode !== "feed") this.pulseDock("feed");
      if (step.id === "feed" && this.mode === "feed") text = this.t("tut.feedTap");
      if (step.id === "buy_decor" || step.id === "buy_fish") this.pulseDock("shop");
      scene.setPointer(pointer);
      const html = `<b>${save.tut + 1}/${C.TUTORIAL.length}</b> ${esc(text)}`;
      if (coach.innerHTML !== html) coach.innerHTML = html;
      coach.hidden = this.mode !== "look";
    }

    pulseDock(name) {
      const b = document.querySelector(`.dock-btn[data-ui="${name}"]`);
      if (b) b.classList.add("hint");
    }

    // ── Cards ────────────────────────────────────────────────────────

    showCard(kind, id, x) {
      this.card = { kind, id, side: x > this.game.scene.W / 2 ? "left" : "right" };
      this.confirm = null;
      this.cardTimer = Date.now();
      this.renderCard(true);
    }

    hideCard() {
      this.card = null;
      this.$("card").hidden = true;
    }

    renderCard(force) {
      const el = this.$("card");
      const save = this.game.save;
      const now = this.game.now();
      const card = this.card;
      if (Date.now() - this.cardTimer > 15000) return this.hideCard();
      if (!force && this.confirm) return;
      let html = "";
      if (card.kind === "fish") {
        const info = E.fishInfo(save, save.active, card.id, now);
        if (!info) return this.hideCard();
        const f = info.fish;
        const fedCls = f.fed < 15 ? "bad" : f.fed < 40 ? "warn" : "";
        const hapCls = info.happiness < 40 ? "bad" : info.happiness < 65 ? "warn" : "";
        html += `<div class="card-title">${esc(fishName(f.id))}</div>`;
        html += `<div class="card-sub">${esc(this.variantName(f.s, f.v))} · ${esc(this.t(`stage.${info.stage}`))}</div>`;
        html += `<div class="stat"><span>${esc(this.t("fed"))}</span><div class="bar ${fedCls}"><i style="width:${Math.round(f.fed)}%"></i></div><span>${Math.round(f.fed)}%</span></div>`;
        html += `<div class="stat"><span>${esc(this.t("happy"))}</span><div class="bar ${hapCls}"><i style="width:${info.happiness}%"></i></div><span>${info.happiness}%</span></div>`;
        if (f.stage < E.STAGE.ADULT) html += `<div class="stat"><span>${esc(this.t("growth"))}</span><div class="bar"><i style="width:${Math.round(info.growPct * 100)}%;background:var(--accent)"></i></div><span>${Math.round(info.growPct * 100)}%</span></div>`;
        html += '<div class="tags">';
        html += `<span class="tag">${icon("coin")} ${fmtRate(info.income)}/${esc(this.t("hourShort"))}</span>`;
        for (const r of info.reasons) {
          if (r.k === "playful") html += `<span class="tag plus">${esc(this.t("reason.playful"))}</span>`;
          else if (r.v) html += `<span class="tag ${r.v > 0 ? "plus" : "minus"}">${r.v > 0 ? "+" : ""}${r.v} ${esc(this.t(`reason.${r.k}`, { home: this.t(`tag.${info.species.needs}`) }))}</span>`;
        }
        if (info.species.cleans) html += `<span class="tag">${esc(this.t("trait.cleaner"))}</span>`;
        html += "</div>";
        html += `<div class="row"><button type="button" class="btn danger" data-ui="cardAction" data-arg="sellFish">${esc(this.t("sell"))} ${icon("coin")}${fmt(info.sell)}</button></div>`;
      } else if (card.kind === "decor") {
        const slot = save.tanks[save.active].decor[card.id];
        if (!slot) return this.hideCard();
        const item = C.DECOR[slot.d];
        html += `<div class="card-title">${esc(this.t(`decor.${slot.d}`))}</div>`;
        html += `<div class="card-sub">${item.tags.map((t) => esc(this.t(`tag.${t}`))).join(" · ")}${item.bonus ? ` · +${Math.round(item.bonus * 100)}% ${esc(this.t("income"))}` : ""}</div>`;
        const fans = save.tanks[save.active].fish.filter((f) => {
          const sp = C.SPECIES[f.s];
          return (sp.likes || []).some((t) => item.tags.includes(t)) || item.tags.includes(sp.needs);
        });
        if (fans.length) html += `<div class="card-sub">${esc(this.t("decorFans", { n: fans.length }))}</div>`;
        const refund = item.pearls ? Math.floor(item.pearls * C.RULES.decorSellReturn) : Math.round(item.price * C.RULES.decorSellReturn);
        html += `<div class="row"><button type="button" class="btn" data-ui="cardAction" data-arg="moveDecor">${icon("move")}${esc(this.t("move"))}</button>`;
        html += `<button type="button" class="btn danger" data-ui="cardAction" data-arg="sellDecor">${esc(this.t("sell"))} ${icon(item.pearls ? "pearl" : "coin")}${refund}</button></div>`;
      } else if (card.kind === "egg") {
        const egg = save.tanks[save.active].eggs.find((e) => e.id === card.id);
        if (!egg) return this.hideCard();
        const ready = E.eggReady(egg, now);
        const title = egg.m ? this.t(egg.m === 2 ? "egg.golden" : "egg.mystery") : this.t("eggsOf", { name: this.speciesName(egg.s) });
        html += `<div class="card-title">${esc(title)}</div>`;
        if (!ready) {
          const left = egg.at + C.RULES.eggHatchHours * E.HOUR - now;
          html += `<div class="card-sub">${esc(this.t("eggsHatchIn", { time: this.duration(left) }))}</div>`;
        } else {
          html += `<div class="card-sub">${esc(this.t("eggsFull"))}</div>`;
          html += `<div class="row"><button type="button" class="btn primary" data-ui="cardAction" data-arg="sellEggs">${esc(this.t("sellFry"))}</button></div>`;
        }
      }
      el.className = card.side;
      if (el.innerHTML !== html) el.innerHTML = html;
      el.hidden = false;
    }

    cardAction(action, el) {
      const card = this.card;
      const tank = this.game.save.active;
      if (!card) return;
      if (action === "sellFish") {
        if (!this.confirmed(el, `sell:${card.id}`)) return;
        const r = this.game.do({ type: "sellFish", tank, fish: card.id });
        if (r.ok) this.toast(this.t("soldFor", { n: r.result.coins }), "gold");
        this.hideCard();
      } else if (action === "sellDecor") {
        if (!this.confirmed(el, `selld:${card.id}`)) return;
        this.game.do({ type: "sellDecor", tank, slot: card.id });
        this.hideCard();
      } else if (action === "moveDecor") {
        const save = this.game.save;
        const decor = save.tanks[tank].decor;
        const item = decor[card.id];
        const slots = C.SLOTS.map((_, i) => i).filter((i) => i !== card.id && E.slotFits(i, item.d) && (!decor[i] || E.slotFits(card.id, decor[i].d)));
        if (!slots.length) return this.toast(this.t("err.fit"), "err");
        this.setMode("move", { from: card.id, slots });
      } else if (action === "sellEggs") {
        const r = this.game.do({ type: "hatch", tank, id: card.id, sell: true });
        if (r.ok) this.toast(this.t("soldFor", { n: r.result.soldFor }), "gold");
        this.hideCard();
      }
    }

    duration(ms) {
      const m = Math.max(1, Math.round(ms / 60000));
      if (m < 60) return `${m}${this.t("minShort")}`;
      const h = Math.floor(m / 60);
      if (h < 48) return `${h}${this.t("hourShort")} ${m % 60}${this.t("minShort")}`;
      return `${Math.floor(h / 24)}${this.t("dayShort")} ${h % 24}${this.t("hourShort")}`;
    }

    // ── Sheets ───────────────────────────────────────────────────────

    openSheet(kind, tab) {
      if (this.mode !== "look") this.setMode("look");
      this.hideCard();
      this.sheet = { kind, tab: tab || null, page: 0, sel: null };
      this.$("sheet").hidden = false;
      this.$("app").classList.add("sheet-open");
      this.renderSheet();
      this.renderCoach();
    }

    closeSheet() {
      this.sheet = null;
      this.$("sheet").hidden = true;
      this.$("app").classList.remove("sheet-open");
      this.renderCoach();
    }

    // Columns and rows that fit the sheet body, so grids page instead of scroll.
    layout(itemH, minW) {
      const body = this.$("sheetBody");
      const w = body.clientWidth || 300;
      const h = body.clientHeight || 160;
      const cols = Math.max(2, Math.min(6, Math.floor((w + 6) / (minW + 6))));
      const rows = Math.max(1, Math.floor((h + 6) / (itemH + 6)));
      return { cols, rows, per: cols * rows, itemH: Math.floor((h - (rows - 1) * 6) / rows) };
    }

    renderSheet(relayout) {
      const sh = this.sheet;
      if (!sh) return;
      const save = this.game.save;
      const tabs = {
        shop: ["fish", "decor", "food", "upgrades"],
        journal: ["goals", "dex", "trophies"],
      }[sh.kind];
      this.$("sheetTitle").textContent = this.t(`sheet.${sh.kind}`);
      this.$("sheetMeta").innerHTML =
        sh.kind === "shop" || sh.kind === "tanks"
          ? `<span class="pill">${icon("coin")}<span style="color:var(--gold)">${fmt(save.coins)}</span></span><span class="pill">${icon("pearl")}<span style="color:var(--pearl)">${fmt(save.pearls)}</span></span>`
          : "";
      this.$("sheetTabs").innerHTML = tabs ? tabs.map((t) => `<button type="button" class="tab ${t === sh.tab ? "on" : ""}" data-ui="tab" data-arg="${t}">${esc(this.t(`tab.${t}`))}</button>`).join("") : "";
      const body = this.$("sheetBody");
      body.innerHTML = "";
      const view = {
        shop: () => (sh.tab === "upgrades" ? this.viewUpgrades() : this.viewShop()),
        journal: () => (sh.tab === "dex" ? this.viewDex() : sh.tab === "trophies" ? this.viewTrophies() : this.viewGoals()),
        tanks: () => this.viewTanks(),
        menu: () => this.viewMenu(),
        help: () => this.viewHelp(),
      }[sh.kind];
      const out = view();
      body.innerHTML = out.body;
      body.style.gridTemplateColumns = out.cols ? `repeat(${out.cols}, 1fr)` : "";
      body.style.gridAutoRows = out.rowH ? `${out.rowH}px` : "";
      const pager = out.pages > 1 ? `<div class="pager"><button type="button" class="icon-btn" data-ui="page" data-arg="-1" ${sh.page <= 0 ? "disabled" : ""}>${icon("left")}</button>${sh.page + 1}/${out.pages}<button type="button" class="icon-btn" data-ui="page" data-arg="1" ${sh.page >= out.pages - 1 ? "disabled" : ""}>${icon("right")}</button></div>` : "";
      this.$("sheetFoot").innerHTML = (out.foot || "") + pager;
      // The grid is sized from the space left by the footer; if the new footer is taller than
      // the old one, lay out once more so items never slide under it.
      if (!relayout && body.scrollHeight > body.clientHeight + 2) this.renderSheet(true);
    }

    paged(items, per) {
      const pages = Math.max(1, Math.ceil(items.length / per));
      this.sheet.page = Math.min(Math.max(0, this.sheet.page), pages - 1);
      return { pageItems: items.slice(this.sheet.page * per, this.sheet.page * per + per), pages };
    }

    priceTag(coins, pearls, have) {
      const ok = pearls ? have.pearls >= pearls : have.coins >= coins;
      return `<span class="price ${ok ? "" : "no"}">${icon(pearls ? "pearl" : "coin")}${fmt(pearls || coins)}</span>`;
    }

    viewShop() {
      const sh = this.sheet;
      const save = this.game.save;
      const tankId = save.active;
      const tank = save.tanks[tankId];
      const L = this.layout(88, 74);
      let items = [];
      if (sh.tab === "fish") {
        items = E.speciesFor(tankId).map((id) => ({ id, kind: "fish" }));
        for (const k of Object.keys(C.EGGS)) items.push({ id: `egg_${k}`, kind: "egg", egg: k });
      }
      if (sh.tab === "decor") items = E.decorFor(tankId).map((id) => ({ id, kind: "decor" }));
      if (sh.tab === "food") items = Object.keys(C.FOODS).map((id) => ({ id, kind: "food" }));
      const { pageItems, pages } = this.paged(items, L.per);
      const size = Math.max(40, Math.min(90, L.itemH - 34));
      let body = "";
      for (const it of pageItems) {
        let img = "";
        let name = "";
        let price = "";
        let lock = "";
        let owned = "";
        if (it.kind === "fish") {
          const sp = C.SPECIES[it.id];
          const locked = save.level < sp.level;
          img = A.preview("fish", it.id, 0, 96, { silhouette: locked });
          name = this.speciesName(it.id);
          price = this.priceTag(sp.price, 0, save);
          if (locked) lock = `${icon("lock")}${sp.level}`;
          const n = tank.fish.filter((f) => f.s === it.id).length;
          if (n) owned = `×${n}`;
        } else if (it.kind === "egg") {
          const egg = C.EGGS[it.egg];
          const cost = E.eggPrice(tank, it.egg);
          img = eggImage(it.egg);
          name = this.t(`egg.${it.egg}`);
          price = this.priceTag(cost.coins, cost.pearls, save);
          if (save.level < egg.level) lock = `${icon("lock")}${egg.level}`;
        } else if (it.kind === "decor") {
          const item = C.DECOR[it.id];
          const locked = save.level < item.level;
          img = A.preview("decor", it.id, 0, 96, { size: item.size, silhouette: locked });
          name = this.t(`decor.${it.id}`);
          price = this.priceTag(item.price, item.pearls, save);
          if (locked) lock = `${icon("lock")}${item.level}`;
          if (tank.decor.some((d) => d && d.d === it.id)) owned = "✓";
        } else {
          const food = C.FOODS[it.id];
          const locked = save.level < food.level;
          img = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect x="9" y="8" width="22" height="28" rx="5" fill="#2a5c70"/><rect x="9" y="8" width="22" height="9" rx="4" fill="#ffffff" opacity=".85"/>${[0, 1, 2, 3, 4].map((i) => `<circle cx="${14 + (i % 3) * 6}" cy="${23 + Math.floor(i / 3) * 6}" r="2.4" fill="${FOOD_DOT[it.id]}"/>`).join("")}</svg>`)}`;
          name = cap(this.t(`food.${it.id}`));
          price = this.priceTag(food.price, 0, save);
          if (locked) lock = `${icon("lock")}${food.level}`;
          owned = `${save.food[it.id] || 0}`;
        }
        body += `<button type="button" class="card-item ${sh.sel === it.id ? "sel" : ""} ${lock ? "locked" : ""}" data-ui="sel" data-arg="${it.id}">${owned ? `<span class="owned">${owned}</span>` : ""}${lock ? `<span class="lock">${lock}</span>` : ""}<img alt="" src="${img}" style="max-height:${size}px"><span class="name">${esc(name)}</span>${price}</button>`;
      }
      let foot = `<div class="foot-info"><span class="muted">${esc(this.t(`shopHint.${sh.tab}`, { used: E.usedSpace(tank), cap: E.capacity(tank) }))}</span></div>`;
      if (sh.sel) foot = this.shopDetail(sh.tab, sh.sel);
      return { body, cols: L.cols, rowH: L.itemH, pages, foot };
    }

    shopDetail(tab, id) {
      const save = this.game.save;
      const tank = save.tanks[save.active];
      let info = "";
      let btn = "";
      if (tab === "fish" && id.startsWith("egg_")) {
        const kind = id.slice(4);
        const egg = C.EGGS[kind];
        const cost = E.eggPrice(tank, kind);
        const full = tank.eggs.length >= C.RULES.maxEggClutches;
        const locked = save.level < egg.level;
        info = `<b>${esc(this.t(`egg.${kind}`))}</b><br><span class="muted">${esc(this.t(`eggInfo.${kind}`, { tank: this.t(`tank.${tank.id}`) }))}</span>`;
        btn = `<button type="button" class="btn primary" style="flex:none" data-ui="action" data-arg="buyEgg:${kind}" ${locked || full ? "disabled" : ""}>${locked ? `${icon("lock")}${this.t("levelN", { n: egg.level })}` : full ? esc(this.t("err.eggsFull")) : `${esc(this.t("buy"))} ${icon(cost.pearls ? "pearl" : "coin")}${fmt(cost.pearls || cost.coins)}`}</button>`;
      } else if (tab === "fish") {
        const sp = C.SPECIES[id];
        const block = E.speciesBlock(save, tank, id);
        const likes = sp.needs ? this.t("needs", { tag: this.t(`tag.${sp.needs}`) }) : sp.likes && sp.likes.length ? this.t("likes", { tags: sp.likes.map((t) => this.t(`tag.${t}`)).join(", ") }) : "";
        info = `<b>${esc(this.speciesName(id))}</b><br><span class="muted">${icon("coin")}${sp.income}/${esc(this.t("hourShort"))} · ${esc(this.t("space", { n: sp.space }))}${likes ? ` · ${esc(likes)}` : ""} · ${esc(this.t("eats", { foods: sp.eats.map((f) => this.t(`food.${f}`)).join("/") }))}${sp.cleans ? ` · ${esc(this.t("trait.cleaner"))}` : ""}</span>`;
        btn = `<button type="button" class="btn primary" style="flex:none" data-ui="action" data-arg="buyFish:${id}" ${block && block !== "coins" ? "disabled" : ""}>${block === "level" ? `${icon("lock")}${this.t("levelN", { n: sp.level })}` : block === "space" ? esc(this.t("err.space")) : block === "max" ? esc(this.t("err.max")) : `${esc(this.t("buy"))} ${icon("coin")}${fmt(sp.price)}`}</button>`;
      } else if (tab === "decor") {
        const item = C.DECOR[id];
        const block = E.decorBlock(save, tank, id);
        info = `<b>${esc(this.t(`decor.${id}`))}</b><br><span class="muted">${item.tags.map((t) => esc(this.t(`tag.${t}`))).join(" · ")} · ${esc(this.t(`size.${item.size}`))}${item.bonus ? ` · +${Math.round(item.bonus * 100)}% ${esc(this.t("income"))}` : ""}</span>`;
        btn = `<button type="button" class="btn primary" style="flex:none" data-ui="action" data-arg="buyDecor:${id}" ${block && block !== "coins" && block !== "pearls" ? "disabled" : ""}>${block === "level" ? `${icon("lock")}${this.t("levelN", { n: item.level })}` : block === "slot" ? esc(this.t("err.slot")) : `${esc(this.t("buy"))} ${icon(item.pearls ? "pearl" : "coin")}${fmt(item.pearls || item.price)}`}</button>`;
      } else if (tab === "food") {
        const food = C.FOODS[id];
        const eaters = Object.keys(C.SPECIES).filter((s) => C.SPECIES[s].eats.includes(id) && C.SPECIES[s].level <= save.level + 3);
        info = `<b>${esc(cap(this.t(`food.${id}`)))}</b> <span class="muted">(${save.food[id] || 0})</span><br><span class="muted">${esc(this.t("foodInfo", { n: food.pack, portion: food.portion }))} · ${eaters.slice(0, 4).map((s) => esc(this.speciesName(s))).join(", ")}</span>`;
        btn = `<button type="button" class="btn primary" style="flex:none" data-ui="action" data-arg="buyFood:${id}" ${save.level < food.level ? "disabled" : ""}>${save.level < food.level ? `${icon("lock")}${this.t("levelN", { n: food.level })}` : `+${food.pack} ${icon("coin")}${fmt(food.price)}`}</button>`;
      }
      return `<div class="foot-info">${info}</div>${btn}`;
    }

    viewUpgrades() {
      const save = this.game.save;
      const tank = save.tanks[save.active];
      const L = this.layout(52, 999);
      const kinds = Object.keys(C.UPGRADES);
      const { pageItems, pages } = this.paged(kinds, L.rows);
      let body = "";
      for (const k of pageItems) {
        const lvl = tank.up[k];
        const max = C.UPGRADES[k].cost.length;
        const cost = E.upgradeCost(tank, k);
        const pips = Array.from({ length: max }, (_, i) => `<i class="${i < lvl ? "on" : ""}"></i>`).join("");
        const desc = this.t(`upgradeDesc.${k}`, { n: C.UPGRADES.size.perLevel, h: C.UPGRADES.chest.hours[Math.min(lvl + 1, max)], f: lvl + 1 });
        body += `<div class="list-row"><div class="grow"><div class="title">${esc(this.t(`upgrade.${k}`))}</div><div class="sub">${esc(cost == null ? this.t("maxed") : desc)}</div><div class="pips">${pips}</div></div>${cost == null ? icon("check") : `<button type="button" class="btn ${save.coins >= cost ? "primary" : ""}" style="flex:none" data-ui="action" data-arg="upgrade:${k}">${icon("coin")}${fmt(cost)}</button>`}</div>`;
      }
      return { body, rowH: L.itemH, pages, foot: `<div class="foot-info"><span class="muted">${esc(this.t("upgradeHint", { tank: this.t(`tank.${save.active}`) }))}</span></div>` };
    }

    viewTanks() {
      const save = this.game.save;
      const now = this.game.now();
      const L = this.layout(54, 999);
      const { pageItems, pages } = this.paged(E.TANK_IDS, L.rows);
      let body = "";
      for (const id of pageItems) {
        const tank = save.tanks[id];
        const def = C.TANKS[id];
        let sub;
        let right = "";
        if (tank.unlocked) {
          const info = E.tankInfo(save, id, now);
          sub = `${tank.fish.length} ${this.t("fishCount")} · ${icon("coin")}${fmtRate(info.income)}/${this.t("hourShort")}${info.uncollected ? ` · ${fmt(info.uncollected)} ${this.t("waiting")}` : ""}`;
          right = id === save.active ? `<span class="tag">${esc(this.t("here"))}</span>` : `<button type="button" class="btn primary" style="flex:none" data-ui="action" data-arg="visit:${id}">${esc(this.t("visit"))}</button>`;
        } else {
          const lvlOk = save.level >= def.unlockLevel;
          sub = `${icon("lock")} ${esc(this.t("levelN", { n: def.unlockLevel }))} · ${icon("coin")}${fmt(def.unlockCost)}`;
          right = `<button type="button" class="btn ${lvlOk && save.coins >= def.unlockCost ? "primary" : ""}" style="flex:none" data-ui="action" data-arg="unlock:${id}" ${lvlOk ? "" : "disabled"}>${esc(this.t("unlock"))}</button>`;
        }
        body += `<div class="list-row"><div class="tank-swatch" style="background:${TANK_SWATCH[id]}"></div><div class="grow"><div class="title">${esc(this.t(`tank.${id}`))}</div><div class="sub">${sub}</div></div>${right}</div>`;
      }
      return { body, rowH: L.itemH, pages };
    }

    viewMenu() {
      const save = this.game.save;
      const dexCount = Object.values(save.dex).reduce((n, m) => n + (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1), 0);
      const total = Object.keys(C.SPECIES).length * 3;
      const tiles = [
        ["tanks", "tank", this.t("sheet.tanks"), `${E.TANK_IDS.filter((id) => save.tanks[id].unlocked).length}/${E.TANK_IDS.length}`],
        ["journal", "book", this.t("sheet.journal"), this.t("dexProgress", { n: dexCount, total })],
        ["shop", "upgrade", this.t("tab.upgrades"), this.t(`tank.${save.active}`), "upgrades"],
        ["help", "help", this.t("sheet.help"), this.t("helpSub")],
      ];
      const body = `<div class="tile-grid">${tiles.map(([kind, ic, label, sub, tab]) => `<button type="button" class="tile" data-ui="go" data-arg="${kind}" ${tab ? `data-tab="${tab}"` : ""}>${icon(ic)}<span>${esc(label)}<small>${esc(sub)}</small></span></button>`).join("")}</div>`;
      return { body };
    }

    viewGoals() {
      const save = this.game.save;
      const now = this.game.now();
      let body = "";
      let foot = "";
      if (save.tut < C.TUTORIAL.length) {
        C.TUTORIAL.forEach((step, i) => {
          const done = i < save.tut;
          const cur = i === save.tut;
          body += `<div class="list-row ${done ? "done" : ""}"><div class="grow"><div class="title">${esc(this.t(`tut.${step.id}`))}</div>${cur ? `<div class="bar"><i style="width:${Math.round((save.tutProg / step.target) * 100)}%"></i></div>` : ""}</div>${done ? icon("check") : `<span class="price" style="color:var(--gold)">${icon("coin")}${step.coins}</span>`}</div>`;
        });
        foot = `<div class="foot-info"><span class="muted">${esc(this.t("tutHint"))}</span></div>`;
        return { body, foot, rowH: 0 };
      }
      const reward = E.goalReward(save, now);
      for (const g of save.daily.goals) {
        body += `<div class="list-row ${g.done ? "done" : ""}"><div class="grow"><div class="title">${esc(this.t(`goal.${g.k}`, { n: fmt(g.n) }))}</div><div class="bar"><i style="width:${Math.round((g.p / g.n) * 100)}%"></i></div><div class="sub">${fmt(g.p)} / ${fmt(g.n)}</div></div>${g.done ? icon("check") : `<span class="price" style="color:var(--gold)">${icon("coin")}${fmt(reward)}</span>`}</div>`;
      }
      const nextDay = (E.localDay(save, now) + 1) * E.DAY + (save.tz || 0) * 60000;
      foot = `<div class="foot-info">${icon("flame")} <b>${esc(this.t("streak", { n: save.daily.streak }))}</b><br><span class="muted">${esc(this.t("allGoalsReward", { n: C.RULES.goalsBonusPearls }))} · ${esc(this.t("newGoalsIn", { time: this.duration(nextDay - now) }))}</span></div>`;
      return { body, foot };
    }

    viewDex() {
      const sh = this.sheet;
      const save = this.game.save;
      const L = this.layout(84, 76);
      const ids = E.TANK_IDS.flatMap((t) => E.speciesFor(t));
      const { pageItems, pages } = this.paged(ids, L.per);
      const size = Math.max(36, Math.min(80, L.itemH - 30));
      let body = "";
      for (const id of pageItems) {
        const mask = save.dex[id] | 0;
        const img = A.preview("fish", id, 0, 96, { silhouette: !mask });
        const dots = [0, 1, 2].map((v) => `<i class="${mask & (1 << v) ? "on" : ""} ${v ? "rare" : ""}"></i>`).join("");
        body += `<button type="button" class="card-item ${sh.sel === id ? "sel" : ""}" data-ui="sel" data-arg="${id}"><img alt="" src="${img}" style="max-height:${size}px"><span class="name">${mask ? esc(this.speciesName(id)) : "???"}</span><span class="vdots">${dots}</span></button>`;
      }
      let foot = `<div class="foot-info"><span class="muted">${esc(this.t("dexHint"))}</span></div>`;
      if (sh.sel) {
        const id = sh.sel;
        const mask = save.dex[id] | 0;
        const imgs = [0, 1, 2]
          .map((v) => `<img alt="" src="${A.preview("fish", id, v, 64, { silhouette: !(mask & (1 << v)) })}" style="width:${Math.min(56, L.itemH * 0.7)}px">`)
          .join("");
        const names = [0, 1, 2].map((v) => (mask & (1 << v) ? this.variantName(id, v) : "???")).join(" · ");
        foot = `<div style="display:flex;gap:2px">${imgs}</div><div class="foot-info"><b>${mask ? esc(this.speciesName(id)) : "???"}</b><br><span class="muted">${esc(names)}</span></div>`;
      }
      return { body, cols: L.cols, rowH: L.itemH, pages, foot };
    }

    viewTrophies() {
      const save = this.game.save;
      const L = this.layout(46, 999);
      const list = C.ACHIEVEMENTS.slice().sort((a, b) => save.ach.includes(a.id) - save.ach.includes(b.id));
      const { pageItems, pages } = this.paged(list, L.rows);
      let body = "";
      for (const a of pageItems) {
        const done = save.ach.includes(a.id);
        const v = Math.min(a.n, E.statValue(save, a.stat));
        body += `<div class="list-row ${done ? "done" : ""}">${icon("trophy")}<div class="grow"><div class="title">${esc(this.t(`ach.${a.stat}`, { n: fmt(a.n) }))}</div>${done ? "" : `<div class="bar"><i style="width:${Math.round((v / a.n) * 100)}%"></i></div>`}</div>${done ? icon("check") : `<span class="price" style="color:var(--pearl)">${icon("pearl")}${a.pearls}</span>`}</div>`;
      }
      return { body, rowH: L.itemH, pages, foot: `<div class="foot-info"><span class="muted">${esc(this.t("trophyCount", { n: save.ach.length, total: C.ACHIEVEMENTS.length }))}</span></div>` };
    }

    viewHelp() {
      const pages = ["tank", "feed", "clean", "happy", "breed", "progress", "reset"];
      const sh = this.sheet;
      sh.page = Math.min(Math.max(0, sh.page), pages.length - 1);
      const p = pages[sh.page];
      let body = `<div class="help-page"><h3>${esc(this.t(`help.${p}.title`))}</h3><p>${esc(this.t(`help.${p}.text`))}</p>`;
      if (p === "reset") body += `<div class="row"><button type="button" class="btn danger" data-ui="action" data-arg="reset">${icon("reset")}${esc(this.t("resetGame"))}</button></div>`;
      body += "</div>";
      return { body, pages: pages.length };
    }

    sheetAction(arg, el) {
      const [kind, id] = arg.split(":");
      const save = this.game.save;
      const tank = save.active;
      if (kind === "buyFish") {
        const r = this.game.do({ type: "buyFish", tank, s: id });
        if (r.ok) {
          this.toast(this.t("welcomeFish", { name: fishName(r.result.fish) }), "gold");
          this.closeSheet();
        }
      } else if (kind === "buyEgg") {
        const r = this.game.do({ type: "buyEgg", tank, kind: id });
        if (r.ok) {
          this.toast(this.t("eggBought"), "gold");
          this.closeSheet();
        }
      } else if (kind === "buyDecor") {
        const slots = E.freeSlots(save.tanks[tank], id);
        const block = E.decorBlock(save, save.tanks[tank], id);
        if (block) return this.showError(block, C.DECOR[id].level);
        this.closeSheet();
        this.setMode("place", { decor: id, slots });
      } else if (kind === "buyFood") {
        const r = this.game.do({ type: "buyFood", food: id });
        if (r.ok) this.renderSheet();
      } else if (kind === "upgrade") {
        const r = this.game.do({ type: "upgrade", tank, kind: id });
        if (r.ok) {
          this.toast(this.t("upgraded", { name: this.t(`upgrade.${id}`) }), "gold");
          this.renderSheet();
        }
      } else if (kind === "visit") {
        this.game.do({ type: "setTank", tank: id });
        this.closeSheet();
      } else if (kind === "unlock") {
        const r = this.game.do({ type: "unlockTank", tank: id });
        if (r.ok) this.closeSheet();
      } else if (kind === "reset") {
        if (!this.confirmed(el, "reset")) return;
        this.closeSheet();
        this.game.reset();
      }
    }

    // ── Feedback ─────────────────────────────────────────────────────

    toast(msg, kind, life) {
      const box = this.$("toasts");
      const el = document.createElement("div");
      el.className = `toast ${kind || ""}`;
      el.style.setProperty("--life", `${life || 2.4}s`);
      el.textContent = msg;
      box.appendChild(el);
      while (box.children.length > 3) box.firstChild.remove();
      setTimeout(() => el.remove(), (life || 2.4) * 1000 + 450);
    }

    banner(big, small) {
      const el = this.$("banner");
      el.innerHTML = `<div class="banner-box"><div class="banner-big">${esc(big)}</div>${small ? `<div class="banner-small">${esc(small)}</div>` : ""}</div>`;
      el.hidden = false;
      clearTimeout(this.bannerTimer);
      this.bannerTimer = setTimeout(() => {
        el.hidden = true;
      }, 2700);
    }

    showError(code, level) {
      const msg = code === "level" ? this.t("levelN", { n: level }) : this.t(`err.${code}`);
      this.toast(msg, "err");
    }

    // Turn engine events into toasts and banners.
    handleEvents(events) {
      for (const e of events) {
        switch (e.t) {
          case "level": {
            const unlocks = [];
            for (const id of Object.keys(C.SPECIES)) if (C.SPECIES[id].level === e.level) unlocks.push(this.speciesName(id));
            for (const id of E.TANK_IDS) if (C.TANKS[id].unlockLevel === e.level && e.level > 1) unlocks.push(this.t(`tank.${id}`));
            this.banner(this.t("levelUp", { n: e.level }), unlocks.length ? this.t("newUnlocks", { list: unlocks.join(", ") }) : `+${e.coins} ${this.t("coins")}`);
            break;
          }
          case "goal":
            this.toast(this.t("goalDone", { n: e.coins }), "gold");
            break;
          case "allgoals":
            this.banner(this.t("allGoals"), `+${e.pearls} ${this.t("pearls")} · ${this.t("streak", { n: e.streak })}`);
            break;
          case "tutorial":
            this.toast(this.t("tutDone", { n: e.coins }), "gold");
            break;
          case "ach":
            this.toast(`${this.t("trophy")}: ${this.t(`ach.${C.ACHIEVEMENTS.find((a) => a.id === e.id).stat}`, { n: fmt(C.ACHIEVEMENTS.find((a) => a.id === e.id).n) })} +${e.pearls}`, "gold", 3);
            break;
          case "dex":
            if (e.v > 0) this.banner(this.t("rareFound"), this.variantName(e.s, e.v));
            else if (e.pearls) this.toast(this.t("dexNew", { name: this.speciesName(e.s) }), "gold");
            break;
          case "eggs":
            this.toast(this.t("eggsLaid", { name: this.speciesName(e.s) }), "gold", 3);
            break;
          case "grow":
            if (e.stage === E.STAGE.ADULT) this.toast(this.t("grownUp", { name: fishName(e.fish) }));
            break;
          case "tank":
            this.banner(this.t(`tank.${e.id}`), this.t("tankUnlocked"));
            break;
          case "daily":
            break;
        }
      }
    }

    welcome(away, created) {
      const modal = this.$("modal");
      const save = this.game.save;
      if (created) {
        modal.innerHTML = `<div class="modal-box"><h2>${esc(this.t("intro.title"))}</h2><div class="sub">${esc(this.t("intro.text"))}</div><div class="row"><button type="button" class="btn primary" data-ui="modalClose">${esc(this.t("intro.go"))}</button></div></div>`;
        modal.hidden = false;
        return;
      }
      if (!away || away.hours < 0.5) return;
      const hungry = E.TANK_IDS.reduce((n, id) => n + (save.tanks[id].unlocked ? save.tanks[id].fish.filter((f) => f.fed < 30).length : 0), 0);
      const lines = [];
      if (away.coins) lines.push(["coin", this.t("away.coins", { n: fmt(away.coins) })]);
      if (away.eggs) lines.push(["egg", this.t("away.eggs", { n: away.eggs })]);
      if (hungry) lines.push(["food", this.t("away.hungry", { n: hungry })]);
      if (away.algae + away.debris) lines.push(["water", this.t("away.dirty", { n: away.algae + away.debris })]);
      if (!lines.length) return;
      modal.innerHTML = `<div class="modal-box"><h2>${esc(this.t("away.title"))}</h2><div class="sub">${esc(this.t("away.sub", { time: this.duration(away.hours * E.HOUR) }))}</div>${lines.map(([ic, text]) => `<div class="modal-line">${icon(ic)}<span>${esc(text)}</span></div>`).join("")}<div class="row"><button type="button" class="btn primary" data-ui="modalClose">${esc(this.t("away.go"))}</button></div></div>`;
      modal.hidden = false;
    }
  }

  root.AquaUI = { UI, fishName, fmt, icon };
})(typeof self !== "undefined" ? self : this);
