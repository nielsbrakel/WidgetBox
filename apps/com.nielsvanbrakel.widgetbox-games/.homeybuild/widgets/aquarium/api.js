'use strict';

// ── Catalogs (inline for simplicity) ──────────────────────────────────

const CONSTANTS = {
    BASE_DIRTY_RATE: 0.45,      // cleanliness lost per hour (base)
    DIRTY_PER_FISH: 0.10,       // additional dirt per fish per hour
    TIER_BASE: 3.2,
    FISH_INFLATION_BASE: 1.18,
    CLEAN_RESTORE: 45,          // cleanliness restored on clean action
    CLEAN_BONUS_BASE: 10,       // base coin bonus from cleaning
    CLEAN_BONUS_SCALE: 0.6,     // bonus scale based on dirt
    SELL_RETURN_RATE: 0.30,     // 30% return on sell
    WEAK_HUNGER_THRESHOLD: 10,
    WEAK_CLEANLINESS_THRESHOLD: 10,
    WEAK_HEALTH_THRESHOLD: 15,
    RECOVERY_HUNGER: 35,
    RECOVERY_CLEANLINESS: 30,
    HEALTH_REGEN_RATE: 2,       // health per hour when conditions good
    HEALTH_REGEN_HUNGER_MIN: 40,
    HEALTH_REGEN_CLEAN_MIN: 40,
    STARTING_COINS: 50,
    STARTING_FLAKES: 10,
    XP_PER_FEED: 8,
    XP_PER_LEVEL: 100,
    MAX_LEVEL: 10,
    LEVEL_COIN_BONUS: 0.12,     // +12% coins per level
};

const TANKS = {
    1: { capacity: 3, name: 'Fishbowl', allowedSpecies: ['guppy', 'goldfish'] },
    2: { capacity: 5, name: 'Small Aquarium', allowedSpecies: ['guppy', 'goldfish', 'neonTetra', 'betta', 'corydoras'] },
    3: { capacity: 10, name: 'Big Freshwater Tank', allowedSpecies: ['guppy', 'goldfish', 'neonTetra', 'betta', 'corydoras', 'angelfish', 'pleco', 'discus'] },
};

const SPECIES = {
    guppy: {
        name: 'Guppy',
        basePrice: 15,
        baseCoinPerHour: 2.5,
        hungerRate: 1.0,
        tier: 1,
        swimPatterns: ['drift', 'dart', 'zigzag'],
        zones: ['top', 'middle'],
        favoriteFoods: ['flakes', 'pellets'],
        colors: [
            { body: '#FF7043', tail: '#FFB74D' },
            { body: '#42A5F5', tail: '#90CAF9' },
            { body: '#AB47BC', tail: '#CE93D8' },
            { body: '#66BB6A', tail: '#A5D6A7' },
            { body: '#FFA726', tail: '#FFCC80' },
        ],
    },
    goldfish: {
        name: 'Goldfish',
        basePrice: 25,
        baseCoinPerHour: 3.8,
        hungerRate: 1.2,
        tier: 1,
        swimPatterns: ['drift', 'glide'],
        zones: ['middle', 'bottom'],
        favoriteFoods: ['pellets', 'flakes'],
        colors: [
            { body: '#FF8F00', tail: '#FFB300' },
            { body: '#F4511E', tail: '#FF8A65' },
            { body: '#FFD54F', tail: '#FFF176' },
        ],
    },
};

const FOODS = {
    flakes: { name: 'Flakes', price: 3, hungerRestore: 30, xpBonus: 1.0 },
    pellets: { name: 'Pellets', price: 6, hungerRestore: 45, xpBonus: 1.5 },
};

// ── Fish name generator ───────────────────────────────────────────────

const FISH_NAMES = [
    'Bubbles', 'Splash', 'Nemo', 'Goldie', 'Finn', 'Coral',
    'Shimmer', 'Dash', 'Pip', 'Sunny', 'Luna', 'Pearl',
    'Twirl', 'Ziggy', 'Drift', 'Sparkle', 'Pebbles', 'Glow',
    'Ripple', 'Skipper', 'Waddle', 'Mochi', 'Tofu', 'Bean',
    'Biscuit', 'Poppy', 'Clover', 'Maple', 'Olive', 'Sage',
];

function generateFishName(existingNames) {
    const available = FISH_NAMES.filter(n => !existingNames.includes(n));
    if (available.length === 0) {
        return `Fish ${Math.floor(Math.random() * 1000)}`;
    }
    return available[Math.floor(Math.random() * available.length)];
}

// ── Utility helpers ───────────────────────────────────────────────────

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

function lerp(a, b, t) {
    return a + (b - a) * clamp(t, 0, 1);
}

function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function generateId() {
    return `f_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Create fresh state ────────────────────────────────────────────────

function createInitialState() {
    const now = Date.now();
    const starterFish = createFish('guppy', [], now);

    return {
        version: 1,
        tankTier: 1,
        coins: CONSTANTS.STARTING_COINS,
        lastSeenAt: now,
        cleanliness: 100,
        foodStock: { flakes: CONSTANTS.STARTING_FLAKES, pellets: 0 },
        upgrades: { filterLevel: 0, autoFeederLevel: 0, foodSiloLevel: 0 },
        snails: 0,
        fish: [starterFish],
        stats: { coinsEarnedLifetime: 0, streakDays: 0 },
    };
}

function createFish(speciesId, existingNames, now) {
    const species = SPECIES[speciesId];
    if (!species) throw new Error(`Unknown species: ${speciesId}`);

    const color = randomChoice(species.colors);
    return {
        id: generateId(),
        speciesId,
        name: generateFishName(existingNames),
        bornAt: now,
        level: 1,
        xp: 0,
        hunger: 85 + Math.floor(Math.random() * 15), // 85-100
        health: 100,
        weak: false,
        favoriteFoodId: randomChoice(species.favoriteFoods),
        swimPattern: randomChoice(species.swimPatterns),
        zone: randomChoice(species.zones),
        color,
        sizeVariance: 0.95 + Math.random() * 0.10, // ±5%
        lifetimeCoins: 0,
    };
}

// ── Simulation engine ─────────────────────────────────────────────────

function simulate(state) {
    const now = Date.now();
    const dtHours = (now - state.lastSeenAt) / 3600000;

    if (dtHours <= 0) {
        state.lastSeenAt = now;
        return { coinsEarned: 0, dtHours: 0 };
    }

    // Cap simulation to 7 days max to prevent absurd values
    const cappedDt = Math.min(dtHours, 168);
    const aliveFishCount = state.fish.length;

    // ── Dirt decay ──
    const dirtyRate = CONSTANTS.BASE_DIRTY_RATE + aliveFishCount * CONSTANTS.DIRTY_PER_FISH;
    state.cleanliness = clamp(state.cleanliness - cappedDt * dirtyRate, 0, 100);

    // ── Per-fish simulation ──
    let totalCoinsEarned = 0;

    for (const fish of state.fish) {
        const species = SPECIES[fish.speciesId];

        // Hunger decay
        fish.hunger = clamp(fish.hunger - cappedDt * species.hungerRate, 0, 100);

        // Weak state check
        const shouldBeWeak = (
            fish.hunger <= CONSTANTS.WEAK_HUNGER_THRESHOLD ||
            state.cleanliness <= CONSTANTS.WEAK_CLEANLINESS_THRESHOLD ||
            fish.health <= CONSTANTS.WEAK_HEALTH_THRESHOLD
        );

        if (shouldBeWeak) {
            fish.weak = true;
        } else if (
            fish.weak &&
            fish.hunger >= CONSTANTS.RECOVERY_HUNGER &&
            state.cleanliness >= CONSTANTS.RECOVERY_CLEANLINESS
        ) {
            fish.weak = false;
        }

        // Health regen when conditions are good
        if (
            fish.hunger > CONSTANTS.HEALTH_REGEN_HUNGER_MIN &&
            state.cleanliness > CONSTANTS.HEALTH_REGEN_CLEAN_MIN
        ) {
            fish.health = clamp(fish.health + cappedDt * CONSTANTS.HEALTH_REGEN_RATE, 0, 100);
        }

        // Coin generation (only if not weak)
        if (!fish.weak) {
            const levelMult = 1 + CONSTANTS.LEVEL_COIN_BONUS * (fish.level - 1);
            const cleanMult = lerp(0.7, 1.2, state.cleanliness / 100);
            const hungerMult = lerp(0.3, 1.1, fish.hunger / 100);
            const coinsFromFish = species.baseCoinPerHour * levelMult * cleanMult * hungerMult * cappedDt;
            totalCoinsEarned += coinsFromFish;
            fish.lifetimeCoins += coinsFromFish;
        }
    }

    state.coins += totalCoinsEarned;
    state.stats.coinsEarnedLifetime += totalCoinsEarned;
    state.lastSeenAt = now;

    return { coinsEarned: Math.floor(totalCoinsEarned), dtHours: cappedDt };
}

// ── Fish pricing ──────────────────────────────────────────────────────

function getFishPrice(speciesId, totalFishOwned) {
    const species = SPECIES[speciesId];
    if (!species) return Infinity;

    const tierMult = Math.pow(CONSTANTS.TIER_BASE, species.tier - 1);
    const inflation = Math.pow(CONSTANTS.FISH_INFLATION_BASE, totalFishOwned);
    return Math.ceil(species.basePrice * tierMult * inflation);
}

function getSellValue(speciesId, totalFishOwned) {
    const price = getFishPrice(speciesId, Math.max(0, totalFishOwned - 1));
    return Math.floor(price * CONSTANTS.SELL_RETURN_RATE);
}

// ── Action handlers ───────────────────────────────────────────────────

function handleFeed(state, payload) {
    const { foodId } = payload;
    const food = FOODS[foodId];
    if (!food) return { error: 'Unknown food' };
    if (!state.foodStock[foodId] || state.foodStock[foodId] <= 0) {
        return { error: 'No food available' };
    }

    state.foodStock[foodId]--;
    let fedCount = 0;

    for (const fish of state.fish) {
        if (fish.hunger < 95) {
            const isFavorite = fish.favoriteFoodId === foodId;
            const restoreAmount = isFavorite ? food.hungerRestore * 1.3 : food.hungerRestore;
            fish.hunger = clamp(fish.hunger + restoreAmount, 0, 100);

            // XP gain
            const xpGain = CONSTANTS.XP_PER_FEED * food.xpBonus * (isFavorite ? 1.5 : 1);
            fish.xp += xpGain;

            // Level up check
            while (fish.xp >= CONSTANTS.XP_PER_LEVEL && fish.level < CONSTANTS.MAX_LEVEL) {
                fish.xp -= CONSTANTS.XP_PER_LEVEL;
                fish.level++;
            }

            fedCount++;
        }
    }

    return { success: true, fedCount };
}

function handleClean(state) {
    const dirtyMissing = 100 - state.cleanliness;
    const bonus = Math.floor(CONSTANTS.CLEAN_BONUS_BASE + CONSTANTS.CLEAN_BONUS_SCALE * dirtyMissing);

    state.cleanliness = clamp(state.cleanliness + CONSTANTS.CLEAN_RESTORE, 0, 100);
    state.coins += bonus;
    state.stats.coinsEarnedLifetime += bonus;

    return { success: true, bonus, newCleanliness: state.cleanliness };
}

function handleBuyFish(state, payload) {
    const { speciesId } = payload;
    const tank = TANKS[state.tankTier];

    if (state.fish.length >= tank.capacity) {
        return { error: 'Tank is full' };
    }
    if (!tank.allowedSpecies.includes(speciesId)) {
        return { error: 'Species not available for this tank' };
    }

    const price = getFishPrice(speciesId, state.fish.length);
    if (state.coins < price) {
        return { error: 'Not enough coins' };
    }

    state.coins -= price;
    const existingNames = state.fish.map(f => f.name);
    const newFish = createFish(speciesId, existingNames, Date.now());
    state.fish.push(newFish);

    return { success: true, fish: newFish, price };
}

function handleSellFish(state, payload) {
    const { fishId } = payload;
    const fishIndex = state.fish.findIndex(f => f.id === fishId);
    if (fishIndex === -1) return { error: 'Fish not found' };
    if (state.fish.length <= 1) return { error: 'Cannot sell your last fish' };

    const fish = state.fish[fishIndex];
    const value = getSellValue(fish.speciesId, state.fish.length);
    state.coins += value;
    state.fish.splice(fishIndex, 1);

    return { success: true, value, fishName: fish.name };
}

function handleBuyFood(state, payload) {
    const { foodId, quantity = 1 } = payload;
    const food = FOODS[foodId];
    if (!food) return { error: 'Unknown food' };

    const totalCost = food.price * quantity;
    if (state.coins < totalCost) return { error: 'Not enough coins' };

    state.coins -= totalCost;
    state.foodStock[foodId] = (state.foodStock[foodId] || 0) + quantity;

    return { success: true, totalCost };
}

// ── API endpoints ─────────────────────────────────────────────────────

module.exports = {
    async getState({ homey, query }) {
        const { widgetId } = query;
        if (!widgetId) throw new Error('Missing widgetId');

        const key = `aquarium_${widgetId}`;
        let state = homey.settings.get(key);
        let isNew = false;

        if (!state) {
            state = createInitialState();
            isNew = true;
        }

        // Run simulation
        const simResult = simulate(state);

        // Persist updated state
        homey.settings.set(key, state);

        // Build store catalog for the frontend
        const tank = TANKS[state.tankTier];
        const storeCatalog = {
            fish: tank.allowedSpecies.map(sid => ({
                speciesId: sid,
                ...SPECIES[sid],
                price: getFishPrice(sid, state.fish.length),
            })),
            foods: Object.entries(FOODS).map(([id, f]) => ({ foodId: id, ...f })),
        };

        return {
            state,
            simResult,
            isNew,
            storeCatalog,
            tankInfo: tank,
        };
    },

    async doAction({ homey, query, body }) {
        const { widgetId } = query;
        if (!widgetId) throw new Error('Missing widgetId');

        const key = `aquarium_${widgetId}`;
        let state = homey.settings.get(key);

        if (!state) {
            state = createInitialState();
        }

        // Run simulation first
        simulate(state);

        // Handle action
        const { type, payload = {} } = body;
        let result;

        switch (type) {
            case 'feed':
                result = handleFeed(state, payload);
                break;
            case 'clean':
                result = handleClean(state);
                break;
            case 'buy_fish':
                result = handleBuyFish(state, payload);
                break;
            case 'sell_fish':
                result = handleSellFish(state, payload);
                break;
            case 'buy_food':
                result = handleBuyFood(state, payload);
                break;
            default:
                result = { error: `Unknown action: ${type}` };
        }

        // Persist & rebuild store catalog
        homey.settings.set(key, state);

        const tank = TANKS[state.tankTier];
        const storeCatalog = {
            fish: tank.allowedSpecies.map(sid => ({
                speciesId: sid,
                ...SPECIES[sid],
                price: getFishPrice(sid, state.fish.length),
            })),
            foods: Object.entries(FOODS).map(([id, f]) => ({ foodId: id, ...f })),
        };

        return {
            result,
            state,
            storeCatalog,
            tankInfo: tank,
        };
    },
};
