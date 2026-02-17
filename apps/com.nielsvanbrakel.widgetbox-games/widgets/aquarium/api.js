'use strict';

// ═══════════════════════════════════════════════════════════════════════════════
// Aquarium Widget — Server-side API (Homey SDK 3)
// Multi-tank architecture: players own separate fishbowl / aquarium / big tank,
// each with independent fish populations, upgrades, cleanliness & decorations.
// Coins & food stock are shared globally.
// ═══════════════════════════════════════════════════════════════════════════════

// ── Constants ────────────────────────────────────────────────────────────────

const CONSTANTS = {
  BASE_DIRTY_RATE: 0.45,
  DIRTY_PER_FISH: 0.10,
  CLEAN_RESTORE: 45,
  CLEAN_BONUS_BASE: 10,
  CLEAN_BONUS_SCALE: 0.6,
  CLEAN_XP_PER_FISH: 2,
  CLEAN_COOLDOWN_MS: 2 * 3600000,

  TIER_BASE: 3.2,
  FISH_INFLATION_BASE: 1.18,
  SELL_RETURN_RATE: 0.30,
  STARTING_COINS: 50,
  STARTING_FLAKES: 10,

  WEAK_HUNGER_THRESHOLD: 10,
  WEAK_CLEANLINESS_THRESHOLD: 10,
  WEAK_HEALTH_THRESHOLD: 15,
  RECOVERY_HUNGER: 35,
  RECOVERY_CLEANLINESS: 30,
  HEALTH_REGEN_RATE: 2,
  HEALTH_REGEN_HUNGER_MIN: 40,
  HEALTH_REGEN_CLEAN_MIN: 40,

  XP_PER_FEED: 8,
  XP_BASE: 30,
  XP_PER_LEVEL_SCALE: 14,
  MAX_LEVEL: 10,
  LEVEL_COIN_BONUS: 0.12,

  MAX_SNAILS: 2,
  SNAIL_PRICE: 40,
  SNAIL_DIRTY_REDUCTION: 0.15,

  FILTER_PRICES: [60, 150],
  FILTER_DIRTY_REDUCTION: [0.20, 0.30],
  AUTOFEEDER_PRICES: [80, 200],
  AUTOFEEDER_INTERVAL_HOURS: [6, 4],
  SILO_PRICES: [50, 120],
  SILO_CAPACITY_MULT: [1.5, 2.0],
  BASE_FOOD_CAPACITY: 30,

  TANK_UNLOCK_PRICES: { 2: 200, 3: 2000 },

  LASER_COOLDOWN_MS: 6 * 3600000,
  LASER_REWARD_COINS: 50,
  LASER_REWARD_XP: 10,
};

// ── Tank definitions ─────────────────────────────────────────────────────────

const TANKS = {
  1: {
    name: 'Fishbowl', spaceCapacity: 6,
    allowedSpecies: ['guppy', 'goldfish'],
    features: ['feed', 'clean', 'store'],
  },
  2: {
    name: 'Small Aquarium', spaceCapacity: 10,
    allowedSpecies: ['guppy', 'goldfish', 'neon_tetra', 'betta'],
    features: ['feed', 'clean', 'store', 'snails', 'filter', 'autofeeder', 'silo'],
  },
  3: {
    name: 'Big Freshwater Tank', spaceCapacity: 20,
    allowedSpecies: ['guppy', 'goldfish', 'neon_tetra', 'betta', 'angelfish', 'clownfish'],
    features: ['feed', 'clean', 'store', 'snails', 'filter', 'autofeeder', 'silo', 'laser'],
  },
};

// ── Species ──────────────────────────────────────────────────────────────────

const SPECIES = {
  guppy:      { name: 'Guppy',      basePrice: 15, baseCoinPerHour: 2.5, hungerRate: 1.0, tier: 1, spaceCost: 1, swimPatterns: ['school'],         zones: ['top','middle'],    favoriteFoods: ['flakes','pellets'],         color: { body:'#FF7043', tail:'#FFB74D' } },
  goldfish:   { name: 'Goldfish',    basePrice: 25, baseCoinPerHour: 3.8, hungerRate: 1.2, tier: 1, spaceCost: 2, swimPatterns: ['drift','glide'],  zones: ['middle','bottom'], favoriteFoods: ['pellets','flakes'],         color: { body:'#FF8F00', tail:'#FFB300' } },
  neon_tetra: { name: 'Neon Tetra',  basePrice: 30, baseCoinPerHour: 3.2, hungerRate: 0.9, tier: 2, spaceCost: 1, swimPatterns: ['school'],         zones: ['middle'],          favoriteFoods: ['flakes','premium_flakes'], color: { body:'#29B6F6', tail:'#E53935' } },
  betta:      { name: 'Betta',       basePrice: 45, baseCoinPerHour: 5.0, hungerRate: 1.3, tier: 2, spaceCost: 2, swimPatterns: ['dart','circle'],  zones: ['top','middle'],    favoriteFoods: ['pellets','premium_flakes'],color: { body:'#7E57C2', tail:'#B39DDB' } },
  angelfish:  { name: 'Angelfish',   basePrice: 70, baseCoinPerHour: 6.5, hungerRate: 1.1, tier: 3, spaceCost: 4, swimPatterns: ['glide','drift'],  zones: ['middle'],          favoriteFoods: ['premium_flakes','pellets'],color: { body:'#ECEFF1', tail:'#B0BEC5' } },
  clownfish:  { name: 'Clownfish',   basePrice: 60, baseCoinPerHour: 5.8, hungerRate: 1.0, tier: 3, spaceCost: 3, swimPatterns: ['circle','zigzag'],zones: ['bottom','middle'], favoriteFoods: ['pellets','premium_flakes'],color: { body:'#FF7043', tail:'#FFFFFF' } },
};

// ── Foods ────────────────────────────────────────────────────────────────────

const FOODS = {
  flakes:         { name: 'Flakes',         price: 3,  hungerRestore: 30, xpBonus: 1.0, tier: 1 },
  pellets:        { name: 'Pellets',        price: 6,  hungerRestore: 45, xpBonus: 1.5, tier: 1 },
  premium_flakes: { name: 'Premium Flakes', price: 12, hungerRestore: 60, xpBonus: 2.0, tier: 2 },
};

// ── Equipment upgrades ───────────────────────────────────────────────────────

const UPGRADES = {
  filter:     { name: 'Filter',      icon: '\u{1F527}', maxLevel: 2, minTier: 2, prices: CONSTANTS.FILTER_PRICES,     descriptions: ['Reduces dirt by 20%','Reduces dirt by 30%'] },
  autoFeeder: { name: 'Auto-Feeder', icon: '\u{1F916}', maxLevel: 2, minTier: 2, prices: CONSTANTS.AUTOFEEDER_PRICES, descriptions: ['Auto-feeds every 6h','Auto-feeds every 4h'] },
  foodSilo:   { name: 'Food Silo',   icon: '\u{1F3D7}', maxLevel: 2, minTier: 2, prices: CONSTANTS.SILO_PRICES,       descriptions: ['+50% food capacity','+100% food capacity'] },
};

// ── Decorations ──────────────────────────────────────────────────────────────

const DECORATIONS = {
  plant_fern:    { name: 'Fern',          price: 25,  sellValue: 8,   minTier: 1 },
  plant_grass:   { name: 'Sea Grass',     price: 30,  sellValue: 10,  minTier: 1 },
  plant_anubias: { name: 'Anubias',       price: 40,  sellValue: 13,  minTier: 2 },
  shipwreck:     { name: 'Shipwreck',     price: 80,  sellValue: 25,  minTier: 2 },
  bubbler:       { name: 'Bubble Maker',  price: 60,  sellValue: 20,  minTier: 2 },
  castle:        { name: 'Castle',        price: 120, sellValue: 40,  minTier: 3 },
  treasure:      { name: 'Treasure Chest',price: 100, sellValue: 33,  minTier: 2 },
  coral_rock:    { name: 'Coral Rock',    price: 50,  sellValue: 16,  minTier: 3 },
};

// ── Fish names ───────────────────────────────────────────────────────────────

const FISH_NAMES = [
  'Bubbles','Splash','Nemo','Goldie','Finn','Coral','Shimmer','Dash','Pip','Sunny',
  'Luna','Pearl','Twirl','Ziggy','Drift','Sparkle','Pebbles','Glow','Azure','Ruby',
  'Jade','Storm','Whisper','Breeze','Mochi','Sushi','Tofu','Maple','Clover','Sky',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function randomChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function generateId() { return `f_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }

function getUsedSpace(tank) {
  return tank.fish.reduce((sum, f) => sum + (SPECIES[f.speciesId]?.spaceCost || 1), 0);
}

function xpToNextLevel(level) {
  return CONSTANTS.XP_BASE + CONSTANTS.XP_PER_LEVEL_SCALE * (level - 1);
}

function getLifeStage(fish) {
  const ageDays = (Date.now() - fish.bornAt) / 86400000;
  if (ageDays < 2) return { stage: 'Baby', coinMult: 0.90 };
  if (ageDays < 7) return { stage: 'Child', coinMult: 1.00 };
  return { stage: 'Adult', coinMult: 1.05 };
}

function getAgeDays(fish) {
  return (Date.now() - fish.bornAt) / 86400000;
}

function generateFishName(existingNames) {
  const available = FISH_NAMES.filter(n => !existingNames.includes(n));
  return available.length > 0 ? randomChoice(available) : `Fish ${Math.floor(Math.random() * 1000)}`;
}

function createFish(speciesId, existingNames) {
  const species = SPECIES[speciesId];
  if (!species) throw new Error(`Unknown species: ${speciesId}`);
  return {
    id: generateId(), speciesId,
    name: generateFishName(existingNames),
    bornAt: Date.now(),
    level: 1, xp: 0,
    hunger: 85 + Math.floor(Math.random() * 15),
    health: 100, weak: false,
    favoriteFoodId: randomChoice(species.favoriteFoods),
    swimPattern: randomChoice(species.swimPatterns),
    zone: randomChoice(species.zones),
    color: species.color,
    sizeVariance: 0.95 + Math.random() * 0.10,
    lifetimeCoins: 0,
  };
}

// ── State factory ────────────────────────────────────────────────────────────

function createTankState(tier) {
  return {
    fish: [],
    cleanliness: 100,
    upgrades: { filterLevel: 0, autoFeederLevel: 0, foodSiloLevel: 0 },
    snails: 0,
    decorations: [],
    lastCleaned: 0,
    lastLaserReward: 0,
  };
}

function createInitialState() {
  const tank1 = createTankState(1);
  tank1.fish = [createFish('guppy', [])];
  return {
    version: 3,
    coins: CONSTANTS.STARTING_COINS,
    activeTankId: 1,
    unlockedTanks: [1],
    lastSeenAt: Date.now(),
    foodStock: { flakes: CONSTANTS.STARTING_FLAKES, pellets: 0, premium_flakes: 0 },
    tanks: { 1: tank1 },
    stats: { coinsEarnedLifetime: 0, fishPurchasedLifetime: 1, streakDays: 0 },
  };
}

// ── Migration from v2 state ──────────────────────────────────────────────────

function migrateState(state) {
  if (!state || state.version >= 3) return state;
  // v2 had flat structure: tankTier, fish[], upgrades, cleanliness, snails at root
  const oldTier = state.tankTier || 1;
  const tank = createTankState(oldTier);
  tank.fish = state.fish || [];
  tank.cleanliness = state.cleanliness != null ? state.cleanliness : 100;
  tank.upgrades = state.upgrades || { filterLevel: 0, autoFeederLevel: 0, foodSiloLevel: 0 };
  tank.snails = state.snails || 0;
  tank.lastCleaned = state.lastCleaned || 0;
  tank.lastLaserReward = state.lastLaserReward || 0;

  const unlockedTanks = [];
  for (let t = 1; t <= oldTier; t++) unlockedTanks.push(t);

  return {
    version: 3,
    coins: state.coins || 0,
    activeTankId: oldTier,
    unlockedTanks,
    lastSeenAt: state.lastSeenAt || Date.now(),
    foodStock: state.foodStock || { flakes: 0, pellets: 0, premium_flakes: 0 },
    tanks: { [oldTier]: tank },
    stats: state.stats || { coinsEarnedLifetime: 0, fishPurchasedLifetime: 0, streakDays: 0 },
  };
}

// ── Pricing ──────────────────────────────────────────────────────────────────

function getTotalFishCount(state) {
  let total = 0;
  for (const tid of state.unlockedTanks) {
    if (state.tanks[tid]) total += state.tanks[tid].fish.length;
  }
  return total;
}

function getFishPrice(speciesId, totalFishOwned) {
  const species = SPECIES[speciesId];
  if (!species) return Infinity;
  return Math.ceil(species.basePrice * Math.pow(CONSTANTS.TIER_BASE, species.tier - 1) * Math.pow(CONSTANTS.FISH_INFLATION_BASE, totalFishOwned));
}

function getFoodCapacity(state, tankId) {
  const tank = state.tanks[tankId];
  if (!tank) return CONSTANTS.BASE_FOOD_CAPACITY;
  const siloLevel = tank.upgrades.foodSiloLevel || 0;
  const mult = siloLevel > 0 ? CONSTANTS.SILO_CAPACITY_MULT[siloLevel - 1] : 1.0;
  return Math.floor(CONSTANTS.BASE_FOOD_CAPACITY * mult);
}

function getEffectiveDirtyRate(tank) {
  let rate = CONSTANTS.BASE_DIRTY_RATE + tank.fish.length * CONSTANTS.DIRTY_PER_FISH;
  rate *= (1 - tank.snails * CONSTANTS.SNAIL_DIRTY_REDUCTION);
  const filterLevel = tank.upgrades.filterLevel || 0;
  if (filterLevel > 0) rate *= (1 - CONSTANTS.FILTER_DIRTY_REDUCTION[filterLevel - 1]);
  return Math.max(rate, 0.05);
}

// ── Simulation (runs per-tank for all unlocked tanks) ────────────────────────

function simulate(state) {
  const now = Date.now();
  const dtHours = Math.min((now - state.lastSeenAt) / 3600000, 168);
  if (dtHours <= 0) { state.lastSeenAt = now; return { coinsEarned: 0, dtHours: 0 }; }

  let totalCoinsEarned = 0;

  for (const tidStr of state.unlockedTanks) {
    const tid = Number(tidStr);
    const tank = state.tanks[tid];
    if (!tank) continue;
    const tankDef = TANKS[tid];
    if (!tankDef) continue;

    // Dirt decay
    const dirtyRate = getEffectiveDirtyRate(tank);
    tank.cleanliness = clamp(tank.cleanliness - dtHours * dirtyRate, 0, 100);

    // Auto-feeder
    const autoFeederLevel = tank.upgrades.autoFeederLevel || 0;
    if (autoFeederLevel > 0 && dtHours > 0) {
      const interval = CONSTANTS.AUTOFEEDER_INTERVAL_HOURS[autoFeederLevel - 1];
      const feedCycles = Math.floor(dtHours / interval);
      for (let c = 0; c < feedCycles; c++) {
        const foodId = state.foodStock.flakes > 0 ? 'flakes' : state.foodStock.pellets > 0 ? 'pellets' : state.foodStock.premium_flakes > 0 ? 'premium_flakes' : null;
        if (!foodId) break;
        state.foodStock[foodId]--;
        const hungryFish = [...tank.fish].sort((a, b) => a.hunger - b.hunger)[0];
        if (hungryFish) hungryFish.hunger = clamp(hungryFish.hunger + FOODS[foodId].hungerRestore * 0.8, 0, 100);
      }
    }

    // Per-fish simulation
    for (const fish of tank.fish) {
      const species = SPECIES[fish.speciesId];
      fish.hunger = clamp(fish.hunger - dtHours * species.hungerRate, 0, 100);
      const shouldBeWeak = fish.hunger <= CONSTANTS.WEAK_HUNGER_THRESHOLD || tank.cleanliness <= CONSTANTS.WEAK_CLEANLINESS_THRESHOLD;
      if (shouldBeWeak && !fish.weak) { fish.weak = true; fish.health = clamp(fish.health - 20, 0, 100); }
      if (!shouldBeWeak && fish.weak && fish.hunger >= CONSTANTS.RECOVERY_HUNGER && tank.cleanliness >= CONSTANTS.RECOVERY_CLEANLINESS) { fish.weak = false; }
      if (!fish.weak && fish.hunger >= CONSTANTS.HEALTH_REGEN_HUNGER_MIN && tank.cleanliness >= CONSTANTS.HEALTH_REGEN_CLEAN_MIN) {
        fish.health = clamp(fish.health + CONSTANTS.HEALTH_REGEN_RATE * dtHours, 0, 100);
      }

      // Coin generation
      const lifeStage = getLifeStage(fish);
      const levelBonus = 1 + fish.level * CONSTANTS.LEVEL_COIN_BONUS;
      const hungerMod = fish.hunger > 50 ? 1.0 : fish.hunger > 20 ? 0.5 : 0.1;
      const cleanMod = tank.cleanliness > 50 ? 1.0 : tank.cleanliness > 20 ? 0.5 : 0.1;
      const weakMod = fish.weak ? 0.1 : 1.0;
      const coins = species.baseCoinPerHour * lifeStage.coinMult * levelBonus * hungerMod * cleanMod * weakMod * dtHours;
      fish.lifetimeCoins = (fish.lifetimeCoins || 0) + coins;
      totalCoinsEarned += coins;
    }
  }

  state.coins += totalCoinsEarned;
  state.stats.coinsEarnedLifetime += totalCoinsEarned;
  state.lastSeenAt = now;
  return { coinsEarned: Math.floor(totalCoinsEarned), dtHours };
}

// ── Build catalog responses ──────────────────────────────────────────────────

function buildStoreCatalog(state, tankId) {
  const tankDef = TANKS[tankId];
  if (!tankDef) return { fish: [], foods: [] };
  const totalFish = getTotalFishCount(state);

  const fish = Object.entries(SPECIES).map(([id, sp]) => ({
    speciesId: id, name: sp.name,
    price: getFishPrice(id, totalFish),
    baseCoinPerHour: sp.baseCoinPerHour,
    spaceCost: sp.spaceCost,
    locked: !tankDef.allowedSpecies.includes(id),
    requiredTier: sp.tier,
  }));

  const foods = Object.entries(FOODS)
    .filter(([, food]) => food.tier <= tankId)
    .map(([id, food]) => ({ foodId: id, name: food.name, price: food.price, hungerRestore: food.hungerRestore }));

  const decorations = Object.entries(DECORATIONS)
    .filter(([, dec]) => dec.minTier <= tankId)
    .map(([id, dec]) => ({ decorationId: id, name: dec.name, price: dec.price, sellValue: dec.sellValue }));

  return { fish, foods, decorations };
}

function buildUpgradesCatalog(state, tankId) {
  const tank = state.tanks[tankId];
  const tankDef = TANKS[tankId];
  if (!tank || !tankDef) return {};
  const result = { upgrades: [], allMaxed: false };

  // Equipment upgrades
  for (const [id, upg] of Object.entries(UPGRADES)) {
    const levelKey = id === 'filter' ? 'filterLevel' : id === 'autoFeeder' ? 'autoFeederLevel' : 'foodSiloLevel';
    const currentLevel = tank.upgrades[levelKey] || 0;
    if (currentLevel >= upg.maxLevel) continue;
    const locked = !tankDef.features.includes(id === 'foodSilo' ? 'silo' : id);
    result.upgrades.push({
      id, name: upg.name, icon: upg.icon,
      currentLevel, maxLevel: upg.maxLevel,
      nextPrice: upg.prices[currentLevel], nextDescription: upg.descriptions[currentLevel],
      canBuy: !locked && state.coins >= upg.prices[currentLevel],
      locked, requiredTier: upg.minTier,
    });
  }

  // Snails (per-tank)
  if (tankDef.features.includes('snails')) {
    result.snails = { current: tank.snails, max: CONSTANTS.MAX_SNAILS, price: CONSTANTS.SNAIL_PRICE, canBuy: tank.snails < CONSTANTS.MAX_SNAILS && state.coins >= CONSTANTS.SNAIL_PRICE };
  }

  result.allMaxed = result.upgrades.length === 0 && (!result.snails || result.snails.current >= result.snails.max);
  return result;
}

function buildTanksList(state) {
  return Object.entries(TANKS).map(([tidStr, def]) => {
    const tid = Number(tidStr);
    const unlocked = state.unlockedTanks.includes(tid);
    const tank = state.tanks[tid];
    const fishCount = tank ? tank.fish.length : 0;
    const usedSpace = tank ? getUsedSpace(tank) : 0;
    const unlockPrice = CONSTANTS.TANK_UNLOCK_PRICES[tid] || 0;
    const canUnlock = !unlocked && state.coins >= unlockPrice;
    // Unlock requirements (simplified): tier 2 needs 3 adults or 800 lifetime coins; tier 3 needs 2000 lifetime coins
    let meetsRequirements = true;
    let requirementsDesc = '';
    if (tid === 2 && !unlocked) {
      const allFish = [];
      for (const t of state.unlockedTanks) { if (state.tanks[t]) allFish.push(...state.tanks[t].fish); }
      const adultCount = allFish.filter(f => getLifeStage(f).stage === 'Adult').length;
      meetsRequirements = (allFish.length >= 3 || state.stats.coinsEarnedLifetime >= 800) && adultCount >= 2;
      requirementsDesc = 'Own 3 fish OR earn 800 lifetime coins, and have 2+ adults';
    } else if (tid === 3 && !unlocked) {
      meetsRequirements = state.stats.coinsEarnedLifetime >= 2000;
      requirementsDesc = 'Earn 2000 lifetime coins';
    }
    return {
      tankId: tid, name: def.name, spaceCapacity: def.spaceCapacity,
      unlocked, fishCount, usedSpace,
      unlockPrice, canUnlock: canUnlock && meetsRequirements,
      meetsRequirements, requirementsDesc,
      isActive: state.activeTankId === tid,
    };
  });
}

// ── Response builder ─────────────────────────────────────────────────────────

function buildResponse(state, result) {
  const tid = state.activeTankId;
  const tank = state.tanks[tid];
  const tankDef = TANKS[tid];
  return {
    state,
    tankInfo: { tankId: tid, ...tankDef },
    activeTank: tank,
    storeCatalog: buildStoreCatalog(state, tid),
    upgradesCatalog: buildUpgradesCatalog(state, tid),
    tanksList: buildTanksList(state),
    foodCapacity: getFoodCapacity(state, tid),
    result: result || {},
  };
}

// ── Action handler ───────────────────────────────────────────────────────────

function handleAction(state, type, payload) {
  const tid = state.activeTankId;
  const tank = state.tanks[tid];
  const tankDef = TANKS[tid];
  if (!tank || !tankDef) return { error: 'Invalid tank' };

  switch (type) {
    // ── Switch tank view ─────────────────────────────────────────────────
    case 'switch_tank': {
      const { tankId } = payload;
      if (!state.unlockedTanks.includes(tankId)) return { error: 'Tank not unlocked' };
      if (!state.tanks[tankId]) return { error: 'Tank not found' };
      state.activeTankId = tankId;
      return { switched: true, tankId };
    }

    // ── Unlock new tank ──────────────────────────────────────────────────
    case 'unlock_tank': {
      const { tankId } = payload;
      if (state.unlockedTanks.includes(tankId)) return { error: 'Already unlocked' };
      const price = CONSTANTS.TANK_UNLOCK_PRICES[tankId];
      if (!price) return { error: 'Invalid tank' };
      if (state.coins < price) return { error: 'Not enough coins' };
      state.coins -= price;
      state.unlockedTanks.push(tankId);
      state.unlockedTanks.sort();
      state.tanks[tankId] = createTankState(tankId);
      state.activeTankId = tankId;
      return { unlocked: true, tankId, tankName: TANKS[tankId].name };
    }

    // ── Buy fish (into active tank) ──────────────────────────────────────
    case 'buy_fish': {
      const { speciesId } = payload;
      const species = SPECIES[speciesId];
      if (!species) return { error: 'Unknown species' };
      const usedSpace = getUsedSpace(tank);
      if (usedSpace + species.spaceCost > tankDef.spaceCapacity) return { error: `Tank is full (${usedSpace}/${tankDef.spaceCapacity} space)` };
      if (!tankDef.allowedSpecies.includes(speciesId)) return { error: 'Species not available for this tank' };
      const price = getFishPrice(speciesId, getTotalFishCount(state));
      if (state.coins < price) return { error: 'Not enough coins' };
      state.coins -= price;
      const existingNames = tank.fish.map(f => f.name);
      const fish = createFish(speciesId, existingNames);
      tank.fish.push(fish);
      state.stats.fishPurchasedLifetime++;
      return { fish };
    }

    // ── Sell fish ────────────────────────────────────────────────────────
    case 'sell_fish': {
      const { fishId } = payload;
      const idx = tank.fish.findIndex(f => f.id === fishId);
      if (idx === -1) return { error: 'Fish not found in this tank' };
      if (tank.fish.length <= 1) return { error: 'You need at least one fish per tank' };
      const fish = tank.fish[idx];
      const species = SPECIES[fish.speciesId];
      const value = Math.ceil(getFishPrice(fish.speciesId, getTotalFishCount(state)) * CONSTANTS.SELL_RETURN_RATE * (1 + fish.level * 0.05));
      state.coins += value;
      tank.fish.splice(idx, 1);
      return { fishName: fish.name, value };
    }

    // ── Move fish between tanks ──────────────────────────────────────────
    case 'move_fish': {
      const { fishId, toTankId } = payload;
      if (!state.unlockedTanks.includes(toTankId)) return { error: 'Target tank not unlocked' };
      const fromTank = tank;
      const toTank = state.tanks[toTankId];
      const toTankDef = TANKS[toTankId];
      if (!toTank || !toTankDef) return { error: 'Invalid target tank' };
      const idx = fromTank.fish.findIndex(f => f.id === fishId);
      if (idx === -1) return { error: 'Fish not found' };
      const fish = fromTank.fish[idx];
      if (!toTankDef.allowedSpecies.includes(fish.speciesId)) return { error: `${SPECIES[fish.speciesId]?.name || fish.speciesId} not allowed in ${toTankDef.name}` };
      const usedSpace = getUsedSpace(toTank);
      const species = SPECIES[fish.speciesId];
      if (usedSpace + species.spaceCost > toTankDef.spaceCapacity) return { error: `${toTankDef.name} is full` };
      fromTank.fish.splice(idx, 1);
      toTank.fish.push(fish);
      return { moved: true, fishName: fish.name, toTankName: toTankDef.name };
    }

    // ── Feed ─────────────────────────────────────────────────────────────
    case 'feed': {
      const { foodId } = payload;
      const food = FOODS[foodId];
      if (!food) return { error: 'Unknown food' };
      if ((state.foodStock[foodId] || 0) <= 0) return { error: 'Out of stock' };
      state.foodStock[foodId]--;
      return { fed: true };
    }

    case 'fish_consume': {
      const { fishId, foodId } = payload;
      const fish = tank.fish.find(f => f.id === fishId);
      const food = FOODS[foodId];
      if (!fish || !food) return {};
      fish.hunger = clamp(fish.hunger + food.hungerRestore, 0, 100);
      const xpGain = CONSTANTS.XP_PER_FEED * food.xpBonus * (fish.favoriteFoodId === foodId ? 1.5 : 1.0);
      fish.xp += xpGain;
      while (fish.level < CONSTANTS.MAX_LEVEL && fish.xp >= xpToNextLevel(fish.level)) {
        fish.xp -= xpToNextLevel(fish.level);
        fish.level++;
      }
      return { fish };
    }

    // ── Clean ────────────────────────────────────────────────────────────
    case 'clean': {
      const now = Date.now();
      if (now - tank.lastCleaned < CONSTANTS.CLEAN_COOLDOWN_MS && tank.cleanliness >= 90) {
        return { error: 'Tank was recently cleaned', cooldownRemaining: CONSTANTS.CLEAN_COOLDOWN_MS - (now - tank.lastCleaned) };
      }
      const pct = clamp(payload.percentCleaned || 0, 0, 100);
      if (pct <= 0) return { cleanliness: tank.cleanliness, bonus: 0 };
      const before = tank.cleanliness;
      const restore = (100 - before) * (pct / 100);
      tank.cleanliness = clamp(before + restore, 0, 100);
      tank.lastCleaned = now;
      const improvement = tank.cleanliness - before;
      const bonus = improvement > 10 ? Math.ceil(CONSTANTS.CLEAN_BONUS_BASE * Math.pow(improvement / 100, CONSTANTS.CLEAN_BONUS_SCALE) * tank.fish.length) : 0;
      state.coins += bonus;
      for (const fish of tank.fish) {
        fish.xp += Math.ceil(CONSTANTS.CLEAN_XP_PER_FISH * (pct / 100));
        while (fish.level < CONSTANTS.MAX_LEVEL && fish.xp >= xpToNextLevel(fish.level)) { fish.xp -= xpToNextLevel(fish.level); fish.level++; }
      }
      return { cleanliness: tank.cleanliness, bonus, percentCleaned: pct };
    }

    // ── Buy food ─────────────────────────────────────────────────────────
    case 'buy_food': {
      const { foodId, quantity } = payload;
      const food = FOODS[foodId];
      if (!food) return { error: 'Unknown food' };
      const qty = quantity || 5;
      const cost = food.price * qty;
      if (state.coins < cost) return { error: 'Not enough coins' };
      state.coins -= cost;
      state.foodStock[foodId] = (state.foodStock[foodId] || 0) + qty;
      return { foodId, quantity: qty };
    }

    // ── Buy snail ────────────────────────────────────────────────────────
    case 'buy_snail': {
      if (!tankDef.features.includes('snails')) return { error: 'Snails not available' };
      if (tank.snails >= CONSTANTS.MAX_SNAILS) return { error: 'Max snails reached' };
      if (state.coins < CONSTANTS.SNAIL_PRICE) return { error: 'Not enough coins' };
      state.coins -= CONSTANTS.SNAIL_PRICE;
      tank.snails++;
      return { snails: tank.snails };
    }

    // ── Buy upgrade ──────────────────────────────────────────────────────
    case 'buy_upgrade': {
      const { upgradeId } = payload;
      const upg = UPGRADES[upgradeId];
      if (!upg) return { error: 'Unknown upgrade' };
      const levelKey = upgradeId === 'filter' ? 'filterLevel' : upgradeId === 'autoFeeder' ? 'autoFeederLevel' : 'foodSiloLevel';
      const current = tank.upgrades[levelKey] || 0;
      if (current >= upg.maxLevel) return { error: 'Already max level' };
      const price = upg.prices[current];
      if (state.coins < price) return { error: 'Not enough coins' };
      state.coins -= price;
      tank.upgrades[levelKey] = current + 1;
      return { upgraded: upgradeId, level: current + 1 };
    }

    // ── Buy decoration ───────────────────────────────────────────────────
    case 'buy_decoration': {
      const { decorationType } = payload;
      const dec = DECORATIONS[decorationType];
      if (!dec) return { error: 'Unknown decoration' };
      if (dec.minTier > tid) return { error: 'Not available for this tank tier' };
      if (state.coins < dec.price) return { error: 'Not enough coins' };
      state.coins -= dec.price;
      const decObj = { id: generateId(), type: decorationType, x: 0.2 + Math.random() * 0.6 };
      tank.decorations.push(decObj);
      return { decoration: decObj };
    }

    // ── Sell decoration ──────────────────────────────────────────────────
    case 'sell_decoration': {
      const { decorationId } = payload;
      const idx = tank.decorations.findIndex(d => d.id === decorationId);
      if (idx === -1) return { error: 'Decoration not found' };
      const dec = tank.decorations[idx];
      const decDef = DECORATIONS[dec.type];
      const value = decDef ? decDef.sellValue : 0;
      state.coins += value;
      tank.decorations.splice(idx, 1);
      return { sold: true, value, decorationType: dec.type };
    }

    // ── Laser pointer ────────────────────────────────────────────────────
    case 'laser_pointer': {
      if (!tankDef.features.includes('laser')) return {};
      const now = Date.now();
      if (now - tank.lastLaserReward >= CONSTANTS.LASER_COOLDOWN_MS) {
        tank.lastLaserReward = now;
        state.coins += CONSTANTS.LASER_REWARD_COINS;
        for (const fish of tank.fish) {
          fish.xp += CONSTANTS.LASER_REWARD_XP;
          while (fish.level < CONSTANTS.MAX_LEVEL && fish.xp >= xpToNextLevel(fish.level)) { fish.xp -= xpToNextLevel(fish.level); fish.level++; }
        }
        return { reward: { coins: CONSTANTS.LASER_REWARD_COINS, xp: CONSTANTS.LASER_REWARD_XP } };
      }
      return { reward: null };
    }

    // ── Reset state ──────────────────────────────────────────────────────
    case 'reset_state': {
      const fresh = createInitialState();
      Object.assign(state, fresh);
      return { reset: true };
    }

    default:
      return { error: `Unknown action: ${type}` };
  }
}

// ── Homey SDK API endpoint ───────────────────────────────────────────────────

module.exports = {
  async getState({ homey, query }) {
    const widgetId = query.widgetId || 'default';
    const storeKey = `aquarium_${widgetId}`;
    let state = await homey.settings.get(storeKey);
    let isNew = false;

    if (!state) {
      state = createInitialState();
      isNew = true;
    } else if (state.version < 3) {
      state = migrateState(state);
    }

    const simResult = simulate(state);
    await homey.settings.set(storeKey, state);
    return { ...buildResponse(state), simResult, isNew };
  },

  async doAction({ homey, body, query }) {
    const widgetId = query.widgetId || 'default';
    const storeKey = `aquarium_${widgetId}`;
    let state = await homey.settings.get(storeKey);

    if (!state) state = createInitialState();
    else if (state.version < 3) state = migrateState(state);

    const { type, payload } = body || {};
    const result = handleAction(state, type, payload || {});

    await homey.settings.set(storeKey, state);
    return buildResponse(state, result);
  },
};
