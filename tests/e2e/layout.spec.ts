import { test, expect } from '@playwright/test';
import { LayoutPage } from '../pages/LayoutPage';

test.describe('Layout App', () => {
    let layout: LayoutPage;

    test.beforeEach(async ({ page }) => {
        layout = new LayoutPage(page);
        await layout.goto();
    });

    test.describe('Spacer', () => {
        test.beforeEach(async () => {
            await layout.selectWidget('Spacer');
        });

        test('should load the spacer', async () => {
            await layout.verifySpacerLoaded();
        });

        test('should update height', async () => {
            await layout.setSettingInput('Height Multiplier', '20');
            await layout.verifySpacerLoaded();
        });
    });
});
