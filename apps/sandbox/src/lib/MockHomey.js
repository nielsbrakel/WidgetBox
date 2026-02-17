import { SCENARIOS } from './scenarios';
import { handleBuienradarApi } from './mocks/buienradarMocks';
import { handleAquariumApi } from './mocks/aquariumMocks';

class SimpleEventEmitter {
    constructor() {
        this.events = {};
    }

    on(event, listener) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(listener);
        return this;
    }

    emit(event, ...args) {
        if (!this.events[event]) return false;
        this.events[event].forEach(listener => listener(...args));
        return true;
    }

    removeListener(event, listener) {
        if (!this.events[event]) return this;
        this.events[event] = this.events[event].filter(l => l !== listener);
        return this;
    }
}

class MockHomey extends SimpleEventEmitter {
    constructor(options = {}) {
        super();
        this.settings = {};
        this.onHeightChange = options.onHeightChange || (() => { });
        this.widgetId = options.widgetId || 'mock-widget-id-12345';
        this.localeData = null;
        this.widgetInstanceId = 'mock-widget-id-12345';
        this.activeScenario = 'default';
    }

    setLocaleData(data) {
        this.localeData = data;
        this.emit('update', {});
    }

    ready(options) {
        console.log('[MockHomey] Widget ready', options);
        if (options?.height && this.onHeightChange) {
            this.onHeightChange(options.height);
        }
    }

    __(key, tokens) {
        // Try to resolve the key from locale data
        if (this.localeData) {
            const parts = key.split('.');
            let value = this.localeData;

            for (const part of parts) {
                if (value && typeof value === 'object' && part in value) {
                    value = value[part];
                } else {
                    value = null;
                    break;
                }
            }

            if (value && typeof value === 'string') {
                // Replace tokens if provided: {key} → value
                if (tokens && typeof tokens === 'object') {
                    return value.replace(/\{(\w+)\}/g, (_, k) => tokens[k] ?? `{${k}}`);
                }
                return value;
            }
        }

        // Fallback: return the last segment of the key
        return key.split('.').pop();
    }

    getSettings() {
        return { ...this.settings };
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.emit('settings', this.settings);
        Object.entries(newSettings).forEach(([key, value]) => {
            this.emit('settings.set', key, value);
        });
    }

    setHeight(height) {
        console.log(`[MockHomey] setHeight: ${height}`);
        this.onHeightChange?.(height);
    }

    getWidgetInstanceId() {
        return this.widgetInstanceId;
    }

    setScenario(scenarioId) {
        this.activeScenario = scenarioId;
    }

    async api(method, endpoint, body) {
        const scenarioDef = SCENARIOS[this.widgetId]?.[this.activeScenario] || { type: 'mock' };

        // State endpoint (persistent via localStorage)
        if (endpoint.startsWith('/state')) {
            return this._handleStateApi(method, endpoint, body);
        }

        // Error scenario
        if (scenarioDef.type === 'error') {
            throw new Error('Simulated API Error (Debug Scenario)');
        }

        // Delegate to widget-specific mock handlers
        const buienradarResult = await handleBuienradarApi(
            this.widgetId,
            { ...scenarioDef, id: this.activeScenario },
            this.settings,
            method,
            endpoint,
        );
        if (buienradarResult !== null) return buienradarResult;

        // Aquarium widget
        const aquariumResult = handleAquariumApi(this.widgetId, method, endpoint, body, this.activeScenario);
        if (aquariumResult !== null) return aquariumResult;

        // Default fallback
        return { mock: true, message: 'Mock response' };
    }

    _handleStateApi(method, endpoint, body) {
        const urlParts = endpoint.split('?');
        const queryParams = new URLSearchParams(urlParts[1]);
        const widgetId = queryParams.get('widgetId');
        const key = `mock_state_${widgetId}`;

        if (method === 'PUT') {
            localStorage.setItem(key, JSON.stringify(body));
            return { success: true };
        }
        if (method === 'GET') {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : {};
        }
    }
}

export default MockHomey;
