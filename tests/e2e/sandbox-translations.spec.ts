import { test, expect } from '@playwright/test';
import { UtilitiesPage } from '../pages/UtilitiesPage';

test.describe('Sandbox Translations', () => {
    let utils: UtilitiesPage;

    test.beforeEach(async ({ page }) => {
        utils = new UtilitiesPage(page);
        await utils.goto();
    });

    test('should translate widget text correctly', async () => {
        // Select Stopwatch widget
        await utils.selectWidget('Stopwatch');

        // Verify that the "Add Stopwatch" button has the correct translated text
        // In en.json: "addStopwatch": "Add Stopwatch"
        // Current behavior (bug): "addStopwatch"
        await expect(utils.btnAdd).toContainText('Add Stopwatch', { timeout: 5000 });
    });
});
