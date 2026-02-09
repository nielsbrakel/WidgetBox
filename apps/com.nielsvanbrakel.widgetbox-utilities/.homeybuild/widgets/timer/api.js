'use strict';

module.exports = {
    /**
     * Get the saved state for a timer widget instance
     */
    async getState({ homey, query }) {
        const { widgetId } = query;

        if (!widgetId) {
            throw new Error('Missing widgetId');
        }

        const key = `timer_${widgetId}`;
        const state = homey.settings.get(key);

        return state || null;
    },

    /**
     * Save the state for a timer widget instance
     */
    async setState({ homey, query, body }) {
        const { widgetId } = query;

        if (!widgetId) {
            throw new Error('Missing widgetId');
        }

        const key = `timer_${widgetId}`;
        homey.settings.set(key, body);

        return { success: true };
    },

    /**
     * Clear the saved state for a timer widget instance
     */
    async clearState({ homey, query }) {
        const { widgetId } = query;

        if (!widgetId) {
            throw new Error('Missing widgetId');
        }

        const key = `timer_${widgetId}`;
        homey.settings.unset(key);

        return { success: true };
    }
};
