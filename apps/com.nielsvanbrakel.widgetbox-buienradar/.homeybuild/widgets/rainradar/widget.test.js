import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';

const html = fs.readFileSync(path.resolve(__dirname, 'public/index.html'), 'utf8');

describe('RainRadar Widget', () => {
    let dom;
    let window;
    let document;

    beforeEach(() => {
        dom = new JSDOM(html, {
            runScripts: "dangerously",
            url: "http://localhost/", // resources: "usable" removed to avoid blocking on 404s
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
            __: vi.fn((key) => key),
        };

        global.window = window;
        global.document = document;

        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should render the radar image with correct base URL', () => {
        console.log('Test: window.onHomeyReady type:', typeof window.onHomeyReady);
        // Trigger init
        if (window.onHomeyReady) {
            window.onHomeyReady(window.Homey);
        } else {
            console.log('Test: window.onHomeyReady is undefined!');
        }

        const img = document.getElementById('radar-image');
        expect(img).not.toBeNull();
        expect(img.src).toContain('https://image.buienradar.nl/2.0/image/single/RadarMapRainNL');
        expect(img.src).toContain('renderBackground=True');
    });

    it('should handle aspect ratio setting for height', () => {
        // Mock settings
        window.Homey.getSettings.mockReturnValue({ aspectRatio: '16:9' });

        if (window.onHomeyReady) {
            window.onHomeyReady(window.Homey);
        }

        // 16:9 is 56.25%
        expect(window.Homey.ready).toHaveBeenCalledWith(expect.objectContaining({
            height: '56.25%'
        }));
    });

    it('should show attribution', () => {
        if (window.onHomeyReady) {
            window.onHomeyReady(window.Homey);
        }

        const attribution = document.querySelector('.attribution');
        // Can be a link text "Data: Buienradar.nl"
        expect(document.body.textContent).toContain('Buienradar.nl');

        // Should be a link
        const links = Array.from(document.querySelectorAll('a'));
        const buienradarLink = links.find(a => a.href.includes('buienradar.nl') && a.textContent.includes('Buienradar'));
        expect(buienradarLink).not.toBeNull();
    });

    it('should refresh image every 5 minutes', () => {
        if (window.onHomeyReady) {
            window.onHomeyReady(window.Homey);
        }

        const img = document.getElementById('radar-image');
        const initialSrc = img.src;

        // Advance time by 5 minutes
        vi.advanceTimersByTime(5 * 60 * 1000);

        const newSrc = img.src;
        expect(newSrc).not.toBe(initialSrc);
        expect(newSrc).toContain('t='); // Should have timestamp to bust cache
    });
});
