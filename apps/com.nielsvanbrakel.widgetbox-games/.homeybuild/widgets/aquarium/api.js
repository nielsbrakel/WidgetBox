'use strict';

// ═══════════════════════════════════════════════════════════════════════════════
// Aquarium Widget — Server-side API (Homey SDK 3)
//
// Server-authoritative game engine. The client is a dumb renderer.
// All game state lives here; mutations happen only via POST actions.
//
// Architecture: Catalog → Save Model → Migration → Simulation → Economy → Actions
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════
//  HELPERS — Utility functions
// ═══════════════════════════════════════════

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function generateId() {
  return `f_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Deterministic hash for seeded RNG. Returns a positive integer. */
function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Returns a seeded PRNG function that produces values in [0, 1). */
function seededRng(seed) {
  let s = seed | 0;
  return function next() {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) / 4294967296);
  };
}

// ═══════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════

const CURRENT_SAVE_VERSION = 2;
const MAX_LEVEL = 10;
const XP_BASE = 30;
const XP_PER_LEVEL_SCALE = 14;
const LEVEL_COIN_BONUS = 0.12;
const MAX_IDLE_HOURS = 168; // 7 days cap
const LASER_COOLDOWN_MS = 6 * 3600000;
const LASER_REWARD_COINS = 50;
const LASER_REWARD_XP = 10;
const WEAK_HUNGER_THRESHOLD = 10;
const WEAK_HUNGER_DURATION_MS = 2 * 3600000;
const WEAK_HEALTH_THRESHOLD = 15;
const RECOVERY_HUNGER = 35;
const RECOVERY_CLEANLINESS = 30;
const HEALTH_REGEN_RATE_PER_HOUR = 2;
const HEALTH_REGEN_HUNGER_MIN = 40;
const HEALTH_REGEN_CLEAN_MIN = 40;
const HAPPINESS_WEAK_THRESHOLD = 20;

// ═══════════════════════════════════════════
//  CATALOG — All content and balance data
// ═══════════════════════════════════════════

// Shared tool requirements applied to every fish in a tank
const TROPICAL_TOOL_REQS = [
  { toolId: 'heater', penalty: 20, label: 'Missing Heater' },
];

const SALT_TOOL_REQS = [
  { toolId: 'filter_salt', penalty: 15, label: 'Missing Filter' },
  { toolId: 'skimmer', penalty: 15, label: 'Missing Protein Skimmer' },
  { toolId: 'uv_sterilizer', penalty: 20, label: 'Missing UV Sterilizer' },
];

const CATALOG = {
  schemaVersion: 1,
  contentVersion: '1.0.0',

  aliases: {
    fish: {},
    decor: {},
    tools: {},
    food: {},
  },

  global: {
    ui: {
      aspectRatio: '4:3',
      wipeMaskGrid: { w: 64, h: 48 },
    },
    economy: {
      coinsPer100Dirt: 10,
      sellReturnDefault: 0.35,
      fishSellReturn: 0.30,
      priceGrowth: {
        fish: 1.18,
      },
    },
  },

  tanks: {
    // ── FRESH STARTER TANK ───────────────────────────────────────────
    fresh: {
      id: 'fresh',
      name: 'Fresh Starter',
      unlock: { type: 'free', label: 'Your starter tank' },
      capacity: { spaceCapacity: 8 },
      simulation: {
        baseDirtyRatePerHour: 0.4,
        dirtyPerSpacePerHour: 0.08,
        hungerRateMultiplier: 1.0,
      },
      visuals: {
        waterTint: '#a8d8c8',
        substrate: 'gravel',
        themeKey: 'fresh',
      },
      content: {
        fish: {
          guppy: {
            name: 'Guppy', basePrice: 15, baseCoinPerHour: 2.5,
            hungerRate: 0.9, spaceCost: 1,
            diet: { accepts: ['basic_flakes', 'pellets'] },
            preferences: { zonePreference: 'top', schooling: false },
            visuals: { spriteKey: 'guppy', sizeVarianceRange: [0.9, 1.1] },
          },
          goldfish: {
            name: 'Goldfish', basePrice: 35, baseCoinPerHour: 4.0,
            hungerRate: 1.0, spaceCost: 3,
            diet: { accepts: ['basic_flakes', 'pellets'] },
            preferences: { zonePreference: 'middle' },
            visuals: { spriteKey: 'goldfish', sizeVarianceRange: [0.9, 1.1] },
          },
          snail: {
            name: 'Mystery Snail', basePrice: 40, baseCoinPerHour: 0.5,
            hungerRate: 0.5, spaceCost: 1,
            diet: { accepts: ['algae_wafer'] },
            preferences: { zonePreference: 'bottom', movementType: 'crawl' },
            utility: { dirtReduction: 0.15 },
            visuals: { spriteKey: 'snail', sizeVarianceRange: [0.85, 1.0] },
          },
        },
        food: {
          basic_flakes: { name: 'Basic Flakes', price: 3, hungerRestore: 30, xp: 5, sinkBehavior: 'slowSink' },
          pellets: { name: 'Pellets', price: 6, hungerRestore: 45, xp: 8, sinkBehavior: 'sink' },
          algae_wafer: { name: 'Algae Wafer', price: 4, hungerRestore: 35, xp: 5, sinkBehavior: 'sink' },
        },
        decor: {
          hornwort: {
            name: 'Hornwort', price: 20, placement: 'mid',
            growth: { growthRatePerHour: 0.02, minSize: 0.5, maxSize: 2.0 },
            visuals: { spriteKey: 'hornwort' },
          },
          vallisneria: {
            name: 'Vallisneria', price: 25, placement: 'mid',
            growth: { growthRatePerHour: 0.018, minSize: 0.4, maxSize: 2.2 },
            visuals: { spriteKey: 'vallisneria' },
          },
          anubias: {
            name: 'Anubias', price: 22, placement: 'mid',
            growth: { growthRatePerHour: 0.008, minSize: 0.5, maxSize: 1.4 },
            visuals: { spriteKey: 'anubias' },
          },
          moss_ball: {
            name: 'Moss Ball', price: 15, placement: 'bottom',
            visuals: { spriteKey: 'moss_ball' },
          },
          rock_pile: {
            name: 'Rock Pile', price: 25, placement: 'bottom',
            visuals: { spriteKey: 'rock_pile' },
          },
          driftwood: {
            name: 'Driftwood', price: 35, placement: 'mid',
            visuals: { spriteKey: 'driftwood' },
          },
          treasure_chest: {
            name: 'Treasure Chest', price: 50, placement: 'bottom',
            visuals: { spriteKey: 'treasure_chest' },
          },
        },
        tools: {},
      },
      store: {
        sections: [
          { id: 'fish', order: ['guppy', 'goldfish', 'snail'] },
          { id: 'food', order: ['basic_flakes', 'pellets', 'algae_wafer'] },
          { id: 'decor', order: ['hornwort', 'vallisneria', 'anubias', 'moss_ball', 'rock_pile', 'driftwood', 'treasure_chest'] },
          { id: 'tools', order: [] },
        ],
      },
    },

    // ── TROPICAL PLANTED TANK ────────────────────────────────────────
    tropical: {
      id: 'tropical',
      name: 'Tropical Planted',
      unlock: { type: 'lifetimeCoins', value: 500, label: 'Earn 500 lifetime coins' },
      capacity: { spaceCapacity: 14 },
      simulation: {
        baseDirtyRatePerHour: 0.5,
        dirtyPerSpacePerHour: 0.10,
        hungerRateMultiplier: 1.0,
      },
      visuals: {
        waterTint: '#40b8d0',
        substrate: 'gravel',
        themeKey: 'tropical',
      },
      content: {
        fish: {
          neon_tetra: {
            name: 'Neon Tetra', basePrice: 25, baseCoinPerHour: 3.2,
            hungerRate: 0.8, spaceCost: 0.5,
            diet: { accepts: ['tropical_flakes', 'bloodworms'] },
            requirements: { tools: [...TROPICAL_TOOL_REQS] },
            preferences: { zonePreference: 'middle', schooling: true },
            visuals: { spriteKey: 'neon_tetra', sizeVarianceRange: [0.9, 1.1] },
          },
          blue_eye: {
            name: 'Blue-Eye', basePrice: 30, baseCoinPerHour: 3.5,
            hungerRate: 0.9, spaceCost: 1,
            diet: { accepts: ['tropical_flakes', 'pellets'] },
            requirements: { tools: [...TROPICAL_TOOL_REQS] },
            preferences: { zonePreference: 'top' },
            visuals: { spriteKey: 'blue_eye', sizeVarianceRange: [0.9, 1.1] },
          },
          moon_fish: {
            name: 'Moon Fish', basePrice: 40, baseCoinPerHour: 4.5,
            hungerRate: 1.0, spaceCost: 2,
            diet: { accepts: ['tropical_flakes', 'pellets', 'bloodworms'] },
            requirements: { tools: [...TROPICAL_TOOL_REQS] },
            preferences: { zonePreference: 'middle' },
            visuals: { spriteKey: 'moon_fish', sizeVarianceRange: [0.9, 1.1] },
          },
          discus: {
            name: 'Discus', basePrice: 70, baseCoinPerHour: 6.5,
            hungerRate: 1.1, spaceCost: 4,
            diet: { accepts: ['tropical_flakes', 'bloodworms'] },
            requirements: {
              tools: [...TROPICAL_TOOL_REQS],
              plantMass: { minTotal: 3.0, penalty: 25, label: 'Needs more plants (mass \u2265 3.0)' },
            },
            preferences: { zonePreference: 'middle' },
            visuals: { spriteKey: 'discus', sizeVarianceRange: [0.85, 1.1] },
          },
          pleco: {
            name: 'Pleco', basePrice: 50, baseCoinPerHour: 1.8,
            hungerRate: 0.6, spaceCost: 3,
            diet: { accepts: ['algae_wafer'] },
            requirements: { tools: [...TROPICAL_TOOL_REQS] },
            preferences: { zonePreference: 'bottom', movementType: 'glass' },
            utility: { dirtReduction: 0.10 },
            visuals: { spriteKey: 'pleco', sizeVarianceRange: [0.9, 1.15] },
          },
          gourami: {
            name: 'Gourami', basePrice: 55, baseCoinPerHour: 5.5,
            hungerRate: 1.0, spaceCost: 2,
            diet: { accepts: ['tropical_flakes', 'pellets', 'bloodworms'] },
            requirements: {
              tools: [...TROPICAL_TOOL_REQS],
              floatingPlants: { minCount: 1, penalty: 30, label: 'Needs floating plants' },
            },
            preferences: { zonePreference: 'top' },
            visuals: { spriteKey: 'gourami', sizeVarianceRange: [0.9, 1.1] },
          },
        },
        food: {
          tropical_flakes: { name: 'Tropical Flakes', price: 4, hungerRestore: 30, xp: 5, sinkBehavior: 'slowSink' },
          pellets: { name: 'Pellets', price: 6, hungerRestore: 45, xp: 8, sinkBehavior: 'sink' },
          bloodworms: { name: 'Bloodworms', price: 8, hungerRestore: 55, xp: 10, sinkBehavior: 'slowSink' },
          algae_wafer: { name: 'Algae Wafer', price: 4, hungerRestore: 35, xp: 5, sinkBehavior: 'sink' },
        },
        decor: {
          java_fern: {
            name: 'Java Fern', price: 30, placement: 'mid',
            growth: { growthRatePerHour: 0.015, minSize: 0.5, maxSize: 1.8 },
            visuals: { spriteKey: 'java_fern' },
          },
          amazon_sword: {
            name: 'Amazon Sword', price: 40, placement: 'mid',
            growth: { growthRatePerHour: 0.02, minSize: 0.5, maxSize: 2.0 },
            visuals: { spriteKey: 'amazon_sword' },
          },
          cryptocoryne: {
            name: 'Cryptocoryne', price: 28, placement: 'mid',
            growth: { growthRatePerHour: 0.012, minSize: 0.4, maxSize: 1.6 },
            visuals: { spriteKey: 'cryptocoryne' },
          },
          ludwigia: {
            name: 'Ludwigia', price: 35, placement: 'mid',
            growth: { growthRatePerHour: 0.022, minSize: 0.4, maxSize: 2.0 },
            visuals: { spriteKey: 'ludwigia' },
          },
          floating_plants: {
            name: 'Floating Plants', price: 20, placement: 'top',
            growth: { growthRatePerHour: 0.025, minSize: 0.3, maxSize: 1.5 },
            spread: { spreadChancePerDay: 0.3, maxClusters: 4, spawnRadius: 0.15, spreadThreshold: 0.8 },
            visuals: { spriteKey: 'floating_plants' },
          },
          mossy_log: {
            name: 'Mossy Log', price: 45, placement: 'bottom',
            visuals: { spriteKey: 'mossy_log' },
          },
          hollow_stump: {
            name: 'Hollow Stump', price: 55, placement: 'bottom',
            visuals: { spriteKey: 'hollow_stump' },
          },
        },
        tools: {
          heater: {
            name: 'Heater', prices: [60], maxLevel: 1,
            effect: {},
            negativeIfMissing: { penalty: 20, label: 'Missing Heater' },
          },
          filter_tropical: {
            name: 'Filter', prices: [80, 180], maxLevel: 2,
            effect: { dirtReduction: [0.20, 0.30], flow: [0.3, 0.6] },
          },
        },
      },
      store: {
        sections: [
          { id: 'fish', order: ['neon_tetra', 'blue_eye', 'moon_fish', 'discus', 'pleco', 'gourami'] },
          { id: 'food', order: ['tropical_flakes', 'pellets', 'bloodworms', 'algae_wafer'] },
          { id: 'decor', order: ['java_fern', 'amazon_sword', 'cryptocoryne', 'ludwigia', 'floating_plants', 'mossy_log', 'hollow_stump'] },
          { id: 'tools', order: ['heater', 'filter_tropical'] },
        ],
      },
    },

    // ── SALTWATER REEF TANK ──────────────────────────────────────────
    salt: {
      id: 'salt',
      name: 'Saltwater Reef',
      unlock: {
        type: 'compound',
        rules: [
          { type: 'lifetimeCoins', value: 2000 },
          { type: 'toolOwned', toolId: 'heater', tankId: 'tropical' },
        ],
        label: 'Earn 2000 lifetime coins and own a Heater',
      },
      capacity: { spaceCapacity: 20 },
      simulation: {
        baseDirtyRatePerHour: 0.6,
        dirtyPerSpacePerHour: 0.12,
        hungerRateMultiplier: 1.0,
      },
      visuals: {
        waterTint: '#1a4a7a',
        substrate: 'sand',
        themeKey: 'salt',
      },
      content: {
        fish: {
          clownfish: {
            name: 'Clownfish', basePrice: 45, baseCoinPerHour: 5.0,
            hungerRate: 1.0, spaceCost: 2,
            diet: { accepts: ['marine_pellets', 'reef_flakes', 'frozen_brine'] },
            requirements: {
              tools: [...SALT_TOOL_REQS],
              decor: [{ decorId: 'anemone', penalty: 40, label: 'Missing Anemone' }],
            },
            preferences: { nearDecor: 'anemone', zonePreference: 'middle' },
            visuals: { spriteKey: 'clownfish', sizeVarianceRange: [0.9, 1.1] },
          },
          blue_tang: {
            name: 'Blue Tang', basePrice: 80, baseCoinPerHour: 7.5,
            hungerRate: 1.1, spaceCost: 3,
            diet: { accepts: ['marine_pellets', 'reef_flakes'] },
            requirements: { tools: [...SALT_TOOL_REQS] },
            preferences: { zonePreference: 'middle' },
            visuals: { spriteKey: 'blue_tang', sizeVarianceRange: [0.9, 1.1] },
          },
          green_chromis: {
            name: 'Green Chromis', basePrice: 35, baseCoinPerHour: 3.0,
            hungerRate: 0.8, spaceCost: 0.5,
            diet: { accepts: ['reef_flakes', 'frozen_brine'] },
            requirements: { tools: [...SALT_TOOL_REQS] },
            preferences: { zonePreference: 'middle', schooling: true },
            visuals: { spriteKey: 'green_chromis', sizeVarianceRange: [0.9, 1.1] },
          },
          firefish: {
            name: 'Firefish', basePrice: 45, baseCoinPerHour: 4.5,
            hungerRate: 0.9, spaceCost: 1,
            diet: { accepts: ['reef_flakes', 'frozen_brine'] },
            requirements: { tools: [...SALT_TOOL_REQS] },
            preferences: { nearDecor: 'brain_coral', zonePreference: 'middle' },
            visuals: { spriteKey: 'firefish', sizeVarianceRange: [0.9, 1.1] },
          },
          royal_gramma: {
            name: 'Royal Gramma', basePrice: 55, baseCoinPerHour: 5.0,
            hungerRate: 0.9, spaceCost: 1.5,
            diet: { accepts: ['marine_pellets', 'reef_flakes'] },
            requirements: { tools: [...SALT_TOOL_REQS] },
            preferences: { nearDecor: 'cave', zonePreference: 'bottom' },
            visuals: { spriteKey: 'royal_gramma', sizeVarianceRange: [0.9, 1.1] },
          },
          banggai_cardinal: {
            name: 'Banggai Cardinalfish', basePrice: 45, baseCoinPerHour: 3.8,
            hungerRate: 0.8, spaceCost: 1,
            diet: { accepts: ['reef_flakes', 'frozen_brine'] },
            requirements: { tools: [...SALT_TOOL_REQS] },
            preferences: { zonePreference: 'middle', schooling: true },
            visuals: { spriteKey: 'banggai_cardinal', sizeVarianceRange: [0.9, 1.1] },
          },
          moray_eel: {
            name: 'Moray Eel', basePrice: 150, baseCoinPerHour: 12.0,
            hungerRate: 1.3, spaceCost: 8, maxPerTank: 1,
            diet: { accepts: ['marine_pellets', 'frozen_brine', 'live_shrimp'] },
            requirements: {
              tools: [...SALT_TOOL_REQS],
              decor: [{ decorId: 'cave', penalty: 55, label: 'Missing Cave' }],
            },
            preferences: { nearDecor: 'cave', zonePreference: 'bottom', movementType: 'snake' },
            visuals: { spriteKey: 'moray_eel', sizeVarianceRange: [0.95, 1.05] },
          },
          cleaner_shrimp: {
            name: 'Cleaner Shrimp', basePrice: 55, baseCoinPerHour: 1.8,
            hungerRate: 0.5, spaceCost: 0.5,
            diet: { accepts: ['reef_flakes'] },
            requirements: { tools: [...SALT_TOOL_REQS] },
            preferences: { zonePreference: 'bottom', movementType: 'crawl' },
            utility: { dirtReduction: 0.08 },
            visuals: { spriteKey: 'cleaner_shrimp', sizeVarianceRange: [0.85, 1.0] },
          },
        },
        food: {
          marine_pellets: { name: 'Marine Pellets', price: 8, hungerRestore: 45, xp: 8, sinkBehavior: 'sink' },
          reef_flakes: { name: 'Reef Flakes', price: 6, hungerRestore: 30, xp: 5, sinkBehavior: 'slowSink' },
          frozen_brine: { name: 'Frozen Brine Shrimp', price: 10, hungerRestore: 55, xp: 10, sinkBehavior: 'slowSink' },
          live_shrimp: { name: 'Live Shrimp', price: 18, hungerRestore: 70, xp: 15, sinkBehavior: 'sink' },
        },
        decor: {
          anemone: {
            name: 'Anemone', price: 80, placement: 'any',
            visuals: { spriteKey: 'anemone' },
          },
          live_rock: {
            name: 'Live Rock', price: 45, placement: 'bottom',
            visuals: { spriteKey: 'live_rock' },
          },
          brain_coral: {
            name: 'Brain Coral', price: 60, placement: 'bottom',
            visuals: { spriteKey: 'brain_coral' },
          },
          staghorn_coral: {
            name: 'Staghorn Coral', price: 55, placement: 'any',
            visuals: { spriteKey: 'staghorn_coral' },
          },
          cave: {
            name: 'Cave', price: 100, placement: 'bottom',
            maxPerTank: 1,
            visuals: { spriteKey: 'cave' },
          },
          sea_fan: {
            name: 'Sea Fan', price: 40, placement: 'any',
            visuals: { spriteKey: 'sea_fan' },
          },
        },
        tools: {
          filter_salt: {
            name: 'Filter', prices: [100, 220], maxLevel: 2,
            effect: { dirtReduction: [0.20, 0.30], flow: [0.3, 0.6] },
            negativeIfMissing: { penalty: 15, label: 'Missing Filter' },
          },
          skimmer: {
            name: 'Protein Skimmer', prices: [150], maxLevel: 1,
            effect: { dirtReduction: [0.20] },
            negativeIfMissing: { penalty: 15, label: 'Missing Protein Skimmer' },
          },
          uv_sterilizer: {
            name: 'UV Sterilizer', prices: [200], maxLevel: 1,
            effect: {},
            negativeIfMissing: { penalty: 20, label: 'Missing UV Sterilizer' },
          },
        },
      },
      store: {
        sections: [
          { id: 'fish', order: ['clownfish', 'blue_tang', 'green_chromis', 'firefish', 'royal_gramma', 'banggai_cardinal', 'moray_eel', 'cleaner_shrimp'] },
          { id: 'food', order: ['marine_pellets', 'reef_flakes', 'frozen_brine', 'live_shrimp'] },
          { id: 'decor', order: ['anemone', 'live_rock', 'brain_coral', 'staghorn_coral', 'cave', 'sea_fan'] },
          { id: 'tools', order: ['filter_salt', 'skimmer', 'uv_sterilizer'] },
        ],
      },
    },
  },
};

// ═══════════════════════════════════════════
//  SAVE MODEL — Initial state & factories
// ═══════════════════════════════════════════

function createDefaultTank(tankId, unlocked) {
  const tankCat = CATALOG.tanks[tankId];
  if (!tankCat) return null;

  return {
    id: tankId,
    unlocked: !!unlocked,
    cleanliness: 100,
    lastSeenAt: Date.now(),
    foodStock: {},
    toolsOwned: {},
    fish: [],
    decor: [],
  };
}

function createFishInstance(speciesId) {
  return {
    id: generateId(),
    speciesId,
    bornAt: Date.now(),
    level: 1,
    xp: 0,
    hunger: 90 + Math.floor(Math.random() * 10),
    health: 100,
    weak: false,
    lastFedAt: Date.now(),
    lastPlayedAt: null,
  };
}

function createDecorInstance(decorId, x, y) {
  return {
    id: generateId(),
    decorId,
    x: x ?? (0.2 + Math.random() * 0.6),
    y: y ?? 0.85,
    size: 1.0,
    placedAt: Date.now(),
    state: {},
  };
}

function createInitialState(widgetInstanceId) {
  const freshTank = createDefaultTank('fresh', true);
  freshTank.foodStock = { basic_flakes: 10 };

  // Start with one guppy
  const starterFish = createFishInstance('guppy');
  starterFish.hunger = 95;
  freshTank.fish = [starterFish];

  return {
    version: CURRENT_SAVE_VERSION,
    widgetInstanceId: widgetInstanceId || 'default',
    activeTankId: 'fresh',
    coins: 50,
    tanks: {
      fresh: freshTank,
      tropical: createDefaultTank('tropical', false),
      salt: createDefaultTank('salt', false),
    },
    lifetime: {
      coinsEarned: 0,
    },
    meta: {
      createdAt: Date.now(),
      lastSavedAt: Date.now(),
      lastCatalogVersion: CATALOG.contentVersion,
    },
  };
}

// ═══════════════════════════════════════════
//  MIGRATION & RECONCILIATION
// ═══════════════════════════════════════════

/**
 * Migrate old save formats to current version.
 * Chained: v0 → v1, never skip.
 */
function migrateSave(save) {
  if (!save) return null;

  // Handle saves from the old (test) implementation
  if (save.version === 3 && save.unlockedTanks) {
    return migrateFromLegacy(save);
  }

  // v1 → v2: Move coins from per-tank to global
  if (save.version < 2) {
    let totalCoins = 0;
    for (const tankId of Object.keys(save.tanks || {})) {
      const tank = save.tanks[tankId];
      if (tank && typeof tank.coins === 'number') {
        totalCoins += tank.coins;
        delete tank.coins;
      }
    }
    save.coins = totalCoins;
    save.version = 2;
  }

  return save;
}

/** Migrate from the old numeric-tank implementation to the new spec format. */
function migrateFromLegacy(old) {
  const now = Date.now();
  const freshTank = createDefaultTank('fresh', true);
  freshTank.lastSeenAt = old.lastSeenAt || now;

  // Migrate food stock
  if (old.foodStock) {
    freshTank.foodStock = {
      basic_flakes: old.foodStock.flakes || 0,
      pellets: old.foodStock.pellets || 0,
    };
  }

  // Migrate fish from old tank 1 (cold water) into fresh
  const oldTank = old.tanks && old.tanks[1];
  if (oldTank && oldTank.fish) {
    freshTank.fish = oldTank.fish.map(f => {
      // Map old species to new (goldfish → goldfish, koi → goldfish, guppy → guppy)
      let speciesId = f.speciesId;
      if (speciesId === 'koi') speciesId = 'goldfish';
      if (!CATALOG.tanks.fresh.content.fish[speciesId]) speciesId = 'guppy';

      return {
        id: f.id || generateId(),
        speciesId,
        bornAt: f.bornAt || now,
        level: f.level || 1,
        xp: f.xp || 0,
        hunger: clamp(f.hunger || 80, 0, 100),
        health: clamp(f.health || 100, 0, 100),
        weak: !!f.weak,
        lastFedAt: now,
        lastPlayedAt: null,
      };
    });
    freshTank.cleanliness = clamp(oldTank.cleanliness || 100, 0, 100);
  }

  if (freshTank.fish.length === 0) {
    const starter = createFishInstance('guppy');
    freshTank.fish = [starter];
  }

  return {
    version: CURRENT_SAVE_VERSION,
    widgetInstanceId: 'default',
    activeTankId: 'fresh',
    coins: old.coins || 50,
    tanks: {
      fresh: freshTank,
      tropical: createDefaultTank('tropical', false),
      salt: createDefaultTank('salt', false),
    },
    lifetime: {
      coinsEarned: old.stats?.coinsEarnedLifetime || 0,
    },
    meta: {
      createdAt: now,
      lastSavedAt: now,
      lastCatalogVersion: CATALOG.contentVersion,
    },
  };
}

/**
 * Reconcile save with current catalog:
 * 1. Map IDs through aliases
 * 2. Handle unknown IDs (legacy fallback)
 * 3. Clamp values to new bounds
 * 4. Create default tank slots for new catalog tanks
 */
function reconcileSaveWithCatalog(save) {
  const catalog = CATALOG;

  // Ensure global coins field exists (v2 migration safety net)
  if (typeof save.coins !== 'number') {
    save.coins = 0;
  }

  // Ensure all catalog tanks have a save slot
  for (const tankId of Object.keys(catalog.tanks)) {
    if (!save.tanks[tankId]) {
      save.tanks[tankId] = createDefaultTank(tankId, false);
    }
  }

  for (const tankId of Object.keys(save.tanks)) {
    const tank = save.tanks[tankId];
    const tankCat = catalog.tanks[tankId];
    if (!tankCat) continue;

    // 1. Alias mapping for fish
    for (const fish of tank.fish) {
      const alias = catalog.aliases.fish[fish.speciesId];
      if (alias) fish.speciesId = alias;
    }

    // 2. Alias mapping for decor
    for (const decor of tank.decor) {
      const alias = catalog.aliases.decor[decor.decorId];
      if (alias) decor.decorId = alias;
    }

    // 3. Mark unknown fish as legacy
    for (const fish of tank.fish) {
      if (!tankCat.content.fish[fish.speciesId]) {
        fish._legacy = true;
      }
    }

    // 4. Clamp decor sizes to catalog bounds
    for (const decor of tank.decor) {
      const decorDef = tankCat.content.decor[decor.decorId];
      if (decorDef && decorDef.growth) {
        decor.size = clamp(decor.size, decorDef.growth.minSize, decorDef.growth.maxSize);
      }
    }

    // 5. Clamp tool levels
    for (const [toolId, level] of Object.entries(tank.toolsOwned)) {
      const toolDef = tankCat.content.tools[toolId];
      if (toolDef) {
        tank.toolsOwned[toolId] = Math.min(level, toolDef.maxLevel);
      }
    }
  }

  save.meta.lastCatalogVersion = catalog.contentVersion;
  return save;
}

// ═══════════════════════════════════════════
//  HAPPINESS — Pure functions for fish well-being
// ═══════════════════════════════════════════

function hungerContribution(hunger) {
  if (hunger >= 70) return 0;
  if (hunger >= 40) return -(70 - hunger) * 0.5;
  if (hunger >= 10) return -(70 - hunger) * 0.8;
  return -60;
}

function cleanlinessContribution(cleanliness) {
  if (cleanliness >= 60) return 0;
  if (cleanliness >= 30) return -(60 - cleanliness) * 0.5;
  return -(60 - cleanliness) * 1.0;
}

/**
 * Calculate happiness for a single fish in a tank.
 * Returns { happiness: number, breakdown: Array<{ label, value }> }
 */
function calculateHappiness(fish, tank, tankCat) {
  if (!tankCat) return { happiness: 50, breakdown: [] };

  const species = tankCat.content.fish[fish.speciesId];
  if (!species || fish._legacy) return { happiness: 50, breakdown: [] };

  let happiness = 100;
  const breakdown = [];

  // Hunger contribution
  const hungerVal = hungerContribution(fish.hunger);
  if (hungerVal !== 0) {
    breakdown.push({ label: fish.hunger < 40 ? 'Hunger: Low' : 'Hunger: Fair', value: Math.round(hungerVal) });
  } else {
    breakdown.push({ label: 'Hunger: OK', value: 0 });
  }
  happiness += hungerVal;

  // Cleanliness contribution
  const cleanVal = cleanlinessContribution(tank.cleanliness);
  if (cleanVal !== 0) {
    breakdown.push({ label: tank.cleanliness < 30 ? 'Cleanliness: Very Low' : 'Cleanliness: Low', value: Math.round(cleanVal) });
  } else {
    breakdown.push({ label: 'Cleanliness: OK', value: 0 });
  }
  happiness += cleanVal;

  // Requirement penalties
  const reqs = species.requirements || {};

  // Tool requirements
  if (reqs.tools) {
    for (const req of reqs.tools) {
      const toolLevel = tank.toolsOwned[req.toolId] || 0;
      if (toolLevel <= 0) {
        happiness -= req.penalty;
        breakdown.push({ label: req.label, value: -req.penalty });
      }
    }
  }

  // Decor requirements
  if (reqs.decor) {
    for (const req of reqs.decor) {
      const hasDecor = tank.decor.some(d => d.decorId === req.decorId);
      if (!hasDecor) {
        happiness -= req.penalty;
        breakdown.push({ label: req.label, value: -req.penalty });
      }
    }
  }

  // Plant mass requirement
  if (reqs.plantMass) {
    const totalPlantMass = tank.decor.reduce((sum, d) => {
      const dd = tankCat.content.decor[d.decorId];
      if (dd && dd.growth) return sum + d.size;
      return sum;
    }, 0);
    if (totalPlantMass < reqs.plantMass.minTotal) {
      happiness -= reqs.plantMass.penalty;
      breakdown.push({ label: reqs.plantMass.label, value: -reqs.plantMass.penalty });
    }
  }

  // Floating plants requirement
  if (reqs.floatingPlants) {
    const floatingCount = tank.decor.filter(d => {
      const dd = tankCat.content.decor[d.decorId];
      return dd && dd.placement === 'top';
    }).length;
    if (floatingCount < reqs.floatingPlants.minCount) {
      happiness -= reqs.floatingPlants.penalty;
      breakdown.push({ label: reqs.floatingPlants.label, value: -reqs.floatingPlants.penalty });
    }
  }

  // Preferred decor bonus (small)
  const plantCount = tank.decor.filter(d => {
    const dd = tankCat.content.decor[d.decorId];
    return dd && dd.growth;
  }).length;
  const plantBonus = Math.min(plantCount * 2, 10);
  if (plantBonus > 0) {
    happiness += plantBonus;
    breakdown.push({ label: 'Plant bonus', value: plantBonus });
  }

  happiness = clamp(Math.round(happiness), 0, 100);
  return { happiness, breakdown };
}

/** Coin generation modifier based on happiness (see spec §9.5). */
function getHappinessCoinMod(happiness) {
  if (happiness >= 80) return 1.0;
  if (happiness >= 60) return 0.70;
  if (happiness >= 40) return 0.40;
  if (happiness >= 20) return 0.15;
  return 0;
}

// ═══════════════════════════════════════════
//  SIMULATION ENGINE — Idle catch-up logic
// ═══════════════════════════════════════════

function getLifeStage(fish) {
  const ageDays = (Date.now() - fish.bornAt) / 86400000;
  if (ageDays < 2) return { stage: 'Baby', coinMult: 0.90 };
  if (ageDays < 7) return { stage: 'Child', coinMult: 1.00 };
  return { stage: 'Adult', coinMult: 1.05 };
}

function xpToNextLevel(level) {
  return XP_BASE + XP_PER_LEVEL_SCALE * (level - 1);
}

/** Calculate effective dirt rate for a tank including tool and utility fish reductions. */
function getEffectiveDirtRate(tank, tankCat) {
  const totalSpace = tank.fish.reduce((sum, f) => {
    const sp = tankCat.content.fish[f.speciesId];
    return sum + (sp ? sp.spaceCost : 1);
  }, 0);

  let rate = tankCat.simulation.baseDirtyRatePerHour
           + totalSpace * tankCat.simulation.dirtyPerSpacePerHour;

  // Tool dirt reduction (multiplicative per tool)
  for (const [toolId, level] of Object.entries(tank.toolsOwned)) {
    const tool = tankCat.content.tools[toolId];
    if (tool && tool.effect && tool.effect.dirtReduction && level > 0) {
      const reduction = tool.effect.dirtReduction[level - 1] || 0;
      rate *= (1 - reduction);
    }
  }

  // Utility fish dirt reduction (additive, then applied)
  let utilityReduction = 0;
  for (const fish of tank.fish) {
    const sp = tankCat.content.fish[fish.speciesId];
    if (sp && sp.utility && sp.utility.dirtReduction) {
      utilityReduction += sp.utility.dirtReduction;
    }
  }
  rate *= Math.max(0, 1 - utilityReduction);

  return Math.max(rate, 0.05);
}

/** Calculate effective flow strength from filters/pumps. 0 = no flow, 1 = max. */
function getEffectiveFlow(tank, tankCat) {
  let flow = 0;
  for (const [toolId, level] of Object.entries(tank.toolsOwned)) {
    const tool = tankCat.content.tools[toolId];
    if (tool && tool.effect && tool.effect.flow && level > 0) {
      flow = Math.max(flow, tool.effect.flow[level - 1] || 0);
    }
  }
  return Math.min(flow, 1.0);
}

/**
 * Run idle simulation for all unlocked tanks.
 * Returns { coinsEarned, dtHours }.
 */
function simulate(save) {
  const now = Date.now();
  let totalCoinsEarned = 0;

  for (const tankId of Object.keys(save.tanks)) {
    const tank = save.tanks[tankId];
    if (!tank || !tank.unlocked) continue;

    const tankCat = CATALOG.tanks[tankId];
    if (!tankCat) continue;

    const dtMs = Math.min(now - (tank.lastSeenAt || now), MAX_IDLE_HOURS * 3600000);
    const dtHours = dtMs / 3600000;
    if (dtHours <= 0) {
      tank.lastSeenAt = now;
      continue;
    }

    // 1. Dirt accumulation
    const dirtRate = getEffectiveDirtRate(tank, tankCat);
    tank.cleanliness = clamp(tank.cleanliness - dirtRate * dtHours, 0, 100);

    // 2. Per-fish simulation
    for (const fish of tank.fish) {
      const species = tankCat.content.fish[fish.speciesId];
      if (!species) continue;

      // Hunger decay
      const hungerLoss = species.hungerRate * tankCat.simulation.hungerRateMultiplier * dtHours;
      fish.hunger = clamp(fish.hunger - hungerLoss, 0, 100);

      // Weak state check
      const { happiness } = calculateHappiness(fish, tank, tankCat);
      const hungerWeak = fish.hunger <= WEAK_HUNGER_THRESHOLD
        && (fish.lastFedAt ? (now - fish.lastFedAt) > WEAK_HUNGER_DURATION_MS : true);
      const healthWeak = fish.health <= WEAK_HEALTH_THRESHOLD;
      const happinessWeak = happiness < HAPPINESS_WEAK_THRESHOLD;
      const shouldWeaken = hungerWeak || healthWeak || happinessWeak;

      if (shouldWeaken && !fish.weak) {
        fish.weak = true;
        fish.health = clamp(fish.health - 20, 0, 100);
      }

      // Recovery check
      if (fish.weak) {
        const meetsRecovery = fish.hunger >= RECOVERY_HUNGER
          && tank.cleanliness >= RECOVERY_CLEANLINESS;
        if (meetsRecovery) {
          // Also check that requirements are met (no unmet requirement penalties)
          const reqsMet = checkRequirementsMet(fish, tank, tankCat);
          if (reqsMet) {
            fish.weak = false;
          }
        }
      }

      // Health regen
      if (!fish.weak && fish.hunger >= HEALTH_REGEN_HUNGER_MIN && tank.cleanliness >= HEALTH_REGEN_CLEAN_MIN) {
        fish.health = clamp(fish.health + HEALTH_REGEN_RATE_PER_HOUR * dtHours, 0, 100);
      }

      // Coin generation
      const coinMod = getHappinessCoinMod(happiness);
      const lifeStage = getLifeStage(fish);
      const levelBonus = 1 + fish.level * LEVEL_COIN_BONUS;
      const coins = species.baseCoinPerHour * coinMod * levelBonus * lifeStage.coinMult * dtHours;
      save.coins += coins;
      totalCoinsEarned += coins;
    }

    // 3. Plant growth
    for (const decor of tank.decor) {
      const decorDef = tankCat.content.decor[decor.decorId];
      if (decorDef && decorDef.growth) {
        decor.size = clamp(
          decor.size + decorDef.growth.growthRatePerHour * dtHours,
          decorDef.growth.minSize,
          decorDef.growth.maxSize
        );
      }
    }

    // 4. Floating plant spread (deterministic)
    const dtDays = dtHours / 24;
    for (const decor of [...tank.decor]) {
      const decorDef = tankCat.content.decor[decor.decorId];
      if (!decorDef || !decorDef.spread) continue;

      const clusterCount = tank.decor.filter(d => d.decorId === decor.decorId).length;
      if (clusterCount >= decorDef.spread.maxClusters) continue;
      if (decor.size < decorDef.spread.spreadThreshold) continue;

      const dayIndex = Math.floor(now / 86400000);
      const rng = seededRng(hashString(tankId + dayIndex + decor.id));
      if (rng() < decorDef.spread.spreadChancePerDay * dtDays) {
        const newDecor = createDecorInstance(
          decor.decorId,
          clamp(decor.x + (rng() - 0.5) * decorDef.spread.spawnRadius * 2, 0.05, 0.95),
          clamp(decor.y + (rng() - 0.5) * decorDef.spread.spawnRadius, 0.0, 0.3)
        );
        newDecor.size = decorDef.growth.minSize;
        tank.decor.push(newDecor);
      }
    }

    tank.lastSeenAt = now;
  }

  // Track lifetime coins
  save.lifetime.coinsEarned += totalCoinsEarned;
  save.meta.lastSavedAt = now;

  return {
    coinsEarned: Math.floor(totalCoinsEarned),
    dtHours: Math.round(((now - (save.meta.lastSavedAt || now)) / 3600000) * 10) / 10,
  };
}

/** Check if all decor/tool requirements for a fish are met. */
function checkRequirementsMet(fish, tank, tankCat) {
  const species = tankCat.content.fish[fish.speciesId];
  if (!species || !species.requirements) return true;

  const reqs = species.requirements;
  if (reqs.tools) {
    for (const req of reqs.tools) {
      if ((tank.toolsOwned[req.toolId] || 0) <= 0) return false;
    }
  }
  if (reqs.decor) {
    for (const req of reqs.decor) {
      if (!tank.decor.some(d => d.decorId === req.decorId)) return false;
    }
  }
  return true;
}

// ═══════════════════════════════════════════
//  ECONOMY — Price calculations, validation
// ═══════════════════════════════════════════

function getUsedSpace(tank, tankCat) {
  return tank.fish.reduce((sum, f) => {
    const sp = tankCat.content.fish[f.speciesId];
    return sum + (sp ? sp.spaceCost : 1);
  }, 0);
}

function getSpeciesCount(tank, speciesId) {
  return tank.fish.filter(f => f.speciesId === speciesId).length;
}

function getFishPrice(speciesId, ownedCount, tankCat) {
  const species = tankCat.content.fish[speciesId];
  if (!species) return Infinity;
  return Math.ceil(species.basePrice * Math.pow(CATALOG.global.economy.priceGrowth.fish, ownedCount));
}

function getSellReturn(fish, tankCat) {
  const species = tankCat.content.fish[fish.speciesId];
  if (!species) return 0;
  const ownedCount = 1;
  const baseReturn = CATALOG.global.economy.fishSellReturn;
  const levelBonus = 1 + fish.level * 0.05;
  const price = getFishPrice(fish.speciesId, ownedCount, tankCat);
  return Math.ceil(price * baseReturn * levelBonus);
}

function getDecorSellReturn(decorId, tankCat) {
  const decorDef = tankCat.content.decor[decorId];
  if (!decorDef) return 0;
  const returnRate = decorDef.sellReturn ?? CATALOG.global.economy.sellReturnDefault;
  return Math.ceil(decorDef.price * returnRate);
}

/** Check if tank unlock requirements are met. */
function checkUnlockRequirements(save, tankId) {
  const tankCat = CATALOG.tanks[tankId];
  if (!tankCat) return false;

  const rule = tankCat.unlock;
  return evaluateUnlockRule(save, rule);
}

function evaluateUnlockRule(save, rule) {
  if (!rule) return false;
  switch (rule.type) {
    case 'free': return true;
    case 'lifetimeCoins': return save.lifetime.coinsEarned >= (rule.value || 0);
    case 'toolOwned': {
      const tank = save.tanks[rule.tankId];
      return tank && (tank.toolsOwned[rule.toolId] || 0) > 0;
    }
    case 'compound': {
      return (rule.rules || []).every(r => evaluateUnlockRule(save, r));
    }
    default: return false;
  }
}

// ═══════════════════════════════════════════
//  RESPONSE BUILDERS — Client-ready data
// ═══════════════════════════════════════════

function buildResponse(save, actionResult) {
  const tankId = save.activeTankId;
  const tank = save.tanks[tankId];
  const tankCat = CATALOG.tanks[tankId];
  if (!tank || !tankCat) return { save, error: 'Invalid tank' };

  // Compute derived data for each fish in the active tank
  const fishComputed = tank.fish.map(f => {
    const species = tankCat.content.fish[f.speciesId];
    const { happiness, breakdown } = calculateHappiness(f, tank, tankCat);
    const lifeStage = getLifeStage(f);
    const coinMod = getHappinessCoinMod(happiness);
    const levelBonus = 1 + f.level * LEVEL_COIN_BONUS;
    const coinRate = species
      ? species.baseCoinPerHour * coinMod * levelBonus * lifeStage.coinMult
      : 0;

    return {
      ...f,
      _computed: {
        happiness,
        happinessBreakdown: breakdown,
        lifeStage: lifeStage.stage,
        coinRate: Math.round(coinRate * 10) / 10,
        speciesName: species ? species.name : 'Unknown',
        xpToNext: xpToNextLevel(f.level),
      },
    };
  });

  return {
    save: {
      ...save,
      tanks: {
        ...save.tanks,
        [tankId]: { ...tank, fish: fishComputed },
      },
    },
    coins: Math.floor(save.coins),
    activeTankId: tankId,
    tankCatalog: {
      ...tankCat,
      // Include computed dirt rate and flow
      _computed: {
        dirtRate: Math.round(getEffectiveDirtRate(tank, tankCat) * 100) / 100,
        usedSpace: getUsedSpace(tank, tankCat),
        flow: getEffectiveFlow(tank, tankCat),
      },
    },
    store: buildStoreCatalog(save, tankId),
    tanksList: buildTanksList(save),
    global: CATALOG.global,
    result: actionResult || {},
  };
}

function buildStoreCatalog(save, tankId) {
  const tank = save.tanks[tankId];
  const tankCat = CATALOG.tanks[tankId];
  if (!tank || !tankCat) return {};

  const sections = {};

  for (const section of tankCat.store.sections) {
    const items = [];

    for (const itemId of section.order) {
      if (section.id === 'fish') {
        const sp = tankCat.content.fish[itemId];
        if (!sp) continue;
        const ownedCount = getSpeciesCount(tank, itemId);
        const price = getFishPrice(itemId, ownedCount, tankCat);
        const usedSpace = getUsedSpace(tank, tankCat);
        const canAfford = save.coins >= price;
        const hasSpace = usedSpace + sp.spaceCost <= tankCat.capacity.spaceCapacity;
        const maxReached = sp.maxPerTank ? ownedCount >= sp.maxPerTank : false;

        let blockReason = null;
        if (maxReached) blockReason = `Max ${sp.maxPerTank} per tank`;
        else if (!hasSpace) blockReason = `Tank full (${usedSpace}/${tankCat.capacity.spaceCapacity} space)`;
        else if (!canAfford) blockReason = 'Not enough coins';

        // Tool requirement info (shown even if purchasable)
        const reqInfo = [];
        if (sp.requirements?.tools) {
          for (const req of sp.requirements.tools) {
            if ((tank.toolsOwned[req.toolId] || 0) <= 0) {
              reqInfo.push(req.label || `Requires ${req.toolId}`);
            }
          }
        }
        if (sp.requirements?.decor) {
          for (const req of sp.requirements.decor) {
            if (!tank.decor.some(d => d.decorId === req.decorId)) {
              reqInfo.push(req.label || `Requires ${req.decorId}`);
            }
          }
        }

        items.push({
          id: itemId, name: sp.name, price, spaceCost: sp.spaceCost,
          baseCoinPerHour: sp.baseCoinPerHour, ownedCount,
          canBuy: !blockReason, blockReason, reqInfo,
          diet: sp.diet, requirements: sp.requirements,
        });
      } else if (section.id === 'food') {
        const fd = tankCat.content.food[itemId];
        if (!fd) continue;
        const currentStock = tank.foodStock[itemId] || 0;
        items.push({
          id: itemId, name: fd.name, price: fd.price,
          hungerRestore: fd.hungerRestore, sinkBehavior: fd.sinkBehavior,
          currentStock, canBuy: save.coins >= fd.price,
        });
      } else if (section.id === 'decor') {
        const dc = tankCat.content.decor[itemId];
        if (!dc) continue;
        const maxReached = dc.maxPerTank
          ? tank.decor.filter(d => d.decorId === itemId).length >= dc.maxPerTank
          : false;
        items.push({
          id: itemId, name: dc.name, price: dc.price,
          placement: dc.placement, growth: !!dc.growth,
          sellReturn: getDecorSellReturn(itemId, tankCat),
          canBuy: !maxReached && save.coins >= dc.price,
          blockReason: maxReached ? `Max ${dc.maxPerTank} per tank` : (save.coins < dc.price ? 'Not enough coins' : null),
        });
      } else if (section.id === 'tools') {
        const tl = tankCat.content.tools[itemId];
        if (!tl) continue;
        const currentLevel = tank.toolsOwned[itemId] || 0;
        const nextLevel = currentLevel + 1;
        const maxed = currentLevel >= tl.maxLevel;
        const nextPrice = maxed ? null : tl.prices[currentLevel];
        items.push({
          id: itemId, name: tl.name, currentLevel, maxLevel: tl.maxLevel,
          nextPrice, maxed,
          canBuy: !maxed && save.coins >= (nextPrice || Infinity),
          blockReason: maxed ? 'Max level' : (save.coins < nextPrice ? 'Not enough coins' : null),
        });
      }
    }

    sections[section.id] = items;
  }

  return sections;
}

function buildTanksList(save) {
  return Object.keys(CATALOG.tanks).map(tankId => {
    const tankCat = CATALOG.tanks[tankId];
    const tank = save.tanks[tankId];
    const unlocked = tank ? tank.unlocked : false;
    const fishCount = tank ? tank.fish.length : 0;
    const usedSpace = (tank && unlocked) ? getUsedSpace(tank, tankCat) : 0;
    const meetsRequirements = checkUnlockRequirements(save, tankId);

    return {
      tankId,
      name: tankCat.name,
      spaceCapacity: tankCat.capacity.spaceCapacity,
      unlocked,
      fishCount,
      usedSpace,
      meetsRequirements,
      unlockLabel: tankCat.unlock.label,
      isActive: save.activeTankId === tankId,
    };
  });
}

// ═══════════════════════════════════════════
//  ACTION HANDLERS — POST action dispatch
// ═══════════════════════════════════════════

function handleAction(save, type, payload) {
  const tid = save.activeTankId;
  const tank = save.tanks[tid];
  const tankCat = CATALOG.tanks[tid];
  if (!tank || !tankCat) return { error: 'Invalid tank' };

  switch (type) {
    // ── Tank management ──────────────────────────────────────────────
    case 'switch_tank': {
      const { tankId } = payload;
      const targetTank = save.tanks[tankId];
      if (!targetTank || !targetTank.unlocked) return { error: 'Tank not unlocked' };
      save.activeTankId = tankId;
      return { switched: true, tankId };
    }

    case 'unlock_tank': {
      const { tankId } = payload;
      const targetTank = save.tanks[tankId];
      if (!targetTank) return { error: 'Unknown tank' };
      if (targetTank.unlocked) return { error: 'Already unlocked' };
      if (!checkUnlockRequirements(save, tankId)) return { error: 'Requirements not met' };
      targetTank.unlocked = true;
      save.activeTankId = tankId;
      return { unlocked: true, tankId, tankName: CATALOG.tanks[tankId].name };
    }

    // ── Fish actions ─────────────────────────────────────────────────
    case 'buy_fish': {
      const { speciesId } = payload;
      const species = tankCat.content.fish[speciesId];
      if (!species) return { error: 'Unknown species' };

      const usedSpace = getUsedSpace(tank, tankCat);
      if (usedSpace + species.spaceCost > tankCat.capacity.spaceCapacity) {
        return { error: `Tank full (${usedSpace}/${tankCat.capacity.spaceCapacity} space)` };
      }

      if (species.maxPerTank && getSpeciesCount(tank, speciesId) >= species.maxPerTank) {
        return { error: `Max ${species.maxPerTank} per tank` };
      }

      const ownedCount = getSpeciesCount(tank, speciesId);
      const price = getFishPrice(speciesId, ownedCount, tankCat);
      if (save.coins < price) return { error: 'Not enough coins' };

      save.coins -= price;
      const fish = createFishInstance(speciesId);
      tank.fish.push(fish);
      return { bought: true, fish, price };
    }

    case 'sell_fish': {
      const { fishId } = payload;
      const idx = tank.fish.findIndex(f => f.id === fishId);
      if (idx === -1) return { error: 'Fish not found' };

      const fish = tank.fish[idx];
      const value = getSellReturn(fish, tankCat);
      save.coins += value;
      tank.fish.splice(idx, 1);
      return { sold: true, value, speciesId: fish.speciesId };
    }

    // ── Feeding ──────────────────────────────────────────────────────
    case 'feed': {
      const { foodId } = payload;
      const food = tankCat.content.food[foodId];
      if (!food) return { error: 'Unknown food' };
      if ((tank.foodStock[foodId] || 0) <= 0) return { error: 'Out of stock' };
      tank.foodStock[foodId]--;
      return { fed: true, foodId };
    }

    case 'fish_consume': {
      const { fishId, foodId } = payload;
      const fish = tank.fish.find(f => f.id === fishId);
      if (!fish) return { error: 'Fish not found' };
      const food = tankCat.content.food[foodId];
      if (!food) return { error: 'Unknown food' };

      // Check diet
      const species = tankCat.content.fish[fish.speciesId];
      if (species && !species.diet.accepts.includes(foodId)) {
        return { ignored: true };
      }

      fish.hunger = clamp(fish.hunger + food.hungerRestore, 0, 100);
      fish.lastFedAt = Date.now();

      // XP gain
      const xpGain = food.xp;
      fish.xp += xpGain;
      while (fish.level < MAX_LEVEL && fish.xp >= xpToNextLevel(fish.level)) {
        fish.xp -= xpToNextLevel(fish.level);
        fish.level++;
      }

      return { consumed: true, fishId, hunger: fish.hunger, level: fish.level };
    }

    // ── Cleaning ─────────────────────────────────────────────────────
    case 'start_clean': {
      const dirtPercent = 1 - tank.cleanliness / 100;
      const seed = hashString(tid + Math.floor(tank.cleanliness));
      return { started: true, dirtPercent, seed, gridW: CATALOG.global.ui.wipeMaskGrid.w, gridH: CATALOG.global.ui.wipeMaskGrid.h };
    }

    case 'finish_clean': {
      const { improvementPercent } = payload;
      const improvement = clamp(improvementPercent || 0, 0, 100) / 100;
      const dirtBefore = 1 - tank.cleanliness / 100;
      const dirtRemoved = dirtBefore * improvement;
      tank.cleanliness = clamp(tank.cleanliness + dirtRemoved * 100, 0, 100);

      const coinsEarned = Math.floor(dirtRemoved * 100 * CATALOG.global.economy.coinsPer100Dirt);
      save.coins += coinsEarned;
      save.lifetime.coinsEarned += coinsEarned;

      // XP for fish
      for (const fish of tank.fish) {
        fish.xp += Math.ceil(2 * improvement);
        while (fish.level < MAX_LEVEL && fish.xp >= xpToNextLevel(fish.level)) {
          fish.xp -= xpToNextLevel(fish.level);
          fish.level++;
        }
      }

      return { cleaned: true, cleanliness: tank.cleanliness, coinsEarned };
    }

    // ── Play mode (laser) ────────────────────────────────────────────
    case 'laser_pointer': {
      const now = Date.now();
      const lastReward = tank._lastLaserReward || 0;
      if (now - lastReward >= LASER_COOLDOWN_MS) {
        tank._lastLaserReward = now;
        save.coins += LASER_REWARD_COINS;
        save.lifetime.coinsEarned += LASER_REWARD_COINS;

        for (const fish of tank.fish) {
          fish.xp += LASER_REWARD_XP;
          fish.lastPlayedAt = now;
          while (fish.level < MAX_LEVEL && fish.xp >= xpToNextLevel(fish.level)) {
            fish.xp -= xpToNextLevel(fish.level);
            fish.level++;
          }
        }
        return { reward: { coins: LASER_REWARD_COINS, xp: LASER_REWARD_XP } };
      }
      const cooldownRemaining = LASER_COOLDOWN_MS - (now - lastReward);
      return { reward: null, cooldownRemaining };
    }

    // ── Store: buy food ──────────────────────────────────────────────
    case 'buy_food': {
      const { foodId, quantity } = payload;
      const food = tankCat.content.food[foodId];
      if (!food) return { error: 'Unknown food' };
      const qty = Math.max(1, quantity || 5);
      const cost = food.price * qty;
      if (save.coins < cost) return { error: 'Not enough coins' };
      save.coins -= cost;
      tank.foodStock[foodId] = (tank.foodStock[foodId] || 0) + qty;
      return { bought: true, foodId, quantity: qty, newStock: tank.foodStock[foodId] };
    }

    // ── Store: buy decor ─────────────────────────────────────────────
    case 'buy_decor': {
      const { decorId, x, y } = payload;
      const decorDef = tankCat.content.decor[decorId];
      if (!decorDef) return { error: 'Unknown decor' };
      if (decorDef.maxPerTank && tank.decor.filter(d => d.decorId === decorId).length >= decorDef.maxPerTank) {
        return { error: `Max ${decorDef.maxPerTank} per tank` };
      }
      if (save.coins < decorDef.price) return { error: 'Not enough coins' };
      save.coins -= decorDef.price;

      const decor = createDecorInstance(decorId, x, y);
      if (decorDef.growth) {
        decor.size = decorDef.growth.minSize;
      }
      tank.decor.push(decor);
      return { bought: true, decor };
    }

    // ── Store: sell decor ────────────────────────────────────────────
    case 'sell_decor': {
      const { decorInstanceId } = payload;
      const idx = tank.decor.findIndex(d => d.id === decorInstanceId);
      if (idx === -1) return { error: 'Decor not found' };
      const decor = tank.decor[idx];
      const value = getDecorSellReturn(decor.decorId, tankCat);
      save.coins += value;
      tank.decor.splice(idx, 1);
      return { sold: true, value, decorId: decor.decorId };
    }

    // ── Store: buy tool upgrade ──────────────────────────────────────
    case 'buy_tool': {
      const { toolId } = payload;
      const toolDef = tankCat.content.tools[toolId];
      if (!toolDef) return { error: 'Unknown tool' };
      const currentLevel = tank.toolsOwned[toolId] || 0;
      if (currentLevel >= toolDef.maxLevel) return { error: 'Already max level' };
      const price = toolDef.prices[currentLevel];
      if (save.coins < price) return { error: 'Not enough coins' };
      save.coins -= price;
      tank.toolsOwned[toolId] = currentLevel + 1;
      return { bought: true, toolId, level: currentLevel + 1 };
    }

    // ── Decor: move ──────────────────────────────────────────────────
    case 'move_decor': {
      const { decorInstanceId, x: newX, y: newY } = payload;
      const decor = tank.decor.find(d => d.id === decorInstanceId);
      if (!decor) return { error: 'Decor not found' };
      decor.x = clamp(newX ?? decor.x, 0, 1);
      decor.y = clamp(newY ?? decor.y, 0, 1);
      return { moved: true };
    }

    // ── Decor: trim plant ────────────────────────────────────────────
    case 'trim_plant': {
      const { decorInstanceId } = payload;
      const decor = tank.decor.find(d => d.id === decorInstanceId);
      if (!decor) return { error: 'Decor not found' };
      const decorDef = tankCat.content.decor[decor.decorId];
      if (!decorDef || !decorDef.growth) return { error: 'Not a growable plant' };
      const trimStep = 0.25;
      decor.size = clamp(decor.size - trimStep, decorDef.growth.minSize, decorDef.growth.maxSize);
      return { trimmed: true, newSize: decor.size };
    }

    // ── System: reset ────────────────────────────────────────────────
    case 'reset_state': {
      const fresh = createInitialState(save.widgetInstanceId);
      Object.assign(save, fresh);
      return { reset: true };
    }

    // ── Debug scenarios ──────────────────────────────────────────────
    case 'debug_scenario': {
      const { scenario } = payload;
      return applyDebugScenario(save, scenario);
    }

    default:
      return { error: `Unknown action: ${type}` };
  }
}

function applyDebugScenario(save, scenario) {
  const tank = save.tanks[save.activeTankId];
  if (!tank) return { error: 'No active tank' };

  switch (scenario) {
    case 'clean_tank':
      tank.cleanliness = 100;
      tank.fish.forEach(f => { f.hunger = 90; f.weak = false; f.health = 100; });
      return { applied: 'clean_tank' };
    case 'dirty_tank':
      tank.cleanliness = 5;
      return { applied: 'dirty_tank' };
    case 'hungry_fish':
      tank.fish.forEach(f => { f.hunger = 5; });
      return { applied: 'hungry_fish' };
    case 'all_weak':
      tank.fish.forEach(f => { f.weak = true; f.hunger = 5; f.health = 10; });
      return { applied: 'all_weak' };
    case 'rich':
      save.coins = 99999;
      return { applied: 'rich' };
    case 'poor':
      save.coins = 0;
      return { applied: 'poor' };
    case 'full_tank': {
      const tankCat = CATALOG.tanks[save.activeTankId];
      while (getUsedSpace(tank, tankCat) < tankCat.capacity.spaceCapacity) {
        const speciesIds = Object.keys(tankCat.content.fish);
        const smallestSpecies = speciesIds.reduce((best, id) => {
          const sp = tankCat.content.fish[id];
          if (!best || sp.spaceCost < tankCat.content.fish[best].spaceCost) return id;
          return best;
        }, null);
        if (!smallestSpecies) break;
        const sp = tankCat.content.fish[smallestSpecies];
        if (getUsedSpace(tank, tankCat) + sp.spaceCost > tankCat.capacity.spaceCapacity) break;
        tank.fish.push(createFishInstance(smallestSpecies));
      }
      return { applied: 'full_tank' };
    }
    case 'all_unlocked':
      for (const tankId of Object.keys(save.tanks)) {
        const t = save.tanks[tankId];
        if (!t.unlocked) {
          t.unlocked = true;
          if (t.fish.length === 0) {
            const firstSpecies = Object.keys(CATALOG.tanks[tankId].content.fish)[0];
            if (firstSpecies) t.fish.push(createFishInstance(firstSpecies));
          }
        }
      }
      return { applied: 'all_unlocked' };
    case 'missing_requirements': {
      // Remove required decor items to trigger requirement penalties
      tank.decor = tank.decor.filter(d => {
        return d.decorId !== 'anemone' && d.decorId !== 'cave';
      });
      // Remove tools to trigger tool penalties
      for (const toolId of Object.keys(tank.toolsOwned)) {
        delete tank.toolsOwned[toolId];
      }
      return { applied: 'missing_requirements' };
    }
    case 'max_plants': {
      const tankCat = CATALOG.tanks[save.activeTankId];
      for (const decor of tank.decor) {
        const dd = tankCat?.content?.decor?.[decor.decorId];
        if (dd && dd.growth) {
          decor.size = dd.growth.maxSize;
        }
      }
      return { applied: 'max_plants' };
    }
    case 'baby_fish':
      tank.fish.forEach(f => { f.bornAt = Date.now(); });
      return { applied: 'baby_fish' };
    case 'fresh_start': {
      const fresh = createInitialState(save.widgetInstanceId);
      Object.assign(save, fresh);
      return { applied: 'fresh_start' };
    }
    default:
      return { error: `Unknown scenario: ${scenario}` };
  }
}

// ═══════════════════════════════════════════
//  API EXPORTS — Homey SDK endpoints
// ═══════════════════════════════════════════

module.exports = {
  async getState({ homey, query }) {
    const widgetId = query.widgetId || 'default';
    const storeKey = `aquarium_${widgetId}`;

    let save = await homey.settings.get(storeKey);
    let isNew = false;

    if (!save) {
      save = createInitialState(widgetId);
      isNew = true;
    } else {
      // Migration from old format
      save = migrateSave(save);
      if (!save) {
        save = createInitialState(widgetId);
        isNew = true;
      }
      // Reconcile with current catalog
      reconcileSaveWithCatalog(save);
    }

    const simResult = simulate(save);
    await homey.settings.set(storeKey, save);

    return { ...buildResponse(save), simResult, isNew };
  },

  async doAction({ homey, body, query }) {
    const widgetId = query.widgetId || 'default';
    const storeKey = `aquarium_${widgetId}`;

    let save = await homey.settings.get(storeKey);
    if (!save) {
      save = createInitialState(widgetId);
    } else {
      save = migrateSave(save);
      if (!save) save = createInitialState(widgetId);
      reconcileSaveWithCatalog(save);
    }

    const { type, payload } = body || {};
    if (!type) return { error: 'Missing action type' };

    const result = handleAction(save, type, payload || {});
    await homey.settings.set(storeKey, save);

    return buildResponse(save, result);
  },
};
