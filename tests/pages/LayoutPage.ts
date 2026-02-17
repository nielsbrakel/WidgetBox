import { expect } from '@playwright/test';
import { SandboxPage } from './SandboxPage';

export class LayoutPage extends SandboxPage {
    get body() { return this.iframe.locator('body'); }

    async verifySpacerLoaded() {
        await expect(this.body).toHaveCount(1);
    }
}
