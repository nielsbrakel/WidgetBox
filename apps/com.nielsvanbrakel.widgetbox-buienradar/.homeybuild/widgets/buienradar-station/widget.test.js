import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';

const htmlPath = path.resolve(__dirname, 'public/index.html');
let html;
try {
    html = fs.readFileSync(htmlPath, 'utf8');
} catch (e) {
    html = '<!DOCTYPE html><html><body></body></html>';
}

describe('StationNow Widget', () => {
    let dom;
    let window;
    let document;

    beforeEach(() => {
        try { html = fs.readFileSync(htmlPath, 'utf8'); } catch (e) { }

        dom = new JSDOM(html, {
            runScripts: "dangerously",
            url: "http://localhost/",
            pretendToBeVisual: true
        });
        window = dom.window;
        document = window.document;

        window.Homey = {
            ready: vi.fn(),
            on: vi.fn(),
            getSettings: vi.fn(() => ({})),
            setHeight: vi.fn(),
            api: vi.fn().mockResolvedValue({}),
            __: vi.fn((key) => key),
        };

        global.window = window;
        global.document = document;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should fetch station data and render values', async () => {
        // Mock data
        const mockResponse = {
            station: {
                stationname: 'De Bilt',
                temperature: 12.5,
                humidity: 80,
                windspeedBft: 3
            }
        };
        window.Homey.api.mockResolvedValue(mockResponse);

        if (window.onHomeyReady) {
            await window.onHomeyReady(window.Homey);
        }

        // Wait for rendering
        await new Promise(resolve => setTimeout(resolve, 50));

        // Check values
        expect(document.body.textContent).toContain('De Bilt');
        expect(document.body.textContent).toContain('12.5');
        expect(document.body.textContent).toContain('80');
    });

    it('should show attribution', async () => {
        if (window.onHomeyReady) {
            await window.onHomeyReady(window.Homey);
        }

        const link = document.querySelector('.attribution a');
        expect(link).not.toBeNull();
        expect(link.textContent).toContain('Buienradar');
    });
});
