
import { test, expect } from '@playwright/test';

test.describe('Widget Sandbox', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should load the sandbox and list widgets', async ({ page }) => {
        await expect(page).toHaveTitle(/sandbox/i);
        const widgetList = page.locator('.widget-list');
        await expect(widgetList).toBeVisible();
        await expect(widgetList.locator('.widget-item')).not.toHaveCount(0);
    });

    // This test assumes at least one widget exists. Adjust based on available widgets.
    test('should load a widget in the iframe when selected', async ({ page }) => {
        // Find the first widget item and click it
        const firstWidget = page.locator('.widget-item').first();
        const widgetNamePromise = firstWidget.locator('.widget-name').textContent();
        await firstWidget.click();
        const widgetName = await widgetNamePromise;

        // Verify the preview area updates
        await expect(page.locator('.preview-toolbar')).toContainText(widgetName || '');

        // Verify iframe loads
        const iframe = page.frameLocator('iframe[title="Widget Sandbox"]');
        await expect(page.locator('iframe[title="Widget Sandbox"]')).toBeVisible();

        // Basic check inside the iframe (if cross-origin issues don't prevent it, 
        // but since it's same-origin served via Vite, it should work)
        // We might need to wait for the iframe to load content
        // The sandbox sets document.body.dataset.theme, so we can check that as a proxy for "loaded enough"
        await expect(iframe.locator('body')).toHaveAttribute('class', /homey-widget/);
    });
});
