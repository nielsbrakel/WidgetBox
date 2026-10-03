/*
 * Aquarium catalog: every piece of content and every balance number.
 *
 * Shared by the widget API (Node, via require) and the widget page (browser global
 * `AquaCatalog`). Pure data, no logic. Saves only store catalog IDs, so balance numbers
 * can change freely between releases. IDs must never be renamed.
 */
((root, factory) => {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.AquaCatalog = factory();
})(typeof self !== "undefined" ? self : this, () => {
  // biome-ignore lint/suspicious/noRedundantUseStrict: loaded as a classic script, not a module
  "use strict";

  // Tanks, in unlock order. `costMult` scales upgrade prices for that tank.
  const TANKS = {
    pond: { order: 0, unlockLevel: 1, unlockCost: 0, capacity: 6, costMult: 1 },
    amazon: { order: 1, unlockLevel: 5, unlockCost: 600, capacity: 8, costMult: 4 },
    reef: { order: 2, unlockLevel: 10, unlockCost: 5000, capacity: 10, costMult: 15 },
    abyss: { order: 3, unlockLevel: 16, unlockCost: 30000, capacity: 10, costMult: 50 },
  };

  /*
   * Species.
   *  cm       real adult body length in centimetres; sets the size on screen
   *  level    aquarist level that unlocks it in the shop
   *  price    coins
   *  space    tank space used
   *  income   coins per hour as a happy adult
   *  hunger   hunger lost per hour (0..100 scale)
   *  grow     hours of being fed until a juvenile becomes an adult (fry take twice as long)
   *  breed    hours two happy adults need to produce a clutch of eggs
   *  move     swim | school | bottom | crawl | eel | jelly | hover
   *  zone     preferred height: top | mid | low
   *  eats     accepted foods
   *  likes    decor tags that raise happiness
   *  needs    decor tag the fish needs as a home (big happiness penalty without it)
   *  school   shoaling fish: happiest in a group of at least this many of their kind
   *  max      max per tank
   *  cleans   cleanup crew: algae/debris hit points removed per hour
   */
  const SPECIES = {
    // Freshwater pond
    guppy: {
      tank: "pond",
      cm: 5,
      level: 1,
      price: 20,
      space: 1,
      income: 3,
      hunger: 4.5,
      grow: 12,
      breed: 18,
      move: "swim",
      zone: "top",
      eats: ["flakes"],
      likes: ["plant"],
    },
    danio: {
      tank: "pond",
      cm: 5,
      level: 2,
      price: 14,
      space: 0.5,
      income: 2,
      hunger: 5,
      grow: 10,
      breed: 16,
      move: "school",
      school: 6,
      zone: "mid",
      eats: ["flakes"],
      likes: ["plant"],
    },
    white_cloud: {
      tank: "pond",
      cm: 4,
      level: 1,
      price: 8,
      space: 0.5,
      income: 1.2,
      hunger: 5,
      grow: 8,
      breed: 14,
      move: "school",
      school: 6,
      zone: "mid",
      eats: ["flakes"],
      likes: ["plant"],
    },
    snail: {
      tank: "pond",
      cm: 5,
      level: 2,
      price: 35,
      space: 1,
      income: 1,
      hunger: 2,
      grow: 24,
      breed: 48,
      move: "crawl",
      zone: "low",
      eats: ["pellets"],
      likes: ["rock"],
      cleans: { algae: 0.35 },
    },
    platy: {
      tank: "pond",
      cm: 6,
      level: 3,
      price: 40,
      space: 1,
      income: 5,
      hunger: 4,
      grow: 18,
      breed: 24,
      move: "swim",
      zone: "mid",
      eats: ["flakes", "pellets"],
      likes: ["plant"],
    },
    goldfish: {
      tank: "pond",
      cm: 18,
      level: 4,
      price: 90,
      space: 2,
      income: 10,
      hunger: 4,
      grow: 36,
      breed: 48,
      move: "swim",
      zone: "mid",
      eats: ["flakes", "pellets"],
      likes: ["ornament"],
    },
    // Amazon
    neon: {
      tank: "amazon",
      cm: 3.5,
      level: 5,
      price: 30,
      space: 0.5,
      income: 5,
      hunger: 5,
      grow: 16,
      breed: 24,
      move: "school",
      school: 6,
      zone: "mid",
      eats: ["flakes"],
      likes: ["plant"],
    },
    ember: {
      tank: "amazon",
      cm: 2,
      level: 5,
      price: 12,
      space: 0.5,
      income: 2.2,
      hunger: 5,
      grow: 9,
      breed: 16,
      move: "school",
      school: 6,
      zone: "mid",
      eats: ["flakes"],
      likes: ["plant"],
    },
    cory: {
      tank: "amazon",
      cm: 6,
      level: 6,
      price: 70,
      space: 1,
      income: 7,
      hunger: 4,
      grow: 24,
      breed: 36,
      move: "bottom",
      zone: "low",
      eats: ["pellets", "worms"],
      likes: ["wood"],
      cleans: { debris: 0.3 },
    },
    angelfish: {
      tank: "amazon",
      cm: 15,
      level: 7,
      price: 160,
      space: 2,
      income: 16,
      hunger: 3.5,
      grow: 36,
      breed: 60,
      move: "swim",
      zone: "mid",
      eats: ["flakes", "worms"],
      likes: ["plant"],
    },
    betta: {
      tank: "amazon",
      cm: 6.5,
      level: 8,
      price: 220,
      space: 1,
      income: 20,
      hunger: 3.5,
      grow: 30,
      breed: 72,
      move: "hover",
      zone: "top",
      eats: ["pellets", "worms"],
      likes: ["plant"],
      max: 1,
    },
    pleco: {
      tank: "amazon",
      cm: 13,
      level: 8,
      price: 180,
      space: 2,
      income: 9,
      hunger: 3,
      grow: 48,
      breed: 96,
      move: "bottom",
      zone: "low",
      eats: ["pellets"],
      likes: ["wood", "cave"],
      cleans: { algae: 0.6 },
    },
    discus: {
      tank: "amazon",
      cm: 18,
      level: 9,
      price: 420,
      space: 2,
      income: 34,
      hunger: 4,
      grow: 48,
      breed: 72,
      move: "swim",
      zone: "mid",
      eats: ["worms"],
      likes: ["wood", "plant"],
    },
    // Coral reef
    chromis: {
      tank: "reef",
      cm: 8,
      level: 10,
      price: 120,
      space: 1,
      income: 14,
      hunger: 5,
      grow: 20,
      breed: 36,
      move: "school",
      school: 5,
      zone: "mid",
      eats: ["flakes", "brine"],
      likes: ["coral"],
    },
    clownfish: {
      tank: "reef",
      cm: 9,
      level: 11,
      price: 300,
      space: 1,
      income: 26,
      hunger: 4,
      grow: 24,
      breed: 48,
      move: "swim",
      zone: "low",
      eats: ["flakes", "brine"],
      needs: "anemone",
    },
    shrimp: {
      tank: "reef",
      cm: 5,
      level: 11,
      price: 200,
      space: 1,
      income: 10,
      hunger: 3,
      grow: 24,
      breed: 72,
      move: "crawl",
      zone: "low",
      eats: ["brine"],
      likes: ["rock"],
      cleans: { debris: 0.5 },
    },
    gramma: {
      tank: "reef",
      cm: 7,
      level: 12,
      price: 450,
      space: 1,
      income: 34,
      hunger: 4,
      grow: 30,
      breed: 60,
      move: "swim",
      zone: "low",
      eats: ["flakes", "brine"],
      likes: ["cave", "rock"],
    },
    tang: {
      tank: "reef",
      cm: 24,
      level: 13,
      price: 900,
      space: 2,
      income: 60,
      hunger: 4.5,
      grow: 48,
      breed: 96,
      move: "swim",
      zone: "mid",
      eats: ["flakes", "brine"],
      likes: ["coral"],
    },
    moray: {
      tank: "reef",
      cm: 60,
      level: 14,
      price: 1600,
      space: 3,
      income: 100,
      hunger: 2.5,
      grow: 72,
      breed: 144,
      move: "eel",
      zone: "low",
      eats: ["brine"],
      needs: "cave",
      max: 1,
    },
    // Abyss
    lantern: {
      tank: "abyss",
      cm: 7,
      level: 16,
      price: 900,
      space: 1,
      income: 70,
      hunger: 5,
      grow: 30,
      breed: 48,
      move: "school",
      school: 5,
      zone: "mid",
      eats: ["krill"],
      likes: ["glow"],
    },
    hatchet: {
      tank: "abyss",
      cm: 6,
      level: 17,
      price: 1500,
      space: 1,
      income: 100,
      hunger: 4.5,
      grow: 36,
      breed: 60,
      move: "swim",
      zone: "top",
      eats: ["brine", "krill"],
      likes: ["glow"],
    },
    isopod: {
      tank: "abyss",
      cm: 12,
      level: 17,
      price: 1800,
      space: 2,
      income: 70,
      hunger: 2,
      grow: 72,
      breed: 120,
      move: "crawl",
      zone: "low",
      eats: ["krill"],
      likes: ["bone"],
      cleans: { debris: 0.7, algae: 0.3 },
    },
    jelly: {
      tank: "abyss",
      cm: 12,
      level: 18,
      price: 3500,
      space: 2,
      income: 220,
      hunger: 3,
      grow: 48,
      breed: 96,
      move: "jelly",
      zone: "mid",
      eats: ["brine"],
      likes: [],
    },
    angler: {
      tank: "abyss",
      cm: 20,
      level: 20,
      price: 9000,
      space: 3,
      income: 600,
      hunger: 2,
      grow: 96,
      breed: 192,
      move: "hover",
      zone: "low",
      eats: ["krill"],
      likes: ["vent"],
      max: 1,
    },
  };

  // Every species has three colour variants: 0 is sold in the shop, 1 and 2 only hatch from eggs.
  const VARIANTS = {
    guppy: ["classic", "cobra", "albino"],
    danio: ["classic", "leopard", "glow"],
    white_cloud: ["classic", "golden", "ghost"],
    ember: ["classic", "fire", "golden"],
    snail: ["classic", "golden", "ivory"],
    platy: ["classic", "mickey", "panda"],
    goldfish: ["classic", "calico", "black"],
    neon: ["classic", "gold", "diamond"],
    cory: ["classic", "panda", "albino"],
    angelfish: ["classic", "marble", "golden"],
    betta: ["classic", "koi", "dragon"],
    pleco: ["classic", "albino", "zebra"],
    discus: ["classic", "pigeon", "blue"],
    chromis: ["classic", "blue", "golden"],
    clownfish: ["classic", "snowflake", "midnight"],
    shrimp: ["classic", "fire", "ghost"],
    gramma: ["classic", "sunset", "ghost"],
    tang: ["classic", "yellow", "powder"],
    moray: ["classic", "zebra", "ghost"],
    lantern: ["classic", "ember", "aurora"],
    hatchet: ["classic", "gold", "void"],
    isopod: ["classic", "ruby", "pearl"],
    jelly: ["classic", "aurora", "crimson"],
    angler: ["classic", "abyssal", "ghost"],
  };

  // Chance per hatched fry to be variant 1 or 2.
  const VARIANT_ODDS = [0, 0.1, 0.025];

  // Foods are global stock. `portion` food bits drop per tap, each bit restores `restore` hunger.
  const FOODS = {
    flakes: { level: 1, price: 15, pack: 10, portion: 5, restore: 30, sink: 0.35 },
    pellets: { level: 2, price: 25, pack: 10, portion: 4, restore: 40, sink: 0.9 },
    worms: { level: 6, price: 60, pack: 10, portion: 4, restore: 50, sink: 0.6, growth: 2 },
    brine: { level: 10, price: 200, pack: 10, portion: 4, restore: 50, sink: 0.45 },
    krill: { level: 16, price: 700, pack: 10, portion: 4, restore: 55, sink: 0.55 },
  };

  /*
   * Decor. Placed freely in the layers below.
   *  size   S fits every layer; M and L stand in the back or mid layer
   *  tags   matched against species likes/needs
   *  pearls price in pearls instead of coins
   *  bonus  extra income for the whole tank (0.1 = +10%)
   *  bloom  the plant flowers now and then once fully grown (see GROWTH)
   */
  const DECOR = {
    // Pond
    vallisneria: { tank: "pond", level: 1, size: "M", price: 30, tags: ["plant"], bloom: true },
    anubias: { tank: "pond", level: 1, size: "S", price: 20, tags: ["plant"], bloom: true },
    pebbles: { tank: "pond", level: 1, size: "S", price: 25, tags: ["rock"] },
    hairgrass: { tank: "pond", level: 2, size: "S", price: 30, tags: ["plant"] },
    seiryu_stone: { tank: "pond", level: 2, size: "M", price: 45, tags: ["rock"] },
    moss_ball: { tank: "pond", level: 2, size: "S", price: 15, tags: ["plant"] },
    chest: { tank: "pond", level: 2, size: "S", price: 60, tags: ["ornament"] },
    driftwood: { tank: "pond", level: 3, size: "L", price: 80, tags: ["wood"] },
    spider_wood: { tank: "pond", level: 4, size: "L", price: 130, tags: ["wood"] },
    castle: { tank: "pond", level: 4, size: "L", price: 150, tags: ["ornament", "cave"] },
    golden_chest: { tank: "pond", level: 3, size: "S", pearls: 15, tags: ["ornament"], bonus: 0.1 },
    // Amazon
    java_fern: { tank: "amazon", level: 5, size: "S", price: 90, tags: ["plant"] },
    sword_plant: { tank: "amazon", level: 5, size: "M", price: 120, tags: ["plant"], bloom: true },
    monte_carlo: { tank: "amazon", level: 5, size: "S", price: 100, tags: ["plant"] },
    dragon_stone: { tank: "amazon", level: 6, size: "M", price: 160, tags: ["rock"] },
    rotala: { tank: "amazon", level: 6, size: "M", price: 170, tags: ["plant"], bloom: true },
    root: { tank: "amazon", level: 6, size: "L", price: 300, tags: ["wood"] },
    stump: { tank: "amazon", level: 7, size: "M", price: 250, tags: ["wood", "cave"] },
    ludwigia: { tank: "amazon", level: 8, size: "M", price: 200, tags: ["plant"], bloom: true },
    clay_cave: { tank: "amazon", level: 8, size: "S", price: 180, tags: ["cave"] },
    idol: { tank: "amazon", level: 7, size: "M", pearls: 25, tags: ["ornament"], bonus: 0.1 },
    // Reef
    anemone: { tank: "reef", level: 10, size: "M", price: 600, tags: ["anemone"] },
    brain_coral: { tank: "reef", level: 10, size: "S", price: 500, tags: ["coral"] },
    staghorn: { tank: "reef", level: 11, size: "M", price: 800, tags: ["coral"] },
    sea_fan: { tank: "reef", level: 12, size: "L", price: 1400, tags: ["coral"] },
    live_rock: { tank: "reef", level: 11, size: "L", price: 1000, tags: ["rock"] },
    rock_cave: { tank: "reef", level: 13, size: "L", price: 2200, tags: ["cave", "rock"] },
    giant_clam: { tank: "reef", level: 12, size: "S", pearls: 30, tags: ["ornament"], bonus: 0.1 },
    // Abyss
    glow_crystal: { tank: "abyss", level: 16, size: "S", price: 2500, tags: ["glow"] },
    tube_worms: { tank: "abyss", level: 16, size: "M", price: 3000, tags: ["glow"] },
    whale_bone: { tank: "abyss", level: 17, size: "L", price: 6000, tags: ["bone"] },
    sea_lily: { tank: "abyss", level: 18, size: "M", price: 4000, tags: ["glow"] },
    vent: { tank: "abyss", level: 19, size: "L", price: 9000, tags: ["vent"] },
    relic: {
      tank: "abyss",
      level: 18,
      size: "M",
      pearls: 40,
      tags: ["ornament", "glow"],
      bonus: 0.1,
    },
  };

  /*
   * Decor stands freely on the sand in three depth layers, like a real aquascape: tall plants
   * and wood against the back glass, a midground for hardscape and homes, and a low foreground
   * for carpets and small stones in front of the fish. Each piece keeps its own x (0..1), so a
   * tank can be planted densely and rearranged at will. sizes lists what fits in a layer.
   */
  const LAYERS = {
    back: { sizes: ["S", "M", "L"] },
    mid: { sizes: ["S", "M", "L"] },
    front: { sizes: ["S"] },
  };

  // Fixed slots used by saves before free placement; only read when migrating them.
  const LEGACY_SLOTS = [
    { x: 0.13, row: "back" },
    { x: 0.37, row: "back" },
    { x: 0.58, row: "back" },
    { x: 0.78, row: "back" },
    { x: 0.05, row: "front" },
    { x: 0.27, row: "front" },
    { x: 0.5, row: "front" },
    { x: 0.72, row: "front" },
    { x: 0.25, row: "mid" },
    { x: 0.47, row: "mid" },
    { x: 0.66, row: "mid" },
  ];

  // Per-tank upgrades. Cost of level n is cost[n-1] × tank costMult.
  const UPGRADES = {
    size: { cost: [80, 250, 700, 1800, 4500], perLevel: 2 },
    filter: { cost: [60, 200, 600, 1500, 4000], perLevel: 0.14 },
    feeder: { cost: [150, 600, 2000], perLevel: 1 },
    chest: { cost: [100, 350, 1000, 3000], hours: [6, 9, 12, 18, 24] },
  };

  const RULES = {
    startCoins: 40,
    startFood: { flakes: 12 },
    maxLevel: 30,
    maxIdleHours: 168,
    maxDrops: 8,
    maxAlgae: 9,
    maxDebris: 8,
    maxEggClutches: 3,
    algaeEveryHours: 3,
    debrisEveryHours: 4,
    eggHatchHours: 2,
    playCooldownHours: 4,
    playBuffHours: 6,
    autoFeedBelow: 30,
    sellReturn: 0.5,
    decorSellReturn: 0.5,
    maxDecor: 24,
    variantSellMult: [1, 3, 8],
    stageIncome: [0.3, 0.6, 1],
    stageSell: [0.3, 0.6, 1],
    xp: { collect: 0.2, eat: 1, scrub: 3, vacuum: 2, play: 2, buy: 5, hatch: 10, goal: 40 },
    scrubCoins: 3,
    vacuumCoins: 2,
    goalsPerDay: 3,
    goalsBonusPearls: 2,
    streakPearls: 5,
  };

  /*
   * Eggs for sale, the long-term sink for coins and pearls. Species is drawn at random from
   * the tank's unlocked species, so they drive the hunt for rare colour variants.
   *  mystery  coins × tank costMult, rare odds multiplied by `boost`
   *  golden   pearls, always hatches a rare variant (preferring ones not yet found)
   */
  const EGGS = {
    mystery: { level: 2, price: 150, boost: 3 },
    golden: { level: 3, pearls: 20, epicChance: 0.3 },
  };

  // Tutorial steps run before the daily goals start.
  const TUTORIAL = [
    { id: "collect", target: 1, coins: 10 },
    { id: "feed", target: 3, coins: 15 },
    { id: "scrub", target: 1, coins: 15 },
    { id: "buy_decor", target: 1, coins: 30 },
    { id: "buy_fish", target: 1, coins: 40 },
  ];

  // Daily goal pool. `min` is the aquarist level needed, n is the target range.
  const GOALS = {
    feed: { min: 1, n: [8, 16] },
    collect: { min: 1, n: [0, 0] }, // target scales with income, see engine
    scrub: { min: 1, n: [2, 4] },
    vacuum: { min: 1, n: [2, 3] },
    play: { min: 2, n: [3, 6] },
    hatch: { min: 3, n: [1, 1] },
    buy: { min: 2, n: [1, 1] },
    visit: { min: 5, n: [2, 2] },
  };

  // Achievements. `stat` is read from save.stats or computed by the engine.
  const ACHIEVEMENTS = [
    { id: "fish_5", stat: "fishOwned", n: 5, pearls: 2 },
    { id: "fish_15", stat: "fishOwned", n: 15, pearls: 5 },
    { id: "fish_40", stat: "fishOwned", n: 40, pearls: 10 },
    { id: "coins_1k", stat: "coinsEarned", n: 1000, pearls: 2 },
    { id: "coins_25k", stat: "coinsEarned", n: 25000, pearls: 5 },
    { id: "coins_500k", stat: "coinsEarned", n: 500000, pearls: 10 },
    { id: "tanks_2", stat: "tanksUnlocked", n: 2, pearls: 3 },
    { id: "tanks_3", stat: "tanksUnlocked", n: 3, pearls: 5 },
    { id: "tanks_4", stat: "tanksUnlocked", n: 4, pearls: 10 },
    { id: "dex_8", stat: "speciesFound", n: 8, pearls: 3 },
    { id: "dex_22", stat: "speciesFound", n: 22, pearls: 10 },
    { id: "rare_3", stat: "raresFound", n: 3, pearls: 3 },
    { id: "rare_15", stat: "raresFound", n: 15, pearls: 8 },
    { id: "rare_44", stat: "raresFound", n: 44, pearls: 25 },
    { id: "clutch_1", stat: "hatched", n: 1, pearls: 2 },
    { id: "clutch_25", stat: "hatched", n: 25, pearls: 6 },
    { id: "algae_100", stat: "scrubbed", n: 100, pearls: 4 },
    { id: "play_50", stat: "played", n: 50, pearls: 3 },
    { id: "level_10", stat: "level", n: 10, pearls: 5 },
    { id: "level_20", stat: "level", n: 20, pearls: 8 },
    { id: "level_30", stat: "level", n: 30, pearls: 15 },
  ];

  // Pearls for Fishdex discoveries.
  const DEX_PEARLS = { species: 1, rare: 3, tankComplete: 10 };

  /*
   * Living decor grows in place after it is bought. Plants take a few days from cutting to full
   * size; items marked bloom then flower for a few hours every couple of days. Coral grows
   * slower and does not flower. Purely visual.
   */
  const GROWTH = {
    plant: { days: 3, start: 0.15, bloomEveryDays: 2, bloomHours: 8 },
    coral: { days: 6, start: 0.25 },
  };

  return {
    TANKS,
    SPECIES,
    VARIANTS,
    VARIANT_ODDS,
    FOODS,
    DECOR,
    LAYERS,
    LEGACY_SLOTS,
    UPGRADES,
    RULES,
    EGGS,
    TUTORIAL,
    GOALS,
    ACHIEVEMENTS,
    DEX_PEARLS,
    GROWTH,
  };
});
