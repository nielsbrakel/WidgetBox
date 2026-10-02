---
name: aquarium-widget-dev
description: Working on the Aquarium widget game in WidgetBox (Homey Pro). Covers the shared engine, catalog, art, scene, UI, save model, sandbox scenarios and tests. Use it for any aquarium feature, bug, balance change or test.
---

# Aquarium widget development

The full design lives in `apps/com.nielsvanbrakel.widgetbox-games/AQUARIUM_SPEC.md`. Read §3 (architecture) and §6 (systems) before changing rules.

## Files

```
apps/com.nielsvanbrakel.widgetbox-games/widgets/aquarium/
  api.js                 load → migrate → simulate → apply actions → persist (aquarium2_<widgetId>)
  widget.compose.json    GET / and POST /, settings day_night and motion
  public/catalog.js      all content and balance numbers (AquaCatalog, UMD)
  public/engine.js       pure, deterministic rules (AquaEngine, UMD)
  public/art.js          procedural Canvas 2D drawings keyed by catalog ids (AquaArt)
  public/scene.js        animated tank: agents, food, effects, hit tests (AquaScene)
  public/ui.js           HUD, dock, tray, cards, sheets, i18n (AquaUI)
  public/main.js         Game: Homey wiring, optimistic actions, sync, tap routing
apps/sandbox/src/lib/mocks/aquariumMocks.js   real engine against localStorage, named scenarios
tests/unit/aquarium-*.test.mjs                Vitest: engine, api, pacing bot
tests/e2e/aquarium.spec.ts, tests/pages/AquariumPage.ts   Playwright in the sandbox
```

Scripts load in this order: catalog, engine, art, scene, ui, main. There is no bundler.

## Rules that keep the game correct

- **Deterministic engine.** Never use `Math.random` or `Date.now()` in `engine.js`. Use `rand(save.seed, id, salt)` and the `now` argument. The client and the server must reach the same save.
- **Every state change is an action** in `ACTIONS` (engine.js). Validate everything first and return an error code string *before* mutating. Tests check that failed actions leave the save untouched.
- **Content is data.** New species, decor, food, goals or achievements go in `catalog.js`. Add the art in `art.js` (`FISH`/`SPECIAL` for fish, `DECOR` drawers for decor) and the strings in both `locales/en.json` and `locales/nl.json` under `widgets.aquarium`.
- **Removing content is safe.** `migrate()` drops unknown ids. Changing the save shape means adding defaults in `migrate()`. A breaking change bumps `SAVE_VERSION`.
- **Taps only.** No swipe or drag gestures: the dashboard eats them. New interactions are a tap, or a mode from the dock followed by a tap.
- **Fit 4:3** from 280 px wide. Sheets page instead of scrolling. Check 320 px and 480 px.

## Workflow

1. Run the sandbox: `pnpm --filter sandbox dev`, pick **Aquarium**, then pick a scenario (fresh, pond day 2, Amazon, reef, abyss at night, eggs, full tank, away 3 days, rich, and art galleries per tank).
2. In the widget frame, `window.__aquarium` is the running game (`.save`, `.scene`, `.ui`, `.do(action)`). `__aquarium.scene.locate(kind, id)` returns tap coordinates for coins, algae, eggs, fish and slots.
3. After rule or balance changes, run `node`-based unit tests with Vitest (`tests/unit`). The pacing test runs a 90-day bot and fails if progression gets much faster or slower.
4. Run `tests/e2e/aquarium.spec.ts` for UI flows.
