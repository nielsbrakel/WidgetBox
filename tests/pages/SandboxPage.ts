import { Page, FrameLocator, Locator, expect } from '@playwright/test';

export class SandboxPage {
    readonly page: Page;
    readonly iframe: FrameLocator;

    constructor(page: Page) {
        this.page = page;
        this.iframe = page.frameLocator('iframe[title="Widget Sandbox"]');
    }

    async goto() {
        await this.page.goto('/');
    }

    async selectWidget(name: string) {
        await expect(this.page.locator('.sidebar')).toBeVisible();
        const widgetItem = this.page.locator('.widget-item').filter({ hasText: name });
        // Click the first match that exactly matches the text if possible, or just the first match
        // But better: use specific text locator
        await this.page.locator('.widget-item').getByText(name, { exact: true }).click();
        await expect(this.page.locator('.preview-toolbar')).toContainText(name);
    }

    async setSettingCheckbox(label: string, checked: boolean) {
        const checkbox = this.page.locator('.setting-group').filter({ hasText: label }).locator('input[type="checkbox"]');
        if (checked) {
            await checkbox.check();
            await expect(checkbox).toBeChecked();
        } else {
            await checkbox.uncheck();
            await expect(checkbox).not.toBeChecked();
        }
        // Wait for reload trigger by settings change (optimistic wait, or we can wait for visual change in specific pages)
        await this.page.waitForTimeout(1000);
    }

    async setSettingInput(label: string | RegExp, value: string) {
        const input = this.page.locator('.setting-group').filter({ hasText: label }).locator('input');
        await input.fill(value);
        await this.page.waitForTimeout(500);
    }

    async setSettingSelect(label: string, optionLabelOrValue: string | { label?: string; value?: string; index?: number }) {
        const select = this.page.locator('.setting-group').filter({ hasText: label }).locator('select');
        await select.selectOption(optionLabelOrValue);
        await this.page.waitForTimeout(500);
    }
}
