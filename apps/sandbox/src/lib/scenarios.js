export const SCENARIOS = {
  "rain-graph": {
    default: { label: "Dynamic Rain (Default)", type: "mock" },
    real: { label: "Real Data (Live)", type: "real" },
    "no-rain": { label: "No Rain", type: "mock" },
    "light-rain": { label: "Light Rain", type: "mock" },
    "heavy-rain": { label: "Heavy Rain", type: "mock" },
    "out-of-range": { label: "Outside NL/BE", type: "mock" },
    "no-location": { label: "No Location", type: "mock" },
    error: { label: "API Error", type: "error" },
  },
  station: {
    default: { label: "Station Data (Default)", type: "mock" },
    real: { label: "Real Data (Live)", type: "real" },
    "no-location": { label: "No Location", type: "mock" },
    error: { label: "API Error", type: "error" },
  },
  forecast: {
    default: { label: "Forecast (Default)", type: "mock" },
    real: { label: "Real Data (Live)", type: "real" },
    "no-location": { label: "No Location", type: "mock" },
    error: { label: "API Error", type: "error" },
  },
  youtube: {
    default: { label: "Normal (Default)", type: "mock" },
    ios: { label: "Simulate iOS", type: "mock" },
  },
  "weather-map": {
    default: { label: "Normal (Default)", type: "mock" },
    "no-location": { label: "No Homey Location", type: "mock" },
    ios: { label: "Simulate iOS", type: "mock" },
  },
  aquarium: {
    default: { label: "Fresh Start (tutorial)", type: "mock", group: "Progression" },
    "pond-day2": { label: "Pond, day 2", type: "mock", group: "Progression" },
    amazon: { label: "Amazon unlocked", type: "mock", group: "Progression" },
    reef: { label: "Coral reef (eel + clownfish)", type: "mock", group: "Progression" },
    "abyss-night": { label: "Abyss", type: "mock", group: "Progression" },
    eggs: { label: "Eggs ready", type: "mock", group: "Situations" },
    "tank-full": { label: "Tank full + eggs", type: "mock", group: "Situations" },
    neglected: { label: "Away for 3 days", type: "mock", group: "Situations" },
    rich: { label: "Everything unlocked", type: "mock", group: "Situations" },
    "gallery-pond": { label: "Gallery: Pond", type: "mock", group: "Art gallery" },
    "gallery-amazon": { label: "Gallery: Amazon", type: "mock", group: "Art gallery" },
    "gallery-reef": { label: "Gallery: Reef", type: "mock", group: "Art gallery" },
    "gallery-abyss": { label: "Gallery: Abyss", type: "mock", group: "Art gallery" },
  },
};

export const DEFAULT_SCENARIO = "default";
