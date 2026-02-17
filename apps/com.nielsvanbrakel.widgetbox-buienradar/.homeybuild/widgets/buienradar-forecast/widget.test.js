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

describe('Forecast5d Widget', () => {
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
            api: vi.fn().mockResolvedValue({ forecast: [] }),
            __: vi.fn((key) => key),
        };

        global.window = window;
        global.document = document;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should fetch and render 5-day forecast', async () => {
        const mockData = {
            forecast: [
                { day: 'Monday', min: 10, max: 15, rain: 20 },
                { day: 'Tuesday', min: 11, max: 16, rain: 10 },
                { day: 'Wednesday', min: 12, max: 17, rain: 0 }
            ]
        };
        window.Homey.api.mockResolvedValue(mockData);

        if (window.onHomeyReady) {
            await window.onHomeyReady(window.Homey);
        }

        await new Promise(resolve => setTimeout(resolve, 50));

        const days = document.querySelectorAll('.day-row');
        expect(days.length).toBeGreaterThan(0);
        expect(days[0].textContent).toContain('Monday');
        expect(days[0].textContent).toContain('15');
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
