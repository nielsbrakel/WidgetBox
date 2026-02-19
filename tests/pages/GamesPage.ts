import { expect, Locator, FrameLocator } from '@playwright/test';
import { SandboxPage } from './SandboxPage';

export class GamesPage extends SandboxPage {

    // ── Core elements ────────────────────────────────────────────────────

    get tankWrap() { return this.iframe.locator('#tankWrap'); }
    get canvas() { return this.iframe.locator('#tank'); }
    get loading() { return this.iframe.locator('#loading'); }

    // ── HUD ──────────────────────────────────────────────────────────────

    get coinDisplay() { return this.iframe.locator('.coin-display'); }
    get coinCount() { return this.iframe.locator('#coinCount'); }
    get cleanBar() { return this.iframe.locator('#cleanBar'); }
    get hungerBar() { return this.iframe.locator('#hungerBar'); }

    // ── HUD Tooltips ─────────────────────────────────────────────────────

    get hudTooltip() { return this.iframe.locator('#hudTooltip'); }
    get hudTooltipTitle() { return this.iframe.locator('#hudTooltipTitle'); }
    get hudTooltipBody() { return this.iframe.locator('#hudTooltipBody'); }

    // ── Store capacity ───────────────────────────────────────────────────

    get storeCap() { return this.iframe.locator('#storeCap'); }

    // ── Fish bubble ──────────────────────────────────────────────────────

    get fishBubble() { return this.iframe.locator('#fishBubble'); }
    get fbName() { return this.iframe.locator('#fbName'); }
    get fbSpecies() { return this.iframe.locator('#fbSpecies'); }
    get fbDetail() { return this.iframe.locator('#fbDetail'); }
    get fbStage() { return this.iframe.locator('#fbStage'); }

    // ── Decor card ───────────────────────────────────────────────────────

    get decorCard() { return this.iframe.locator('#decorCard'); }
    get dcName() { return this.iframe.locator('#dcName'); }
    get dcInfo() { return this.iframe.locator('#dcInfo'); }
    get dcActions() { return this.iframe.locator('#dcActions'); }
    get dcTrimBtn() { return this.iframe.locator('[data-trim-decor]'); }
    get dcSellBtn() { return this.iframe.locator('[data-sell-decor-card]'); }

    // ── FAB & Menu ───────────────────────────────────────────────────────

    get fab() { return this.iframe.locator('#fab'); }
    get menuOverlay() { return this.iframe.locator('#menuOverlay'); }
    get menuGrid() { return this.iframe.locator('#menuGrid'); }
    menuBtn(action: string) { return this.iframe.locator(`.menu-btn[data-action="${action}"]`); }

    // ── Panels ───────────────────────────────────────────────────────────

    get storePanel() { return this.iframe.locator('#storePanel'); }
    get upgradesPanel() { return this.iframe.locator('#upgradesPanel'); }
    get inventoryPanel() { return this.iframe.locator('#inventoryPanel'); }
    get tanksPanel() { return this.iframe.locator('#tanksPanel'); }
    get helpPanel() { return this.iframe.locator('#helpPanel'); }
    get storeList() { return this.iframe.locator('#storeList'); }
    get upgradesList() { return this.iframe.locator('#upgradesList'); }
    get tanksList() { return this.iframe.locator('#tanksList'); }
    get inventoryList() { return this.iframe.locator('#inventoryList'); }

    // ── Tool dock & bottom bar ───────────────────────────────────────────

    get toolDock() { return this.iframe.locator('#toolDock'); }
    get dockItems() { return this.iframe.locator('.dock-item'); }
    get dockClose() { return this.iframe.locator('.dock-close'); }
    get bottomBar() { return this.iframe.locator('#bottomBar'); }
    get tankNav() { return this.iframe.locator('#tankNav'); }
    get tnPrev() { return this.iframe.locator('#tnPrev'); }
    get tnNext() { return this.iframe.locator('#tnNext'); }
    get tnLabel() { return this.iframe.locator('#tnLabel'); }

    // ── Widget container ─────────────────────────────────────────────────

    get widgetContainer() { return this.iframe.locator('#widgetContainer'); }

    // ── Toast ────────────────────────────────────────────────────────────

    get toast() { return this.iframe.locator('#toast'); }

    // ── Cleaning ─────────────────────────────────────────────────────────

    get dirtCanvas() { return this.iframe.locator('#dirtCanvas'); }
    get cleanDockLabel() { return this.iframe.locator('#cleanDockLabel'); }

    // ── Debug scenario selector ──────────────────────────────────────────

    get scenarioSelect() { return this.page.locator('select'); }

    // ── Actions ──────────────────────────────────────────────────────────

    async gotoAquarium() {
        await this.goto();
        await this.selectWidget('Aquarium');
        await expect(this.tankWrap).toBeVisible();
        await expect(this.loading).toHaveClass(/hidden/);
    }

    async openMenu() {
        await this.fab.click();
        await expect(this.menuOverlay).toHaveClass(/visible/);
    }

    async closeMenu() {
        await this.fab.click();
        await expect(this.menuOverlay).not.toHaveClass(/visible/);
    }

    async openStore() {
        await this.openMenu();
        await this.menuBtn('store').click();
        await expect(this.storePanel).toHaveClass(/visible/);
    }

    async openUpgrades() {
        await this.openMenu();
        await this.menuBtn('upgrades').click();
        await expect(this.upgradesPanel).toHaveClass(/visible/);
    }

    async openHelp() {
        await this.openMenu();
        await this.menuBtn('help').click();
        await expect(this.helpPanel).toHaveClass(/visible/);
    }

    async activateFeedMode() {
        await this.openMenu();
        await this.menuBtn('feed').click();
        await expect(this.toolDock).toHaveClass(/visible/);
    }

    async activateCleanMode() {
        await this.openMenu();
        await this.menuBtn('clean').click();
        await expect(this.toolDock).toHaveClass(/visible/);
    }

    async tryActivateCleanMode() {
        await this.openMenu();
        await this.menuBtn('clean').click();
    }

    async performWipeGesture(passes = 1) {
        // Perform a drag across the tank to simulate cleaning wipe
        const box = await this.tankWrap.boundingBox();
        if (!box) throw new Error('Tank wrap not visible');
        const startX = box.x + box.width * 0.2;
        const endX = box.x + box.width * 0.8;
        const y = box.y + box.height * 0.5;
        for (let i = 0; i < passes; i++) {
            const rowY = y + (i - Math.floor(passes / 2)) * 30;
            await this.page.mouse.move(startX, rowY);
            await this.page.mouse.down();
            for (let x = startX; x <= endX; x += 15) {
                await this.page.mouse.move(x, rowY);
            }
            await this.page.mouse.up();
        }
    }

    async exitCleanMode() {
        await this.dockClose.click();
        await expect(this.toolDock).not.toHaveClass(/visible/);
    }

    async openInventory() {
        await this.openMenu();
        await this.menuBtn('inventory').click();
        await expect(this.inventoryPanel).toHaveClass(/visible/);
    }

    async openTanks() {
        await this.openMenu();
        await this.menuBtn('tanks').click();
        await expect(this.tanksPanel).toHaveClass(/visible/);
    }

    async closePanel(panelId: string) {
        await this.iframe.locator(`[data-close="${panelId}"]`).click();
    }

    async switchStoreTab(tab: string) {
        await this.iframe.locator(`.store-tab[data-tab="${tab}"]`).click();
        await this.page.waitForTimeout(200);
    }

    async selectScenario(value: string) {
        await this.scenarioSelect.selectOption(value);
        // Wait for widget reload
        await this.page.waitForTimeout(1500);
        await expect(this.loading).toHaveClass(/hidden/);
    }

    async getCoins(): Promise<number> {
        const text = await this.coinCount.textContent();
        return parseInt(text || '0', 10);
    }

    async getTankTier(): Promise<string> {
        return await this.widgetContainer.getAttribute('data-tier') || '1';
    }
}
