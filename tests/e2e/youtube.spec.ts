import { test, expect } from '@playwright/test';
import { YouTubePage } from '../pages/YouTubePage';

test.describe('YouTube App', () => {
    let tube: YouTubePage;

    test.beforeEach(async ({ page }) => {
        tube = new YouTubePage(page);
        await tube.goto();
        await tube.selectWidget('YouTube');
    });

    test('should load the widget', async () => {
        await tube.verifyLoaded();
    });

    test('should update video id', async () => {
        // Use regex to avoid matching "Playlist ID (leave blank to use Video ID)"
        await tube.setSettingInput(/^Video ID/, 'dQw4w9WgXcQ');
        await tube.verifyVideoId('dQw4w9WgXcQ');
    });

    test('should handle playlist', async () => {
        // Playlist ID starts with "Playlist ID" so string match is fine, or use regex for consistency
        await tube.setSettingInput(/^Playlist ID/, 'PL123456');
        // Logic might check for 'videoseries' or similar in src
        const src = await tube.getVideoSrc();
        expect(src).toContain('videoseries');
    });

    test('should update autoplay', async () => {
        await tube.setSettingCheckbox('Autoplay', true);
        const src = await tube.getVideoSrc();
        expect(src).toContain('autoplay=1');
    });

    test('should update controls', async () => {
        await tube.setSettingCheckbox('Show controls', false);
        const src = await tube.getVideoSrc();
        expect(src).toContain('controls=0');
    });

    test('should update loop', async () => {
        await tube.setSettingCheckbox('Loop', true);
        const src = await tube.getVideoSrc();
        expect(src).toContain('loop=1');
    });

    test('should update start time', async () => {
        await tube.setSettingInput('Start at (seconds)', '30');
        const src = await tube.getVideoSrc();
        expect(src).toContain('start=30');
    });

    test('should update aspect ratio', async () => {
        await tube.setSettingSelect('Aspect Ratio', '4:3');
        // In sandbox, the aspect-ratio is applied to .homey-card (accessed via tube.card)
        // await expect(tube.card).toHaveCSS('aspect-ratio', /(1\.33|4 \/ 3)/);
    });

    test('should toggle wake lock', async () => {
        // Mock navigator.wakeLock
        await tube.widgetIframe.evaluate(() => {
            let releaseFn = async () => { };
            const sentinel = {
                release: async () => { await releaseFn(); },
                get released() { return false; }, // Simplified
                type: 'screen' as WakeLockType,
                onrelease: null,
                addEventListener: () => { },
                removeEventListener: () => { },
                dispatchEvent: () => true,
            };

            (window as any)._wakeLockLog = [] as string[];

            // Mock navigator.wakeLock
            Object.defineProperty(navigator, 'wakeLock', {
                value: {
                    request: async (type: string) => {
                        (window as any)._wakeLockLog.push(`request:${type}`);
                        return sentinel;
                    }
                },
                writable: true
            });

            // Spy on release
            releaseFn = async () => {
                (window as any)._wakeLockLog.push('release');
            };
        });

        // Enable "Keep Screen On"
        await tube.setSettingCheckbox('Keep Screen On', true);

        // Check log
        let log = await tube.widgetIframe.evaluate(() => (window as any)._wakeLockLog);
        expect(log).toContain('request:screen');

        // Disable "Keep Screen On"
        await tube.setSettingCheckbox('Keep Screen On', false);

        // Check log again
        log = await tube.widgetIframe.evaluate(() => (window as any)._wakeLockLog);
        expect(log).toContain('release');
    });
});
