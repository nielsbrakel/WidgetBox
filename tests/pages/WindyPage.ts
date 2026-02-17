import { expect } from '@playwright/test';
import { SandboxPage } from './SandboxPage';

export class WindyPage extends SandboxPage {
    get widgetIframe() { return this.iframe.locator('iframe'); }
    get embedIframe() { return this.iframe.locator('iframe[src^="https://embed.windy.com/embed.html"]'); }
    get card() { return this.iframe.locator('.homey-card'); }

    async verifyLoaded() {
        await expect(this.embedIframe).toBeVisible();
    }

    async verifySrcContains(text: string | RegExp) {
        await expect(this.embedIframe).toHaveAttribute('src', text instanceof RegExp ? text : new RegExp(text));
    }
}
