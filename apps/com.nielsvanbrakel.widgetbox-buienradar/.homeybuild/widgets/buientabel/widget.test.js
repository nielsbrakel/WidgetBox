import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { getByText, waitFor } from '@testing-library/dom';

// Load the HTML file
const html = fs.readFileSync(path.resolve(__dirname, 'public/index.html'), 'utf8');

describe('Buientabel Widget', () => {
    let dom;

    beforeEach(() => {
        // Create a fresh JSDOM for each test
        dom = new JSDOM(html, {
            runScripts: "dangerously", // We need to run the scripts inside the HTML
            resources: "usable",
            url: "http://localhost/",
            pretendToBeVisual: true
        });

        global.document = dom.window.document;
        global.window = dom.window;

        // Mock Homey API
        const homeyMock = {
            ready: vi.fn(),
            on: vi.fn(),
            getSettings: vi.fn(() => ({})),
            setHeight: vi.fn(),
            __: vi.fn((key) => key),
            api: vi.fn(() => Promise.resolve({ success: true }))
        };

        // Attach Homey to the window
        global.window.Homey = homeyMock;

        // Mock global fetch
        global.window.fetch = vi.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            text: () => Promise.resolve("100|08:00\n0|08:05")
        }));
    });

    it('should initialize and render loading state', async () => {
        // 1. Check container exists
        const container = document.getElementById('app');
        expect(container).toBeDefined();

        // 2. Simulate Homey Ready event
        // The widget script defines `function onHomeyReady(Homey) { ... }`
        // We need to call it manually since we don't have the real Homey SDK loading
        if (typeof window.onHomeyReady === 'function') {
            window.onHomeyReady(window.Homey);
        } else {
            throw new Error('onHomeyReady not defined in widget script');
        }

        // 3. Check for loading state
        // The init() function calls renderer.setLoading(true), which runs:
        // this.container.innerHTML = ... <div class="status-overlay">Loading...</div> (localized)

        // Wait for DOM update if needed (though init is sync mostly, fetch is async)
        await waitFor(() => {
            const overlay = container.querySelector('.status-overlay');
            expect(overlay).not.toBeNull();
            // The mock returns the key 'widgets.buientabel.loading' if not found, or just 'loading'
            // Our mock __ returns the key.
            // Utils.__('loading') -> Homey.__('widgets.buientabel.loading') -> 'widgets.buientabel.loading'
            expect(overlay.innerHTML).toContain('widgets.buientabel.loading');
        });
    });
});
