import { expect } from '@playwright/test';
import { SandboxPage } from './SandboxPage';

export class BuienradarPage extends SandboxPage {
    get widgetIframe() { return this.iframe.locator('iframe'); }
    get chartContainer() { return this.iframe.locator('.chart-container'); }
    get radarContainer() { return this.iframe.locator('#buienradar-container'); }
    get mapContainer() { return this.iframe.locator('#map-container'); }
    get zoomMapIframe() { return this.iframe.locator('iframe[src*="zoommap"]'); }

    async verifyLoaded() {
        // Verify one of the known containers is visible
        await expect(
            this.chartContainer.or(this.radarContainer).or(this.mapContainer)
        ).toBeVisible({ timeout: 15000 });
    }
}
