/**
 * Mock handler for the Aquarium widget API.
 * Mirrors the server-side api.js for sandbox development.
 * String tank IDs (fresh, tropical, salt), per-tank economy, catalog-driven.
 */

// ── Helpers ──────────────────────────────────────────────────────────

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function generateId() { return `f_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }

function seededRng(seed) {
    let s = seed | 0;
    return function () { s = (s * 1664525 + 1013904223) | 0; return (s >>> 0) / 4294967296; };
}

function hashString(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return Math.abs(h);
}

// ── Constants ────────────────────────────────────────────────────────

const CURRENT_SAVE_VERSION = 1;
const MAX_LEVEL = 10;
const XP_BASE = 30;
const XP_PER_LEVEL_SCALE = 14;
const LEVEL_COIN_BONUS = 0.12;
const MAX_IDLE_HOURS = 168;
const LASER_COOLDOWN_MS = 6 * 3600000;
const LASER_REWARD_COINS = 25;
const LASER_REWARD_XP = 5;

// ── Catalog (mirrors api.js) ─────────────────────────────────────────

const TROPICAL_TOOL_REQS = [{ toolId: 'heater', penalty: 20, label: 'Missing Heater' }];
const SALT_TOOL_REQS = [
    { toolId: 'filter_salt', penalty: 15, label: 'Missing Filter' },
    { toolId: 'skimmer', penalty: 15, label: 'Missing Protein Skimmer' },
    { toolId: 'uv_sterilizer', penalty: 20, label: 'Missing UV Sterilizer' },
];

const CATALOG = {
    schemaVersion: 1,
    contentVersion: '1.0.0',
    aliases: { fish: {}, decor: {}, tools: {}, food: {} },
    global: {
        ui: { aspectRatio: '4:3', wipeMaskGrid: { w: 64, h: 48 } },
        economy: { coinsPer100Dirt: 5, sellReturnDefault: 0.35, fishSellReturn: 0.30, priceGrowth: { fish: 1.18 } },
    },
    tanks: {
        fresh: {
            id: 'fresh', name: 'Fresh Starter',
            unlock: { type: 'free', label: 'Your starter tank' },
            capacity: { spaceCapacity: 8 },
            simulation: { baseDirtyRatePerHour: 0.4, dirtyPerSpacePerHour: 0.08, hungerRateMultiplier: 1.0 },
            visuals: { waterTint: '#a8d8c8', substrate: 'gravel', themeKey: 'fresh' },
            content: {
                fish: {
                    guppy: { name: 'Guppy', basePrice: 15, baseCoinPerHour: 2.5, hungerRate: 0.9, spaceCost: 1, diet: { accepts: ['basic_flakes', 'pellets'] }, preferences: { zonePreference: 'top' }, visuals: { spriteKey: 'guppy', sizeVarianceRange: [0.9, 1.1] } },
                    goldfish: { name: 'Goldfish', basePrice: 35, baseCoinPerHour: 4.0, hungerRate: 1.0, spaceCost: 3, diet: { accepts: ['basic_flakes', 'pellets'] }, preferences: { zonePreference: 'middle' }, visuals: { spriteKey: 'goldfish', sizeVarianceRange: [0.9, 1.1] } },
                    snail: { name: 'Mystery Snail', basePrice: 40, baseCoinPerHour: 0.5, hungerRate: 0.5, spaceCost: 1, diet: { accepts: ['algae_wafer'] }, preferences: { zonePreference: 'bottom', movementType: 'crawl' }, utility: { dirtReduction: 0.15 }, visuals: { spriteKey: 'snail', sizeVarianceRange: [0.85, 1.0] } },
                },
                food: {
                    basic_flakes: { name: 'Basic Flakes', price: 3, hungerRestore: 30, xp: 5, sinkBehavior: 'slowSink' },
                    pellets: { name: 'Pellets', price: 6, hungerRestore: 45, xp: 8, sinkBehavior: 'sink' },
                    algae_wafer: { name: 'Algae Wafer', price: 4, hungerRestore: 35, xp: 5, sinkBehavior: 'sink' },
                },
                decor: {
                    hornwort: { name: 'Hornwort', price: 20, placement: 'mid', growth: { growthRatePerHour: 0.02, minSize: 0.5, maxSize: 2.0 } },
                    vallisneria: { name: 'Vallisneria', price: 25, placement: 'mid', growth: { growthRatePerHour: 0.018, minSize: 0.5, maxSize: 2.2 } },
                    anubias: { name: 'Anubias', price: 22, placement: 'mid', growth: { growthRatePerHour: 0.008, minSize: 0.4, maxSize: 1.4 } },
                    moss_ball: { name: 'Moss Ball', price: 15, placement: 'bottom' },
                    rock_pile: { name: 'Rock Pile', price: 25, placement: 'bottom' },
                    driftwood: { name: 'Driftwood', price: 35, placement: 'mid' },
                    treasure_chest: { name: 'Treasure Chest', price: 50, placement: 'bottom' },
                    sunken_ship: { name: 'Sunken Ship', price: 75, placement: 'bottom', maxPerTank: 1 },
                },
                tools: {},
            },
            store: { sections: [
                { id: 'fish', order: ['guppy', 'goldfish', 'snail'] },
                { id: 'food', order: ['basic_flakes', 'pellets', 'algae_wafer'] },
                { id: 'decor', order: ['hornwort', 'vallisneria', 'anubias', 'moss_ball', 'rock_pile', 'driftwood', 'treasure_chest', 'sunken_ship'] },
                { id: 'tools', order: [] },
            ] },
        },
        tropical: {
            id: 'tropical', name: 'Tropical Planted',
            unlock: { type: 'lifetimeCoins', value: 1500, label: 'Earn 1,500 lifetime coins' },
            capacity: { spaceCapacity: 14 },
            simulation: { baseDirtyRatePerHour: 0.5, dirtyPerSpacePerHour: 0.10, hungerRateMultiplier: 1.0 },
            visuals: { waterTint: '#40b8d0', substrate: 'gravel', themeKey: 'tropical' },
            content: {
                fish: {
                    neon_tetra: { name: 'Neon Tetra', basePrice: 25, baseCoinPerHour: 3.2, hungerRate: 0.8, spaceCost: 0.5, diet: { accepts: ['tropical_flakes', 'bloodworms'] }, requirements: { tools: [...TROPICAL_TOOL_REQS] }, preferences: { zonePreference: 'middle', schooling: true }, visuals: { spriteKey: 'neon_tetra' } },
                    blue_eye: { name: 'Blue-Eye', basePrice: 30, baseCoinPerHour: 3.5, hungerRate: 0.9, spaceCost: 0.5, diet: { accepts: ['tropical_flakes', 'pellets'] }, requirements: { tools: [...TROPICAL_TOOL_REQS] }, preferences: { zonePreference: 'top' }, visuals: { spriteKey: 'blue_eye' } },
                    moon_fish: { name: 'Moon Fish', basePrice: 40, baseCoinPerHour: 4.5, hungerRate: 1.0, spaceCost: 2, diet: { accepts: ['tropical_flakes', 'pellets', 'bloodworms'] }, requirements: { tools: [...TROPICAL_TOOL_REQS] }, preferences: { zonePreference: 'middle' }, visuals: { spriteKey: 'moon_fish' } },
                    discus: { name: 'Discus', basePrice: 70, baseCoinPerHour: 6.5, hungerRate: 1.1, spaceCost: 4, diet: { accepts: ['tropical_flakes', 'bloodworms'] }, requirements: { tools: [...TROPICAL_TOOL_REQS], plantMass: { minTotal: 3.0, penalty: 25, label: 'Needs plants' } }, preferences: { zonePreference: 'middle' }, visuals: { spriteKey: 'discus' } },
                    pleco: { name: 'Pleco', basePrice: 50, baseCoinPerHour: 1.8, hungerRate: 0.6, spaceCost: 3, diet: { accepts: ['algae_wafer'] }, requirements: { tools: [...TROPICAL_TOOL_REQS] }, preferences: { zonePreference: 'bottom', movementType: 'glass' }, utility: { dirtReduction: 0.10 }, visuals: { spriteKey: 'pleco' } },
                    gourami: { name: 'Gourami', basePrice: 55, baseCoinPerHour: 5.5, hungerRate: 1.0, spaceCost: 2, diet: { accepts: ['tropical_flakes', 'pellets', 'bloodworms'] }, requirements: { tools: [...TROPICAL_TOOL_REQS], floatingPlants: { minCount: 1, penalty: 30, label: 'Needs floating plants' } }, preferences: { zonePreference: 'top' }, visuals: { spriteKey: 'gourami' } },
                },
                food: {
                    tropical_flakes: { name: 'Tropical Flakes', price: 4, hungerRestore: 30, xp: 5, sinkBehavior: 'slowSink' },
                    pellets: { name: 'Pellets', price: 6, hungerRestore: 45, xp: 8, sinkBehavior: 'sink' },
                    bloodworms: { name: 'Bloodworms', price: 8, hungerRestore: 55, xp: 10, sinkBehavior: 'slowSink' },
                    algae_wafer: { name: 'Algae Wafer', price: 4, hungerRestore: 35, xp: 5, sinkBehavior: 'sink' },
                },
                decor: {
                    java_fern: { name: 'Java Fern', price: 30, placement: 'mid', growth: { growthRatePerHour: 0.015, minSize: 0.5, maxSize: 1.8 } },
                    amazon_sword: { name: 'Amazon Sword', price: 40, placement: 'mid', growth: { growthRatePerHour: 0.02, minSize: 0.5, maxSize: 2.0 } },
                    cryptocoryne: { name: 'Cryptocoryne', price: 28, placement: 'mid', growth: { growthRatePerHour: 0.012, minSize: 0.5, maxSize: 1.6 } },
                    ludwigia: { name: 'Ludwigia', price: 35, placement: 'mid', growth: { growthRatePerHour: 0.022, minSize: 0.5, maxSize: 2.0 } },
                    floating_plants: { name: 'Floating Plants', price: 20, placement: 'top', growth: { growthRatePerHour: 0.025, minSize: 0.3, maxSize: 1.5 }, spread: { spreadChancePerDay: 0.3, maxClusters: 4, spawnRadius: 0.15, spreadThreshold: 0.8 } },
                    mossy_log: { name: 'Mossy Log', price: 45, placement: 'bottom' },
                    hollow_stump: { name: 'Hollow Stump', price: 55, placement: 'bottom' },
                },
                tools: {
                    heater: { name: 'Heater', prices: [60], maxLevel: 1, effect: {}, negativeIfMissing: { penalty: 20, label: 'Missing Heater' } },
                    filter_tropical: { name: 'Filter', prices: [80, 180], maxLevel: 2, effect: { dirtReduction: [0.20, 0.30], flow: [0.3, 0.6] } },
                },
            },
            store: { sections: [
                { id: 'fish', order: ['neon_tetra', 'blue_eye', 'moon_fish', 'discus', 'pleco', 'gourami'] },
                { id: 'food', order: ['tropical_flakes', 'pellets', 'bloodworms', 'algae_wafer'] },
                { id: 'decor', order: ['java_fern', 'amazon_sword', 'cryptocoryne', 'ludwigia', 'floating_plants', 'mossy_log', 'hollow_stump'] },
                { id: 'tools', order: ['heater', 'filter_tropical'] },
            ] },
        },
        salt: {
            id: 'salt', name: 'Saltwater Reef',
            unlock: { type: 'compound', rules: [{ type: 'lifetimeCoins', value: 5000 }, { type: 'toolOwned', toolId: 'heater', tankId: 'tropical' }], label: 'Earn 5,000 lifetime coins and own a Heater' },
            capacity: { spaceCapacity: 20 },
            simulation: { baseDirtyRatePerHour: 0.6, dirtyPerSpacePerHour: 0.12, hungerRateMultiplier: 1.0 },
            visuals: { waterTint: '#1a4a7a', substrate: 'sand', themeKey: 'salt' },
            content: {
                fish: {
                    clownfish: { name: 'Clownfish', basePrice: 45, baseCoinPerHour: 5.0, hungerRate: 1.0, spaceCost: 2, diet: { accepts: ['marine_pellets', 'reef_flakes', 'frozen_brine'] }, requirements: { tools: [...SALT_TOOL_REQS], decor: [{ decorId: 'anemone', penalty: 40 }] }, preferences: { nearDecor: 'anemone', zonePreference: 'middle' }, visuals: { spriteKey: 'clownfish' } },
                    blue_tang: { name: 'Blue Tang', basePrice: 80, baseCoinPerHour: 7.5, hungerRate: 1.1, spaceCost: 3, diet: { accepts: ['marine_pellets', 'reef_flakes'] }, requirements: { tools: [...SALT_TOOL_REQS] }, preferences: { zonePreference: 'middle' }, visuals: { spriteKey: 'blue_tang' } },
                    green_chromis: { name: 'Green Chromis', basePrice: 35, baseCoinPerHour: 3.0, hungerRate: 0.8, spaceCost: 0.5, diet: { accepts: ['reef_flakes', 'frozen_brine'] }, requirements: { tools: [...SALT_TOOL_REQS] }, preferences: { zonePreference: 'middle', schooling: true }, visuals: { spriteKey: 'green_chromis' } },
                    firefish: { name: 'Firefish', basePrice: 45, baseCoinPerHour: 4.5, hungerRate: 0.9, spaceCost: 1, diet: { accepts: ['reef_flakes', 'frozen_brine'] }, requirements: { tools: [...SALT_TOOL_REQS] }, preferences: { nearDecor: 'brain_coral', zonePreference: 'middle' }, visuals: { spriteKey: 'firefish' } },
                    royal_gramma: { name: 'Royal Gramma', basePrice: 55, baseCoinPerHour: 5.0, hungerRate: 0.9, spaceCost: 1.5, diet: { accepts: ['marine_pellets', 'reef_flakes'] }, requirements: { tools: [...SALT_TOOL_REQS] }, preferences: { nearDecor: 'cave', zonePreference: 'bottom' }, visuals: { spriteKey: 'royal_gramma' } },
                    banggai_cardinal: { name: 'Banggai Cardinalfish', basePrice: 45, baseCoinPerHour: 3.8, hungerRate: 0.8, spaceCost: 1, diet: { accepts: ['reef_flakes', 'frozen_brine'] }, requirements: { tools: [...SALT_TOOL_REQS] }, preferences: { zonePreference: 'middle', schooling: true }, visuals: { spriteKey: 'banggai_cardinal' } },
                    moray_eel: { name: 'Moray Eel', basePrice: 150, baseCoinPerHour: 12.0, hungerRate: 1.3, spaceCost: 8, maxPerTank: 1, diet: { accepts: ['marine_pellets', 'frozen_brine', 'live_shrimp'] }, requirements: { tools: [...SALT_TOOL_REQS], decor: [{ decorId: 'cave', penalty: 55 }] }, preferences: { nearDecor: 'cave', zonePreference: 'bottom', movementType: 'snake' }, visuals: { spriteKey: 'moray_eel' } },
                    cleaner_shrimp: { name: 'Cleaner Shrimp', basePrice: 55, baseCoinPerHour: 1.8, hungerRate: 0.5, spaceCost: 0.5, diet: { accepts: ['reef_flakes'] }, requirements: { tools: [...SALT_TOOL_REQS] }, preferences: { zonePreference: 'bottom', movementType: 'crawl' }, utility: { dirtReduction: 0.08 }, visuals: { spriteKey: 'cleaner_shrimp' } },
                },
                food: {
                    marine_pellets: { name: 'Marine Pellets', price: 8, hungerRestore: 45, xp: 8, sinkBehavior: 'sink' },
                    reef_flakes: { name: 'Reef Flakes', price: 6, hungerRestore: 30, xp: 5, sinkBehavior: 'slowSink' },
                    frozen_brine: { name: 'Frozen Brine Shrimp', price: 10, hungerRestore: 55, xp: 10, sinkBehavior: 'slowSink' },
                    live_shrimp: { name: 'Live Shrimp', price: 18, hungerRestore: 70, xp: 15, sinkBehavior: 'sink' },
                },
                decor: {
                    anemone: { name: 'Anemone', price: 80, placement: 'any' },
                    live_rock: { name: 'Live Rock', price: 45, placement: 'bottom' },
                    brain_coral: { name: 'Brain Coral', price: 60, placement: 'bottom' },
                    staghorn_coral: { name: 'Staghorn Coral', price: 55, placement: 'any' },
                    cave: { name: 'Cave', price: 100, placement: 'bottom', maxPerTank: 1 },
                    sea_fan: { name: 'Sea Fan', price: 40, placement: 'any' },
                },
                tools: {
                    filter_salt: { name: 'Filter', prices: [100, 220], maxLevel: 2, effect: { dirtReduction: [0.20, 0.30], flow: [0.3, 0.6] } },
                    skimmer: { name: 'Protein Skimmer', prices: [150], maxLevel: 1, effect: { dirtReduction: [0.20] } },
                    uv_sterilizer: { name: 'UV Sterilizer', prices: [200], maxLevel: 1, effect: {} },
                },
            },
            store: { sections: [
                { id: 'fish', order: ['clownfish', 'blue_tang', 'green_chromis', 'firefish', 'royal_gramma', 'banggai_cardinal', 'moray_eel', 'cleaner_shrimp'] },
                { id: 'food', order: ['marine_pellets', 'reef_flakes', 'frozen_brine', 'live_shrimp'] },
                { id: 'decor', order: ['anemone', 'live_rock', 'brain_coral', 'staghorn_coral', 'cave', 'sea_fan'] },
                { id: 'tools', order: ['filter_salt', 'skimmer', 'uv_sterilizer'] },
            ] },
        },
    },
};

// ── Save model ───────────────────────────────────────────────────────

function createDefaultTank(tankId, unlocked) {
    return { id: tankId, unlocked: !!unlocked, cleanliness: 100, lastSeenAt: Date.now(), foodStock: {}, toolsOwned: {}, fish: [], decor: [] };
}

function createFishInstance(speciesId, overrides) {
    return {
        id: generateId(), speciesId, bornAt: Date.now(), level: 1, xp: 0,
        hunger: 90 + Math.floor(Math.random() * 10), health: 100, weak: false,
        lastFedAt: Date.now(), lastPlayedAt: null,
        ...(overrides || {}),
    };
}

function createDecorInstance(decorId, x, y, overrides) {
    return { id: generateId(), decorId, x: x ?? (0.2 + Math.random() * 0.6), y: y ?? 0.85, size: 1.0, placedAt: Date.now(), state: {}, ...(overrides || {}) };
}

function createInitialState() {
    const fresh = createDefaultTank('fresh', true);
    fresh.foodStock = { basic_flakes: 10 };
    fresh.fish = [createFishInstance('guppy', { hunger: 95 })];

    return {
        version: CURRENT_SAVE_VERSION, widgetInstanceId: 'aquarium', activeTankId: 'fresh',
        coins: 50,
        tanks: { fresh, tropical: createDefaultTank('tropical', false), salt: createDefaultTank('salt', false) },
        lifetime: { coinsEarned: 0 },
        meta: { createdAt: Date.now(), lastSavedAt: Date.now(), lastCatalogVersion: CATALOG.contentVersion },
    };
}

// ── Economy helpers ──────────────────────────────────────────────────

function getUsedSpace(tank, tankCat) {
    return tank.fish.reduce((s, f) => { const sp = tankCat.content.fish[f.speciesId]; return s + (sp ? sp.spaceCost : 1); }, 0);
}

function getSpeciesCount(tank, speciesId) { return tank.fish.filter(f => f.speciesId === speciesId).length; }

function getFishPrice(speciesId, ownedCount, tankCat) {
    const sp = tankCat.content.fish[speciesId]; if (!sp) return Infinity;
    return Math.ceil(sp.basePrice * Math.pow(CATALOG.global.economy.priceGrowth.fish, ownedCount));
}

function getSellReturn(fish, tankCat) {
    const sp = tankCat.content.fish[fish.speciesId]; if (!sp) return 0;
    return Math.ceil(getFishPrice(fish.speciesId, 1, tankCat) * CATALOG.global.economy.fishSellReturn * (1 + fish.level * 0.05));
}

function getDecorSellReturn(decorId, tankCat) {
    const d = tankCat.content.decor[decorId]; if (!d) return 0;
    return Math.ceil(d.price * (d.sellReturn ?? CATALOG.global.economy.sellReturnDefault));
}

function xpToNextLevel(level) { return XP_BASE + XP_PER_LEVEL_SCALE * (level - 1); }

function getLifeStage(fish) {
    const ageDays = (Date.now() - fish.bornAt) / 86400000;
    if (ageDays < 2) return { stage: 'Baby', coinMult: 0.90 };
    if (ageDays < 7) return { stage: 'Child', coinMult: 1.00 };
    return { stage: 'Adult', coinMult: 1.05 };
}

// ── Happiness ────────────────────────────────────────────────────────

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

function calculateHappiness(fish, tank, tankCat) {
    const species = tankCat.content.fish[fish.speciesId];
    if (!species) return { happiness: 50, breakdown: [] };
    let happiness = 100;
    const breakdown = [];
    const hc = hungerContribution(fish.hunger);
    if (hc !== 0) breakdown.push({ label: 'Hunger', value: Math.round(hc) });
    happiness += hc;
    const cc = cleanlinessContribution(tank.cleanliness);
    if (cc !== 0) breakdown.push({ label: 'Cleanliness', value: Math.round(cc) });
    happiness += cc;
    const reqs = species.requirements || {};
    if (reqs.tools) for (const r of reqs.tools) { if ((tank.toolsOwned[r.toolId] || 0) <= 0) { happiness -= r.penalty; breakdown.push({ label: r.label, value: -r.penalty }); } }
    if (reqs.decor) for (const r of reqs.decor) { if (!tank.decor.some(d => d.decorId === r.decorId)) { happiness -= r.penalty; breakdown.push({ label: r.label || 'Missing decor', value: -r.penalty }); } }
    if (reqs.plantMass) { const pm = tank.decor.reduce((s, d) => { const dd = tankCat.content.decor[d.decorId]; return dd?.growth ? s + d.size : s; }, 0); if (pm < reqs.plantMass.minTotal) { happiness -= reqs.plantMass.penalty; breakdown.push({ label: reqs.plantMass.label, value: -reqs.plantMass.penalty }); } }
    if (reqs.floatingPlants) { const fc = tank.decor.filter(d => { const dd = tankCat.content.decor[d.decorId]; return dd?.placement === 'top'; }).length; if (fc < reqs.floatingPlants.minCount) { happiness -= reqs.floatingPlants.penalty; breakdown.push({ label: reqs.floatingPlants.label, value: -reqs.floatingPlants.penalty }); } }
    return { happiness: clamp(Math.round(happiness), 0, 100), breakdown };
}

function getHappinessCoinMod(h) { if (h >= 80) return 1.0; if (h >= 60) return 0.70; if (h >= 40) return 0.40; if (h >= 20) return 0.15; return 0; }

// ── Simulation ───────────────────────────────────────────────────────

function getEffectiveDirtRate(tank, tankCat) {
    const totalSpace = tank.fish.reduce((s, f) => { const sp = tankCat.content.fish[f.speciesId]; return s + (sp ? sp.spaceCost : 1); }, 0);
    let rate = tankCat.simulation.baseDirtyRatePerHour + totalSpace * tankCat.simulation.dirtyPerSpacePerHour;
    for (const [toolId, level] of Object.entries(tank.toolsOwned)) {
        const t = tankCat.content.tools[toolId]; if (t?.effect?.dirtReduction && level > 0) rate *= (1 - (t.effect.dirtReduction[level - 1] || 0));
    }
    let utilRed = 0;
    for (const f of tank.fish) { const sp = tankCat.content.fish[f.speciesId]; if (sp?.utility?.dirtReduction) utilRed += sp.utility.dirtReduction; }
    rate *= Math.max(0, 1 - utilRed);
    return Math.max(rate, 0.05);
}

function simulate(save) {
    const now = Date.now();
    let totalCoinsEarned = 0;
    for (const tankId of Object.keys(save.tanks)) {
        const tank = save.tanks[tankId]; if (!tank?.unlocked) continue;
        const tankCat = CATALOG.tanks[tankId]; if (!tankCat) continue;
        const dtMs = Math.min(now - (tank.lastSeenAt || now), MAX_IDLE_HOURS * 3600000);
        const dtHours = dtMs / 3600000;
        if (dtHours <= 0) { tank.lastSeenAt = now; continue; }
        const dirtRate = getEffectiveDirtRate(tank, tankCat);
        tank.cleanliness = clamp(tank.cleanliness - dirtRate * dtHours, 0, 100);
        for (const fish of tank.fish) {
            const sp = tankCat.content.fish[fish.speciesId]; if (!sp) continue;
            fish.hunger = clamp(fish.hunger - sp.hungerRate * dtHours, 0, 100);
            const { happiness } = calculateHappiness(fish, tank, tankCat);
            if ((fish.hunger <= 10 || happiness < 20) && !fish.weak) { fish.weak = true; fish.health = clamp(fish.health - 20, 0, 100); }
            if (fish.weak && fish.hunger >= 35 && tank.cleanliness >= 30) fish.weak = false;
            if (!fish.weak && fish.hunger >= 40 && tank.cleanliness >= 40) fish.health = clamp(fish.health + 2 * dtHours, 0, 100);
            const coinMod = getHappinessCoinMod(happiness);
            const ls = getLifeStage(fish);
            const coins = sp.baseCoinPerHour * coinMod * (1 + fish.level * LEVEL_COIN_BONUS) * ls.coinMult * dtHours;
            save.coins += coins; totalCoinsEarned += coins;
        }
        for (const d of tank.decor) { const dd = tankCat.content.decor[d.decorId]; if (dd?.growth) d.size = clamp(d.size + dd.growth.growthRatePerHour * dtHours, dd.growth.minSize, dd.growth.maxSize); }
        tank.lastSeenAt = now;
    }
    save.lifetime.coinsEarned += totalCoinsEarned;
    save.meta.lastSavedAt = now;
    return { coinsEarned: Math.floor(totalCoinsEarned), dtHours: 0 };
}

// ── Unlock requirements ──────────────────────────────────────────────

function checkUnlockRequirements(save, tankId) {
    const rule = CATALOG.tanks[tankId]?.unlock; if (!rule) return false;
    return evalRule(save, rule);
}

function evalRule(save, rule) {
    switch (rule.type) {
        case 'free': return true;
        case 'lifetimeCoins': return save.lifetime.coinsEarned >= (rule.value || 0);
        case 'toolOwned': { const t = save.tanks[rule.tankId]; return t && (t.toolsOwned[rule.toolId] || 0) > 0; }
        case 'compound': return (rule.rules || []).every(r => evalRule(save, r));
        default: return false;
    }
}

// ── Response builder ─────────────────────────────────────────────────

function getEffectiveFlow(tank, tankCat) {
    let maxFlow = 0;
    for (const [toolId, level] of Object.entries(tank.toolsOwned || {})) {
        const t = tankCat.content?.tools?.[toolId];
        if (t?.effect?.flow && level > 0) {
            const f = t.effect.flow[level - 1] || 0;
            if (f > maxFlow) maxFlow = f;
        }
    }
    return maxFlow;
}

function buildResponse(save, actionResult) {
    const tankId = save.activeTankId;
    const tank = save.tanks[tankId];
    const tankCat = CATALOG.tanks[tankId];
    if (!tank || !tankCat) return { save, error: 'Invalid tank' };
    const fishComputed = tank.fish.map(f => {
        const sp = tankCat.content.fish[f.speciesId];
        const { happiness, breakdown } = calculateHappiness(f, tank, tankCat);
        const ls = getLifeStage(f);
        const coinMod = getHappinessCoinMod(happiness);
        const coinRate = sp ? sp.baseCoinPerHour * coinMod * (1 + f.level * LEVEL_COIN_BONUS) * ls.coinMult : 0;
        return { ...f, _computed: { happiness, happinessBreakdown: breakdown, lifeStage: ls.stage, coinRate: Math.round(coinRate * 10) / 10, speciesName: sp?.name || 'Unknown', xpToNext: xpToNextLevel(f.level) } };
    });
    return {
        save: { ...save, tanks: { ...save.tanks, [tankId]: { ...tank, fish: fishComputed } } },
        activeTankId: tankId,
        coins: Math.floor(save.coins),
        tankCatalog: { ...tankCat, _computed: { dirtRate: Math.round(getEffectiveDirtRate(tank, tankCat) * 100) / 100, usedSpace: getUsedSpace(tank, tankCat), flow: getEffectiveFlow(tank, tankCat) } },
        store: buildStoreCatalog(save, tankId),
        tanksList: buildTanksList(save),
        global: CATALOG.global,
        result: actionResult || {},
    };
}

function buildStoreCatalog(save, tankId) {
    const tank = save.tanks[tankId]; const tankCat = CATALOG.tanks[tankId]; if (!tank || !tankCat) return {};
    const sections = {};
    for (const sec of tankCat.store.sections) {
        const items = [];
        for (const itemId of sec.order) {
            if (sec.id === 'fish') {
                const sp = tankCat.content.fish[itemId]; if (!sp) continue;
                const ownedCount = getSpeciesCount(tank, itemId);
                const price = getFishPrice(itemId, ownedCount, tankCat);
                const used = getUsedSpace(tank, tankCat);
                const hasSpace = used + sp.spaceCost <= tankCat.capacity.spaceCapacity;
                const maxReached = sp.maxPerTank ? ownedCount >= sp.maxPerTank : false;
                let blockReason = null;
                if (maxReached) blockReason = `Max ${sp.maxPerTank} per tank`;
                else if (!hasSpace) blockReason = `Tank full (${used}/${tankCat.capacity.spaceCapacity} space)`;
                else if (save.coins < price) blockReason = 'Not enough coins';
                const reqInfo = [];
                if (sp.requirements?.tools) { for (const req of sp.requirements.tools) { if ((tank.toolsOwned[req.toolId] || 0) <= 0) reqInfo.push(req.label || `Requires ${req.toolId}`); } }
                if (sp.requirements?.decor) { for (const req of sp.requirements.decor) { if (!tank.decor.some(d => d.decorId === req.decorId)) reqInfo.push(req.label || `Requires ${req.decorId}`); } }
                items.push({ id: itemId, name: sp.name, price, spaceCost: sp.spaceCost, baseCoinPerHour: sp.baseCoinPerHour, ownedCount, canBuy: !blockReason, blockReason, reqInfo, diet: sp.diet, requirements: sp.requirements });
            } else if (sec.id === 'food') {
                const fd = tankCat.content.food[itemId]; if (!fd) continue;
                items.push({ id: itemId, name: fd.name, price: fd.price, hungerRestore: fd.hungerRestore, sinkBehavior: fd.sinkBehavior, currentStock: tank.foodStock[itemId] || 0, canBuy: save.coins >= fd.price });
            } else if (sec.id === 'decor') {
                const dc = tankCat.content.decor[itemId]; if (!dc) continue;
                const maxReached = dc.maxPerTank ? tank.decor.filter(d => d.decorId === itemId).length >= dc.maxPerTank : false;
                items.push({ id: itemId, name: dc.name, price: dc.price, placement: dc.placement, growth: !!dc.growth, sellReturn: getDecorSellReturn(itemId, tankCat), canBuy: !maxReached && save.coins >= dc.price, blockReason: maxReached ? `Max ${dc.maxPerTank}` : (save.coins < dc.price ? 'Not enough coins' : null) });
            } else if (sec.id === 'tools') {
                const tl = tankCat.content.tools[itemId]; if (!tl) continue;
                const cl = tank.toolsOwned[itemId] || 0; const maxed = cl >= tl.maxLevel;
                const np = maxed ? null : tl.prices[cl];
                items.push({ id: itemId, name: tl.name, currentLevel: cl, maxLevel: tl.maxLevel, nextPrice: np, maxed, canBuy: !maxed && save.coins >= (np || Infinity), blockReason: maxed ? 'Max level' : (save.coins < np ? 'Not enough coins' : null) });
            }
        }
        sections[sec.id] = items;
    }
    return sections;
}

function buildTanksList(save) {
    return Object.keys(CATALOG.tanks).map(tankId => {
        const tc = CATALOG.tanks[tankId]; const t = save.tanks[tankId];
        return {
            tankId, name: tc.name, spaceCapacity: tc.capacity.spaceCapacity,
            unlocked: t?.unlocked || false, fishCount: t?.fish?.length || 0,
            usedSpace: t?.unlocked ? getUsedSpace(t, tc) : 0,
            meetsRequirements: checkUnlockRequirements(save, tankId),
            unlockLabel: tc.unlock.label, isActive: save.activeTankId === tankId,
        };
    });
}

// ── Action handler ───────────────────────────────────────────────────

function handleAction(save, type, payload) {
    const tid = save.activeTankId; const tank = save.tanks[tid]; const tankCat = CATALOG.tanks[tid];
    if (!tank || !tankCat) return { error: 'Invalid tank' };
    switch (type) {
        case 'switch_tank': { const t = save.tanks[payload.tankId]; if (!t?.unlocked) return { error: 'Tank not unlocked' }; save.activeTankId = payload.tankId; return { switched: true, tankId: payload.tankId }; }
        case 'unlock_tank': { const t = save.tanks[payload.tankId]; if (!t) return { error: 'Unknown tank' }; if (t.unlocked) return { error: 'Already unlocked' }; if (!checkUnlockRequirements(save, payload.tankId)) return { error: 'Requirements not met' }; t.unlocked = true; save.activeTankId = payload.tankId; return { unlocked: true, tankId: payload.tankId, tankName: CATALOG.tanks[payload.tankId].name }; }
        case 'buy_fish': {
            const sp = tankCat.content.fish[payload.speciesId]; if (!sp) return { error: 'Unknown species' };
            if (getUsedSpace(tank, tankCat) + sp.spaceCost > tankCat.capacity.spaceCapacity) return { error: 'Tank full' };
            if (sp.maxPerTank && getSpeciesCount(tank, payload.speciesId) >= sp.maxPerTank) return { error: 'Max reached' };
            const price = getFishPrice(payload.speciesId, getSpeciesCount(tank, payload.speciesId), tankCat);
            if (save.coins < price) return { error: 'Not enough coins' };
            save.coins -= price; const fish = createFishInstance(payload.speciesId); tank.fish.push(fish);
            return { bought: true, fish, price };
        }
        case 'sell_fish': { const idx = tank.fish.findIndex(f => f.id === payload.fishId); if (idx === -1) return { error: 'Fish not found' }; const f = tank.fish[idx]; const v = getSellReturn(f, tankCat); save.coins += v; tank.fish.splice(idx, 1); return { sold: true, value: v }; }
        case 'feed': { const food = tankCat.content.food[payload.foodId]; if (!food) return { error: 'Unknown food' }; if ((tank.foodStock[payload.foodId] || 0) <= 0) return { error: 'Out of stock' }; tank.foodStock[payload.foodId]--; return { fed: true, foodId: payload.foodId }; }
        case 'fish_consume': {
            const fish = tank.fish.find(f => f.id === payload.fishId); if (!fish) return { error: 'Fish not found' };
            const food = tankCat.content.food[payload.foodId]; if (!food) return { error: 'Unknown food' };
            const sp = tankCat.content.fish[fish.speciesId]; if (sp && !sp.diet.accepts.includes(payload.foodId)) return { ignored: true };
            fish.hunger = clamp(fish.hunger + food.hungerRestore, 0, 100); fish.lastFedAt = Date.now();
            fish.xp += food.xp; while (fish.level < MAX_LEVEL && fish.xp >= xpToNextLevel(fish.level)) { fish.xp -= xpToNextLevel(fish.level); fish.level++; }
            return { consumed: true, fishId: fish.id, hunger: fish.hunger, level: fish.level };
        }
        case 'start_clean': { const dp = 1 - tank.cleanliness / 100; const seed = hashString(tid + Math.floor(tank.cleanliness)); return { started: true, dirtPercent: dp, seed, gridW: 64, gridH: 48 }; }
        case 'finish_clean': {
            const imp = clamp(payload.improvementPercent || 0, 0, 100) / 100;
            const dirtBefore = 1 - tank.cleanliness / 100; const removed = dirtBefore * imp;
            tank.cleanliness = clamp(tank.cleanliness + removed * 100, 0, 100);
            const coins = Math.floor(removed * 100 * CATALOG.global.economy.coinsPer100Dirt);
            save.coins += coins; save.lifetime.coinsEarned += coins;
            for (const f of tank.fish) { f.xp += Math.ceil(2 * imp); while (f.level < MAX_LEVEL && f.xp >= xpToNextLevel(f.level)) { f.xp -= xpToNextLevel(f.level); f.level++; } }
            return { cleaned: true, cleanliness: tank.cleanliness, coinsEarned: coins };
        }
        case 'laser_pointer': {
            const now = Date.now(); const last = tank._lastLaserReward || 0;
            if (now - last >= LASER_COOLDOWN_MS) { tank._lastLaserReward = now; save.coins += LASER_REWARD_COINS; save.lifetime.coinsEarned += LASER_REWARD_COINS; for (const f of tank.fish) { f.xp += LASER_REWARD_XP; f.lastPlayedAt = now; while (f.level < MAX_LEVEL && f.xp >= xpToNextLevel(f.level)) { f.xp -= xpToNextLevel(f.level); f.level++; } } return { reward: { coins: LASER_REWARD_COINS, xp: LASER_REWARD_XP } }; }
            return { reward: null, cooldownRemaining: LASER_COOLDOWN_MS - (now - last) };
        }
        case 'buy_food': { const food = tankCat.content.food[payload.foodId]; if (!food) return { error: 'Unknown food' }; const qty = Math.max(1, payload.quantity || 5); const cost = food.price * qty; if (save.coins < cost) return { error: 'Not enough coins' }; save.coins -= cost; tank.foodStock[payload.foodId] = (tank.foodStock[payload.foodId] || 0) + qty; return { bought: true, foodId: payload.foodId, quantity: qty, newStock: tank.foodStock[payload.foodId] }; }
        case 'buy_decor': { const dd = tankCat.content.decor[payload.decorId]; if (!dd) return { error: 'Unknown decor' }; if (dd.maxPerTank && tank.decor.filter(d => d.decorId === payload.decorId).length >= dd.maxPerTank) return { error: 'Max reached' }; if (save.coins < dd.price) return { error: 'Not enough coins' }; save.coins -= dd.price; const d = createDecorInstance(payload.decorId); if (dd.growth) d.size = dd.growth.minSize; tank.decor.push(d); return { bought: true, decor: d }; }
        case 'sell_decor': { const idx = tank.decor.findIndex(d => d.id === payload.decorInstanceId); if (idx === -1) return { error: 'Decor not found' }; const d = tank.decor[idx]; const v = getDecorSellReturn(d.decorId, tankCat); save.coins += v; tank.decor.splice(idx, 1); return { sold: true, value: v }; }
        case 'buy_tool': { const tl = tankCat.content.tools[payload.toolId]; if (!tl) return { error: 'Unknown tool' }; const cl = tank.toolsOwned[payload.toolId] || 0; if (cl >= tl.maxLevel) return { error: 'Max level' }; const p = tl.prices[cl]; if (save.coins < p) return { error: 'Not enough coins' }; save.coins -= p; tank.toolsOwned[payload.toolId] = cl + 1; return { bought: true, toolId: payload.toolId, level: cl + 1 }; }
        case 'move_decor': { const d = tank.decor.find(d => d.id === payload.decorInstanceId); if (!d) return { error: 'Decor not found' }; d.x = clamp(payload.x ?? d.x, 0, 1); d.y = clamp(payload.y ?? d.y, 0, 1); return { moved: true }; }
        case 'trim_plant': { const d = tank.decor.find(d => d.id === payload.decorInstanceId); if (!d) return { error: 'Decor not found' }; const dd = tankCat.content.decor[d.decorId]; if (!dd?.growth) return { error: 'Not growable' }; d.size = clamp(d.size - 0.25, dd.growth.minSize, dd.growth.maxSize); return { trimmed: true, newSize: d.size }; }
        case 'reset_state': { const fresh = createInitialState(); Object.assign(save, fresh); return { reset: true }; }
        case 'debug_scenario': return applyDebugScenario(save, payload.scenario);
        default: return { error: `Unknown action: ${type}` };
    }
}

function applyDebugScenario(save, scenario) {
    const tank = save.tanks[save.activeTankId]; if (!tank) return { error: 'No tank' };
    switch (scenario) {
        case 'clean_tank': tank.cleanliness = 100; tank.fish.forEach(f => { f.hunger = 90; f.weak = false; f.health = 100; }); return { applied: 'clean_tank' };
        case 'dirty_tank': tank.cleanliness = 5; return { applied: 'dirty_tank' };
        case 'hungry_fish': tank.fish.forEach(f => { f.hunger = 5; }); return { applied: 'hungry_fish' };
        case 'all_weak': tank.fish.forEach(f => { f.weak = true; f.hunger = 5; f.health = 10; }); return { applied: 'all_weak' };
        case 'rich': save.coins = 99999; return { applied: 'rich' };
        case 'poor': save.coins = 0; return { applied: 'poor' };
        case 'missing_requirements': {
            tank.decor = tank.decor.filter(d => d.decorId !== 'anemone' && d.decorId !== 'cave');
            for (const toolId of Object.keys(tank.toolsOwned)) delete tank.toolsOwned[toolId];
            return { applied: 'missing_requirements' };
        }
        case 'max_plants': {
            const tc = CATALOG.tanks[save.activeTankId];
            for (const d of tank.decor) { const dd = tc?.content?.decor?.[d.decorId]; if (dd?.growth) d.size = dd.growth.maxSize; }
            return { applied: 'max_plants' };
        }
        case 'baby_fish': tank.fish.forEach(f => { f.bornAt = Date.now(); }); return { applied: 'baby_fish' };
        case 'full_tank': {
            const tc = CATALOG.tanks[save.activeTankId];
            while (getUsedSpace(tank, tc) < tc.capacity.spaceCapacity) {
                const ids = Object.keys(tc.content.fish);
                const small = ids.reduce((best, id) => { const sp = tc.content.fish[id]; if (!best || sp.spaceCost < tc.content.fish[best].spaceCost) return id; return best; }, null);
                if (!small) break; const sp = tc.content.fish[small]; if (getUsedSpace(tank, tc) + sp.spaceCost > tc.capacity.spaceCapacity) break;
                tank.fish.push(createFishInstance(small));
            }
            return { applied: 'full_tank' };
        }
        case 'all_unlocked': {
            for (const tankId of Object.keys(save.tanks)) { const t = save.tanks[tankId]; if (!t.unlocked) { t.unlocked = true; if (t.fish.length === 0) { const first = Object.keys(CATALOG.tanks[tankId].content.fish)[0]; if (first) t.fish.push(createFishInstance(first)); } } }
            return { applied: 'all_unlocked' };
        }
        case 'fresh_start': { const fresh = createInitialState(); Object.assign(save, fresh); return { applied: 'fresh_start' }; }
        case 'full_grown_fresh': return applyMockFullGrownTank(save, 'fresh');
        case 'full_grown_tropical': return applyMockFullGrownTank(save, 'tropical');
        case 'full_grown_salt': return applyMockFullGrownTank(save, 'salt');
        default: return { error: 'Unknown scenario' };
    }
}

function applyMockFullGrownTank(save, tankId) {
    const tc = CATALOG.tanks[tankId];
    if (!tc) return { error: `Unknown tank: ${tankId}` };
    if (!save.tanks[tankId]) save.tanks[tankId] = createDefaultTank(tankId, false);
    const tank = save.tanks[tankId];
    tank.unlocked = true;
    save.coins = 50000; save.lifetimeCoins = 50000; save.xp = 5000; save.activeTankId = tankId;
    tank.fish = [];
    const speciesIds = Object.keys(tc.content.fish);
    for (const sid of speciesIds) {
        if (getUsedSpace(tank, tc) + tc.content.fish[sid].spaceCost > tc.capacity.spaceCapacity) break;
        tank.fish.push(createFishInstance(sid, { bornAt: Date.now() - 30 * 86400000, hunger: 85, health: 100, weak: false, fedCount: 500 }));
    }
    const smallest = speciesIds.reduce((best, id) => { const sp = tc.content.fish[id]; if (!best || sp.spaceCost < tc.content.fish[best].spaceCost) return id; return best; }, null);
    if (smallest) {
        while (getUsedSpace(tank, tc) + tc.content.fish[smallest].spaceCost <= tc.capacity.spaceCapacity) {
            tank.fish.push(createFishInstance(smallest, { bornAt: Date.now() - 30 * 86400000, hunger: 85, health: 100, weak: false, fedCount: 500 }));
        }
    }
    tank.decor = [];
    const decorIds = Object.keys(tc.content.decor);
    for (let i = 0; i < decorIds.length; i++) {
        const did = decorIds[i]; const dd = tc.content.decor[did];
        const d = createDecorInstance(did, 0.1 + (i / decorIds.length) * 0.8);
        if (dd.growth) d.size = dd.growth.maxSize;
        tank.decor.push(d);
    }
    tank.foodStock = {};
    for (const fid of Object.keys(tc.content.food)) tank.foodStock[fid] = 50;
    tank.toolsOwned = {};
    for (const [tid, tDef] of Object.entries(tc.content.tools || {})) tank.toolsOwned[tid] = tDef.maxLevel || 1;
    tank.cleanliness = 100;
    return { applied: `full_grown_${tankId}` };
}

// ── Scenario state generators ────────────────────────────────────────

function createScenarioState(scenarioId) {
    switch (scenarioId) {
        case 'dirty-near-threshold': {
            const s = createInitialState();
            s.tanks.fresh.cleanliness = 25;
            s.tanks.fresh.fish = [
                createFishInstance('guppy', { hunger: 70, level: 2, bornAt: Date.now() - 5 * 86400000 }),
                createFishInstance('goldfish', { hunger: 55, level: 1, bornAt: Date.now() - 3 * 86400000 }),
            ];
            s.coins = 80;
            s.tanks.fresh.foodStock = { basic_flakes: 8, pellets: 3 };
            return s;
        }
        case 'dirty-big-tank': {
            const s = createInitialState();
            s.tanks.fresh.unlocked = true;
            s.tanks.tropical.unlocked = true;
            s.tanks.salt.unlocked = true;
            s.activeTankId = 'salt';
            s.tanks.salt.cleanliness = 15;
            s.coins = 500;
            s.tanks.salt.toolsOwned = { filter_salt: 1, skimmer: 1, uv_sterilizer: 1 };
            s.tanks.salt.foodStock = { marine_pellets: 10, reef_flakes: 15 };
            s.tanks.salt.fish = [
                createFishInstance('clownfish', { hunger: 60, level: 3, bornAt: Date.now() - 15 * 86400000 }),
                createFishInstance('green_chromis', { hunger: 55, level: 2, bornAt: Date.now() - 10 * 86400000 }),
                createFishInstance('firefish', { hunger: 50, level: 2, bornAt: Date.now() - 8 * 86400000 }),
            ];
            s.tanks.salt.decor = [createDecorInstance('anemone', 0.5, 0.8)];
            s.lifetime.coinsEarned = 5000;
            return s;
        }
        case 'tier-2-active': {
            const s = createInitialState();
            s.tanks.fresh.unlocked = true;
            s.tanks.tropical.unlocked = true;
            s.activeTankId = 'tropical';
            s.tanks.fresh.fish = [createFishInstance('guppy', { level: 3, hunger: 80, bornAt: Date.now() - 10 * 86400000 }), createFishInstance('goldfish', { level: 2, hunger: 70, bornAt: Date.now() - 8 * 86400000 })];
            s.coins = 240;
            s.tanks.fresh.cleanliness = 85;
            s.tanks.tropical.fish = [
                createFishInstance('neon_tetra', { level: 3, hunger: 65, bornAt: Date.now() - 12 * 86400000 }),
                createFishInstance('neon_tetra', { level: 2, hunger: 70, bornAt: Date.now() - 8 * 86400000 }),
                createFishInstance('moon_fish', { level: 2, hunger: 60, bornAt: Date.now() - 6 * 86400000 }),
                createFishInstance('pleco', { level: 1, hunger: 75, bornAt: Date.now() - 4 * 86400000 }),
            ];
            s.tanks.tropical.cleanliness = 80;
            s.tanks.tropical.toolsOwned = { heater: 1, filter_tropical: 1 };
            s.tanks.tropical.foodStock = { tropical_flakes: 15, pellets: 5, bloodworms: 3 };
            s.tanks.tropical.decor = [createDecorInstance('java_fern', 0.3, 0.8)];
            s.lifetime.coinsEarned = 1200;
            return s;
        }
        case 'tier-3-endgame': {
            const s = createInitialState();
            s.tanks.fresh.unlocked = true;
            s.tanks.tropical.unlocked = true;
            s.tanks.salt.unlocked = true;
            s.activeTankId = 'salt';
            s.tanks.fresh.fish = [createFishInstance('goldfish', { level: 6, hunger: 75, bornAt: Date.now() - 30 * 86400000 })];
            s.coins = 1900;
            s.tanks.tropical.fish = [createFishInstance('discus', { level: 5, hunger: 70, bornAt: Date.now() - 25 * 86400000 }), createFishInstance('neon_tetra', { level: 4, hunger: 65, bornAt: Date.now() - 20 * 86400000 })];
            s.tanks.tropical.toolsOwned = { heater: 1, filter_tropical: 2 };
            s.tanks.tropical.decor = [createDecorInstance('java_fern', 0.2, 0.8), createDecorInstance('amazon_sword', 0.7, 0.8)];
            s.tanks.salt.toolsOwned = { filter_salt: 2, skimmer: 1, uv_sterilizer: 1 };
            s.tanks.salt.foodStock = { marine_pellets: 20, reef_flakes: 25, frozen_brine: 10, live_shrimp: 5 };
            s.tanks.salt.fish = [
                createFishInstance('clownfish', { level: 5, hunger: 70, bornAt: Date.now() - 25 * 86400000 }),
                createFishInstance('blue_tang', { level: 4, hunger: 65, bornAt: Date.now() - 20 * 86400000 }),
                createFishInstance('clownfish', { level: 3, hunger: 60, bornAt: Date.now() - 15 * 86400000 }),
                createFishInstance('green_chromis', { level: 3, hunger: 55, bornAt: Date.now() - 12 * 86400000 }),
                createFishInstance('firefish', { level: 2, hunger: 50, bornAt: Date.now() - 10 * 86400000 }),
            ];
            s.tanks.salt.decor = [createDecorInstance('anemone', 0.4, 0.7), createDecorInstance('brain_coral', 0.6, 0.85), createDecorInstance('staghorn_coral', 0.2, 0.75)];
            s.lifetime.coinsEarned = 8000;
            return s;
        }
        case 'tank-full': {
            const s = createInitialState();
            s.coins = 200;
            s.tanks.fresh.foodStock = { basic_flakes: 20, pellets: 10 };
            // Fill fresh tank to exactly 8/8 space
            s.tanks.fresh.fish = [
                createFishInstance('guppy', { hunger: 80 }),
                createFishInstance('guppy', { hunger: 75 }),
                createFishInstance('guppy', { hunger: 70 }),
                createFishInstance('guppy', { hunger: 85 }),
                createFishInstance('goldfish', { hunger: 90 }),
                createFishInstance('snail', { hunger: 80 }),
            ]; // space: 1+1+1+1+3+1 = 8
            return s;
        }
        case 'low-food': {
            const s = createInitialState();
            s.tanks.fresh.foodStock = { basic_flakes: 1 };
            s.tanks.fresh.fish = [
                createFishInstance('guppy', { hunger: 30 }),
                createFishInstance('goldfish', { hunger: 25 }),
            ];
            return s;
        }
        case 'tier-3-crowded': {
            const s = createInitialState();
            s.tanks.fresh.unlocked = true;
            s.tanks.tropical.unlocked = true;
            s.tanks.salt.unlocked = true;
            s.activeTankId = 'salt';
            s.coins = 800;
            s.tanks.salt.toolsOwned = { filter_salt: 2, skimmer: 1, uv_sterilizer: 1 };
            s.tanks.salt.foodStock = { marine_pellets: 15, reef_flakes: 20, frozen_brine: 8 };
            // Fill to 18/20 space (with updated space costs)
            s.tanks.salt.fish = [
                createFishInstance('clownfish', { hunger: 70 }), // 2
                createFishInstance('blue_tang', { hunger: 65 }),  // 3
                createFishInstance('green_chromis', { hunger: 60 }), // 0.5
                createFishInstance('green_chromis', { hunger: 55 }), // 0.5
                createFishInstance('green_chromis', { hunger: 50 }), // 0.5
                createFishInstance('green_chromis', { hunger: 48 }), // 0.5
                createFishInstance('firefish', { hunger: 50 }),  // 1
                createFishInstance('firefish', { hunger: 48 }),  // 1
                createFishInstance('firefish', { hunger: 45 }),  // 1
                createFishInstance('royal_gramma', { hunger: 45 }), // 1.5
                createFishInstance('banggai_cardinal', { hunger: 40 }), // 1
                createFishInstance('banggai_cardinal', { hunger: 35 }), // 1
                createFishInstance('banggai_cardinal', { hunger: 38 }), // 1
                createFishInstance('banggai_cardinal', { hunger: 42 }), // 1
                createFishInstance('clownfish', { hunger: 60 }), // 2
                createFishInstance('cleaner_shrimp', { hunger: 80 }), // 0.5
            ]; // 2+3+0.5+0.5+0.5+0.5+1+1+1+1.5+1+1+1+1+2+0.5 = 18
            s.tanks.salt.decor = [createDecorInstance('anemone', 0.5, 0.7)];
            s.lifetime.coinsEarned = 6000;
            return s;
        }
        case 'rich': {
            const s = createInitialState();
            s.coins = 99999;
            s.tanks.fresh.foodStock = { basic_flakes: 50, pellets: 20 };
            s.tanks.fresh.fish = [
                createFishInstance('guppy', { level: 2, hunger: 80, bornAt: Date.now() - 7 * 86400000 }),
                createFishInstance('goldfish', { level: 1, hunger: 75, bornAt: Date.now() - 3 * 86400000 }),
            ];
            return s;
        }
        case 'neglected-48h': {
            const s = createInitialState();
            s.tanks.fresh.cleanliness = 15;
            s.coins = 30;
            s.tanks.fresh.foodStock = { basic_flakes: 2 };
            s.tanks.fresh.fish = [
                createFishInstance('guppy', { hunger: 5, weak: true, health: 15, level: 2, bornAt: Date.now() - 10 * 86400000 }),
                createFishInstance('goldfish', { hunger: 10, weak: true, health: 20, level: 1, bornAt: Date.now() - 5 * 86400000 }),
            ];
            return s;
        }
        case 'tier-2-ready': {
            const s = createInitialState();
            s.coins = 600;
            s.tanks.fresh.fish = [
                createFishInstance('guppy', { level: 4, hunger: 80, bornAt: Date.now() - 15 * 86400000 }),
                createFishInstance('goldfish', { level: 3, hunger: 75, bornAt: Date.now() - 12 * 86400000 }),
                createFishInstance('guppy', { level: 2, hunger: 70, bornAt: Date.now() - 8 * 86400000 }),
            ];
            s.tanks.fresh.foodStock = { basic_flakes: 15, pellets: 5 };
            s.tanks.fresh.cleanliness = 75;
            s.lifetime.coinsEarned = 800;
            return s;
        }
        case 'multi-tank-decorated': {
            const s = createInitialState();
            s.tanks.fresh.unlocked = true;
            s.tanks.tropical.unlocked = true;
            s.tanks.salt.unlocked = true;
            s.activeTankId = 'fresh';
            s.coins = 1000;
            s.tanks.fresh.fish = [
                createFishInstance('guppy', { level: 3, hunger: 80, bornAt: Date.now() - 12 * 86400000 }),
                createFishInstance('goldfish', { level: 2, hunger: 70, bornAt: Date.now() - 8 * 86400000 }),
            ];
            s.tanks.fresh.decor = [
                createDecorInstance('moss_ball', 0.3, 0.8),
                createDecorInstance('driftwood', 0.7, 0.85),
            ];
            s.tanks.fresh.foodStock = { basic_flakes: 15, pellets: 5 };
            s.tanks.tropical.fish = [
                createFishInstance('neon_tetra', { level: 2, hunger: 65, bornAt: Date.now() - 10 * 86400000 }),
                createFishInstance('pleco', { level: 1, hunger: 75, bornAt: Date.now() - 5 * 86400000 }),
            ];
            s.tanks.tropical.decor = [createDecorInstance('java_fern', 0.4, 0.8)];
            s.tanks.tropical.foodStock = { tropical_flakes: 10, pellets: 5 };
            s.tanks.tropical.toolsOwned = { heater: 1 };
            s.tanks.salt.fish = [
                createFishInstance('clownfish', { level: 2, hunger: 60, bornAt: Date.now() - 8 * 86400000 }),
                createFishInstance('green_chromis', { level: 1, hunger: 55, bornAt: Date.now() - 4 * 86400000 }),
            ];
            s.tanks.salt.decor = [
                createDecorInstance('anemone', 0.5, 0.7),
                createDecorInstance('brain_coral', 0.6, 0.85),
            ];
            s.tanks.salt.foodStock = { marine_pellets: 10, reef_flakes: 15 };
            s.tanks.salt.toolsOwned = { filter_salt: 1 };
            s.lifetime.coinsEarned = 3000;
            return s;
        }
        case 'empty-tank': {
            // Zero fish scenario — tests empty tank rendering & behavior
            const s = createInitialState();
            s.tanks.fresh.fish = [];
            s.coins = 200;
            s.tanks.fresh.foodStock = { basic_flakes: 5 };
            s.tanks.fresh.decor = [createDecorInstance('moss_ball', 0.4, 0.85)];
            return s;
        }
        case 'movement-showcase': {
            // All movement types: normal, crawl, glass, snake, schooling
            const s = createInitialState();
            s.tanks.fresh.unlocked = true;
            s.tanks.tropical.unlocked = true;
            s.tanks.salt.unlocked = true;
            s.activeTankId = 'salt';
            s.coins = 5500;
            s.tanks.salt.toolsOwned = { filter_salt: 2, skimmer: 1, uv_sterilizer: 1 };
            s.tanks.salt.foodStock = { marine_pellets: 20, reef_flakes: 20, frozen_brine: 10, live_shrimp: 5 };
            s.tanks.salt.fish = [
                createFishInstance('clownfish', { hunger: 80 }),            // normal middle
                createFishInstance('cleaner_shrimp', { hunger: 75 }),       // crawl bottom
                createFishInstance('moray_eel', { hunger: 70 }),            // snake bottom
                createFishInstance('green_chromis', { hunger: 65 }),        // schooling middle (0.5)
                createFishInstance('green_chromis', { hunger: 60 }),        // schooling middle (0.5)
                createFishInstance('green_chromis', { hunger: 55 }),        // schooling middle (0.5)
                createFishInstance('green_chromis', { hunger: 50 }),        // schooling middle (0.5)
                createFishInstance('banggai_cardinal', { hunger: 70 }),     // schooling middle (0.5)
                createFishInstance('banggai_cardinal', { hunger: 65 }),     // schooling middle (0.5)
                createFishInstance('firefish', { hunger: 75 }),             // normal middle
            ]; // 3+1+6+0.5+0.5+0.5+0.5+0.5+0.5+1 = 14
            s.tanks.salt.decor = [createDecorInstance('anemone', 0.4, 0.7), createDecorInstance('cave', 0.7, 0.85)];
            // Also add pleco to tropical for glass movement
            s.tanks.tropical.toolsOwned = { heater: 1, filter_tropical: 1 };
            s.tanks.tropical.fish = [
                createFishInstance('pleco', { hunger: 80 }),                // glass bottom
                createFishInstance('neon_tetra', { hunger: 70 }),           // schooling middle (0.5)
                createFishInstance('neon_tetra', { hunger: 65 }),           // schooling middle (0.5)
                createFishInstance('neon_tetra', { hunger: 60 }),           // schooling middle (0.5)
                createFishInstance('neon_tetra', { hunger: 55 }),           // schooling middle (0.5)
                createFishInstance('gourami', { hunger: 75 }),              // normal top
            ];
            s.tanks.tropical.decor = [createDecorInstance('floating_plants', 0.5, 0.1)];
            s.tanks.tropical.foodStock = { tropical_flakes: 15, pellets: 5, bloodworms: 5, algae_wafer: 5 };
            s.lifetime.coinsEarned = 5000;
            return s;
        }
        case 'schooling-showcase': {
            // Large schools of small fish — tests half-space & leader following
            const s = createInitialState();
            s.tanks.fresh.unlocked = true;
            s.tanks.tropical.unlocked = true;
            s.tanks.salt.unlocked = true;
            s.activeTankId = 'tropical';
            s.coins = 1000;
            s.tanks.tropical.toolsOwned = { heater: 1, filter_tropical: 2 };
            s.tanks.tropical.foodStock = { tropical_flakes: 20, pellets: 10, bloodworms: 5 };
            // 10 neon tetras (0.5 each = 5 space) + 2 moon fish (2 each = 4) + pleco (2) + discus (3) = 14/14
            s.tanks.tropical.fish = [
                createFishInstance('neon_tetra', { hunger: 90, level: 3 }),
                createFishInstance('neon_tetra', { hunger: 85, level: 2 }),
                createFishInstance('neon_tetra', { hunger: 80, level: 2 }),
                createFishInstance('neon_tetra', { hunger: 75, level: 1 }),
                createFishInstance('neon_tetra', { hunger: 70, level: 1 }),
                createFishInstance('neon_tetra', { hunger: 88, level: 2 }),
                createFishInstance('neon_tetra', { hunger: 82, level: 1 }),
                createFishInstance('neon_tetra', { hunger: 78, level: 1 }),
                createFishInstance('neon_tetra', { hunger: 72, level: 1 }),
                createFishInstance('neon_tetra', { hunger: 68, level: 1 }),
                createFishInstance('moon_fish', { hunger: 80, level: 2 }),
                createFishInstance('pleco', { hunger: 85, level: 1 }),
            ]; // 0.5*10 + 2 + 2 = 9/14 space
            s.tanks.tropical.decor = [
                createDecorInstance('java_fern', 0.2, 0.8),
                createDecorInstance('amazon_sword', 0.5, 0.8),
                createDecorInstance('floating_plants', 0.4, 0.1),
            ];
            s.lifetime.coinsEarned = 4000;
            return s;
        }
        case 'floating-decor': {
            // Tank with floating plants for drift animation testing
            const s = createInitialState();
            s.tanks.fresh.unlocked = true;
            s.tanks.tropical.unlocked = true;
            s.activeTankId = 'tropical';
            s.coins = 500;
            s.tanks.tropical.toolsOwned = { heater: 1 };
            s.tanks.tropical.foodStock = { tropical_flakes: 10 };
            s.tanks.tropical.fish = [
                createFishInstance('neon_tetra', { hunger: 80 }),
                createFishInstance('gourami', { hunger: 75 }),
            ];
            s.tanks.tropical.decor = [
                createDecorInstance('floating_plants', 0.2, 0.1),
                createDecorInstance('floating_plants', 0.5, 0.1),
                createDecorInstance('floating_plants', 0.8, 0.1),
                createDecorInstance('java_fern', 0.4, 0.8),
                createDecorInstance('mossy_log', 0.7, 0.85),
            ];
            s.lifetime.coinsEarned = 1500;
            return s;
        }
        case 'territorial-showcase': {
            // Fish defending their claimed decor zones — clownfish → anemone, moray → cave, firefish → coral, royal_gramma → cave
            const s = createInitialState();
            s.tanks.fresh.unlocked = true;
            s.tanks.tropical.unlocked = true;
            s.tanks.salt.unlocked = true;
            s.activeTankId = 'salt';
            s.coins = 3000;
            s.tanks.salt.toolsOwned = { filter_salt: 2, skimmer: 1, uv_sterilizer: 1 };
            s.tanks.salt.foodStock = { marine_pellets: 20, reef_flakes: 20, frozen_brine: 10 };
            s.tanks.salt.fish = [
                createFishInstance('clownfish', { hunger: 85 }),           // defends anemone
                createFishInstance('moray_eel', { hunger: 80 }),           // defends cave
                createFishInstance('firefish', { hunger: 75 }),            // defends coral
                createFishInstance('royal_gramma', { hunger: 70 }),        // also claims cave area
                createFishInstance('blue_tang', { hunger: 80 }),           // intruder — no territory
                createFishInstance('blue_tang', { hunger: 75 }),           // intruder — no territory
                createFishInstance('green_chromis', { hunger: 60 }),       // small schooling
                createFishInstance('green_chromis', { hunger: 55 }),       // small schooling
                createFishInstance('green_chromis', { hunger: 50 }),       // small schooling
                createFishInstance('banggai_cardinal', { hunger: 65 }),    // schooling
            ]; // 3+6+1+2+4+4+0.5+0.5+0.5+0.5 = 22 — over capacity but good for showing territory
            s.tanks.salt.decor = [
                createDecorInstance('anemone', 0.25, 0.7),
                createDecorInstance('cave', 0.75, 0.85),
                createDecorInstance('brain_coral', 0.5, 0.75),
                createDecorInstance('live_rock', 0.4, 0.85),
            ];
            s.lifetime.coinsEarned = 5000;
            return s;
        }
        case 'lush-planted': {
            // Densely planted tank with layered decorations demonstrating depth rendering
            const s = createInitialState();
            s.tanks.fresh.unlocked = true;
            s.tanks.tropical.unlocked = true;
            s.activeTankId = 'tropical';
            s.coins = 2000;
            s.tanks.tropical.toolsOwned = { heater: 1, filter_tropical: 2 };
            s.tanks.tropical.foodStock = { tropical_flakes: 20, pellets: 10, bloodworms: 5, algae_wafer: 5 };
            s.tanks.tropical.fish = [
                createFishInstance('discus', { hunger: 85, level: 2 }),
                createFishInstance('neon_tetra', { hunger: 80 }),
                createFishInstance('neon_tetra', { hunger: 75 }),
                createFishInstance('neon_tetra', { hunger: 70 }),
                createFishInstance('neon_tetra', { hunger: 65 }),
                createFishInstance('gourami', { hunger: 80, level: 2 }),
                createFishInstance('pleco', { hunger: 85 }),
            ]; // 3+0.5*4+2+2 = 9/14
            s.tanks.tropical.decor = [
                createDecorInstance('java_fern', 0.15, 0.8, { size: 2.5 }),
                createDecorInstance('amazon_sword', 0.35, 0.8, { size: 3.0 }),
                createDecorInstance('java_fern', 0.55, 0.8, { size: 2.0 }),
                createDecorInstance('amazon_sword', 0.75, 0.8, { size: 2.8 }),
                createDecorInstance('floating_plants', 0.3, 0.1),
                createDecorInstance('floating_plants', 0.7, 0.1),
                createDecorInstance('mossy_log', 0.5, 0.85),
                createDecorInstance('hollow_stump', 0.85, 0.85),
            ];
            s.lifetime.coinsEarned = 3000;
            return s;
        }
        case 'size-showcase': {
            // All fish sizes on display — from tiny tetras to massive moray
            const s = createInitialState();
            s.tanks.fresh.unlocked = true;
            s.tanks.tropical.unlocked = true;
            s.tanks.salt.unlocked = true;
            s.activeTankId = 'salt';
            s.coins = 6000;
            s.tanks.salt.toolsOwned = { filter_salt: 2, skimmer: 1, uv_sterilizer: 1 };
            s.tanks.salt.foodStock = { marine_pellets: 20, reef_flakes: 20, frozen_brine: 10, live_shrimp: 5 };
            s.tanks.salt.fish = [
                createFishInstance('green_chromis', { hunger: 80 }),       // tiny (0.65 scale)
                createFishInstance('green_chromis', { hunger: 75 }),       // tiny
                createFishInstance('banggai_cardinal', { hunger: 70 }),    // small (0.85 scale)
                createFishInstance('clownfish', { hunger: 85 }),           // medium (1.1 scale)
                createFishInstance('firefish', { hunger: 75 }),            // medium
                createFishInstance('blue_tang', { hunger: 80 }),           // large (1.8 scale)
                createFishInstance('moray_eel', { hunger: 70 }),           // very large (2.8 scale)
                createFishInstance('cleaner_shrimp', { hunger: 80 }),      // crawling
            ];
            s.tanks.salt.decor = [
                createDecorInstance('anemone', 0.3, 0.7),
                createDecorInstance('cave', 0.7, 0.85),
                createDecorInstance('brain_coral', 0.5, 0.75),
            ];
            // Also populate tropical with different sizes
            s.tanks.tropical.toolsOwned = { heater: 1, filter_tropical: 1 };
            s.tanks.tropical.fish = [
                createFishInstance('neon_tetra', { hunger: 80 }),          // tiny (0.65 scale)
                createFishInstance('neon_tetra', { hunger: 75 }),
                createFishInstance('neon_tetra', { hunger: 70 }),
                createFishInstance('blue_eye', { hunger: 80 }),            // small (0.85)
                createFishInstance('gourami', { hunger: 85 }),             // medium (1.1)
                createFishInstance('moon_fish', { hunger: 80 }),           // large (1.7)
                createFishInstance('discus', { hunger: 75, level: 2 }),    // very large (2.0)
                createFishInstance('pleco', { hunger: 85 }),               // large crawler (1.8)
            ];
            s.tanks.tropical.decor = [
                createDecorInstance('java_fern', 0.3, 0.8),
                createDecorInstance('amazon_sword', 0.6, 0.8),
                createDecorInstance('floating_plants', 0.5, 0.1),
            ];
            s.tanks.tropical.foodStock = { tropical_flakes: 15, pellets: 5, bloodworms: 5, algae_wafer: 5 };
            s.lifetime.coinsEarned = 5000;
            return s;
        }
        case 'full-grown-fresh': {
            const s = createInitialState();
            applyMockFullGrownTank(s, 'fresh');
            return s;
        }
        case 'full-grown-tropical': {
            const s = createInitialState();
            applyMockFullGrownTank(s, 'tropical');
            return s;
        }
        case 'full-grown-salt': {
            const s = createInitialState();
            applyMockFullGrownTank(s, 'salt');
            return s;
        }
        default:
            return null;
    }
}

// ── Persistence ──────────────────────────────────────────────────────

const STORAGE_KEY = 'mock_aquarium_state_v1';

function loadPersistedState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const state = JSON.parse(raw);
        if (state?.version !== CURRENT_SAVE_VERSION) return null;
        return state;
    } catch { return null; }
}

function persistState(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

// ── Main handler ─────────────────────────────────────────────────────

// Track the last loaded scenario to detect changes
let _lastScenarioId = null;

export function resetAquariumScenario(scenarioId) {
    // Skip reset if the widget already loaded this exact scenario — prevents
    // React useEffect double-fire from clearing state mid-session.
    if (scenarioId && scenarioId === _lastScenarioId) return;
    _lastScenarioId = null;
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export function handleAquariumApi(widgetId, method, endpoint, body, scenarioId) {
    if (widgetId !== 'aquarium') return null;

    let state;
    let isNew = false;

    // Only create fresh scenario state on GET when scenario changes, or when there's no persisted state.
    // POST requests always use persisted state to avoid resetting on every action.
    if (method === 'GET' && scenarioId === 'default' && _lastScenarioId && _lastScenarioId !== 'default') {
        // Switching back to default — create fresh state
        state = createInitialState();
        _lastScenarioId = 'default';
        persistState(state);
    } else if (method === 'GET' && scenarioId && scenarioId !== 'default' && scenarioId !== _lastScenarioId) {
        state = createScenarioState(scenarioId);
        if (state) {
            _lastScenarioId = scenarioId;
            persistState(state);
        } else {
            state = loadPersistedState() || createInitialState();
            _lastScenarioId = scenarioId;
        }
    } else {
        state = loadPersistedState();
        if (!state) { state = createInitialState(); isNew = true; }
        // Track current scenario so resetAquariumScenario can skip redundant resets
        if (method === 'GET' && scenarioId) _lastScenarioId = scenarioId;
    }

    if (method === 'GET') {
        const simResult = simulate(state);
        persistState(state);
        return { ...buildResponse(state), simResult, isNew };
    }

    if (method === 'POST') {
        simulate(state);
        const { type, payload = {} } = body || {};
        const result = handleAction(state, type, payload);
        persistState(state);
        return buildResponse(state, result);
    }

    return null;
}

export { CATALOG, getLifeStage, xpToNextLevel };
