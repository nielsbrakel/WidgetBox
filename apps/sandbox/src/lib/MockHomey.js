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
        this.device = {
            name: 'Mock Device',
            class: 'other',
            data: { id: 'mock-device-id' },
        }
    }

    ready(options) {
        console.log('[MockHomey] Widget ready', options);
        if (options && options.height && this.onHeightChange) {
            this.onHeightChange(options.height);
        }
    }

    // Translation mock
    __(key, tokens) {
        // Simple mock: return the last part of the key or the key itself
        const parts = key.split('.');
        return parts[parts.length - 1];
    }

    getSettings() {
        return { ...this.settings };
    }

    // Helper for the sandbox to update settings and trigger the event
    updateSettings(newSettings) {
        console.log('[MockHomey] updateSettings', newSettings);
        this.settings = { ...this.settings, ...newSettings };

        // Emit general settings event with full object
        this.emit('settings', this.settings);

        // Emit specific settings.set events
        Object.entries(newSettings).forEach(([key, value]) => {
            this.emit('settings.set', key, value);
        });
    }

    setHeight(height) {
        console.log(`[MockHomey] setHeight: ${height}`);
        if (this.onHeightChange) {
            this.onHeightChange(height);
        }
    }

    getWidgetInstanceId() {
        return 'mock-widget-id-12345';
    }

    api(method, endpoint, body) {
        console.log(`[MockHomey] API Call: ${method} ${endpoint}`, body);

        // Simple state mocking for /state endpoint
        // Endpoint format: /state?widgetId=...
        if (endpoint.startsWith('/state')) {
            try {
                // Extract widgetId properly in case of query params
                const urlParts = endpoint.split('?');
                const queryParams = new URLSearchParams(urlParts[1]);
                const widgetId = queryParams.get('widgetId');
                const key = `mock_state_${widgetId}`;

                if (method === 'PUT') {
                    localStorage.setItem(key, JSON.stringify(body));
                    return Promise.resolve({ success: true });
                } else if (method === 'GET') {
                    const data = localStorage.getItem(key);
                    return Promise.resolve(data ? JSON.parse(data) : {});
                }
            } catch (err) {
                console.error('[MockHomey] API Error:', err);
                return Promise.reject(err);
            }
        }

        return Promise.resolve({ mock: true, message: 'Mock response' });
    }
}

export default MockHomey;
