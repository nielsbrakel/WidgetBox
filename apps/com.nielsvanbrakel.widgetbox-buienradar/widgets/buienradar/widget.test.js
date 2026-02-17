import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { waitFor } from '@testing-library/dom';

const html = fs.readFileSync(path.resolve(__dirname, 'public/index.html'), 'utf8');

describe('Buienradar Widget', () => {
    let dom;
    let window;
    let document;

    beforeEach(() => {
        dom = new JSDOM(html, {
            runScripts: "dangerously",
            resources: "usable",
            url: "http://localhost/",
            pretendToBeVisual: true
        });
        window = dom.window;
        document = window.document;

        // Mock ResizeObserver
        window.ResizeObserver = class ResizeObserver {
            constructor(callback) {
                this.callback = callback;
            }
            observe() { }
            unobserve() { }
            disconnect() { }
        };

        // Mock Homey
        window.Homey = {
            ready: vi.fn(),
            on: vi.fn(),
            getSettings: vi.fn(() => ({})),
            setHeight: vi.fn(),
            __: vi.fn((key) => key),
        };

        global.window = window;
        global.document = document;
    });

    it('should render the iframe with correct fixed dimensions initially', async () => {
        // Trigger init
        if (window.onHomeyReady) {
            window.onHomeyReady(window.Homey);
        }

        const iframe = document.querySelector('iframe');
        expect(iframe).not.toBeNull();
        expect(iframe.src).toContain('radarfivedays');
        expect(iframe.getAttribute('width')).toBe('256');
        expect(iframe.getAttribute('height')).toBe('406');
    });

    it('should be responsive and scale based on container width', async () => {
        // Trigger init
        if (window.onHomeyReady) {
            window.onHomeyReady(window.Homey);
        }

        const iframe = document.querySelector('iframe');
        const container = document.getElementById('buienradar-container');

        // Mock width (used in updateScale)
        Object.defineProperty(document.body, 'clientWidth', { configurable: true, value: 512 });
        window.innerWidth = 512;

        // Trigger the resize callback manually since JSDOM doesn't trigger ResizeObserver automatically
        // We can access the internal logic by calling updateScale directly if exposed, 
        // or by simulating the observer callback if we had captured it.
        // However, since we can't easily capture the observer callback from outside without more complex mocking,
        // and updateScale is not global, we might need to rely on the fact that onHomeyReady calls render() -> updateScale()

        // Re-call onHomeyReady to trigger initial scale with new width
        window.onHomeyReady(window.Homey);

        const newIframe = document.querySelector('iframe');
        // Expected scale: 512 / 256 = 2
        expect(newIframe.style.transform).toBe('scale(2)');
        expect(container.style.height).toBe('812px'); // 406 * 2
        expect(window.Homey.setHeight).toHaveBeenCalledWith(812);
    });
});
