# Aquarium Widget — Full Feature Specification

**App:** `com.nielsvanbrakel.widgetbox-games` (Homey WidgetBox)
**Widget:** `aquarium`
**Spec version:** 1.2.0
**Last updated:** 2025-07-18

> See [docs/changelog/](docs/changelog/) for a history of spec changes between versions.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Platform Constraints](#2-platform-constraints)
3. [Core Design Principles](#3-core-design-principles)
4. [Architecture Overview](#4-architecture-overview)
5. [Save Data Model](#5-save-data-model)
6. [Catalog System](#6-catalog-system)
7. [Tanks & Biomes](#7-tanks--biomes)
8. [Fish System](#8-fish-system)
9. [Happiness & Penalties](#9-happiness--penalties)
10. [Weak State (No Permanent Death)](#10-weak-state-no-permanent-death)
11. [Decor System](#11-decor-system)
12. [Plant Growth & Multiplication](#12-plant-growth--multiplication)
13. [Tool Modes](#13-tool-modes)
14. [Cleaning System](#14-cleaning-system)
15. [Feeding System](#15-feeding-system)
16. [Play Mode (Laser Pointer)](#16-play-mode-laser-pointer)
17. [Store & Economy](#17-store--economy)
18. [Progression & Unlocks](#18-progression--unlocks)
19. [Rendering & Visual Layers](#19-rendering--visual-layers)
20. [HUD & Menu System](#20-hud--menu-system)
21. [Help System](#21-help-system)
22. [Debug & Development](#22-debug--development)
23. [Backwards Compatibility & Migration](#23-backwards-compatibility--migration)
24. [Game Lifecycle Events](#24-game-lifecycle-events)
25. [Code Maintenance & Quality](#25-code-maintenance--quality)
26. [Implementation Backlog](#26-implementation-backlog)
27. [Testing Strategy](#27-testing-strategy)

---

## 1. Executive Summary

The Aquarium widget is a cozy idle game embedded as a Homey Pro dashboard widget. Players maintain one of several tank biomes (currently Fresh, Tropical, and Saltwater), each with unique fish species, plants, decor, and tool requirements. The game emphasizes low interaction (1–2 checks/day), visual charm (full-bleed pixel-art aquarium), and forgiving mechanics (fish never die permanently).

**Core features:**
- Multiple themed biomes with unique content catalogs, designed for future expansion
- Full decor placement system with x/y positioning and growth mechanics
- Happiness system with visible penalty breakdowns (required decor, tools)
- Deterministic cleaning with wipe-mask grid
- Modular catalog with versioning and ID aliasing for long-running saves
- State persisted server-side per widget instance
- Coins and food stock are **per-tank** (not shared globally)

---

## 2. Platform Constraints

These are hard constraints from the Homey Widget SDK that shape every design decision.

| Constraint | Decision |
|---|---|
| Widgets are standard HTML/CSS/JS pages | Single `index.html` with inline CSS/JS (no build step for widget itself) |
| Widget instance ID via `Homey.getWidgetInstanceId()` | All persistence keyed by this ID |
| State via widget-scoped API endpoints (`widget.compose.json` + `api.js`) | Server-side `api.js` handles all game logic; client is a renderer |
| `height` in `widget.compose.json` percentage = aspect ratio | Set `"height": "75%"` for 4:3 ratio. **Do not** also call `Homey.setHeight()` — pick one to avoid layout shifts |
| Homey CSS variables (`--homey-*`, `.homey-*`) available | Use for text, tooltips, menu chrome to look native |
| No npm packages in widget `public/` | All code inlined or vanilla JS |
| Settings via `widget.compose.json` `settings` array | Keep `reset_state` checkbox; consider adding `debug_mode` for dev |

### API Endpoint Design (widget.compose.json)

```json
{
  "api": {
    "getState": { "method": "GET", "path": "/" },
    "doAction": { "method": "POST", "path": "/" }
  }
}
```

- **GET `/`** — Load + simulate (catch up idle time) + return full state + catalog snapshot
- **POST `/`** — Receive `{ type, payload }` action, mutate state, return updated state

All game logic lives in `api.js`. The client (`index.html`) is a **dumb renderer** — it sends actions and draws the response.

---

## 3. Core Design Principles

1. **Cozy & forgiving** — Fish never die permanently. Neglect causes weakness (reversible), not loss.
2. **Low interaction** — 1–2 checks per day is optimal. Idle progress while away.
3. **Identity** — Each fish has a species and visible personality. Always identifiable by its species traits.
4. **Progression** — Exponential-ish saving curve for unlocks without becoming grindy.
5. **Modular & expandable** — New fish, decor, tools, tanks, and biomes can be added without breaking existing saves. The system is designed for future content expansion.
6. **Server-authoritative** — All mutations happen in `api.js`. Client never directly modifies state.
7. **Test-driven core** — Simulation, economy, migration, and cleaning must have unit tests.

---

## 4. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Widget Client (public/index.html)                      │
│  ┌─────────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Renderer     │  │ Input    │  │ HUD / Menu / Panels│  │
│  │ (Canvas 2D)  │  │ Handler  │  │ (DOM overlay)     │  │
│  └──────┬───────┘  └────┬─────┘  └────────┬──────────┘  │
│         │               │                  │             │
│         └───────────────┼──────────────────┘             │
│                         │                                │
│              Homey.api('GET'|'POST', ...)                │
└─────────────────────────┼────────────────────────────────┘
                          │
┌─────────────────────────┼────────────────────────────────┐
│  Widget API (api.js)    │                                │
│  ┌──────────────────────▼─────────────────────────────┐  │
│  │ Action Router (handleAction)                       │  │
│  │ ┌────────────┐ ┌──────────┐ ┌───────────────────┐ │  │
│  │ │ Simulation  │ │ Economy  │ │ Catalog            │ │  │
│  │ │ Engine      │ │ Engine   │ │ Reconciler         │ │  │
│  │ └──────┬──────┘ └────┬────┘ └────────┬───────────┘ │  │
│  │        │              │               │             │  │
│  │        └──────────────┼───────────────┘             │  │
│  │                       │                             │  │
│  │           homey.settings.get/set(key)               │  │
│  └───────────────────────┼─────────────────────────────┘  │
└──────────────────────────┼────────────────────────────────┘
                           │
                   Homey Settings Store
                   (keyed by widget instance ID)
```

### Module Responsibilities

| Module | Responsibility |
|---|---|
| **Simulation Engine** | Advance time: hunger decay, dirt accumulation, coin generation, weak state transitions, plant growth, auto-feeder cycles |
| **Economy Engine** | Price calculations, capacity checks, purchase validation, sell returns |
| **Catalog Reconciler** | On load: alias mapping, unknown ID handling, level/size clamping, new requirement application |
| **Action Router** | Dispatch `{ type, payload }` to handlers, return mutated state |
| **Renderer** | Draw layered tank view, animate fish/particles, overlay tools |
| **Input Handler** | Map taps/drags to game actions; mode-dependent (feed/clean/play/inspect) |

---

## 5. Save Data Model

### 5.1 Persisted State Shape

Only **player instance state** is persisted. Never persist derived/computed values (coin rates, happiness scores). These are computed from the catalog at runtime so balance updates take effect without save migration.

```typescript
type Save = {
  version: number;                    // save schema version
  widgetInstanceId: string;

  activeTankId: TankId;
  tanks: Record<TankId, TankSave>;

  lifetime: {
    coinsEarned: number;              // total coins ever earned across all tanks
  };

  meta: {
    createdAt: number;                // timestamp
    lastSavedAt: number;              // timestamp
    lastCatalogVersion?: string;      // track which catalog version was last reconciled
  };
};

// Currently ships with three biomes; designed for future expansion
type TankId = "fresh" | "tropical" | "salt";

type TankSave = {
  id: TankId;
  unlocked: boolean;

  coins: number;                      // per-tank currency
  cleanliness: number;                // 0..100
  lastSeenAt: number;                 // timestamp for idle simulation

  foodStock: Record<FoodId, number>;  // per-tank food inventory
  toolsOwned: Record<ToolId, number>; // tool level (0 = not owned, 1+ = level)

  fish: FishSave[];
  decor: DecorSave[];
};

type FishSave = {
  id: string;                         // unique instance ID (e.g. "f_1708300000_a1b2c3")
  speciesId: string;                  // stable catalog ID (e.g. "guppy")

  bornAt: number;                     // timestamp
  level: number;                      // 1..MAX_LEVEL
  xp: number;                        // current XP towards next level

  hunger: number;                     // 0..100 (100 = full)
  health: number;                     // 0..100
  weak: boolean;                      // true = zero income, sad visuals

  lastFedAt?: number;                 // timestamp
  lastPlayedAt?: number;              // timestamp
};

type DecorSave = {
  id: string;                         // unique instance ID
  decorId: string;                    // stable catalog ID (e.g. "hornwort")

  x: number;                          // normalized 0..1
  y: number;                          // normalized 0..1
  size: number;                       // 0.5..2.0 (current size, affected by growth)

  placedAt: number;                   // timestamp
  state?: {
    lastSpreadAt?: number;            // for floating plants: last multiplication time
  };
};
```

### 5.2 What Is NOT Persisted

These are computed at runtime from catalog + save:

- Happiness score (computed from hunger + cleanliness + decor requirements)
- Coin generation rate (computed from happiness + level + species)
- Fish life stage (computed from `bornAt` vs current time)
- Whether a fish has required decor met (checked against `decor[]` at runtime)
- Tank space usage (summed from fish spaceCosts at runtime)
- Effective dirt rate (computed from fish count + tools)

### 5.3 Initial State Factory

When a brand-new widget instance loads with no saved data:

```
activeTankId: "fresh"
tanks: {
  "fresh": {
    unlocked: true,
    coins: 50,
    cleanliness: 100,
    fish: [one guppy with full hunger],
    decor: [],
    foodStock: { "basic_flakes": 10 },
    toolsOwned: {}
  },
  "tropical": { unlocked: false, ... },
  "salt": { unlocked: false, ... }
}
lifetime: { coinsEarned: 0 }
```

---

## 6. Catalog System

The catalog defines **all content and balance parameters**. It is a static object in `api.js` (not persisted). This allows balance changes to take effect immediately for all players without migration.

### 6.1 Catalog Shape

```typescript
type Catalog = {
  schemaVersion: number;              // format version (breaking changes)
  contentVersion: string;             // balance/content version (e.g. "1.0.0")

  aliases?: {
    fish?: Record<string, string>;    // old ID → new ID
    decor?: Record<string, string>;
    tools?: Record<string, string>;
    food?: Record<string, string>;
  };

  global: {
    ui: {
      aspectRatio: "4:3";
      wipeMaskGrid: { w: number; h: number };  // e.g. 64×48
    };
    economy: {
      coinsPer100Dirt: number;        // coins earned for cleaning 100% dirt
      sellReturnDefault: number;      // e.g. 0.35 = 35% return
      priceGrowth: {
        fish: number;                 // e.g. 1.18 — multiplier per owned count
        decor: number;
        tools: number;
      };
    };
  };

  tanks: Record<TankId, TankCatalog>;
};

type TankCatalog = {
  id: TankId;
  name: string;                       // display name

  unlock: UnlockRule;
  capacity: {
    spaceCapacity: number;            // max total spaceCost of fish
  };

  simulation: {
    baseDirtyRatePerHour: number;
    dirtyPerSpacePerHour: number;     // scales with number of fish
    hungerRateMultiplier: number;     // global multiplier for this tank
  };

  visuals: {
    waterTint: string;                // hex color for gradient base
    substrate: "gravel" | "sand";
    themeKey: string;                 // for background silhouettes
  };

  content: {
    fish: Record<FishId, FishSpecies>;
    food: Record<FoodId, FoodItem>;
    decor: Record<DecorId, DecorItem>;
    tools: Record<ToolId, ToolItem>;
  };

  store: {
    sections: Array<{
      id: "fish" | "food" | "decor" | "tools";
      order: string[];                // ordered list of item IDs
    }>;
  };
};
```

### 6.2 Catalog Content Types

```typescript
type FishSpecies = {
  name: string;                       // display name
  basePrice: number;
  baseCoinPerHour: number;
  hungerRate: number;                 // hunger points lost per hour
  spaceCost: number;
  maxPerTank?: number;                // e.g. moray eel = 1

  diet: {
    accepts: FoodId[];                // foods this fish will eat; all others are ignored
  };

  requirements?: {
    decor?: Array<{
      decorId: string;                // e.g. "anemone"
      penalty: number;                // happiness penalty if missing (e.g. -40)
      label: string;                  // e.g. "Missing Anemone"
    }>;
    tools?: Array<{
      toolId: string;                 // tool ID required in tank
      penalty: number;                // happiness penalty if missing
      label: string;
    }>;
    plantMass?: {
      minTotal: number;               // sum of plant sizes needed
      penalty: number;                // penalty if not met
      label: string;
    };
    floatingPlants?: {
      minCount: number;
      penalty: number;
      label: string;
    };
  };

  preferences?: {
    nearDecor?: string;               // decorId to gravitate toward
    zonePreference?: "top" | "middle" | "bottom";
    schooling?: boolean;              // swims in leader-following groups, counts as 0.5 space
    movementType?: 'default' | 'crawl' | 'glass' | 'snake';  // movement behavior override
  };

  visuals: {
    spriteKey: string;                // key into pixel art lookup
    sizeVarianceRange: [number, number]; // e.g. [0.9, 1.1]
  };
};

type FoodItem = {
  name: string;
  price: number;                      // per unit
  hungerRestore: number;
  xp: number;
  sinkBehavior: "float" | "slowSink" | "sink";
};

type DecorItem = {
  name: string;
  price: number;
  sellReturn?: number;                // override global default
  placement: "bottom" | "mid" | "top" | "any";

  growth?: {
    growthRatePerHour: number;
    minSize: number;
    maxSize: number;
  };
  spread?: {                          // only for floating plants
    spreadChancePerDay: number;
    maxClusters: number;
    spawnRadius: number;
    spreadThreshold: number;          // min size before spreading
  };

  maxPerTank?: number;                // e.g. cave = 1
  visuals: {
    spriteKey: string;
  };
};

type ToolItem = {
  name: string;
  prices: number[];                   // price per level [level1, level2, ...]
  maxLevel: number;
  effect: Record<string, any>;        // tool-specific config
  negativeIfMissing?: {               // if set, this tool causes a penalty when not owned
    penalty: number;
    label: string;
  };
  visuals?: {
    spriteKey: string;
    placement: { x: number; y: number };
  };
};

type UnlockRule = {
  type: "free" | "lifetimeCoins" | "toolOwned" | "compound";
  value?: number;
  toolId?: string;
  rules?: UnlockRule[];               // for compound
  label: string;                      // human-readable requirement
};
```

### 6.3 ID Aliasing

When renaming or reorganizing catalog entries:

```javascript
aliases: {
  fish: {
    "goldfish": "goldfish",           // no change (optional, for clarity)
    "neon_tetra": "neon_tetra",
  },
  decor: {
    "plant_fern": "fern",            // old ID → new ID
    "plant_anubias": "anubias",
  }
}
```

**On load:** Before applying any game logic, run all save IDs through the alias map. Unknown IDs (not in catalog AND not in aliases) become "legacy" entities with fallback behavior/sprites.

---

## 7. Tanks & Biomes

The game currently ships with three tank biomes. The system is designed to support additional biomes in future updates — adding a new tank requires only a new entry in the catalog with its own content, unlock rules, and visuals. No structural code changes are needed.

### 7.1 Fresh Starter Tank

| Property | Value |
|---|---|
| **ID** | `fresh` |
| **Unlock** | Free (starting tank) |
| **Space capacity** | 8 |
| **Substrate** | Gravel (muted earth tones) |
| **Water tint** | Light blue-green `#a8d8c8` |

**Fish:** Guppy, Goldfish, Snail (utility, eats algae)
**Food:** Basic Flakes, Pellets, Algae Wafer
**Decor:** Hornwort (plant, grows), Moss Ball, Rock Pile, Driftwood, Treasure Chest (bubbles)
**Tools:** None required

### 7.2 Tropical Planted Tank

| Property | Value |
|---|---|
| **ID** | `tropical` |
| **Unlock** | 500 lifetime coins |
| **Space capacity** | 14 |
| **Substrate** | Fine gravel (warm tones) |
| **Water tint** | Vibrant teal `#40b8d0` |

**Fish:** Neon Tetra (schooling), Blue-Eye, Moon Fish, Discus (requires plant mass), Pleco (utility), Gourami (requires floating plants)
**Food:** Tropical Flakes, Pellets, Bloodworms, Algae Wafer
**Decor:** Java Fern, Amazon Sword, Floating Plants (multiply), Mossy Log, Hollow Stump
**Tools:** Heater (required — fish get cold penalty without it), Filter (reduces dirt rate)

### 7.3 Saltwater Reef Tank

| Property | Value |
|---|---|
| **ID** | `salt` |
| **Unlock** | 2000 lifetime coins + own Heater in tropical |
| **Space capacity** | 20 |
| **Substrate** | White sand |
| **Water tint** | Deep blue `#1a4a7a` |

**Fish:** Clownfish (requires Anemone), Blue Tang, Green Chromis (schooling), Firefish, Royal Gramma, Banggai Cardinalfish (schooling), Moray Eel (requires Cave, max 1), Cleaner Shrimp (utility)
**Food:** Marine Pellets, Reef Flakes, Frozen Brine Shrimp, Live Shrimp
**Decor:** Anemone, Live Rock, Brain Coral, Staghorn Coral, Cave (max 1), Sea Fan
**Tools:** Filter (required), Protein Skimmer (required — reduces organic waste), UV Sterilizer (required — without it all salt fish suffer a happiness penalty from poor water quality)

### 7.4 Tank Switching & Expansion

- Menu → Tanks shows all tanks with lock/unlock status
- Locked tanks show requirements (greyed out)
- Switching is instant — changes `activeTankId`, client re-renders
- Each tank simulates independently (idle time catches up on load)

**Extensibility:** Adding a new biome in a future update only requires adding a new `TankCatalog` entry (with its content, unlock rules, and visuals) to the catalog. The save system automatically creates a new tank slot for any tank ID present in the catalog but missing from the save. No client code changes are needed beyond adding new sprite assets.

---

## 8. Fish System

### 8.1 Fish Identity

Every fish instance has:
- **Unique ID** (generated on purchase)
- **Species** (from catalog, determines all base stats and visuals)
- **Age** (computed from `bornAt`): Baby (0–2 days) → Child (2–7 days) → Adult (7+ days)

Fish are visually identifiable by their species sprite, size variance, and behavior pattern — no two fish of the same species look exactly alike due to size variance and independent movement timing.

### 8.2 Fish Stats

| Stat | Range | Update Frequency |
|---|---|---|
| Hunger | 0–100 | Decays over time (species-specific rate) |
| Health | 0–100 | Degrades if weak; regenerates if healthy + fed + clean |
| XP | 0–∞ | Gained from feeding, cleaning, playing |
| Level | 1–10 | Increases when XP reaches threshold |

### 8.3 Fish Interaction

**Tap a fish in normal mode:**
1. Fish stops swimming and "wiggles" in place (rotation-based oscillation animation, 2 second duration)
2. A fish bubble appears near the fish position with detailed info
3. The bubble auto-dismisses after 8 seconds
4. Hit detection is adjusted for crawl-type fish (uses substrate position)

**Fish Info Bubble shows:**
- **Header:** Species name + Level/Life Stage
- **Stats bar (pills):** Hunger %, HP, Happiness — displayed as colored pill badges
- **Earning info:** Coins/hr rate + XP progress (current/needed)
- **Weak warning:** Red warning text "Weak — Feed & clean to recover!" (only when weak)
- **Trait labels:** Schooling fish (0.5 space), Bottom crawler, Glass cleaner, Dirt reduction %
- **Action buttons:** Sell button (red, inline) — triggers sell_fish action with toast confirmation

**Sell via fish bubble:**
- Clicking the sell button immediately sells the fish
- Shows toast: "Sold for X coins"
- Updates state and dismisses bubble
- Works for all fish including the last one (zero-fish tanks allowed)

### 8.4 Fish Behavior

Fish have species-dependent movement patterns. The `movementType` field in catalog preferences determines the primary behavior:

| movementType | Description | Species |
|---|---|---|
| `default` (or omitted) | Normal zone-based swimming with random direction changes | Guppy, Goldfish, Blue-Eye, Moon Fish, Discus, Gourami, Clownfish, Blue Tang, Firefish, Royal Gramma |
| `crawl` | Bottom-hugging only — 0.25× speed, clamped to substrate, left/right movement | Snail, Cleaner Shrimp |
| `glass` | Wall-crawling — attached to left/right glass walls, 0.4× speed, 12% chance to switch sides, rendered vertically | Pleco |
| `snake` | Serpentine movement — sinusoidal vertical oscillation, 0.5× speed, bottom zone | Moray Eel |
| `school` | Leader-following — one fish is the leader (swims normally), all others follow with index-based offset | Neon Tetra, Green Chromis, Banggai Cardinalfish |

**Legacy pattern names** (descriptive, not catalog fields):

| Pattern | Description |
|---|---|
| `drift` | Slow horizontal movement, gentle vertical bob |
| `glide` | Smooth diagonal sweeps |
| `dart` | Quick bursts with pauses |
| `circle` | Orbits a point (near preferred decor if present) |
| `zigzag` | Quick horizontal, small vertical changes |
| `patrol` | Moves back and forth in a zone (top/mid/bottom) |
| `hide` | Stays mostly behind/inside cave or large decor |

**Special behaviors:**
- Clownfish gravitates toward nearest Anemone decor
- Moray Eel uses `snake` movement — serpentine body undulation, stays in bottom zone near Cave
- Discus swims near plant clusters
- Gourami patrols the top zone near floating plants
- Pleco uses `glass` movement — targets glass walls (x=0.04 or x=0.96) with 12% chance of switching sides; rendered rotated vertically (head up) when attached to glass
- Snails and Cleaner Shrimp use `crawl` movement — bottom-hugging at 0.25× speed, never leave substrate
- **Schooling (leader-following):** One fish of a schooling species becomes the "leader" (swims normally). All other same-species fish follow the leader with facing-relative offsets based on their index in the school. Followers add sinusoidal variation for natural spacing. The leader is identified by `schoolAnchors[speciesId].leaderId`.
- Schooling fish (Neon Tetra, Green Chromis, Banggai Cardinalfish) count as **0.5 space** instead of 1
- Hungry fish swim slower, lower; fed fish are livelier
- Weak fish drift slowly, muted colors
- **Wiggle on tap:** When a fish is tapped, it stops swimming and wiggles in place (rotation oscillation) for 2 seconds while showing the info bubble

**Zero-fish tanks:**
- Tanks are allowed to have zero fish. Selling the last fish is permitted.
- The sell button always appears in inventory — no minimum fish restriction.
- An empty tank still renders normally (environment, decor, cleaning, etc.)

**Species Base Scales (`FISH_BASE_SCALES`):**

Each species has a display scale multiplier applied during rendering so fish appear at species-appropriate sizes:

| Species | Scale | Species | Scale |
|---|---|---|---|
| `guppy` | 1.0 | `neon_tetra` | 0.9 |
| `goldfish` | 1.5 | `moon_fish` | 1.6 |
| `snail` | 0.8 | `pleco` | 1.8 |
| `shrimp` | 0.7 | `gourami` | 1.4 |
| `discus` | 1.8 | `clownfish` | 1.3 |
| `green_chromis` | 0.9 | `firefish` | 1.0 |
| `blue_tang` | 1.7 | `royal_gramma` | 1.1 |
| `moray_eel` | 2.2 | `banggai_cardinal` | 1.0 |
| `cleaner_shrimp` | 0.8 |

**Level badges:** Level badges (Lv.N) are only shown for the currently tapped fish (`selectedFishId`), with a 5-second auto-clear timer. This prevents visual clutter.

---

## 9. Happiness & Penalties

### 9.1 Happiness Calculation

Each fish has a happiness score (0–100), computed at runtime:

```
happiness = 100
  + hungerContribution(hunger)
  + cleanlinessContribution(tankCleanliness)
  - sum(missingRequirementPenalties)
  + sum(preferredDecorBonuses)
```

Clamped to 0–100.

### 9.2 Contribution Functions

**Hunger contribution:**
```
if hunger >= 70:  +0
if hunger >= 40:  -(70 - hunger) * 0.5 = -15 max
if hunger >= 10:  -(70 - hunger) * 0.8 = -48 max
if hunger < 10:   -60
```

**Cleanliness contribution:**
```
if cleanliness >= 60: +0
if cleanliness >= 30: -(60 - cleanliness) * 0.5 = -15 max
if cleanliness < 30:  -(60 - cleanliness) * 1.0 = -60 max
```

### 9.3 Requirement Penalties

These are defined per species in the catalog and are **always shown** in fish details:

| Fish | Requirement | Penalty |
|---|---|---|
| Clownfish | Anemone decor in tank | -40 |
| Moray Eel | Cave decor in tank | -55 |
| Discus | Total plant size mass ≥ 3.0 | -25 |
| Gourami | At least 1 Floating Plant decor | -30 |
| All Tropical | Heater tool owned | -20 |
| All Salt | Filter owned | -15 |
| All Salt | Protein Skimmer owned | -15 |
| All Salt | UV Sterilizer owned | -20 |

The UV Sterilizer is critical for saltwater: without it, poor water quality causes a blanket **-20 happiness** penalty to every fish in the salt tank. This makes it a high-priority early purchase for the saltwater biome.

**Penalty display in fish details (always visible):**
```
Happiness: 43/100

  Hunger:             OK (+0)
  Cleanliness:        Low (-12)
  Missing Anemone:    -40 ⚠️
  Missing UV Sterilizer: -20 ⚠️
```

### 9.4 Preferred Decor Bonuses

Optional small bonuses (not penalties) for "nice to have" decor:
- Any fish in tank with plants: +2 per plant (capped at +10)

### 9.5 Impact of Happiness

| Happiness Range | Coin Generation | Visual |
|---|---|---|
| 80–100 | 100% | Normal, lively swimming |
| 60–79 | 70% | Slightly slower |
| 40–59 | 40% | Slower, slightly muted |
| 20–39 | 15% | Very slow, dull colors |
| 0–19 | 0% (enters Weak state) | Drifting, greyed out |

---

## 10. Weak State (No Permanent Death)

### 10.1 Entering Weak State

A fish becomes **Weak** when:
- `hunger <= 10` AND time since last fed > 2 hours, OR
- `health <= 15`, OR
- Happiness drops below 20 for more than 1 hour (simulated)

### 10.2 Weak State Effects

- Coin generation: **0**
- Visual: Fish colors desaturated, slower drift, "😔" indicator
- Badge on fish bubble: "Weak"
- Fish still visible and tappable

### 10.3 Recovery

To recover from Weak state, **all** must be true:
- Hunger ≥ 35 (feed the fish)
- Tank cleanliness ≥ 30
- If required decor was removed: place it back (penalty clears)

Once conditions are met for 1 tick (next simulation), `weak` becomes `false` and the fish resumes normal behavior. Health regenerates at 2/hour when not weak and hunger ≥ 40 and cleanliness ≥ 40.

---

## 11. Decor System

### 11.1 Placement Model

Decor items are placed in the tank with:
- `x`: normalized 0..1 (left to right)
- `y`: normalized 0..1 (top to bottom)
- `size`: 0.5..2.0 (scalar multiplier on base sprite)

### 11.2 Placement Zones

Each decor type has a valid placement zone. The client enforces this during placement:

| Zone | Y Range | Examples |
|---|---|---|
| `bottom` | 0.7–1.0 | Rocks, wood, cave, treasure chest |
| `mid` | 0.3–0.8 | Plants, tall wood pieces |
| `top` | 0.0–0.3 | Floating plants |
| `any` | 0.0–1.0 | Corals (saltwater) |

### 11.3 Decor Interaction

**Tap a placed decor item:**
- Opens a Decor Card popup showing:
  - Name, current size, growth status
  - Actions: **Trim** (if growable), **Move**, **Sell**

**Drag-to-move decorations (normal mode):**
- In normal mode, pointer down first checks `hitTestDecor` before fish tap
- If a non-floating decor is hit, dragging begins: `d.x` and `d.y` update in real-time
- On pointer up, position is committed via `move_decor` action
- Floating plants (`placement: 'top'`) are excluded from dragging — they drift autonomously

**Floating plant drift:**
- Floating plants (decor with `placement: 'top'`) have time-based sinusoidal drift animation
- Uses `Date.now() / 4000` as phase for smooth, slow movement
- Each plant cluster gets a unique phase based on its array index
- Drift applies both horizontal (±driftX) and vertical (±driftY) oscillation

### 11.4 Decor Capacity

- No hard cap on number of decor items (but UI becomes cluttered)
- Some items have `maxPerTank` (Cave = 1)
- Visual density is self-limiting

---

## 12. Plant Growth & Multiplication

### 12.1 Plant Types

| Type | Growth | Spread | Trimming | Examples |
|---|---|---|---|---|
| Regular plant | Yes (size increases over time) | No | Yes | Hornwort, Java Fern, Amazon Sword |
| Floating plant | Yes | Yes (multiplies into new clusters) | Yes | Water Lettuce, Duckweed |
| Coral | No (static decor) | No | No | Brain Coral, Staghorn, Sea Fan |

### 12.2 Growth Model

Every simulation tick, for each decor with `growth` config:

```
newSize = clamp(
  currentSize + (growthRatePerHour * dtHours),
  growth.minSize,
  growth.maxSize
)
```

Growth rates are slow (e.g. 0.02/hour = reaches max in ~25 hours from min).

### 12.3 Floating Plant Multiplication

Only floating plants have `spread` config. On each simulation tick:

```
if (clusterCount < maxClusters && currentSize >= spreadThreshold) {
  // Deterministic RNG seeded by (tankId + dayIndex)
  if (spreadRoll < spreadChancePerDay * (dtHours / 24)) {
    // Spawn new cluster near parent
    newCluster = {
      decorId: parentDecorId,
      x: parent.x + random(-spawnRadius, +spawnRadius),
      y: parent.y + random(-spawnRadius/2, +spawnRadius/2),
      size: growth.minSize
    };
  }
}
```

**Deterministic seeding:** Use `seed = hash(tankId + Math.floor(Date.now() / 86400000))` so the same day always produces the same spread decisions. This prevents exploits from repeated loads.

### 12.4 Trimming

**Action:** Available on any growable decor (plants, floating plants).

- Reduces `size` by a fixed step (e.g. 0.25)
- Clamped at `growth.minSize`
- When at minSize, Trim button is disabled
- Optional reward: small cleanliness bump (+1 to +3) — cosmetic, not economy-breaking

---

## 13. Tool Modes

The game has three interactive tool modes, activated from the menu:

| Mode | Cursor | Action | Exit |
|---|---|---|---|
| **Feed** | 🍞 (copy cursor) | Tap to drop food particles | Close button or menu |
| **Clean** | Pointer | Swipe to wipe grime overlay | Auto-exits at 0% dirt |
| **Play** | None (laser dot) | Move pointer; fish follow | Close button or menu |

All modes show a **Tool Dock** at bottom center with mode-specific controls and a close button.

### Hardware Tools (Per-Tank Equipment)

These are purchased in the Store and provide passive benefits:

| Tank | Tool | Effect |
|---|---|---|
| Fresh | None required | — |
| Tropical | Heater | Removes cold-penalty from tropical fish. **Required.** |
| Tropical | Filter | Reduces dirt rate by 20%/30% (levels 1/2) |
| Salt | Filter | Reduces dirt rate (required for salt viability) |
| Salt | Protein Skimmer | Reduces dirt rate further, required for most salt fish |
| Salt | UV Sterilizer | Neutralizes harmful pathogens. **Without it: all salt fish get -20 happiness.** |

Hardware tools are rendered in the tank as small decor-like sprites (filter on right wall, heater on left wall, skimmer on back wall, UV sterilizer on left wall lower).

---

## 14. Cleaning System

### 14.1 Dirt Representation

- `cleanliness` is a number 0..100 in `TankSave`
- `dirtPercent = 1 - (cleanliness / 100)` — 0 = clean, 1 = filthy
- Dirt accumulates over time: `cleanliness -= (baseDirtyRate + fishCount * dirtyPerFishRate) * dtHours`

### 14.2 Wipe Mask Grid

When entering Clean mode, generate a **stable grime mask** that doesn't change during the session:

```
Grid: 64 × 48 cells (configurable in catalog.global.ui.wipeMaskGrid)
Each cell: { dirty: boolean, opacity: number }
```

**Important:** Dirt is only rendered **above the substrate line** (`subY = H * (1 - biome.subH)`). Both `renderDirtOverlay` and `initCleanMask` must use the same vertical boundary so cleaning accurately targets only visible dirt.

**Initialization (deterministic):**
```
seed = activeTankId.length * 1000 + 7   // same seed used by renderDirtOverlay
for each cell (cx, cy):
  // Map cy to above-substrate region only
  worldY = (cy / gridRows) * subY        // only the water column
  isEdge = cx == 0 || cy == 0 || cx == maxX || cy == maxY
  isCorner = (cx <= 1 || cx >= maxX-1) && (cy <= 1 || cy >= maxY-1)
  threshold = isCorner ? 0.25 : isEdge ? 0.40 : 0.55
  threshold *= (1 - dirtPercent * 0.6)  // dirtier = more cells
  cell.dirty = seededRandom() < threshold ? false : true  // below threshold = dirty
  cell.opacity = (0.08 + seededRandom() * 0.12) * (1 + dirtPercent * 0.5)
```

The mask initialization uses a **coarse pre-sampling grid** (12×10) to match the same cells visible in renderDirtOverlay, ensuring that the wipe mask aligns exactly with visible dirt patches.

The mask is **not re-randomized per stroke**. Once generated on entering clean mode, it stays stable until all dirt is removed or the player exits.

### 14.3 Wipe Algorithm

On pointer move/drag during clean mode:

```
1. Map pointer (px, py) to grid coords via bounding rect normalization
2. Map to above-substrate grid rows (cy maps to 0..subY, not full height)
3. Return early if pointer is below substrate line
4. Compute brush radius (e.g. 3 cells)
5. For each cell within brush radius:
   a. If cell.dirty, set cell.dirty = false
   b. Track number of cells cleared this session
4. Update visual overlay
5. Compute remaining dirt percentage from mask
```

**Brush is eraser-like:** Follows the stroke path with consistent radius. Must never clear the full overlay from a single event unless the stroke actually covered every cell.

### 14.4 Proportional Rewards

```
On entering clean mode:
  dirtyStart = current dirtPercent (from mask)

On exit (manual close or auto-complete):
  dirtyEnd = remaining dirt from mask
  improvement = dirtyStart - dirtyEnd
  coinsEarned = floor(improvement * catalog.global.economy.coinsPer100Dirt)
```

This prevents exploits: you only earn coins for dirt actually removed.

### 14.5 Auto-Complete

When `remainingDirtPercent <= epsilon` (e.g. 0.01):
- Exit clean mode automatically
- Show toast: "Tank cleaned! +{coins} coins"
- Set `cleanliness = 100`

### 14.6 Fish Layer Always Visible

**Critical:** The fish canvas layer must ALWAYS render during clean mode. The grime overlay is a **separate layer above fish but below HUD** (see §19 for full layer stack). Never conditionally replace or hide the tank view when entering clean mode.

---

## 15. Feeding System

### 15.1 Food Particles

When the player taps the tank in Feed mode:
1. A food particle spawns at the tap position
2. Particle has physics based on food type:

| Sink Behavior | Description |
|---|---|
| `float` | Stays near surface, drifts laterally |
| `slowSink` | Gradually sinks (0.5–1 px/frame) |
| `sink` | Sinks faster (2–3 px/frame) |

3. Particle remains for ~10 seconds or until consumed
4. Stock of selected food decreases by 1

### 15.2 Fish Targeting

When food particles exist:
1. Each fish evaluates nearby particles
2. **Hungry fish** (hunger < 70) get priority — they swim faster toward food
3. Fish picks the **nearest accepted** particle (based on its `diet.accepts` array); food not in its accepts list is ignored entirely
4. Fish swims toward particle; on contact:
   - Particle is consumed (removed)
   - Fish hunger increases by `food.hungerRestore`
   - Fish XP increases by `food.xp`
   - `lastFedAt` updates

This keeps feeding simple: each fish has a list of foods it eats. Drop any accepted food and the fish will go for it. Food not in the accepts list is simply ignored — no negative effects, just no interest.

---

## 16. Play Mode (Laser Pointer)

### 16.1 Mechanics

- Activate from menu → Play
- A red laser dot appears at the pointer/touch position
- Fish are attracted to the dot and swim toward it
- Different species have different chase patterns:
  - Fast chasers (guppy, neon tetra, chromis): dart toward dot
  - Curious followers (goldfish, clownfish): approach slowly then circle
  - Ignores it (moray eel): stays in cave

### 16.2 Rewards

- **Cooldown:** 6 hours between rewards
- **On cooldown expiry + active play session (> 5 seconds):**
  - Coins: 50 (modest)
  - XP: 10 per fish in tank
- Show toast: "+50 coins! Fish had fun!"
- If on cooldown, still show the play mode (visual fun) but no reward toast

### 16.3 Implementation

```
laserReward:
  if (now - tank.lastLaserReward >= LASER_COOLDOWN_MS):
    tank.lastLaserReward = now
    tank.coins += LASER_REWARD_COINS
    for each fish: fish.xp += LASER_REWARD_XP
    return { reward: { coins, xp } }
  else:
    return { reward: null }
```

---

## 17. Store & Economy

### 17.1 Currency Sources

| Source | Amount | Frequency |
|---|---|---|
| Fish passive coins | `baseCoinPerHour × happinessMod × levelBonus × lifeStage` | Per hour (idle) |
| Cleaning reward | `improvement × coinsPer100Dirt` | Per clean session |
| Play reward | 50 coins | Per 6-hour cooldown |

### 17.2 Price Growth

**Fish prices increase per purchase of that species:**
```
price = basePrice × fishPriceGrowth ^ ownedCountOfSpecies
```

Example: Guppy (base 15), growth 1.18:
- First: 15
- Second: 18
- Third: 21
- Fourth: 25

**Decor prices:** Flat (no growth). Some expensive items are naturally gated.

**Tool upgrades:** Defined per-level in catalog (`prices: [60, 150]`).

### 17.3 Capacity Constraints

| Constraint | Check |
|---|---|
| Tank space | `sum(fish.spaceCost) <= tank.spaceCapacity` — **Note:** Schooling fish cost 0.5 space each |
| Species max | `fish.filter(f => f.speciesId === id).length < species.maxPerTank` |
| Tool requirements | Some fish need specific tools owned before purchase |
| Food stock | Per-food inventory count |

**Half-space fish:** Neon Tetra, Green Chromis, and Banggai Cardinalfish have `spaceCost: 0.5`. This is reflected in both the catalog (`api.js`) and store UI (shows "0.5 space" in buy button). The `getUsedSpace()` function naturally sums 0.5 values.

### 17.4 Store UI

Store panel shows sections in catalog-defined order:

**For each item:**
- Name, price, description
- If purchasable: Buy button
- If blocked: **Clear reason shown:**
  - "Not enough coins" (greyed, shows price)
  - "Tank full (8/8 space)" (greyed)
  - "Max 1 per tank" (greyed)
  - "Requires Heater" (locked icon)
  - "Requires 500 lifetime coins" (locked, future items shown as preview)

### 17.5 Selling

| Item Type | Return Rate |
|---|---|
| Fish | 25–40% of current price (low, discourages churn) |
| Decor | 35% of base price (global default, catalog override possible) |
| Tools | Not sellable (permanent upgrade) |
| Food | Not sellable (use it or waste it) |

---

## 18. Progression & Unlocks

### 18.1 Tank Unlocks

| Tank | Requirement | Display |
|---|---|---|
| Fresh | Free | "Your starter tank" |
| Tropical | 500 lifetime coins | "Earn 500 coins to unlock" |
| Salt | 2000 lifetime coins + own Heater in Tropical | "Earn 2000 coins and own a Heater" |

### 18.2 In-Store Preview

Locked items from higher-tier tanks or requiring tools are shown in the store as **greyed out with requirement text**. This gives players a roadmap.

### 18.3 Fish Level Progression

```
xpToNextLevel(level) = XP_BASE + XP_PER_LEVEL_SCALE * (level - 1)
```

Example (XP_BASE=30, SCALE=14):
- Level 1→2: 30 XP
- Level 2→3: 44 XP
- Level 5→6: 86 XP
- Max level: 10

**Benefits of leveling:**
- +12% coin generation per level
- Life stage progression (Baby→Child→Adult) is age-based, not level-based

---

## 19. Rendering & Visual Layers

### 19.1 Full-Bleed Layout

The tank fills the **entire** 4:3 viewport. No desk, no frame, no border. The aquarium IS the widget.

### 19.2 Layer Stack (bottom to top)

| Layer | Z-Index | Description |
|---|---|---|
| 1. Water gradient | 0 | Biome-specific 3-stop gradient: light top, mid-tone center, darkened bottom (uses `shadeColor` helper) |
| 2. Glass frame | 0.5 | Beveled glass border with highlights, animated shimmer, inner reflection strips, and top reflection bar |
| 3. Back silhouettes | 1 | Distant plant/rock shapes (biome theme) |
| 3.5. Light rays | 1.5 | 7 underwater light rays from surface, animated slow drift |
| 4. Caustic light | 2 | 12 animated dappled elliptical caustic patterns |
| 5. Substrate | 3 | 120 varied pebbles (multi-size, multi-shade) with 2-line highlight at substrate top + depth fog above |
| 6. Rock clusters | 4 | Foreground rock formations (if biome has them) |
| 7. Placed decor | 5 | Player-placed items — lily-pad clusters, multi-stem plants, rock piles, coral branches, generic shapes with shading (baseSize = PX_SCALE × 8) |
| 8. Equipment | 6 | Filter, heater, skimmer, UV sterilizer rendered as pixel art sprites from ICON_DATA with level indicator dots |
| 9. Fish sprites | 7 | All fish, pixel-rendered with species data and FISH_BASE_SCALES |
| 10. Movement-type sprites | 8 | Crawl (snail/shrimp on substrate), glass (pleco on walls, vertical), snake (moray undulation) |
| 11. Food particles | 9 | Active food dropping/sinking |
| 12. Bubbles | 10 | Ambient rising bubbles |
| 13. Ambient particles | 11 | Floating dust motes |
| 14. Dirt overlay | 12 | Seeded cell-based dirt texture + edge film — **only rendered above substrate line** (always visible when cleanliness < 95%) |
| 15. Laser dot | 13 | During play mode only |
| 16. Float text | 20 | "+10 coins" floating animations |
| 17. Fish label/bubble | 21 | Tapped fish info overlay (level badge only for selectedFishId) |
| 18. HUD | 30 | Coins, bars, tooltip — all icons rendered as pixel art |
| 19. Tool dock / Tank nav | 40 | Bottom bar controls |
| 20. Toast | 50 | Notification popups |
| 21. Menu overlay | 60 | FAB menu grid with pixel art icons |
| 22. Panels | 70 | Store, Inventory, Help, etc. |

### 19.3 Pixel Art System

Fish are rendered as pixel art sprites with palette swapping:

```
Palette indices:
  0 = transparent
  1 = body color
  2 = tail/fin color
  3 = highlight/accent
  4 = dark detail / eye
```

Each fish species has a `px` array (2D grid of palette indices) and a `color` map. The renderer maps indices to actual colors at draw time, allowing easy palette variations.

### 19.3.1 Pixel Icon System (ICON_DATA)

All UI icons (HUD, menu, store, panels) use a unified pixel art icon system instead of emoji. The `ICON_DATA` dictionary maps icon names to 8×8 pixel grids with palette entries. Icons are rendered to canvas and cached as data URIs.

**Available icons:** `coin`, `broom`, `food`, `fish`, `store`, `wrench`, `clipboard`, `house`, `help`, `laser`, `close`, `menu`, `lock`, `arrow_l`, `arrow_r`, `plant`, `decor`, `heater`, `filter`, `skimmer`, `uv`

**Rendering pipeline:**
1. `renderPixelIcon(name, size)` → draws icon to off-screen canvas, returns `data:image/png` URI
2. `iconCache` stores rendered URIs to avoid recomputation
3. `iconImg(name, size)` → returns `<img>` HTML string for use in panel templates
4. `initPixelIcons()` → called during init, scans all `[data-icon]` elements and replaces content with rendered pixel art `<img>` tags

**HTML usage:** Elements use `data-icon="name"` and optional `data-icon-size="N"` attributes. JS panels use `iconImg('name', size)` for inline icons.

### 19.4 Animation

- Fish swim continuously with species-specific patterns
- Fish direction flips sprites horizontally
- **Schooling:** Leader-following system — one fish per species leads, others follow with index-based offsets and sinusoidal variation
- **Crawl:** Bottom-hugging movement at 0.25× speed, clamped to substrate
- **Glass:** Wall-crawling at 0.4× speed, rendered vertically (head up), 12% switch sides
- **Snake:** Serpentine undulation at 0.5× speed, bottom zone
- **Wiggle:** Tapped fish stop and oscillate in place for 2 seconds
- Bubbles rise with sine-wave wobble
- Plants sway with subtle sine-based offset
- Equipment has rendered pixel art sprites from ICON_DATA with level indicator dots
- Decor uses seeded RNG for consistent rendering across frames: lily-pad clusters for floating plants, multi-stem plants with varied leaves, rock piles with highlights, coral/anemone branching shapes
- Pleco rotates when attached to glass walls
- Food particles set anim.tx/ty to current position after fish consume to prevent snapping

---

## 20. HUD & Menu System

### 20.1 HUD (Always Visible)

- **Top left:** Coin counter with coin icon
- **Top right:** Mini bars for Cleanliness and Average Hunger
- **Tapping a HUD element** shows a tooltip with details

### 20.2 FAB Menu

- **Bottom right:** Floating action button (hamburger icon)
- **Opens:** 3×3 grid of menu items:
  - Feed, Clean, Play
  - Store, Upgrades, Inventory
  - Tanks, Help, (Debug — dev only)

### 20.3 Panels

Full-screen overlays with header (title + close button) and scrollable body:
- **Store** — Buy fish, food, decor, tools
- **Upgrades** — Equipment upgrades
- **Inventory** — List of fish with details
- **Tanks** — Tank switching and unlocking
- **Help** — Game manual

---

## 21. Help System

In-widget help panel with structured chapters:

### Chapters

1. **Getting Started**
   - You start with a Fresh tank and one guppy
   - Feed your fish, keep the tank clean, earn coins
   - Buy more fish and supplies from the Store

2. **Tanks & Switching**
   - Multiple tank biomes, each with unique fish, coins, food, and decor
   - Unlock new tanks by earning lifetime coins

3. **Feeding**
   - Open Feed mode from the menu
   - Tap the tank to drop food
   - Switch food types in the dock
   - Different fish eat different foods — check what your fish accepts

4. **Cleaning**
   - Dirt builds up over time
   - Open Clean mode and swipe to wipe
   - Earn coins proportional to dirt removed
   - Filters and snails slow down dirt accumulation

5. **Play**
   - Open Play mode for a laser pointer
   - Fish will chase the dot
   - Earn coins and XP (on cooldown)

6. **Decor & Plants**
   - Buy decor from the Store
   - Plants grow over time
   - Trim overgrown plants by tapping them
   - Floating plants can multiply into new clusters
   - Some fish require specific decor to be happy

7. **Happiness & Requirements**
   - Each fish has a happiness score (0–100)
   - Hunger, cleanliness, tools, and decor affect happiness
   - Missing required decor or tools causes large penalties
   - Happy fish generate more coins

8. **Weak State & Recovery**
   - Fish never die permanently
   - Neglected fish become Weak (no coin generation)
   - To recover: feed them and clean the tank
   - Health regenerates over time once conditions are met

9. **Store Rules**
   - Some items require tools or lifetime coins
   - Tank space limits how many fish you can have (schooling fish cost 0.5 space)
   - Selling returns a fraction of the purchase price
   - Selling the last fish is allowed — tanks can have zero fish

---

## 22. Debug & Development

### 22.1 Debug Scenarios (Dev-Only)

Available when `debug_mode` setting is enabled:

**Action-based scenarios** (apply mutations to current state via `debug_scenario` action):

| Scenario | Description |
|---|---|
| `clean_tank` | Set cleanliness to 100, all fish fed |
| `dirty_tank` | Set cleanliness to 5, heavy grime |
| `hungry_fish` | All fish hunger set to 5 |
| `all_weak` | All fish set to weak state |
| `missing_requirements` | Remove required decor items |
| `full_tank` | Fill tank to capacity |
| `rich` | Set coins to 99999 |
| `poor` | Set coins to 0 |
| `max_plants` | All plants at max growth |
| `baby_fish` | Reset all fish bornAt to now |
| `fresh_start` | Full reset to initial state |
| `all_unlocked` | Unlock all tanks with starter fish |

**State-generator scenarios** (create full state snapshots via dropdown selector):

| Scenario ID | Description |
|---|---|
| `default` | Fresh start — 1 guppy, 50 coins, 10 flakes |
| `tier-2-ready` | Fresh tank with 600 coins, 3 leveled fish, ready to unlock tropical |
| `tier-2-active` | Tropical active with 4 fish, heater, filter, decor |
| `tier-3-endgame` | All tanks unlocked, saltwater active, 5 fish, full tool loadout |
| `neglected-48h` | Dirty tank (15%), 2 weak fish, near-empty food |
| `low-food` | Only 1 food item remaining, 2 hungry fish |
| `dirty-near-threshold` | Cleanliness at 25%, 2 fish, 80 coins |
| `dirty-big-tank` | Saltwater at 15% cleanliness, all tanks unlocked |
| `rich` | 99999 coins, 2 fish, stocked food |
| `tank-full` | Fresh tank at 8/8 space (6 fish) |
| `tier-3-crowded` | Saltwater at 18/20 space (10 fish) |
| `multi-tank-decorated` | All 3 tanks unlocked with fish, decor, and tools |

### 22.2 Sandbox Mock Integration

The sandbox app (`apps/sandbox/`) must have updated mocks:

- `aquariumMocks.js` contains both `applyDebugScenario()` (action-based) and `createScenarioState()` (state generators)
- `MockHomey.js` routes widget API calls to mock handlers and passes `scenarioId`
- Mock state persists in localStorage via `STORAGE_KEY = 'mock_aquarium_state_v2'`
- **State persistence fix:** `resetAquariumScenario(scenarioId)` skips reset when the same scenario is already loaded, preventing React `useEffect` double-fire from clearing state mid-session
- `_lastScenarioId` tracking ensures scenario state is only recreated on GET when the scenario actually changes
- POST requests always use persisted state to avoid resetting on every action

### 22.3 Playwright E2E Tests

Two test files cover the aquarium widget:

**`tests/e2e/games.spec.ts`** (60 tests) — Core functionality:
- Widget loads without errors
- HUD elements are visible
- Menu opens/closes
- Panels render content
- Tool modes activate correctly
- Store, inventory, tanks, upgrades, help panels
- Feed mode, clean mode, laser mode
- Debug scenario loading and state persistence

**`tests/e2e/games-advanced.spec.ts`** (57 tests) — Visual overhaul & advanced flows:
- Pixel icon system rendering (HUD, menu, FAB, bars, tank nav)
- Store purchasing flow (buy fish/food/decor/tools, coin updates, persistence)
- Tank navigation (multi-tank switching via nav buttons and tanks panel)
- Debug scenario state persistence (purchases persist, scenario switching resets)
- Decor system (inventory display, sell buttons, sell flow, growth info)
- Inventory details (food stock, fish stats, pixel icons, sell fish)
- Equipment panel (tools display, pixel icons, upgrades, utility creatures)
- Laser mode activation and dismissal
- Dirty tank visual rendering
- Fish info display without emoji
- Store tab navigation
- Panel close behavior

---

## 23. Backwards Compatibility & Migration

### 23.1 Migration Framework

```javascript
function migrateSave(save) {
  // Each version bump adds a migration step
  // Example: version 1 → version 2
  if (save.version < CURRENT_VERSION) {
    return applyMigrations(save);
  }
  return save;
}
```

**Migration rules:**
- Each save schema version has a migration function to the next version
- Migrations are chained: v1 → v2 → v3, never skip
- Unknown fields are preserved (forward compatibility)
- Missing fields get sensible defaults

### 23.2 Catalog Reconciliation

On every load, after migration:

```javascript
function reconcileSaveWithCatalog(save, catalog) {
  for (const tankId of Object.keys(save.tanks)) {
    const tank = save.tanks[tankId];
    const tankCat = catalog.tanks[tankId];

    // 1. Map IDs through aliases
    for (const fish of tank.fish) {
      fish.speciesId = catalog.aliases?.fish?.[fish.speciesId] || fish.speciesId;
    }
    for (const decor of tank.decor) {
      decor.decorId = catalog.aliases?.decor?.[decor.decorId] || decor.decorId;
    }

    // 2. Unknown IDs → "legacy" fallback
    for (const fish of tank.fish) {
      if (!tankCat.content.fish[fish.speciesId]) {
        fish._legacy = true;  // use fallback sprite/behavior
      }
    }

    // 3. Clamp values to catalog bounds
    for (const decor of tank.decor) {
      const decorDef = tankCat.content.decor[decor.decorId];
      if (decorDef?.growth) {
        decor.size = clamp(decor.size, decorDef.growth.minSize, decorDef.growth.maxSize);
      }
    }
    for (const [toolId, level] of Object.entries(tank.toolsOwned)) {
      const toolDef = tankCat.content.tools[toolId];
      if (toolDef) {
        tank.toolsOwned[toolId] = Math.min(level, toolDef.maxLevel);
      }
    }

    // 4. New requirements don't delete fish — they apply penalties
    //    (happiness calc handles this at runtime)
  }

  save.meta.lastCatalogVersion = catalog.contentVersion;
  return save;
}
```

### 23.3 Rules for Future Updates

1. **Never rename IDs without aliases.** Add the old→new mapping in `catalog.aliases`.
2. **Keep simulation rules stable.** Change only catalog balance numbers where possible.
3. **Never persist derived values.** Compute from catalog at runtime so balance updates take effect without migration.
4. **New requirements don't break existing fish.** They add penalties, not deletions.
5. **New species/decor/tools are additive.** Old saves just don't have them yet.
6. **New tanks are additive.** The save system creates a default locked tank for any catalog tank not found in the save.

---

## 24. Game Lifecycle Events

This section documents every event in the game's lifecycle — from first load to ongoing play sessions.

### 24.1 Widget Initialization

```
1. Homey calls window.onHomeyReady(homey)
2. Get widgetInstanceId (async)
3. Initialize canvas, DOM refs, event listeners
4. Call GET /api → server:
   a. Load save from homey.settings (keyed by widgetId)
   b. If no save exists → createInitialState()
   c. If save exists → migrateSave(save) → reconcileSaveWithCatalog(save, catalog)
   d. Run simulate(save) to catch up idle time
   e. Persist updated save
   f. Return { state, catalog snapshot, simResult }
5. Client applies state → initializes renderer
6. Start animation loop (requestAnimationFrame)
7. Start periodic refresh (every 5 minutes)
8. Call homey.ready({ height })
```

### 24.2 Idle Simulation (Catch-Up)

When the widget loads (or periodic refresh fires), the server simulates all elapsed time:

```
simulate(save):
  now = Date.now()
  for each unlocked tank:
    dt = min(now - tank.lastSeenAt, 168h)  // cap at 7 days

    // 1. Dirt accumulation
    dirtyRate = baseDirtyRate + (fishCount * dirtyPerSpace)
    dirtyRate *= (1 - filterReduction) * (1 - snailReduction)
    tank.cleanliness = clamp(cleanliness - dirtyRate * dtHours, 0, 100)

    // 2. Auto-feeder cycles
    if autoFeederLevel > 0:
      feedCycles = floor(dtHours / autoFeederInterval)
      for each cycle: spend food stock, feed hungriest fish

    // 3. Per-fish simulation
    for each fish:
      a. Hunger decay: hunger -= hungerRate * dtHours
      b. Weak state check
      c. Health regen (if not weak + fed + clean)
      d. Coin generation (based on happiness × level × lifeStage)
      e. XP from idle (tiny passive amount)

    // 4. Plant growth
    for each decor with growth:
      decor.size = clamp(size + growthRate * dtHours, minSize, maxSize)

    // 5. Floating plant spread (deterministic)
    for each floating plant:
      if canSpread: roll(deterministicSeed, spreadChance, dtDays)

    tank.lastSeenAt = now

  save.meta.lastSavedAt = now
```

### 24.3 Player Actions (Action Router)

Every player action goes through `POST /api`:

```
handleAction(save, type, payload):
  switch(type):
    // Tank management
    "switch_tank"      → change activeTankId
    "unlock_tank"      → check requirements, deduct coins, create tank

    // Fish
    "buy_fish"         → validate capacity + coins + requirements, create fish
    "sell_fish"        → remove fish, add partial coins

    // Feeding
    "feed"             → decrement food stock, return food particle info
    "fish_consume"     → apply hunger restore + XP to specific fish

    // Cleaning
    "start_clean"      → record dirtyStart, return mask seed
    "finish_clean"     → receive improvementPercent, apply rewards

    // Play
    "laser_pointer"    → check cooldown, apply reward if eligible

    // Store
    "buy_food"         → validate coins, add to stock
    "buy_decor"        → validate coins, create decor instance
    "sell_decor"       → remove decor, add partial coins
    "buy_tool"         → validate coins + prerequisites, upgrade tool level

    // Decor
    "move_decor"       → update x/y position
    "trim_plant"       → reduce decor size by step

    // System
    "reset_state"      → recreate initial state
    "debug_scenario"   → apply preset (dev only)
```

### 24.4 Periodic Refresh

Every 5 minutes while widget is visible:

```
1. Client calls GET /api
2. Server runs simulate() for elapsed time
3. Server returns updated state
4. Client smoothly updates all visuals
5. Open panels are refreshed if content changed
```

### 24.5 Settings Change

When user toggles `reset_state` in widget settings:

```
1. Homey fires settings.set event
2. Client prompts confirmation dialog
3. If confirmed: POST /api { type: "reset_state" }
4. Server creates fresh initial state
5. Client re-initializes
```

### 24.6 Widget Resize

```
1. Window resize event fires
2. Recalculate canvas dimensions (maintain 4:3)
3. Re-render environment (gravel, plants, rocks — all position-dependent)
4. Re-generate dirt mask if in clean mode
5. Fish positions scale proportionally (normalized coordinates)
```

---

## 25. Code Maintenance & Quality

This section defines how the codebase should be structured, maintained, and tested to ensure long-term health.

### 25.1 Code Organization

**Server (`api.js`):**
The server file is large by necessity (single file, no build step). Organize it into clearly separated logical sections using comment banners:

```javascript
// ═══════════════════════════════════════════
//  CATALOG — All content and balance data
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
//  SIMULATION ENGINE — Idle catch-up logic
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
//  ECONOMY — Price calculations, validation
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
//  ACTION HANDLERS — POST action dispatch
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
//  MIGRATION & RECONCILIATION
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
//  HELPERS — Utility functions (clamp, hash, RNG)
// ═══════════════════════════════════════════
```

**Client (`public/index.html`):**
Similarly organize inline JS into clear sections:

```javascript
// ─── STATE ───
// ─── RENDERER ───
// ─── INPUT ───
// ─── HUD / MENU / PANELS ───
// ─── ANIMATIONS ───
// ─── PIXEL ART DATA ───
```

### 25.2 Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Catalog IDs | `snake_case` | `neon_tetra`, `basic_flakes`, `filter_tropical` |
| JS variables / functions | `camelCase` | `baseCoinPerHour`, `handleAction()` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_LEVEL`, `LASER_COOLDOWN_MS` |
| DOM IDs | `kebab-case` | `#coin-display`, `#store-panel` |
| CSS classes | `kebab-case` or Homey classes | `.tool-dock`, `.homey-text` |
| Type names (in comments) | `PascalCase` | `FishSave`, `TankCatalog` |

### 25.3 Pure Functions First

Keep game logic in **pure functions** wherever possible. Pure functions (no side effects, deterministic output) are easy to test:

```javascript
// ✅ GOOD — pure, testable
function calculateHappiness(fish, tank, catalog) {
  let happiness = 100;
  happiness += hungerContribution(fish.hunger);
  happiness += cleanlinessContribution(tank.cleanliness);
  // ...
  return clamp(happiness, 0, 100);
}

// ❌ BAD — reads global state, hard to test
function calculateHappiness(fishId) {
  const fish = globalState.tanks[globalState.activeTankId].fish.find(f => f.id === fishId);
  // ...
}
```

### 25.4 State Mutation Rules

- State is **only** mutated inside action handlers (after validation)
- Every mutation must be followed by `persistSave(save)` before returning
- Never mutate catalog data
- Never mutate state on the client side — all mutations go through `POST /api`

### 25.5 Error Handling

- Action handlers return `{ error: "message" }` for invalid actions (not throws)
- Client shows errors as toast notifications
- Server should never crash from bad input — validate everything
- Use defensive defaults: `value ?? defaultValue` over trusting input

### 25.6 Testing Requirements

**Every new feature MUST include:**
1. Unit tests for any new pure function (simulation, economy, validation)
2. Updated sandbox mocks if the data model changes
3. E2E smoke test for any new UI element or interaction

**Test organization:**
```
test/
  unit/
    simulation.test.js    # hunger, dirt, weak, coins, growth
    economy.test.js       # prices, buy validation, sell returns
    migration.test.js     # save version upgrades
    reconciliation.test.js # alias mapping, unknown IDs, clamping
    cleaning.test.js      # mask generation, wipe algorithm
```

**Test patterns:**
- Use descriptive test names: `"fish enters weak state when hunger <= 10 for 2+ hours"`
- Test boundary values: 0, max, just-above-threshold, just-below-threshold
- Test time-dependent logic with explicit timestamps (don't use `Date.now()` in tests)
- Test determinism: same inputs MUST produce same outputs (especially RNG-seeded systems)

### 25.7 Code Review Checklist

Before merging any game logic change:

- [ ] Game logic changes are in `api.js` (not client)
- [ ] No derived values persisted in save
- [ ] New IDs don't conflict with existing ones
- [ ] Catalog aliases updated if any IDs were renamed
- [ ] Translations added to both `en.json` and `nl.json`
- [ ] Sandbox mocks updated if data model changed
- [ ] Unit tests written and passing for affected systems
- [ ] E2E tests pass (`npx playwright test tests/e2e/games.spec.ts`)
- [ ] Widget renders correctly in sandbox (`pnpm run dev` from root)
- [ ] Fish layer remains visible during clean mode
- [ ] Happiness penalties are clearly shown in fish details
- [ ] No `console.log` left in production paths (use debug-gated logging)

### 25.8 Performance Considerations

- **Simulation must be fast:** `simulate()` runs on every GET. Avoid O(n²) loops over fish × decor.
- **Canvas rendering:** Minimize draw calls. Batch sprites by palette where possible.
- **DOM overlays:** Only create/update panel DOM when panels are open.
- **Animation loop:** Use `requestAnimationFrame`, not `setInterval`. Skip heavy updates when widget is not visible.
- **Save size:** Keep saves lean. A late-game save (3 tanks, ~15 fish, ~20 decor) should be under 5KB JSON.

---

## 26. Implementation Backlog

### EPIC 1 — Widget Foundation

| # | Task | Acceptance Criteria |
|---|---|---|
| 1.1 | Set `height: "75%"` in `widget.compose.json` | 4:3 aspect ratio, no layout shifts |
| 1.2 | Implement widget API endpoints | GET returns state+catalog, POST handles actions |
| 1.3 | Add Homey CSS variable usage | Text, menus, tooltips use `--homey-*` vars |
| 1.4 | Widget instance ID persistence | State persisted per `getWidgetInstanceId()` |

### EPIC 2 — Persistence & Backwards Compatibility

| # | Task | Acceptance Criteria |
|---|---|---|
| 2.1 | Save schema + storage | Schema persists correctly |
| 2.2 | Migration framework `migrateSave()` | Version-chained migrations work |
| 2.3 | Catalog reconciliation `reconcileSaveWithCatalog()` | Aliases mapped, unknowns handled, values clamped |
| 2.4 | Unit tests for migration + reconciliation | All edge cases covered |

### EPIC 3 — Rendering & Layout

| # | Task | Acceptance Criteria |
|---|---|---|
| 3.1 | Full-bleed tank renderer (all layers) | 21-layer stack renders correctly |
| 3.2 | Biome-specific water gradients + substrates | Distinct visual theme per biome |
| 3.3 | Input system (tap fish, tap decor, drag modes) | All interactions route correctly |
| 3.4 | HUD + FAB menu + tooltip system | All elements functional |

### EPIC 4 — Simulation Engine (TDD)

| # | Task | Acceptance Criteria |
|---|---|---|
| 4.1 | `simulate()` core (hunger, cleanliness, weak) | Correct idle catch-up for 0–168h |
| 4.2 | Happiness calculation + breakdown | Matches spec formula, returns breakdown |
| 4.3 | Coin accrual with happiness modifiers | Correct rates per fish per hour |
| 4.4 | Unit tests for all simulation functions | Edge cases: 0h, 168h cap, boundary values |

### EPIC 5 — Decor Placement, Growth, Trimming (TDD)

| # | Task | Acceptance Criteria |
|---|---|---|
| 5.1 | Place/move/resize decor + persistence | Saved positions survive reload |
| 5.2 | Plant growth simulation | Growth stops at max, doesn't exceed bounds |
| 5.3 | Floating plant spread (deterministic seed) | Same day = same spread result |
| 5.4 | Trim action | Reduces size by step, disabled at min |
| 5.5 | Unit tests for growth + spread + trim | Determinism verified, bounds checked |

### EPIC 6 — Store & Economy (TDD)

| # | Task | Acceptance Criteria |
|---|---|---|
| 6.1 | Store UI with locked/greyed items | Clear block reasons shown |
| 6.2 | Purchase validation (capacity, caps, requirements) | All constraints enforced |
| 6.3 | Price growth logic | Prices increase correctly per species |
| 6.4 | Sell logic | Returns correct percentages |
| 6.5 | Unit tests for all economy functions | Price curves, edge cases |

### EPIC 7 — Tool Modes (TDD)

| # | Task | Acceptance Criteria |
|---|---|---|
| 7.1 | Clean mode (wipe mask) | Deterministic mask, proportional rewards, auto-complete |
| 7.2 | Feed mode (particles + targeting) | Particles sink, fish target accepted foods |
| 7.3 | Play mode (laser) | Fish follow, cooldown rewards work |
| 7.4 | Unit tests for clean mask, feed, play | Mask stability, reward proportionality |

### EPIC 8 — Content (Biomes)

| # | Task | Acceptance Criteria |
|---|---|---|
| 8.1 | Fresh Starter catalog | All species, food, decor, visuals |
| 8.2 | Tropical Planted catalog | Heater/filter gating, discus/gourami requirements |
| 8.3 | Saltwater Reef catalog | Skimmer/UV gating, schooling fish, anemone/cave |
| 8.4 | Tank switching UI + unlock rules | Switch works, requirements shown |

### EPIC 9 — Help & Debug

| # | Task | Acceptance Criteria |
|---|---|---|
| 9.1 | Help screen with all chapters | Readable, covers all mechanics |
| 9.2 | Debug scenarios + dev toggle | All scenarios work, hidden in prod |

---

## 27. Testing Strategy

### 27.1 Unit Tests (Vitest)

Core systems must have unit tests. These live alongside the game code or in a test directory.

**Simulation tests:**
- Hunger decay over various time periods
- Cleanliness decay with/without filter/snails
- Weak state entry/exit conditions
- Coin generation at various happiness levels
- 168h cap enforcement
- Auto-feeder cycles

**Economy tests:**
- Fish price growth curve
- Buy validation (space, coins, caps, requirements)
- Sell return calculations
- Food capacity with silo upgrades

**Migration tests:**
- Save version upgrades (chained)
- Edge cases: missing fields, extra fields, null values

**Reconciliation tests:**
- Alias mapping (old ID → new ID)
- Unknown IDs become legacy
- Size clamping to new bounds
- Tool level clamping to new maxLevel
- New tanks in catalog create default tank slots

**Plant growth tests:**
- Growth over time respects min/max
- Floating plant spread determinism (same seed = same result)
- Trim reduces size correctly

**Cleaning tests:**
- Mask generation is deterministic for same inputs
- Wipe removes correct cells
- Reward proportional to dirt removed
- Auto-complete triggers at epsilon threshold

### 27.2 E2E Tests (Playwright)

Two test files in `tests/e2e/`:

**`games.spec.ts`** (60 tests) — Core smoke tests:
- Widget loads in 4:3 aspect ratio
- HUD shows coins, cleanliness, hunger
- Menu FAB opens/closes
- All panels render
- Tool modes activate and show dock
- Fish are visible and tappable
- Store shows items with prices
- Tank switching works
- All 12 debug scenarios load correctly

**`games-advanced.spec.ts`** (57 tests) — Advanced validation:
- Pixel icon system in HUD, menu, FAB, bars, tank nav
- Store purchasing (fish, food, decor, tools) with coin verification
- Tank navigation via nav buttons and tanks panel
- Scenario state persistence across actions
- Decor sell flow with coin tracking
- Fish sell flow with list update verification
- Equipment upgrades in rich scenario
- Dirty tank visual and cleanliness bar colors
- Fish info display without emoji text

**`games-features.spec.ts`** (50 tests) — v1.2 feature validation:
- Zero-fish tank: empty-tank scenario, sell last fish, buy first fish, empty inventory
- Half-space schooling: 0.5 space cost in store, schooling showcase with 10+ tetras, capacity display
- Movement types: movement-showcase scenario, crawl/glass traits in bubble, rendering without errors
- Fish info panel: stats pills, earning info, sell button, weak warning, trait labels, auto-dismiss
- Cleaning improvements: consistent dirt pattern, wiping works, saltwater cleaning
- Floating plants: floating-decor scenario, inventory display, rendering without errors
- New scenarios: empty-tank, movement-showcase, schooling-showcase, floating-decor
- Visual rendering: no JS errors across all scenarios, proper dimensions, tier verification
- Inventory sell flow: sell all fish, coin updates, sell last fish to empty

### 27.3 Sandbox Scenarios

Updated scenarios in `apps/sandbox/src/lib/scenarios.js`:

**Progression group:**
- Fresh start (new player)
- Mid-game (tropical unlocked, some fish)
- Late-game (all tanks, multiple species)

**Problem states:**
- Dirty tank (cleanliness: 5)
- Hungry fish (all hunger < 20)
- All fish weak
- Missing requirements (clownfish without anemone)

**Features:**
- Max plants (all at max growth)
- Full tank (at space capacity)
- Clean mode active (dirty mask visible)
- Feed mode active (food particles dropping)

**New Features (v1.2):**
- Empty tank (zero fish, decor present)
- Movement showcase (all movement types: normal, crawl, glass, snake, schooling)
- Schooling showcase (10 neon tetras + pleco + moon fish, demonstrates leader-following)
- Floating decor (multiple floating plants with drift animation)

---

## Appendix A: Catalog Content Reference

### Fresh Starter Tank Content

**Fish:**
| ID | Display Name | Price | Coins/hr | Space | Accepts |
|---|---|---|---|---|---|
| `guppy` | Guppy | 15 | 2.5 | 1 | `basic_flakes`, `pellets` |
| `goldfish` | Goldfish | 30 | 4.0 | 2 | `basic_flakes`, `pellets` |
| `snail` | Mystery Snail | 40 | 0.5 | 1 | `algae_wafer`. Utility: dirt -15%, crawl movement |

**Food:**
| ID | Display Name | Price | Hunger | Sink |
|---|---|---|---|---|
| `basic_flakes` | Basic Flakes | 3 | 30 | slowSink |
| `pellets` | Pellets | 6 | 45 | sink |
| `algae_wafer` | Algae Wafer | 4 | 35 | sink |

**Decor:**
| ID | Display Name | Price | Zone | Growth |
|---|---|---|---|---|
| `hornwort` | Hornwort | 20 | mid | 0.02/hr, min 0.5, max 2.0 |
| `moss_ball` | Moss Ball | 15 | bottom | No |
| `rock_pile` | Rock Pile | 25 | bottom | No |
| `driftwood` | Driftwood | 35 | mid | No |
| `treasure_chest` | Treasure Chest | 50 | bottom | No (animated bubbles) |

### Tropical Planted Tank Content

**Fish:**
| ID | Display Name | Price | Coins/hr | Space | Accepts | Requirements |
|---|---|---|---|---|---|---|
| `neon_tetra` | Neon Tetra | 25 | 3.2 | **0.5** | `tropical_flakes`, `bloodworms` | Schooling, half-space |
| `blue_eye` | Blue-Eye | 30 | 3.5 | 1 | `tropical_flakes`, `pellets` | — |
| `moon_fish` | Moon Fish | 40 | 4.5 | 2 | `tropical_flakes`, `pellets`, `bloodworms` | — |
| `discus` | Discus | 65 | 6.0 | 3 | `tropical_flakes`, `bloodworms` | Plant mass ≥ 3.0 (-25 penalty) |
| `pleco` | Pleco | 45 | 1.5 | 2 | `algae_wafer` | Utility: reduces dirt 10%, glass movement |
| `gourami` | Gourami | 55 | 5.5 | 2 | `tropical_flakes`, `pellets`, `bloodworms` | Floating plants required (-30 penalty) |

**Food:**
| ID | Display Name | Price | Hunger | Sink |
|---|---|---|---|---|
| `tropical_flakes` | Tropical Flakes | 4 | 30 | slowSink |
| `pellets` | Pellets | 6 | 45 | sink |
| `bloodworms` | Bloodworms | 8 | 55 | slowSink |
| `algae_wafer` | Algae Wafer | 4 | 35 | sink |

**Tools:**
| ID | Display Name | Prices | Effect |
|---|---|---|---|
| `heater` | Heater | [60] | Required. Without it: all tropical fish -20 happiness |
| `filter_tropical` | Filter | [80, 180] | Reduces dirt rate by 20%/30% |

### Saltwater Reef Tank Content

**Fish:**
| ID | Display Name | Price | Coins/hr | Space | Accepts | Requirements |
|---|---|---|---|---|---|---|
| `clownfish` | Clownfish | 50 | 5.5 | 3 | `marine_pellets`, `reef_flakes`, `frozen_brine` | Anemone required (-40 penalty) |
| `blue_tang` | Blue Tang | 75 | 7.0 | 4 | `marine_pellets`, `reef_flakes` | — |
| `green_chromis` | Green Chromis | 35 | 3.0 | **0.5** | `reef_flakes`, `frozen_brine` | Schooling, half-space |
| `firefish` | Firefish | 45 | 4.5 | 1 | `reef_flakes`, `frozen_brine` | — |
| `royal_gramma` | Royal Gramma | 55 | 5.0 | 2 | `marine_pellets`, `reef_flakes` | — |
| `banggai_cardinal` | Banggai Cardinalfish | 40 | 3.5 | **0.5** | `reef_flakes`, `frozen_brine` | Schooling, half-space |
| `moray_eel` | Moray Eel | 120 | 10.0 | 6 | `marine_pellets`, `frozen_brine`, `live_shrimp` | Cave required (-55), max 1, snake movement |
| `cleaner_shrimp` | Cleaner Shrimp | 60 | 2.0 | 1 | `reef_flakes` | Utility: dirt -8%, crawl movement |

**Food:**
| ID | Display Name | Price | Hunger | Sink | Notes |
|---|---|---|---|---|---|
| `marine_pellets` | Marine Pellets | 8 | 45 | sink | General purpose salt food |
| `reef_flakes` | Reef Flakes | 6 | 30 | slowSink | Affordable salt staple |
| `frozen_brine` | Frozen Brine Shrimp | 10 | 55 | slowSink | High quality, most fish love it |
| `live_shrimp` | Live Shrimp | 18 | 70 | sink | Premium — only Moray accepts it |

**Tools:**
| ID | Display Name | Prices | Effect |
|---|---|---|---|
| `filter_salt` | Filter | [100, 220] | Required. Reduces dirt rate |
| `skimmer` | Protein Skimmer | [150] | Required. Further dirt reduction |
| `uv_sterilizer` | UV Sterilizer | [200] | Required. **Without it: all salt fish get -20 happiness** from poor water quality. Neutralizes harmful pathogens and algae blooms. |

**Decor:**
| ID | Display Name | Price | Zone | Growth |
|---|---|---|---|---|
| `anemone` | Anemone | 80 | any | No (sways) |
| `live_rock` | Live Rock | 45 | bottom | No |
| `brain_coral` | Brain Coral | 60 | bottom | No |
| `staghorn_coral` | Staghorn Coral | 55 | any | No |
| `cave` | Cave | 100 | bottom | No. Max 1 per tank |
| `sea_fan` | Sea Fan | 40 | any | No (sways) |

---

*End of specification.*
