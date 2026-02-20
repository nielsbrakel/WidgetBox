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
- Debugging save/load or catalog reconciliation issues
- Writing unit tests (Vitest) or E2E tests (Playwright) for game systems
- Modifying the renderer or visual layers
- Updating the sandbox mock scenarios

## Project Layout

```
apps/com.nielsvanbrakel.widgetbox-games/
├── app.js                          # Homey App entry (minimal)
├── app.json                        # Generated from .homeycompose/app.json
├── .homeycompose/app.json          # Source of truth for app metadata
├── package.json                    # Scripts: homey:run, homey:install, homey:build
├── AQUARIUM_SPEC.md             # Full game specification
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
tests/e2e/games-design.spec.ts                 # v1.3 design overhaul E2E tests (56 tests)
tests/e2e/games-v2.spec.ts                     # v2 visual overhaul E2E tests (40+ tests)
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
  version: number;                    // save schema version (currently 1)
  widgetInstanceId: string;
  activeTankId: TankId;
  tanks: Record<TankId, TankSave>;
  coins: number;                      // GLOBAL currency (shared across all tanks)
  lifetime: { coinsEarned: number };
  meta: { createdAt: number; lastSavedAt: number; lastCatalogVersion?: string };
};

// Currently ships with three biomes; designed for expansion
type TankId = "fresh" | "tropical" | "salt";

type TankSave = {
  id: string;
  unlocked: boolean;
  // Coins are global (save.coins)
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
| Fresh Starter | `fresh` | Free | 8 | Guppy, Goldfish, Snail, Hornwort, Vallisneria, Anubias, Treasure Chest, Sunken Ship, Driftwood (spider wood) |
| Tropical Planted | `tropical` | 1500 lifetime coins | 14 | Neon Tetra, Discus, Gourami, Cryptocoryne, Ludwigia, Heater/Filter required |
| Saltwater Reef | `salt` | 5000 lifetime + Heater | 20 | Clownfish, Blue Tang, Chromis, Firefish, Gramma, Banggai, Moray Eel, Cleaner Shrimp. Filter/Skimmer/UV Sterilizer required |

Each tank has **independent** food stock, cleanliness, fish, and decor. **Coins are global** (shared across all tanks).

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
3. Reward: 25 coins + 5 XP per fish, on 6-hour cooldown

## Economy

### Currency Sources
- Fish passive coins (happiness × level × lifeStage, per hour)
- Cleaning rewards (coinsPer100Dirt = 5, proportional to dirt removed)
- Play rewards (25 coins + 5 XP per fish, 6-hour cooldown)

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

1. Water gradient (3-stop, biome-specific) → 2. Glass frame (animated shimmer + reflections) → 3. Back silhouettes → 3.5. Light rays (7 animated, 95% tank height) → 3.6. Animated water surface (sine wave at y=5, amplitude 2.2+1.0, shimmer) → 4. Caustic light (12 animated ellipses) → 5. Substrate (120 varied pebbles + 2-line highlight + depth fog) →
6. Rock clusters → 7. **Back decor layer** (every 3rd item, 55% opacity — behind fish for depth) → 8. Equipment (on right wall, vertically centered, with mounting plate + filter bubbles) → 9. Fish (FISH_BASE_SCALES applied) → 10. Movement-type sprites (crawl/glass/snake) → 10.5. **Front decor layer** (remaining items, full opacity — in front of fish for depth) →
11. Food particles → 12. Bubbles → 13. Ambient particles → 14. Dirt overlay (seeded cells + edge film, **above substrate only**, visible when cleanliness < 95%) →
15. Laser dot → 16. Float text → 17. Fish bubble (stats pills, earning info, traits, sell button — clamped to widget bounds) → 18. HUD (pixel art icons, fades during cleaning with hud-muted class) →
19. Tool dock → 20. Toast → 21. Menu (flat 7-button grid: Feed/Clean/Play/Store/Inventory/Tanks/Help, no sub-menus) → 22. Panels

Fish pixel art uses palette indices (0=transparent, 1=body, 2=tail/fin, 3=highlight, 4=dark/eye) mapped to species colors at draw time.

### Pixel Icon System

All UI icons use a unified pixel art system (`ICON_DATA`) instead of emoji:
- `renderPixelIcon(name, size)` renders to canvas, returns data URI
- `iconCache` prevents recomputation
- `iconImg(name, size)` returns `<img>` HTML string for panel templates
- `initPixelIcons()` scans `[data-icon]` elements and replaces with pixel art
- Available icons: coin, broom, food, fish, store, wrench, clipboard, house, help, laser, close, menu, lock, arrow_l, arrow_r, plant, decor, heater, filter, skimmer, uv

### FAB Button

The FAB uses 3 `<span class="fab-line">` elements that animate via CSS transforms:
- Default: 3 horizontal lines (hamburger)
- `.open` state: top rotates 45°, middle fades out, bottom rotates -45° (X shape)
- Pure CSS animation, no image assets

## Backwards Compatibility

### Reconciliation Pipeline

```
load → reconcileSaveWithCatalog(save, catalog) → simulate → persist
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
- RECONCILIATION
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

## Testing

> Full testing strategy: AQUARIUM_SPEC.md §26

### E2E Tests (Playwright — 260+ tests)

| File | Count | Coverage |
|---|---|---|
| `games.spec.ts` | 60 | Core: widget load, HUD, menu, panels, tool modes, scenarios |
| `games-advanced.spec.ts` | 57 | Pixel icons, store purchasing, tank nav, state persistence, sell flows |
| `games-features.spec.ts` | 50 | Zero-fish, half-space, movement types, fish info, cleaning, floating plants |
| `games-design.spec.ts` | 56 | Fish sizes, layered decor, territorial, trim/move, full-grown, FAB animation |
| `games-v2.spec.ts` | 40+ | v2 visual overhaul: sunken ship, blue-eye half-space, store icons, equipment + filter bubbles, spider wood, panel close → menu, debug tools, treasure chest |

Page object: `tests/pages/GamesPage.ts`

```bash
# Run all aquarium E2E tests
npx playwright test tests/e2e/games.spec.ts tests/e2e/games-advanced.spec.ts tests/e2e/games-features.spec.ts tests/e2e/games-design.spec.ts tests/e2e/games-v2.spec.ts
```

### Sandbox Mocks

`apps/sandbox/src/lib/mocks/aquariumMocks.js`:
- `createScenarioState(scenarioId)` — 22 state generators
- `applyDebugScenario(save, scenario)` — 12 mutations + 3 full-grown scenarios
- `handleAquariumApi()` — Main handler with `_lastScenarioId` tracking
- Mock storage key: `mock_aquarium_state_v1`

**Critical:** POST requests use `loadPersistedState()` to avoid recreating state on every action. Only GET with changed scenarioId triggers `createScenarioState()`.

## Widget Platform Constraints

> Full details: AQUARIUM_SPEC.md §2

Key constraints: single `index.html` (no build step), `Homey.getWidgetInstanceId()` → async, `homey.settings.get/set()` for persistence, `"height": "75%"` for 4:3 ratio (never also call `Homey.setHeight()`), Homey CSS variables `--homey-*` for native look.

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

**Fish interaction:** Tap → wiggle persists while bubble is open → info bubble with stats pills, earning info, traits, sell button → auto-dismiss after 8s.

**Decor interaction:** Tap to open Decor Card popup (name, size, actions: Trim/Move/Sell). Move button activates drag mode for repositioning. Floating plants drift autonomously with sinusoidal animation.

## Territorial Fish Behavior

Fish with `nearDecor` preference defend their claimed decor zone with tight swim radius:

| Species | Claims | Behavior |
|---|---|---|
| `clownfish` | `anemone` | Anemone defense, reduced opacity when nesting (simulates hiding in tentacles) |
| `moray_eel` | `cave` | Cave lurking, partially hidden (front 40% visible via canvas clipping), dashes at intruders |
| `firefish` | `brain_coral` | Coral territory |
| `royal_gramma` | `cave` | Cave entrance defense |

**Implementation:**
1. Each frame builds `claimedDecorZones` — map of decor positions to owner fish
2. Owner fish "claims" a zone radius around their preferred decor (territorial zone: moray 0.05, clownfish 0.07, default 0.09)
3. Trespassers entering a claimed zone (detection radius 0.10) get `dashSpeed = 3.0` (flee)
4. Owners dash toward trespassers with `dashSpeed = 2.5`
5. Swim radius: moray 0.04, clownfish 0.06 (tight orbits around claimed decor)
5. `dashSpeed` decays: `dashSpeed *= (1 - dt * 2)` — burst-then-slow
6. Speed integration: `baseSpd *= (1 + dashSpeed)`
7. Same-species fish are not chased

This creates emergent behavior: fish naturally spread out to avoid territorial zones.

## Fish Size Design

> Full details: AQUARIUM_SPEC.md §19.3

Fish use `FISH_BASE_SCALES` to create visual size hierarchy from tiny (0.65, schooling) to very large (3.0, moray). Each sprite has a distinctive shape with enlarged dimensions for better recognition (goldfish 14×10, discus 20×16, moray 32×3). Scale multiplier amplifies dimension differences.

## Layered Decoration Rendering

> Full details: AQUARIUM_SPEC.md §19

Decorations split into two render layers for depth. **Game loop order:** environment → decorBack → equipment → fish → decorFront → food → bubbles → laser → dirt.

- `renderDecorBack()` — Every 3rd decor at 55% opacity (behind fish)
- `renderDecorFront()` — Remaining decor at full opacity (in front of fish)
- `drawDecorItem()` — Shared rendering, `isBack` controls opacity

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
