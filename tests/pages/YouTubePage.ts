import { expect } from '@playwright/test';
import { SandboxPage } from './SandboxPage';

export class YouTubePage extends SandboxPage {
    get widgetIframe() { return this.iframe.locator('iframe').first(); }
    get card() { return this.iframe.locator('.homey-card'); }
    get iosMessage() { return this.iframe.locator('.ios-unsupported'); }
    get iosTitle() { return this.iframe.locator('.ios-unsupported-title'); }

    async verifyLoaded() {
        await expect(this.widgetIframe).toBeVisible();
    }

    async getVideoSrc() {
        return await this.widgetIframe.getAttribute('src');
    }

    async verifyVideoId(id: string) {
        await expect(this.widgetIframe).toHaveAttribute('src', new RegExp(id));
    }
}
