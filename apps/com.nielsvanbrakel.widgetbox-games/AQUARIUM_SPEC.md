# Aquarium widget, v2 specification

**App:** `com.nielsvanbrakel.widgetbox-games` · **Widget:** `aquarium` · **Spec version:** 2.0.0 (2026-10-02)

The aquarium is a cozy idle game on the Homey dashboard. You keep up to four tanks, from a garden
pond to the deep abyss. Fish earn coins while you are away, so a visit or two a day keeps the tanks
thriving. Long-term goals are completing the Fishdex (22 species in 3 colours each), unlocking every
tank and reaching aquarist level 30.

Version 2 is a full rebuild. Version 1 relied on swipes, which the Homey dashboard swallows, and its
drawings did not line up (eels clipping through caves, decor overlapping the HUD). The old save format
is not migrated; first-version players get a fresh tank plus a welcome gift (+250 coins, +5 pearls).

---

## 1. Platform constraints

| Constraint | Consequence |
|---|---|
| The dashboard scrolls vertically and captures swipes | **Taps only.** A tap is pointer down plus up within 14 px and 800 ms. The canvas uses `touch-action: pan-y`, so a vertical drag scrolls the dashboard instead of being eaten. |
| Widget height is fixed by `widget.compose.json` (`height: "75%"`, so 4:3) | Every layout is built for 4:3 from 280 px up to tablet width, with `clamp()` sizing. Sheets page with arrow buttons instead of scrolling. |
| No build step and no modules in widget pages | Plain scripts that set globals, loaded in a fixed order. Shared files are UMD so Node can `require` them. |
| Widget state lives in app settings (`homey.settings`) | One small JSON save per widget instance (about 2–4 KB) under `aquarium2_<widgetId>`. |
| Homey Pro is a small device | The server does no rendering and simulates in half-hour steps. Reads only write back when something changed (see §3). |
| Widgets are always on | The page drops to 30 fps after 20 s without input and stops drawing while hidden. A "battery" motion setting caps it at 30 fps. |

## 2. Design principles

1. **One tap does one obvious thing.** Coins, algae, debris, eggs, fish and decor are tap targets. Modes (feed, play, place) are entered from the dock and say what the next tap does.
2. **Nothing dies.** Neglect lowers happiness and income and makes the tank dirty, but never loses fish.
3. **Every number is explained.** The fish card lists the happiness reasons (food, water, decor, home, playful).
4. **Deterministic rules.** The engine never reads the clock or `Math.random`; it hashes the save seed with ids and timestamps. The client and the server reach the same result.
5. **Server is the source of truth.** The page applies taps optimistically, and any server response replaces the local save.
6. **Content is data.** Species, decor, foods, upgrades, goals and achievements live in `catalog.js`. Art is keyed by the same ids.

## 3. Architecture

```
widgets/aquarium/
  api.js              Homey widget API, a thin wrapper around public/server.js
  widget.compose.json GET / (getState) and POST / (doAction), settings day_night and motion
  public/
    catalog.js        content and balance (UMD: AquaCatalog)
    engine.js         pure rules: createSave, migrate, simulate, apply, read models (UMD: AquaEngine)
    server.js         request handling and persistence, shared with the sandbox (UMD: AquaServer)
    art.js            procedural Canvas 2D art: biomes, 22 fish, 28 decor items, props (AquaArt)
    scene.js          the living tank: agents, behaviours, food physics, effects, hit testing (AquaScene)
    ui.js             HUD, dock, tray, cards, sheets, toasts, translations (AquaUI)
    main.js           Game class: Homey wiring, action queue, sync, tick, tap routing
    index.html, style.css
```

**Data flow.** `main.js` keeps `save`, plus a queue of actions not yet sent.

1. A tap becomes an action such as `{type: "collect", tank, id}`. `Game.do()` runs `E.apply()` on the local save at once and shows the result.
2. Actions are batched (400 ms debounce, at most 50) and POSTed as `{batch, actions: [...]}`. The server loads the save, runs `simulate` to catch up idle time, applies each action and stores the result. A failing action only fails itself. The last 8 batch ids are kept in the save, so a retry after a lost response is never applied twice.
3. The response (`{save, now, results}`) replaces the local save, and any queued actions not yet sent are replayed on top. A clock offset from the server `now` keeps the client simulation in step. Responses that started before a newer local change, or before a reset, are ignored.
4. **Same steps on both sides.** `simulate` only advances on a fixed 10-minute clock grid. The page ticks every second and the server may catch up a week at once, but both pass the same grid boundaries in the same order, so ids, positions and hunger come out identical (a unit test checks this).
5. **Untrusted input.** Every action field is checked against the catalog with own-key lookups before a handler runs, and `migrate` repairs wrong types. A save that still can't be read is kept under `aquarium2bad_<id>` and play starts over.
6. GET runs on load, every 5 minutes, and when the page becomes visible. It writes the save back only when the save was just created, when it was caught up by 30 minutes or more, or when the catch-up raised events. A 5-minute refresh therefore costs no flash writes.

**Settings.** `day_night`: auto (follows the Homey clock), day or night. `motion`: smooth or battery. Resetting the game is in the in-game Help pages (two taps to confirm), not in widget settings.

**Debugging.** `window.__aquarium` is the running `Game`. The sandbox runs the real engine against `localStorage` with named scenarios (`apps/sandbox/src/lib/mocks/aquariumMocks.js`).

## 4. Save model (`SAVE_VERSION = 2`)

```js
{
  v: 2, seed, t,                // t = last simulated time (ms)
  coins, pearls, xp, level,     // level 1..30
  food: { flakes: 12, ... },    // shared by all tanks
  active: "pond", tz,           // tz = client timezone offset, for the daily reset
  tut, tutProg,                 // tutorial step and progress
  daily: { day, goals: [{k, n, p, done}], bonus, streak, lastFull, visited },
  dex: { guppy: 0b011, ... },   // bit per colour variant found
  ach: ["fish_5", ...], stats: { coinsEarned, hatched, scrubbed, vacuumed, played, fed, bought },
  nextId, batches: [...],       // id counter, recent batch ids
  tanks: { pond: Tank, amazon: Tank, reef: Tank, abyss: Tank }
}
Tank = {
  id, unlocked, up: { size, filter, feeder, chest },
  fish:   [{ id, s, v, born, stage, growth, fed, played, buff }],
  decor:  [8 slots: { id, d } | null],
  drops:  [{ id, x, v }],        // coins on the sand
  algae:  [{ id, x, y, hp, max }], debris: [{ id, x }],
  eggs:   [{ id, s, at, x, m?, v? }],   // m: 1 mystery, 2 golden (bought eggs)
  bits, bitsAt, waste, pending, breed: { [species]: hours }, crew, autoFed, nextAlgae, nextDebris
}
```

`migrate()` fills new fields with defaults and drops ids the catalog no longer knows, so content can be removed safely. Any save without `v: 2` is replaced.

## 5. Game loop

| Time scale | What the player does | What pulls them back |
|---|---|---|
| Seconds | Tap coins, scrub algae, vacuum debris, drop food, toss a toy | Coins fly to the counter, fish dart for food, sparkles |
| Visit (1–3 min) | Clear chores, feed, play, hatch eggs, buy a fish or decor | Daily goals, the coach hint, chips in the HUD |
| Day | Finish three daily goals (+2 pearls, streak) | Coin chest fills in 6–24 h; eggs hatch after 2 h |
| Week | Unlock the next tank, upgrade, breed adults | 7-day streak bonus (+5 pearls) |
| Months | Collect all 66 Fishdex entries, max every tank | Rare colours only come from eggs; golden eggs target missing ones |

## 6. Systems

**Tanks.** Each tank has its own biome art, species, decor and upgrades. Coins, pearls, food and level are shared.

| Tank | Unlock | Cost | Base space | Price multiplier |
|---|---|---|---|---|
| Garden pond | level 1 | free | 6 | ×1 |
| Amazon river | level 5 | 600 | 8 | ×4 |
| Coral reef | level 10 | 5 000 | 10 | ×15 |
| Deep abyss | level 16 | 30 000 | 10 | ×50 |

**Income.** Each fish earns `species.income × stage factor (0.3 / 0.6 / 1) × happiness factor × playful buff (1.25) × (1 + decor bonus)` per hour. The happiness factor is 0 at 20 happiness and 1 at 80. Income drops as coins on the sand in chunks of a third of the tank's hourly potential, up to the coin chest's cap (6 to 24 hours of income, by chest upgrade). A full chest stops earning, which is the reason to check in.

**Happiness (0–100).** It starts at 50 and is adjusted by food (+20 well fed down to −35 starving), water quality (−15 to +15), liked decor (+8 per liked tag, at most +16) and a missing required home (−30, for clownfish without an anemone and the moray without a cave).

**Care.** Hunger drops per species rate. Fed fish grow from fry to juvenile to adult. Algae spawn about every 3 hours and debris about every 4 (slower with filter upgrades); both lower water quality. Uneaten food becomes waste, and waste becomes debris. Cleaner species (snail, cory, pleco, shrimp, isopod) slowly clean on their own. The feeder upgrade auto-feeds when the tank average drops below 30, from shared stock, up to its level times per day.

**Feeding (touch).** The dock's food button opens the tray (food picker, stock, buy). Each tap on open water drops a portion that floats, sinks and settles; fish that eat that food swim to it. Every bite is an `eat` action. Food not eaten within 9 s of settling becomes waste (if the widget closes first, the server turns leftovers into waste after 2 minutes).

**Play.** Play mode drops a toy at the tapped spot. Rested fish (4 h cooldown) chase it and get +25% income for 6 hours.

**Breeding and eggs.** Two happy (≥70) adults of a species slowly breed. A clutch appears on the sand, and after 2 hours a tap hatches 1–3 fry. Each fry rolls a colour (10% uncommon, 2.5% rare). If the tank is full, the egg card offers to sell the fry. The shop also sells eggs:
- **Mystery egg** (level 2): coins (150 × tank multiplier). One random fish of that tank, with 3× rare odds.
- **Golden egg** (level 3): 20 pearls. Always a rare colour, picked from the ones still missing in that tank.

**Decor.** There are 8 fixed slots per tank: 4 back (L, M, M, L) behind the fish and 4 front (S) in front of them. S fits any slot, M fits M and L, and L only fits L. Placing is a mode: after buying, valid slots glow and a tap places the item. Decor can be moved or sold (two taps) from its card. Pearl decor adds +10% tank income. Caves are real shelters: shy fish hide in them, and the moray lives in its rock cave (see §7).

**Upgrades (per tank).** Size (+2 space, 5 levels), filter (slower algae and debris, 5 levels), feeder (auto-feeds per day, 3 levels) and coin chest (6/9/12/18/24 hours of storage). Prices scale with the tank multiplier.

**Progression.** XP comes from every chore and purchase. Level `n` needs `25·n^1.9` XP and unlocks species, decor, foods and tanks. A 5-step tutorial (collect, feed ×3, scrub, buy decor, buy fish) runs before daily goals start. There are 21 achievements and pearls for Fishdex discoveries (1 per species, 3 per rare colour).

**Pacing (from the bot in `tests/unit/aquarium-bot.mjs`, 3 visits a day).** The Amazon opens around day 5, the reef around day 18, the abyss around day 30, and level 30 arrives around day 45. A 1-visit-a-day player reaches the abyss around day 55. The rare hunt runs past day 60. `tests/unit/aquarium-engine.test.mjs` guards these bounds.

## 7. Rendering

Everything is drawn with Canvas 2D, procedurally, so it stays sharp at any DPR and needs no image assets.

- **Layers (back to front):** cached biome background (gradient, far silhouettes, sand) → light rays → back decor → back-decor glows → fish (sorted by depth `z`) → front decor → coins, algae, debris, eggs → food → caustics, bubbles, particles → effects.
- **Fish:** the body is a cached sprite per species, colour and size, and the tail and fins are drawn live with a swim phase. Species have their own movement: swim, school (leader and followers), bottom, crawl, hover, jelly pulse and eel.
- **Moray eel:** a 18-point spine ribbon that follows its own trail. Its cave decor provides an outline and a hole. The eel is drawn with an even-odd clip (everything outside the rock, plus the hole), so it really slides in and out of the opening. When it returns, it swims through the hole and coils inside the rock until its whole body is hidden, then peeks out.
- **Clownfish** are drawn between the anemone's back and front layers, so they nestle inside the tentacles.
- **Day and night:** `auto` follows local time with dawn and dusk blends. At night the water darkens and glow decor and abyss species light up.
- **Performance:** 60 fps while interacting, 30 fps when idle or in battery mode, and no drawing while the page is hidden (animation frames pause). Static parts are cached offscreen.

## 8. Interface

- **HUD:** coins and pearls pills, status chips (eggs ready, hungry count, water %, chest full) and the level ring (opens the journal; a dot means goals are still open today). The coach bubble shows the next tutorial or goal hint while nothing else is open.
- **Dock (right edge):** Feed, Play, Shop, Menu. A pulsing hint marks the button the tutorial wants.
- **Cards:** tapping a fish, decor item or egg opens a small card with stats, happiness reasons and actions. Destructive buttons need a second tap.
- **Sheets:** Shop (fish and eggs, decor, food, upgrades), Journal (goals, Fishdex, trophies), Tanks, Menu and Help (7 pages plus reset). Grids are sized to the available space and page with arrows.
- **Welcome modal:** an intro on a fresh save, or "welcome back" with coins, hungry fish and chores after 30 minutes or more away.
- **Language:** every string goes through `Homey.__("widgets.aquarium.*")`, in English and Dutch.

## 9. Testing

- `tests/unit/aquarium-engine.test.mjs` covers the starter save, tutorial, determinism, idle catch-up caps, failed actions leaving the save untouched, migration, eggs and long-term pacing.
- `tests/unit/aquarium-api.test.mjs` covers the persistence policy, legacy gift, batching limits and reset.
- `tests/e2e/aquarium.spec.ts` (with `tests/pages/AquariumPage.ts`) plays the tutorial with taps in the sandbox, plus sheets, the fish card, tank travel, the welcome back and the eel cave cycle.

## 10. Backlog

Ideas that fit the architecture but are not built yet:

- Seasonal decor and limited-time species (catalog flags with date windows).
- Photo mode: hide the HUD for a clean dashboard view after 60 s idle.
- Tank themes (alternative backgrounds per biome) as a late-game coin sink.
- Fish names editable from the card (needs a text input, which works on the dashboard but not on every device).
- Flow cards ("aquarium chest is full") for Homey automations.
