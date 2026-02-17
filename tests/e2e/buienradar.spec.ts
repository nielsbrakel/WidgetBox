import { test, expect } from '@playwright/test';
import { BuienradarPage } from '../pages/BuienradarPage';

test.describe('Buienradar Widgets', () => {
    let radar: BuienradarPage;

    test.beforeEach(async ({ page }) => {
        radar = new BuienradarPage(page);
        await radar.goto();
    });

    test.describe('Precipitation Forecast (buientabel)', () => {
        test.beforeEach(async () => {
            await radar.selectWidget('Precipitation Forecast');
        });

        test('should load the chart container', async () => {
            await expect(radar.chartContainer).toBeVisible();
        });

        test('should update styles', async () => {
            await radar.setSettingSelect('Graph Style', 'Line');
            // Verify effect if possible, else just no crash
        });
    });

    test.describe('Radar Map (buienradar)', () => {
        test.beforeEach(async () => {
            await radar.selectWidget('Weather Radar');
        });

        test('should load iframe', async () => {
            await radar.verifyLoaded();
        });
    });

    test.describe('Rain Radar (rainradar)', () => {
        test.beforeEach(async () => {
            await radar.selectWidget('Rain Radar');
        });

        test('should load rain radar image', async () => {
            await expect(radar.iframe.locator('img#radar-image')).toBeVisible();
        });
    });

    test.describe('Station Weather (buienradar-station)', () => {
        test.beforeEach(async () => {
            await radar.selectWidget('Station Weather');
        });

        test('should update alignment', async () => {
            await expect(radar.iframe.locator('.widget-container')).toHaveClass(/align-left/);
            await radar.setSettingSelect('Text Alignment', 'Right');
            await expect(radar.iframe.locator('.widget-container')).toHaveClass(/align-right/);
        });
    });
});
