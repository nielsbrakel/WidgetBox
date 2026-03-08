import { expect } from '@playwright/test';
import { SandboxPage } from './SandboxPage';

export class LayoutPage extends SandboxPage {
    get body() { return this.iframe.locator('body'); }

    // ── Divider ──
    async verifyDividerLoaded() {
        await expect(this.iframe.locator('#divider')).toBeAttached();
    }

    async getWidgetHeight() {
        const container = this.page.locator('.device-frame > div').first();
        return container.evaluate((el: HTMLElement) => el.style.height);
    }

    // ── Separator ──
    async verifySeparatorLoaded() {
        await expect(this.iframe.locator('#line')).toBeVisible();
    }

    async getSeparatorStyle() {
        return this.iframe.locator('#line').evaluate((el: HTMLElement) => el.style.borderTop);
    }

    async getSeparatorMargin() {
        return this.iframe.locator('#line').evaluate((el: HTMLElement) => el.style.margin);
    }

    // ── Header ──
    async verifyHeaderLoaded() {
        await expect(this.iframe.locator('#header')).toBeVisible();
    }

    async getHeaderText() {
        return this.iframe.locator('#header').textContent();
    }

    async getHeaderStyle(prop: 'fontSize' | 'fontWeight' | 'textAlign' | 'color') {
        return this.iframe.locator('#header').evaluate(
            (el: HTMLElement, p: string) => el.style[p as any],
            prop
        );
    }
}
