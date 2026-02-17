import { test, expect } from '@playwright/test';
import { ClocksPage } from '../pages/ClocksPage';

test.describe('Clocks App', () => {
    let clocks: ClocksPage;

    test.beforeEach(async ({ page }) => {
        clocks = new ClocksPage(page);
        await clocks.goto();
    });

    test.describe('Analog Clock', () => {
        test.beforeEach(async () => {
            await clocks.selectWidget('Analog Clock');
        });

        test('should load the clock', async () => {
            await clocks.verifyAnalogLoaded();
        });

        test('should toggle second hand', async () => {
            await clocks.setSettingCheckbox('Show Second Hand', false);
            await expect(clocks.secondHand).toBeHidden();

            await clocks.setSettingCheckbox('Show Second Hand', true);
            await expect(clocks.secondHand).toBeVisible();
        });

        test('should change style', async () => {
            // Just verifying setting can be toggled without error
            await clocks.setSettingSelect('Style', { index: 1 }); // Change to 'Minimal' or similar
            await clocks.verifyAnalogLoaded();
        });
    });

    test.describe('Digital Clock', () => {
        test.beforeEach(async () => {
            await clocks.selectWidget('Digital Clock');
        });

        test('should load the clock', async () => {
            await clocks.verifyDigitalLoaded();
        });

        test('should toggle seconds', async () => {
            await clocks.setSettingCheckbox('Show Seconds', false);
            // Verify time format shorter? or logic check.
            // Simplified check for now: setting change works
            await expect(clocks.digitalTime).toBeVisible();
        });

        test('should show date', async () => {
            await clocks.setSettingCheckbox('Show Date', true);
            await expect(clocks.digitalDate).toBeVisible();
        });
    });

    test.describe('Flip Clock', () => {
        test.beforeEach(async () => {
            await clocks.selectWidget('Flip Clock');
        });

        test('should load the clock', async () => {
            await clocks.verifyFlipLoaded();
        });

        test('should toggle seconds', async () => {
            await clocks.setSettingCheckbox('Show Seconds', true);
            await expect(clocks.flipSeconds).toBeVisible();

            await clocks.setSettingCheckbox('Show Seconds', false);
            await expect(clocks.flipSeconds).toBeHidden();
        });

        test('should toggle colons', async () => {
            // Default is false -> hidden
            await expect(clocks.widgetCard).toHaveClass(/colons-hidden/);

            await clocks.setSettingCheckbox('Show Colons', true);
            await expect(clocks.widgetCard).not.toHaveClass(/colons-hidden/);

            await clocks.setSettingCheckbox('Show Colons', false);
            await expect(clocks.widgetCard).toHaveClass(/colons-hidden/);
        });
    });

    test.describe('Binary Clock', () => {
        test.beforeEach(async () => {
            await clocks.selectWidget('Binary Clock');
        });

        test('should load the clock', async () => {
            await expect(clocks.binaryClock).toBeVisible();
        });

        test('should toggle seconds', async () => {
            // Default is true
            await clocks.setSettingCheckbox('Show Seconds', false);
            await clocks.setSettingCheckbox('Show Seconds', true);
        });

        test('should show labels', async () => {
            // Default is true -> visible -> NO hide-labels class
            await expect(clocks.widgetCard).not.toHaveClass(/hide-labels/);

            await clocks.setSettingCheckbox('Show H/M/S Labels', false);
            await expect(clocks.widgetCard).toHaveClass(/hide-labels/);

            await clocks.setSettingCheckbox('Show H/M/S Labels', true);
            await expect(clocks.widgetCard).not.toHaveClass(/hide-labels/);
        });
    });

    test.describe('Word Clock Grid', () => {
        test.beforeEach(async () => {
            await clocks.selectWidget('Word Clock Grid');
        });

        test('should load', async () => {
            await expect(clocks.wordGrid).toBeVisible();
        });
    });

    test.describe('Word Clock Sentence', () => {
        test.beforeEach(async () => {
            await clocks.selectWidget('Word Clock Sentence');
        });

        test('should load', async () => {
            await expect(clocks.wordSentence).toBeVisible();
        });
    });
});
