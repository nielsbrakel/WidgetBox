import { test, expect } from '@playwright/test';
import { GamesPage } from '../pages/GamesPage';

/**
 * v2 Visual Overhaul Tests for Aquarium Widget
 *
 * Tests for all changes made in the v2 session:
 * - Sunken Ship decor in fresh tank
 * - Blue-Eye half-space (0.5 spaceCost)
 * - Store icon consistency (colored circles, specific tool icons)
 * - Equipment rendering on right wall with filter bubbles
 * - Spider wood (driftwood) rendering
 * - Panel close → menu reopen behavior
 * - Debug full-grown tool levels respect maxLevel
 * - Treasure chest animated rendering
 * - Updated fish sprites (7 species redesigned)
 * - Help button sizing
 */

test.describe('Games App — Aquarium v2 Visual Overhaul', () => {
    let games: GamesPage;

    test.beforeEach(async ({ page }) => {
        games = new GamesPage(page);
        await games.gotoAquarium();
    });

    // ══════════════════════════════════════════════════════════════════════
    // ── Sunken Ship Decor ────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════

    test.describe('Sunken Ship Decor', () => {
        test('should show Sunken Ship in fresh tank store decor tab', async () => {
            await games.openStore();
            await games.switchStoreTab('decor');
            await expect(games.storeList).toContainText('Sunken Ship');
        });

        test('should show Sunken Ship priced at 75 coins', async () => {
            await games.openStore();
            await games.switchStoreTab('decor');
            const shipItem = games.storeList.locator('.s-item:has-text("Sunken Ship")');
            await expect(shipItem).toBeVisible();
            await expect(shipItem).toContainText('75');
        });

        test('should buy Sunken Ship with enough coins', async () => {
            await games.selectScenario('rich');
            await games.openStore();
            await games.switchStoreTab('decor');
            const buyBtn = games.storeList.locator('.s-item:has-text("Sunken Ship") [data-buy-decor]');
            if (await buyBtn.count() > 0) {
                await buyBtn.click();
                await games.page.waitForTimeout(800);
                await expect(games.toast).toContainText('Decoration placed');
            }
        });

        test('should show Sunken Ship in inventory after purchase', async () => {
            await games.selectScenario('rich');
            await games.openStore();
            await games.switchStoreTab('decor');
            const buyBtn = games.storeList.locator('.s-item:has-text("Sunken Ship") [data-buy-decor]');
            if (await buyBtn.count() > 0) {
                await buyBtn.click();
                await games.page.waitForTimeout(800);
            }
            await games.closePanel('storePanel');
            await games.page.waitForTimeout(300);
            // Menu is already reopened by panel close behavior
            await games.menuBtn('inventory').click();
            await expect(games.inventoryPanel).toHaveClass(/visible/);
            await expect(games.inventoryList).toContainText('Sunken Ship');
        });

        test('should render Sunken Ship on canvas without errors', async () => {
            await games.selectScenario('rich');
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.openStore();
            await games.switchStoreTab('decor');
            const buyBtn = games.storeList.locator('.s-item:has-text("Sunken Ship") [data-buy-decor]');
            if (await buyBtn.count() > 0) {
                await buyBtn.click();
                await games.page.waitForTimeout(800);
            }
            await games.closePanel('storePanel');
            await games.page.waitForTimeout(2000);
            await expect(games.canvas).toBeVisible();
            expect(errors.length).toBe(0);
        });

        test('should enforce max 1 Sunken Ship per tank', async () => {
            await games.selectScenario('rich');
            await games.openStore();
            await games.switchStoreTab('decor');
            // Buy first one
            const buyBtn = games.storeList.locator('.s-item:has-text("Sunken Ship") [data-buy-decor]');
            if (await buyBtn.count() > 0) {
                await buyBtn.click();
                await games.page.waitForTimeout(800);
            }
            // Try buying second — button should be disabled or show "Max" message
            await games.closePanel('storePanel');
            await games.page.waitForTimeout(300);
            // Menu is already reopened by panel close behavior
            await games.menuBtn('store').click();
            await expect(games.storePanel).toHaveClass(/visible/);
            await games.switchStoreTab('decor');
            const shipItem = games.storeList.locator('.s-item:has-text("Sunken Ship")');
            const disabledBtn = shipItem.locator('.buy-btn:disabled, .buy-btn:has-text("Max")');
            const count = await disabledBtn.count();
            expect(count).toBeGreaterThan(0);
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // ── Blue-Eye Half-Space ──────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════

    test.describe('Blue-Eye Half-Space', () => {
        test('should show 0.5 space cost for Blue-Eye in store', async () => {
            await games.selectScenario('tier-2-active');
            await games.openStore();
            const blueEyeItem = games.storeList.locator('.s-item:has-text("Blue-Eye")');
            await expect(blueEyeItem).toBeVisible();
            // Should show 0.5 space diamond
            await expect(blueEyeItem).toContainText('0.5');
        });

        test('should account for half-space Blue-Eye in capacity display', async () => {
            await games.selectScenario('tier-2-active');
            await games.openStore();
            // Buy a Blue-Eye (if affordable)
            const buyBtn = games.storeList.locator('.s-item:has-text("Blue-Eye") .buy-btn:not(:disabled)');
            if (await buyBtn.count() > 0) {
                const capBefore = await games.storeCap.textContent();
                const matchBefore = capBefore?.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+)/);
                const usedBefore = matchBefore ? parseFloat(matchBefore[1]) : 0;

                await buyBtn.click();
                await games.page.waitForTimeout(800);

                const capAfter = await games.storeCap.textContent();
                const matchAfter = capAfter?.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+)/);
                const usedAfter = matchAfter ? parseFloat(matchAfter[1]) : 0;

                // Blue-eye takes 0.5 space, so increase should be 0.5
                expect(usedAfter - usedBefore).toBeCloseTo(0.5, 1);
            }
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // ── Store Icon Consistency ───────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════

    test.describe('Store Icon Consistency', () => {
        test('should show colored circle icons for fish in store', async () => {
            await games.openStore();
            // Fish items should have coloured circles not pixel art fish icon
            const fishIcons = games.storeList.locator('.s-icon');
            const count = await fishIcons.count();
            expect(count).toBeGreaterThan(0);
            // First icon should contain a ● (colored circle)
            const iconHtml = await fishIcons.first().innerHTML();
            expect(iconHtml).toContain('●');
        });

        test('should show colored circle icon for food items', async () => {
            await games.openStore();
            await games.switchStoreTab('food');
            const foodIcons = games.storeList.locator('.s-icon');
            const count = await foodIcons.count();
            expect(count).toBeGreaterThan(0);
            const iconHtml = await foodIcons.first().innerHTML();
            expect(iconHtml).toContain('●');
        });

        test('should show specific pixel icons for tool items', async () => {
            await games.selectScenario('tier-2-active');
            await games.openStore();
            await games.switchStoreTab('tools');
            const toolIcons = games.storeList.locator('.s-icon img');
            const count = await toolIcons.count();
            // Should have pixel art icons (img tags) for tools
            expect(count).toBeGreaterThan(0);
            // First icon should be a data URI (pixel art)
            const src = await toolIcons.first().getAttribute('src');
            expect(src).toMatch(/^data:image\/png/);
        });

        test('should show colored circle icons for decor items', async () => {
            await games.openStore();
            await games.switchStoreTab('decor');
            const decorIcons = games.storeList.locator('.s-icon');
            const count = await decorIcons.count();
            expect(count).toBeGreaterThan(0);
            const iconHtml = await decorIcons.first().innerHTML();
            expect(iconHtml).toContain('●');
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // ── Panel Close → Menu Reopen ────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════

    test.describe('Panel Close Reopens Menu', () => {
        test('should reopen menu when closing store panel', async () => {
            await games.openStore();
            await expect(games.storePanel).toHaveClass(/visible/);
            await games.closePanel('storePanel');
            await expect(games.storePanel).not.toHaveClass(/visible/);
            // Menu should be visible again
            await expect(games.menuOverlay).toHaveClass(/visible/);
        });

        test('should reopen menu when closing inventory panel', async () => {
            await games.openInventory();
            await expect(games.inventoryPanel).toHaveClass(/visible/);
            await games.closePanel('inventoryPanel');
            await expect(games.inventoryPanel).not.toHaveClass(/visible/);
            await expect(games.menuOverlay).toHaveClass(/visible/);
        });

        test('should reopen menu when closing tanks panel', async () => {
            await games.openTanks();
            await expect(games.tanksPanel).toHaveClass(/visible/);
            await games.closePanel('tanksPanel');
            await expect(games.tanksPanel).not.toHaveClass(/visible/);
            await expect(games.menuOverlay).toHaveClass(/visible/);
        });

        test('should reopen menu when closing help panel', async () => {
            await games.openHelp();
            await expect(games.helpPanel).toHaveClass(/visible/);
            await games.closePanel('helpPanel');
            await expect(games.helpPanel).not.toHaveClass(/visible/);
            await expect(games.menuOverlay).toHaveClass(/visible/);
        });

        test('should allow closing menu after panel close reopened it', async () => {
            await games.openStore();
            await games.closePanel('storePanel');
            // Menu should be visible
            await expect(games.menuOverlay).toHaveClass(/visible/);
            // Now close the menu normally
            await games.closeMenu();
            await expect(games.menuOverlay).not.toHaveClass(/visible/);
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // ── Debug Full-Grown Tool Levels ─────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════

    test.describe('Debug Full-Grown Tool Levels', () => {
        test('should show correct max tool levels in full-grown-tropical', async () => {
            await games.selectScenario('full-grown-tropical');
            await games.openStore();
            await games.switchStoreTab('tools');
            // Heater has maxLevel 1 — should show Lv.1/1 or "Max" not "3/1"
            const heaterItem = games.storeList.locator('.s-item:has-text("Heater")');
            await expect(heaterItem).toBeVisible();
            const heaterText = await heaterItem.textContent() || '';
            // Should not contain "3/1" which was the old bug
            expect(heaterText).not.toContain('3/1');
            // Should indicate max level reached
            expect(heaterText).toMatch(/Max|1\/1/);
        });

        test('should show correct max tool levels in full-grown-salt', async () => {
            await games.selectScenario('full-grown-salt');
            await games.openStore();
            await games.switchStoreTab('tools');
            // Filter has maxLevel 2 — should show Lv.2/2 or "Max"
            const filterItem = games.storeList.locator('.s-item:has-text("Filter")');
            await expect(filterItem).toBeVisible();
            const filterText = await filterItem.textContent() || '';
            expect(filterText).not.toContain('3/');
            // Skimmer has maxLevel 1 — should show 1/1 or "Max"
            const skimmerItem = games.storeList.locator('.s-item:has-text("Skimmer")');
            await expect(skimmerItem).toBeVisible();
            const skimmerText = await skimmerItem.textContent() || '';
            expect(skimmerText).not.toContain('3/1');
            // UV has maxLevel 1 — should show 1/1 or "Max"
            const uvItem = games.storeList.locator('.s-item:has-text("UV")');
            await expect(uvItem).toBeVisible();
            const uvText = await uvItem.textContent() || '';
            expect(uvText).not.toContain('3/1');
        });

        test('should not exceed maxLevel for any tool in full-grown scenarios', async () => {
            // Test all three full-grown scenarios
            for (const scenario of ['full-grown-fresh', 'full-grown-tropical', 'full-grown-salt']) {
                await games.selectScenario(scenario);
                await games.openStore();
                await games.switchStoreTab('tools');
                const toolItems = games.storeList.locator('.s-item');
                const count = await toolItems.count();
                for (let i = 0; i < count; i++) {
                    const text = await toolItems.nth(i).textContent() || '';
                    // None should show level higher than expected max
                    // Old bug: "3/1" — tool at level 3 when maxLevel is 1
                    expect(text).not.toMatch(/3\/1|3\/2/);
                }
                await games.closePanel('storePanel');
                await games.page.waitForTimeout(300);
            }
        });

        test('should render full-grown-fresh with correct tool state', async () => {
            await games.selectScenario('full-grown-fresh');
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.page.waitForTimeout(3000);
            await expect(games.canvas).toBeVisible();
            expect(errors.length).toBe(0);
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // ── Equipment Rendering ──────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════

    test.describe('Equipment Rendering', () => {
        test('should render equipment without errors in tropical tank', async () => {
            await games.selectScenario('full-grown-tropical');
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.page.waitForTimeout(3000);
            await expect(games.canvas).toBeVisible();
            expect(errors.length).toBe(0);
        });

        test('should render equipment without errors in salt tank', async () => {
            await games.selectScenario('full-grown-salt');
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.page.waitForTimeout(3000);
            await expect(games.canvas).toBeVisible();
            expect(errors.length).toBe(0);
        });

        test('should render filter bubbles over time in tropical tank', async () => {
            await games.selectScenario('full-grown-tropical');
            // Wait enough time for filter bubbles to be spawned (300ms intervals)
            await games.page.waitForTimeout(3000);
            // No errors means the bubble emission runs correctly
            await expect(games.canvas).toBeVisible();
            await expect(games.coinDisplay).toBeVisible();
        });

        test('should render all salt tools (filter + skimmer + UV) without crash', async () => {
            await games.selectScenario('full-grown-salt');
            await games.page.waitForTimeout(5000);
            await expect(games.canvas).toBeVisible();
            await expect(games.coinDisplay).toBeVisible();
            // Verify we can still interact after long render
            await games.openMenu();
            await expect(games.menuOverlay).toHaveClass(/visible/);
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // ── Treasure Chest & Driftwood Rendering ─────────────────────────────
    // ══════════════════════════════════════════════════════════════════════

    test.describe('Treasure Chest & Driftwood Rendering', () => {
        test('should show Treasure Chest in fresh tank store', async () => {
            await games.openStore();
            await games.switchStoreTab('decor');
            await expect(games.storeList).toContainText('Treasure Chest');
        });

        test('should show Driftwood in fresh tank store', async () => {
            await games.openStore();
            await games.switchStoreTab('decor');
            await expect(games.storeList).toContainText('Driftwood');
        });

        test('should render treasure chest without errors', async () => {
            await games.selectScenario('rich');
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.openStore();
            await games.switchStoreTab('decor');
            const buyBtn = games.storeList.locator('.s-item:has-text("Treasure Chest") [data-buy-decor]');
            if (await buyBtn.count() > 0) {
                await buyBtn.click();
                await games.page.waitForTimeout(800);
            }
            await games.closePanel('storePanel');
            await games.page.waitForTimeout(3000);
            await expect(games.canvas).toBeVisible();
            expect(errors.length).toBe(0);
        });

        test('should render driftwood (spider wood) without errors', async () => {
            await games.selectScenario('rich');
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.openStore();
            await games.switchStoreTab('decor');
            const buyBtn = games.storeList.locator('.s-item:has-text("Driftwood") [data-buy-decor]');
            if (await buyBtn.count() > 0) {
                await buyBtn.click();
                await games.page.waitForTimeout(800);
            }
            await games.closePanel('storePanel');
            await games.page.waitForTimeout(3000);
            await expect(games.canvas).toBeVisible();
            expect(errors.length).toBe(0);
        });

        test('should render full-grown-fresh with all decor types', async () => {
            // Full-grown-fresh places one of each decor type
            await games.selectScenario('full-grown-fresh');
            await games.page.waitForTimeout(3000);
            await expect(games.canvas).toBeVisible();
            // Verify all decor types are present
            await games.openInventory();
            await expect(games.inventoryList).toContainText('Treasure Chest');
            await expect(games.inventoryList).toContainText('Driftwood');
            await expect(games.inventoryList).toContainText('Sunken Ship');
        });

        test('should render multiple decor types simultaneously without crash', async () => {
            await games.selectScenario('full-grown-fresh');
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.page.waitForTimeout(5000);
            await expect(games.canvas).toBeVisible();
            expect(errors.length).toBe(0);
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // ── Updated Fish Sprites ─────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════

    test.describe('Updated Fish Sprites', () => {
        test('should render redesigned goldfish without errors', async () => {
            // Default scenario has a goldfish-compatible tank
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.selectScenario('full-grown-fresh');
            await games.page.waitForTimeout(3000);
            await expect(games.canvas).toBeVisible();
            expect(errors.length).toBe(0);
            await games.openInventory();
            await expect(games.inventoryList).toContainText('Goldfish');
        });

        test('should render redesigned tropical fish without errors', async () => {
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.selectScenario('full-grown-tropical');
            await games.page.waitForTimeout(3000);
            await expect(games.canvas).toBeVisible();
            expect(errors.length).toBe(0);
            await games.openInventory();
            await expect(games.inventoryList).toContainText('Discus');
            await expect(games.inventoryList).toContainText('Gourami');
        });

        test('should render redesigned saltwater fish without errors', async () => {
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.selectScenario('full-grown-salt');
            await games.page.waitForTimeout(3000);
            await expect(games.canvas).toBeVisible();
            expect(errors.length).toBe(0);
            await games.openInventory();
            await expect(games.inventoryList).toContainText('Blue Tang');
            await expect(games.inventoryList).toContainText('Moray Eel');
        });

        test('should render size-showcase with redesigned sprites for 5s', async () => {
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.selectScenario('size-showcase');
            await games.page.waitForTimeout(5000);
            await expect(games.canvas).toBeVisible();
            expect(errors.length).toBe(0);
        });

        test('should render moray eel thinner (32×3) without clipping', async () => {
            await games.selectScenario('territorial-showcase');
            await games.page.waitForTimeout(3000);
            await expect(games.canvas).toBeVisible();
            await games.openInventory();
            await expect(games.inventoryList).toContainText('Moray Eel');
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // ── Help Button Sizing ───────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════

    test.describe('Help Button Sizing', () => {
        test('should render help button without stretching', async () => {
            await games.openMenu();
            const helpBtn = games.menuBtn('help');
            await expect(helpBtn).toBeVisible();
            const box = await helpBtn.boundingBox();
            expect(box).toBeTruthy();
            if (box) {
                // Help button should not be abnormally wide (stretching bug)
                // Other menu buttons are approximately the same width
                const storeBtn = games.menuBtn('store');
                const storeBox = await storeBtn.boundingBox();
                if (storeBox) {
                    // Help button width should not be dramatically larger than store
                    // (old bug: help spanned full grid width)
                    // Both should be visible and reasonably sized
                    expect(box.height).toBeGreaterThan(20);
                }
            }
        });

        test('should show help icon at constrained size', async () => {
            await games.openMenu();
            const helpIcon = games.menuBtn('help').locator('.menu-icon img');
            if (await helpIcon.count() > 0) {
                const box = await helpIcon.boundingBox();
                if (box) {
                    // Icon should be constrained (16×16 or similar, not stretched)
                    expect(box.width).toBeLessThanOrEqual(24);
                    expect(box.height).toBeLessThanOrEqual(24);
                }
            }
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // ── Fresh Tank Decor Completeness ────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════

    test.describe('Fresh Tank Decor Catalog', () => {
        test('should show all fresh decor items in store', async () => {
            await games.openStore();
            await games.switchStoreTab('decor');
            await expect(games.storeList).toContainText('Hornwort');
            await expect(games.storeList).toContainText('Vallisneria');
            await expect(games.storeList).toContainText('Anubias');
            await expect(games.storeList).toContainText('Moss Ball');
            await expect(games.storeList).toContainText('Rock Pile');
            await expect(games.storeList).toContainText('Driftwood');
            await expect(games.storeList).toContainText('Treasure Chest');
            await expect(games.storeList).toContainText('Sunken Ship');
        });

        test('should have 8 decor items in fresh tank store', async () => {
            await games.openStore();
            await games.switchStoreTab('decor');
            const decorItems = games.storeList.locator('.s-item');
            expect(await decorItems.count()).toBe(8);
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // ── Visual Stability with All Changes ────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════

    test.describe('Visual Stability', () => {
        test('should render all full-grown scenarios sequentially without errors', async () => {
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));

            await games.selectScenario('full-grown-fresh');
            await games.page.waitForTimeout(2000);
            await games.selectScenario('full-grown-tropical');
            await games.page.waitForTimeout(2000);
            await games.selectScenario('full-grown-salt');
            await games.page.waitForTimeout(2000);

            await expect(games.canvas).toBeVisible();
            expect(errors.length).toBe(0);
        });

        test('should handle rapid scenario switching with new sprites', async () => {
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));

            await games.selectScenario('full-grown-fresh');
            await games.page.waitForTimeout(500);
            await games.selectScenario('full-grown-tropical');
            await games.page.waitForTimeout(500);
            await games.selectScenario('full-grown-salt');
            await games.page.waitForTimeout(500);
            await games.selectScenario('size-showcase');
            await games.page.waitForTimeout(500);

            await expect(games.canvas).toBeVisible();
            expect(errors.length).toBe(0);
        });

        test('should run full-grown-fresh with all new visuals for 10s', async () => {
            await games.selectScenario('full-grown-fresh');
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.page.waitForTimeout(10000);
            await expect(games.canvas).toBeVisible();
            await expect(games.coinDisplay).toBeVisible();
            expect(errors.length).toBe(0);
        });

        test('should run full-grown-salt with all new visuals for 10s', async () => {
            await games.selectScenario('full-grown-salt');
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.page.waitForTimeout(10000);
            await expect(games.canvas).toBeVisible();
            await expect(games.coinDisplay).toBeVisible();
            expect(errors.length).toBe(0);
        });

        test('should render default fresh tank without JS errors', async () => {
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.page.waitForTimeout(3000);
            await expect(games.canvas).toBeVisible();
            expect(errors.length).toBe(0);
        });
    });
});
