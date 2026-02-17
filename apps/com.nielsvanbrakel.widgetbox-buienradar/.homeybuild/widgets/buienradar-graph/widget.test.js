import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';

// Ensure directory exists or let write_to_file handle it
const htmlPath = path.resolve(__dirname, 'public/index.html');
let html;
try {
    html = fs.readFileSync(htmlPath, 'utf8');
} catch (e) {
    html = '<!DOCTYPE html><html><body></body></html>'; // Fallback if file not created yet
}

describe('RainGraph Widget', () => {
    let dom;
    let window;
    let document;

    beforeEach(() => {
        // Reload HTML in case it changed
        try {
            html = fs.readFileSync(htmlPath, 'utf8');
        } catch (e) { }

        dom = new JSDOM(html, {
            runScripts: "dangerously",
            url: "http://localhost/",
            pretendToBeVisual: true
        });
        window = dom.window;
        document = window.document;

        // Mock Homey
        window.Homey = {
            ready: vi.fn(),
            on: vi.fn(),
            getSettings: vi.fn(() => ({})),
            setHeight: vi.fn(),
            api: vi.fn().mockResolvedValue({ forecast: [] }), // Default empty
            __: vi.fn((key) => key),
        };

        global.window = window;
        global.document = document;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should fetch rain data on init with default location', async () => {
        // Trigger init
        if (window.onHomeyReady) {
            await window.onHomeyReady(window.Homey);
        }

        // Expect match on query params (lat/lon defaults)
        expect(window.Homey.api).toHaveBeenCalledWith('GET', expect.stringContaining('?lat='));
    });

    it('should render a graph or bars', async () => {
        const mockData = {
            forecast: [
                { time: '10:00', mmPerHour: 0.5 },
                { time: '10:05', mmPerHour: 1.0 }
            ]
        };
        window.Homey.api.mockResolvedValue(mockData);

        if (window.onHomeyReady) {
            await window.onHomeyReady(window.Homey);
        }

        // Wait for async rendering
        // With real timers, setTimeout(0) runs after current stack
        await new Promise(resolve => setTimeout(resolve, 50));

        // Check for meaningful DOM elements
        // E.g. .bar or canvas
        const bars = document.querySelectorAll('.bar');
        expect(bars.length).toBeGreaterThan(0);
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
