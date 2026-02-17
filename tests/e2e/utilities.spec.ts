import { test, expect } from '@playwright/test';
import { UtilitiesPage } from '../pages/UtilitiesPage';

test.describe('Utilities App', () => {
    let utils: UtilitiesPage;

    test.beforeEach(async ({ page }) => {
        utils = new UtilitiesPage(page);
        await utils.goto();
    });

    test.describe('Stopwatch', () => {
        test.beforeEach(async () => {
            await utils.selectWidget('Stopwatch');
        });

        test('should load the stopwatch', async () => {
            await expect(utils.stopwatchItem).toBeVisible();
            await expect(utils.timeDisplay).toContainText('00:00');
        });

        test('should start and pause stopwatch', async ({ page }) => {
            await utils.startStopwatch();
            await page.waitForTimeout(1100);
            await utils.pauseStopwatch();

            const timeText = await utils.timeDisplay.innerText();
            expect(timeText).not.toBe('00:00.00');
        });

        test('should reset stopwatch', async ({ page }) => {
            await utils.startStopwatch();
            await page.waitForTimeout(500);
            await utils.pauseStopwatch();
            await utils.resetStopwatch();
            await expect(utils.timeDisplay).toContainText('00:00');
        });

        test('should record laps', async ({ page }) => {
            await utils.setSettingCheckbox('Show lap times', true);
            // Wait for reload and setting persistence
            await page.waitForTimeout(2000);

            await utils.startStopwatch();
            await page.waitForTimeout(2000); // Increased wait for stability
            await utils.clickLap();

            await expect(utils.lapItem).toBeVisible();
        });

        test('should add and remove stopwatches', async () => {
            await utils.btnAdd.click();
            await expect(utils.stopwatchItem).toHaveCount(2);
            await utils.btnClose.click();
            await expect(utils.stopwatchItem).toHaveCount(1);
        });
        test('should have transparent close button', async () => {
            // Add a stopwatch first to ensure button exists
            if (await utils.stopwatchItem.count() === 0) {
                await utils.btnAdd.click();
            }
            // If only one stopwatch, close button might not be visible depending on logic
            // "timers.length > 1 ? ... : ''" logic in timer, verify stopwatch logic
            // Stopwatch logic: "stopwatches.length > 1 ? ... : ''"
            // So we need 2 stopwatches
            if (await utils.stopwatchItem.count() < 2) {
                await utils.btnAdd.click();
            }

            const closeBtn = utils.stopwatchItem.first().locator('.stopwatch-close');
            await expect(closeBtn).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
        });
    });

    test.describe('Timer', () => {
        test.beforeEach(async () => {
            await utils.selectWidget('Timer');
        });

        test('should load the timer', async () => {
            await expect(utils.timerItem).toBeVisible();
            await expect(utils.picker).toBeVisible();
        });

        test('should start timer', async () => {
            await utils.startStopwatch(); // Timer uses same play btn class
            await expect(utils.countdown).toBeVisible();
            await utils.pauseStopwatch();
            await utils.resetStopwatch();
            await expect(utils.picker).toBeVisible();
        });

        test('should update timer duration', async ({ page }) => {
            await utils.setTimerDuration(10);
            await utils.startStopwatch();
            await expect(utils.countdown).toContainText('10');
        });

        test('should add and remove timers', async () => {
            await utils.btnAdd.click();
            await expect(utils.timerItem).toHaveCount(2);
            await utils.btnClose.click(); // Reuses logic
            await expect(utils.timerItem).toHaveCount(1);
        });

        test('should have transparent close button', async () => {
            // Timer logic: "timers.length > 1 ? ... : ''"
            if (await utils.timerItem.count() < 2) {
                await utils.btnAdd.click();
            }
            const closeBtn = utils.timerItem.first().locator('.timer-close');
            await expect(closeBtn).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
        });

        test('should have transparent picker background', async () => {
            const pickerScroll = utils.picker.locator('.picker-scroll').first();
            await expect(pickerScroll).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
        });
    });
});
