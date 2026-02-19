---
name: aquarium-widget-dev
description: Expert skill for developing the Aquarium widget game in WidgetBox (Homey Pro). Covers game architecture, simulation engine, catalog system, save model, cleaning/feeding/play modes, economy, rendering, testing, and backwards compatibility. Use this when working on any aquarium game code, features, bugs, or tests.
---

# Aquarium Widget Development Skill

This skill provides comprehensive domain knowledge for developing the Aquarium widget game within the WidgetBox monorepo for Homey Pro.

## When to Use

- Implementing any aquarium game feature (fish, tanks, tools, decor, economy)
- Writing or fixing simulation logic (hunger, cleanliness, coin generation, growth)
- Working on the cleaning, feeding, or play tool modes
- Adding new fish species, decor items, foods, or tools to the catalog
- Adding new tank biomes to the system
- Debugging save/load, migration, or catalog reconciliation issues
- Writing unit tests (Vitest) or E2E tests (Playwright) for game systems
- Modifying the renderer or visual layers
- Updating the sandbox mock scenarios
- Fixing backwards compatibility or save migration problems

## Project Layout

```
apps/com.nielsvanbrakel.widgetbox-games/
├── app.js                          # Homey App entry (minimal)
├── app.json                        # Generated from .homeycompose/app.json
├── .homeycompose/app.json          # Source of truth for app metadata
├── package.json                    # Scripts: homey:run, homey:install, homey:build
├── AQUARIUM_SPEC.md             # Full game specification (v1.3.0)
├── locales/
│   ├── en.json                     # English translations
│   └── nl.json                     # Dutch translations
├── widgets/
│   └── aquarium/
│       ├── widget.compose.json     # Widget config (height, settings, API routes)
│       ├── api.js                  # SERVER-SIDE: All game logic, state, catalog
│       └── public/
│           └── index.html          # CLIENT: Renderer, UI, input (vanilla JS)
```

Related files:
```
apps/sandbox/src/lib/mocks/aquariumMocks.js    # Sandbox mock state + handlers
apps/sandbox/src/lib/MockHomey.js              # Mock Homey SDK with scenario support
apps/sandbox/src/lib/scenarios.js              # Dev scenarios for testing
tests/e2e/games.spec.ts                        # Playwright E2E tests (60 tests)
tests/e2e/games-advanced.spec.ts               # Advanced E2E tests (57 tests)
tests/e2e/games-features.spec.ts               # v1.2 feature E2E tests (50 tests)
tests/e2e/games-design.spec.ts                 # v1.3 design overhaul E2E tests (45 tests)
tests/pages/GamesPage.ts                       # Page object for E2E
```

## Architecture Rules

### Server-Authoritative Design

ALL game logic lives in `api.js`. The client (`public/index.html`) is a **dumb renderer**:

- Client sends actions via `Homey.api('POST', '/', { type, payload })`
- Server validates, mutates state, returns updated state
- Client never directly modifies game state
- Client only draws what the server tells it

### API Contract

```
GET  /  → Load state, run simulation (idle catch-up), return state + catalog snapshot
POST /  → Receive { type, payload }, handle action, return mutated state
```

Query parameter: `widgetId` (from `Homey.getWidgetInstanceId()`)

### State Persistence

- Stored via `homey.settings.get/set(key)` where key = `aquarium_{widgetId}`
- State is a JSON object (see Save Data Model below)
- **Never persist derived values** — compute from catalog at runtime

## Save Data Model

### Persisted State Shape

```typescript
type Save = {
  version: number;                    // save schema version
  widgetInstanceId: string;
  activeTankId: TankId;
  tanks: Record<TankId, TankSave>;
  lifetime: { coinsEarned: number };
  meta: { createdAt: number; lastSavedAt: number; lastCatalogVersion?: string };
};

// Currently ships with three biomes; designed for expansion
type TankId = "fresh" | "tropical" | "salt";

type TankSave = {
  id: string;
  unlocked: boolean;
  coins: number;                      // PER-TANK currency
  cleanliness: number;                // 0..100
  lastSeenAt: number;
  foodStock: Record<string, number>;  // PER-TANK food
  toolsOwned: Record<string, number>;
  fish: FishSave[];
  decor: DecorSave[];
};

type FishSave = {
  id: string; speciesId: string;
  bornAt: number; level: number; xp: number;
  hunger: number; health: number; weak: boolean;
  lastFedAt?: number; lastPlayedAt?: number;
};

type DecorSave = {
  id: string; decorId: string;
  x: number; y: number; size: number;
  placedAt: number; state?: { lastSpreadAt?: number };
};
```

### Critical: What Is NOT Persisted

These are computed at runtime from catalog + save:
- Happiness score (from hunger + cleanliness + tool/decor requirements)
- Coin generation rate (from happiness + level + species)
- Fish life stage (from bornAt vs now)
- Tank space usage (sum of fish spaceCosts)
- Effective dirt rate (from fish count + tools)

This ensures **balance changes take effect immediately** without save migration.

## Catalog System

The catalog is a static object in `api.js` defining all content and balance.

### Key Types

```typescript
type FishSpecies = {
  name: string;                       // display name
  basePrice: number; baseCoinPerHour: number;
  hungerRate: number; spaceCost: number; // 0.5 for schooling fish
  maxPerTank?: number;
  diet: { accepts: FoodId[] };        // foods this fish eats; all others ignored
  requirements?: { decor?; tools?; plantMass?; floatingPlants? };
  preferences?: {
    nearDecor?;                       // decor type this fish claims as territory
    zonePreference?;
    schooling?: boolean;              // leader-following groups, 0.5 space
    movementType?: 'default' | 'crawl' | 'glass' | 'snake';  // movement behavior
  };
  visuals: { spriteKey; sizeVarianceRange };
};

type ToolItem = {
  name: string; prices: number[]; maxLevel: number;
  effect: Record<string, any>;
  negativeIfMissing?: { penalty: number; label: string };  // penalty when NOT owned
};
```

### Diet System

Each fish has a simple `diet.accepts` array listing the food IDs it will eat. When food particles are present:
- Fish evaluates nearby particles
- Only targets food in its `accepts` list — everything else is ignored
- No negative effects from non-accepted food, just no interest
- All accepted foods give their standard `hungerRestore` and `xp` values

### Adding New Content

When adding a new fish/decor/tool/food:

1. Add it to the catalog under the appropriate tank's `content`
2. Add it to the tank's `store.sections[].order` array
3. Add sprite data to the client pixel art lookup
4. Add translations to `locales/en.json` and `locales/nl.json`
5. Update sandbox mocks if needed
6. **Never rename existing IDs** — add to `aliases` instead

### Adding a New Tank Biome

The tank system is designed for expansion. To add a new biome:

1. Add a new `TankCatalog` entry in the catalog's `tanks` record
2. Define its content (fish, food, decor, tools), unlock rules, and visuals
3. The save system automatically creates a default locked tank slot for any catalog tank not in the save
4. Add sprite/visual assets for new species and biome theme on the client
5. No structural code changes needed in game logic

### ID Aliasing Rules

```javascript
aliases: {
  fish: { "old_id": "new_id" },
  decor: { "plant_fern": "fern" }
}
```

On every load, all save IDs pass through the alias map. Unknown IDs (not in catalog, not in aliases) become "legacy" entities with fallback behavior.

## Tank Biomes

The game currently ships with three biomes, designed with room for future expansion.

| Tank | ID | Unlock | Capacity | Key Content |
|---|---|---|---|---|
| Fresh Starter | `fresh` | Free | 8 | Guppy, Goldfish, Snail, Hornwort, Treasure Chest |
| Tropical Planted | `tropical` | 500 lifetime coins | 14 | Neon Tetra, Discus, Gourami, Heater/Filter required |
| Saltwater Reef | `salt` | 2000 lifetime + Heater | 20 | Clownfish, Blue Tang, Chromis, Firefish, Gramma, Banggai, Moray Eel, Cleaner Shrimp. Filter/Skimmer/UV Sterilizer required |

Each tank has **independent** coins, food stock, cleanliness, fish, and decor.

### Saltwater Tools — Negative Impact

The salt tank has three required tools: Filter, Protein Skimmer, and UV Sterilizer. The UV Sterilizer is notable because **not owning it causes a -20 happiness penalty to ALL salt fish** — representing poor water quality from harmful pathogens. This makes it a high-priority early purchase.

## Simulation Engine

### Idle Catch-Up

On every GET request:
```
dt = min(now - tank.lastSeenAt, 168 hours)  // cap at 7 days
1. Dirt accumulation: cleanliness -= dirtyRate × dt
2. Auto-feeder cycles: floor(dt / interval), spend food, feed hungriest
3. Per-fish: hunger decay, weak state check, health regen, coin generation
4. Plant growth: size += growthRate × dt (clamped)
5. Floating plant spread: deterministic roll per day
```

### Happiness Formula

```
happiness = 100
  + hungerContribution(hunger)      // 0 to -60
  + cleanlinessContribution(clean)  // 0 to -60
  - sum(missingRequirementPenalties)// per fish species (decor + tools)
  + sum(preferredDecorBonuses)      // small
```

Clamped 0–100. Happiness directly scales coin generation:
- 80-100: 100%
- 60-79: 70%
- 40-59: 40%
- 20-39: 15%
- 0-19: 0% (fish enters Weak state)

### Weak State

- **Entry:** hunger ≤ 10 (for 2h+), health ≤ 15, or happiness < 20 (for 1h+)
- **Effects:** zero coins, sad visuals, desaturated colors
- **Recovery:** hunger ≥ 35 AND cleanliness ≥ 30 AND required decor/tools present
- **Fish NEVER die permanently**

## Tool Modes

### Cleaning

The most complex tool. Key rules:

1. **Stable mask:** Generate a 64×48 cell grid seeded deterministically. Does NOT re-randomize per stroke.
2. **Above substrate only:** Dirt is only rendered and wipeable above the substrate line (`subY = H * (1 - biome.subH)`). Both `renderDirtOverlay` and `initCleanMask` use the same seed (`activeTankId.length * 1000 + 7`).
3. **Eraser-like wipe:** Pointer stroke maps to grid cells, brush radius clears cells. Wipe ignores touches below substrate.
4. **Proportional reward:** `coins = floor((dirtyStart - dirtyEnd) × coinsPer100Dirt)`
5. **Auto-complete:** Exit when remaining dirt ≤ epsilon.
6. **Fish always visible:** Grime overlay is a SEPARATE layer above fish, never replaces the tank view.

### Feeding

1. Tap spawns food particle at position
2. Particle has sink behavior: float / slowSink / sink
3. Hungry fish (hunger < 70) get speed boost toward accepted food
4. On contact: hunger restore + XP
5. Fish ignore food not in their `diet.accepts` array — no negative effects, just no interest

### Play (Laser Pointer)

1. Red dot follows pointer
2. Fish chase with species-specific patterns
3. Reward: 50 coins + XP, on 6-hour cooldown

## Economy

### Currency Sources
- Fish passive coins (happiness × level × lifeStage, per hour)
- Cleaning rewards (proportional to dirt removed)
- Play rewards (small, on cooldown)

### Price Growth
```
fishPrice = basePrice × growthFactor ^ ownedCountOfSpecies
```

### Selling
- Fish: 25-40% return (low, discourages churn)
- Decor: 35% return (configurable per item)
- Tools: not sellable
- Food: not sellable

## Rendering Layers (Bottom to Top)

1. Water gradient (3-stop, biome-specific) → 2. Glass frame (animated shimmer + reflections) → 3. Back silhouettes → 3.5. Light rays (7 animated) → 4. Caustic light (12 animated ellipses) → 5. Substrate (120 varied pebbles + 2-line highlight + depth fog) →
6. Rock clusters → 7. **Back decor layer** (every 3rd item, 55% opacity — behind fish for depth) → 8. Equipment (pixel art sprites from ICON_DATA + level dots) → 9. Fish (FISH_BASE_SCALES applied) → 10. Movement-type sprites (crawl/glass/snake) → 10.5. **Front decor layer** (remaining items, full opacity — in front of fish for depth) →
11. Food particles → 12. Bubbles → 13. Ambient particles → 14. Dirt overlay (seeded cells + edge film, **above substrate only**, visible when cleanliness < 95%) →
15. Laser dot → 16. Float text → 17. Fish bubble (stats pills, earning info, traits, sell button) → 18. HUD (pixel art icons) →
19. Tool dock → 20. Toast → 21. Menu (pixel art icons) → 22. Panels

Fish pixel art uses palette indices (0=transparent, 1=body, 2=tail/fin, 3=highlight, 4=dark/eye) mapped to species colors at draw time.

### Pixel Icon System

All UI icons use a unified pixel art system (`ICON_DATA`) instead of emoji:
- `renderPixelIcon(name, size)` renders to canvas, returns data URI
- `iconCache` prevents recomputation
- `iconImg(name, size)` returns `<img>` HTML string for panel templates
- `initPixelIcons()` scans `[data-icon]` elements and replaces with pixel art
- Available icons: coin, broom, food, fish, store, wrench, clipboard, house, help, laser, close, menu, lock, arrow_l, arrow_r, plant, decor, heater, filter, skimmer, uv

## Backwards Compatibility

### Migration Pipeline

```
load → migrateSave(save) → reconcileSaveWithCatalog(save, catalog) → simulate → persist
```

### Reconciliation Steps
1. Map all IDs through aliases
2. Unknown IDs → legacy entities (fallback sprite/behavior)
3. Clamp tool levels to new maxLevel
4. Clamp decor sizes to new min/max
5. New requirements apply penalties, never delete fish
6. New tanks in catalog create default locked tank slots in save

### Golden Rules
1. **Never rename IDs without aliases**
2. **Keep simulation rules stable** — change catalog balance numbers only
3. **Never persist derived values** — compute from catalog at runtime
4. **New requirements don't break saves** — they add penalties, not deletions
5. **New content is additive** — old saves just don't have it yet
6. **New tanks are additive** — save system auto-creates slots

## Code Maintenance & Quality

### Code Organization

Organize both `api.js` and `index.html` into clearly separated logical sections using comment banners (see spec §25 for full details). Key sections in api.js:
- CATALOG — content and balance data
- SIMULATION ENGINE — idle catch-up logic
- ECONOMY — price calculations, validation
- ACTION HANDLERS — POST action dispatch
- MIGRATION & RECONCILIATION
- HELPERS — utility functions

### Pure Functions First

Keep game logic in **pure functions** wherever possible. Pure functions (deterministic, no side effects) are the easiest to test and reason about.

### State Mutation Rules

- State is **only** mutated inside action handlers (after validation)
- Every mutation must be followed by persist before returning
- Never mutate catalog data
- Never mutate state on the client side

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Catalog IDs | `snake_case` | `neon_tetra`, `basic_flakes` |
| JS variables / functions | `camelCase` | `baseCoinPerHour`, `handleAction()` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_LEVEL`, `LASER_COOLDOWN_MS` |
| DOM IDs | `kebab-case` | `#coin-display`, `#store-panel` |
| Type names (in comments) | `PascalCase` | `FishSave`, `TankCatalog` |

### Testing Requirements

Every new feature MUST include:
1. Unit tests for any new pure function (simulation, economy, validation)
2. Updated sandbox mocks if the data model changes
3. E2E smoke test for any new UI element or interaction

Test patterns:
- Descriptive test names: `"fish enters weak state when hunger <= 10 for 2+ hours"`
- Boundary values: 0, max, just-above, just-below threshold
- Explicit timestamps in time-dependent tests (no `Date.now()`)
- Determinism checks for RNG-seeded systems (same inputs → same outputs)

### Performance Considerations

- `simulate()` runs on every GET — avoid O(n²) loops
- Batch canvas draw calls, minimize DOM updates
- Keep late-game saves under 5KB JSON

## Testing Requirements

### Unit Tests (Vitest)

Required test files and what they cover:

| Test Area | Must Verify |
|---|---|
| Simulation | Hunger decay, dirt accumulation, weak state, coin generation, 168h cap |
| Economy | Price curves, buy validation (space/coins/caps), sell returns |
| Migration | Save version upgrades, missing fields, null handling |
| Reconciliation | Alias mapping, unknown IDs, size/level clamping, new tank slot creation |
| Plant growth | Growth over time, min/max bounds, trim reducing size |
| Floating spread | Determinism (same seed = same result), max clusters cap |
| Cleaning mask | Deterministic generation, wipe algorithm, proportional rewards |

### E2E Tests (Playwright)

Four test files:
- `tests/e2e/games.spec.ts` (60 tests) — Core smoke tests: widget loads, HUD, menu, panels, tool modes, scenarios
- `tests/e2e/games-advanced.spec.ts` (57 tests) — Advanced: pixel icons, store purchasing, tank nav, scenario persistence, decor/fish sell, equipment upgrades, dirty tank visuals
- `tests/e2e/games-features.spec.ts` (50 tests) — v1.2 features: zero-fish tanks, half-space schooling, movement types, fish info panel, cleaning improvements, floating plants, new scenarios, visual rendering, inventory sell flow
- `tests/e2e/games-design.spec.ts` (45 tests) — v1.3 design overhaul: fish size differentiation, layered decor rendering, territorial fish behavior, plant trim & move, visual rendering stability, decor store integration, tank navigation, long-running stability

Page object at `tests/pages/GamesPage.ts`.

Must verify: widget loads, HUD visible, menu works, panels render, tool modes activate, fish tappable, store functional, pixel icons render, scenario state persists across actions.

### Sandbox Mocks

Located at `apps/sandbox/src/lib/mocks/aquariumMocks.js`. Contains:
- `createScenarioState(scenarioId)` — 19 full state generators (default, tier-2-ready, tier-2-active, tier-3-endgame, neglected-48h, low-food, dirty-near-threshold, dirty-big-tank, rich, tank-full, tier-3-crowded, multi-tank-decorated, empty-tank, movement-showcase, schooling-showcase, floating-decor, territorial-showcase, lush-planted, size-showcase)
- `applyDebugScenario(save, scenario)` — 12 mutation actions
- `handleAquariumApi()` — Main handler with `_lastScenarioId` tracking
- `resetAquariumScenario(scenarioId)` — Skips reset when same scenario already loaded (prevents React useEffect double-fire)

**Critical pattern:** POST requests always use `loadPersistedState()` to avoid recreating state on every action. Only GET requests with changed scenarioId trigger `createScenarioState()`.

## Widget Platform Constraints

| Constraint | Implementation |
|---|---|
| Aspect ratio | `"height": "75%"` in widget.compose.json → 4:3 |
| No build step | Single `index.html` with inline CSS/JS |
| State storage | `homey.settings.get/set()` keyed by widget instance ID |
| API routes | Defined in `widget.compose.json.api`, implemented in `api.js` |
| Styling | Homey CSS variables `--homey-*` and classes `.homey-*` for native look |
| Instance ID | `Homey.getWidgetInstanceId()` — async, may return a Promise |
| Height | Pick ONE method: `widget.compose.json` percentage OR runtime `Homey.setHeight()`. Never both. |

## Fish Movement System

Fish have species-dependent movement controlled by `movementType` in catalog preferences:

| movementType | Speed | Behavior | Species |
|---|---|---|---|
| `default` | 1× | Normal zone-based swimming | Guppy, Goldfish, Blue-Eye, Moon Fish, Discus, Gourami, Clownfish, Blue Tang, Firefish, Royal Gramma |
| `crawl` | 0.25× | Bottom-hugging, clamped to substrate | Snail, Cleaner Shrimp |
| `glass` | 0.4× | Wall-crawling, rendered vertically (head-up), 12% side-switch | Pleco |
| `snake` | 0.5× | Serpentine undulation, bottom zone | Moray Eel |
| `school` (schooling=true) | 1× | Leader-following: first fish leads, others follow with index-based offsets + sinusoidal variation | Neon Tetra, Green Chromis, Banggai Cardinalfish |

**Half-space fish:** Schooling species cost 0.5 space instead of 1. The `getUsedSpace()` function naturally sums half-space values.

**Zero-fish tanks:** Selling the last fish is allowed. Tanks can be empty and still render normally.

**Fish interaction:** Tap → wiggle in place (2s) → info bubble with stats pills, earning info, traits, sell button → auto-dismiss after 8s.

**Decor interaction:** Drag-to-move non-floating decor in normal mode. Floating plants drift autonomously with sinusoidal animation. Tap decor to open Decor Card popup (name, size, actions: Trim/Move/Sell).

## Territorial Fish Behavior

Fish with `nearDecor` preference defend their claimed decor zone:

| Species | Claims | Behavior |
|---|---|---|
| `clownfish` | `anemone` | Anemone defense |
| `moray_eel` | `cave` | Cave lurking, dashes at intruders |
| `firefish` | `brain_coral` | Coral territory |
| `royal_gramma` | `cave` | Cave entrance defense |

**Implementation:**
1. Each frame builds `claimedDecorZones` — map of decor positions to owner fish
2. Owner fish "claims" a zone radius around their preferred decor (decorSize × 0.15 normalized)
3. Trespassers entering a claimed zone get `dashSpeed = 3.0` (flee)
4. Owners dash toward trespassers with `dashSpeed = 2.5`
5. `dashSpeed` decays: `dashSpeed *= (1 - dt * 2)` — burst-then-slow
6. Speed integration: `baseSpd *= (1 + dashSpeed)`
7. Same-species fish are not chased

This creates emergent behavior: fish naturally spread out to avoid territorial zones.

## Fish Size Design

Fish sprites use dramatically different dimensions and FISH_BASE_SCALES to create visual size hierarchy:

| Category | Scale Range | Sprite Size | Species |
|---|---|---|---|
| Tiny | 0.65-0.75 | 8×4 to 8×6 | Neon Tetra, Green Chromis, Snail, Shrimp |
| Small | 0.85 | 10×6 to 10×8 | Guppy, Blue-Eye, Banggai Cardinal |
| Medium | 1.0-1.2 | 12×6 to 14×4 | Firefish, Royal Gramma, Clownfish, Cleaner Shrimp |
| Large | 1.3-1.8 | 14×10 to 18×12 | Gourami, Goldfish, Moon Fish, Pleco, Blue Tang |
| Very Large | 2.0-2.8 | 16×14 to 28×5 | Discus, Moray Eel |

**Design principles:**
- Tiny schooling fish (0.65 scale) look natural in groups of 10+
- Large fish (1.8+ scale) visually dominate the tank
- Each sprite has a distinctive shape: moon fish is tall/round, moray is long/thin, discus is disc-shaped
- Scale multiplier amplifies the sprite dimension differences

## Layered Decoration Rendering

Decorations are split into two render layers for depth:

1. **`renderDecorBack(decors, biomeKey)`** — Every 3rd decor item rendered at 55% opacity **before fish** (fish swim in front)
2. **`renderDecorFront(decors, biomeKey)`** — Remaining decor items at full opacity **after fish** (fish swim behind)
3. **`drawDecorItem(d, def, color, x, baseSize, subY, biomeKey, isBack)`** — Shared rendering with `isBack` controlling opacity

**Game loop order:** environment → decorBack → equipment → fish → decorFront → food → bubbles → laser → dirt

**Enhanced decor rendering:**
- Floating plants: 4-6 lily pads with leaf veins, dangling roots
- Plants: 2-3 stems with 6-11 leaves on quadratic Bézier curves, 2.5× height
- Rocks: 4-5 boulders with drop shadows
- Coral/Anemone: 5-8 animated swaying branches with sub-branches
- Cave: Dark arch with interior shading and rim highlights
- Driftwood: Gnarled shape with wood grain texture and moss patches

## Common Patterns

### Action Handler Pattern (api.js)

```javascript
case 'buy_fish': {
  const { speciesId } = payload;
  const species = catalog.tanks[tid].content.fish[speciesId];
  if (!species) return { error: 'Unknown species' };
  const usedSpace = tank.fish.reduce((s, f) => s + catalogSpecies(f).spaceCost, 0);
  if (usedSpace + species.spaceCost > tankCat.capacity.spaceCapacity)
    return { error: `Tank full (${usedSpace}/${cap})` };
  const price = getPrice(speciesId, tank);
  if (tank.coins < price) return { error: 'Not enough coins' };
  tank.coins -= price;
  tank.fish.push(createFish(speciesId));
  return { fish: tank.fish[tank.fish.length - 1] };
}
```

### Client State Application Pattern

```javascript
function applyState(data) {
  gameState = data.state;
  storeCatalog = data.storeCatalog;
  tankInfo = data.tankInfo;
  // Re-initialize renderer for current tank
  initEnvironment();
  syncFishSprites();
  updateHUD();
}
```

### Deterministic RNG Pattern

```javascript
function seededRng(seed) {
  let s = seed;
  return function() {
    s = (s * 16807 + 0) % 2147483647;
    return (s & 0x7fffffff) / 2147483647;
  };
}
// Usage: const rng = seededRng(hash(tankId + dayIndex));
```

## Checklist Before Submitting Changes

- [ ] Game logic changes are in `api.js` (not client)
- [ ] No derived values persisted in save
- [ ] New IDs don't conflict with existing ones
- [ ] Catalog aliases updated if any IDs were renamed
- [ ] Translations added to both `en.json` and `nl.json`
- [ ] Sandbox mocks updated if data model changed
- [ ] Unit tests written and passing for affected systems
- [ ] E2E tests pass (`npx playwright test tests/e2e/games.spec.ts tests/e2e/games-advanced.spec.ts tests/e2e/games-features.spec.ts tests/e2e/games-design.spec.ts`)
- [ ] Widget renders correctly in sandbox (`pnpm run dev` from root)
- [ ] Fish layer remains visible during clean mode
- [ ] Happiness penalties are clearly shown in fish details
- [ ] No `console.log` left in production paths
