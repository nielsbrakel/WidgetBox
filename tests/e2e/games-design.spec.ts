import { test, expect } from '@playwright/test';
import { GamesPage } from '../pages/GamesPage';

/**
 * Design Overhaul Tests for Aquarium Widget v1.3
 *
 * Tests for: fish size differentiation, layered decor rendering, territorial
 * behavior, plant trimming, new scenarios (territorial, lush-planted, size-showcase),
 * and visual depth system.
 */

test.describe('Games App — Aquarium Design Overhaul', () => {
    let games: GamesPage;

    test.beforeEach(async ({ page }) => {
        games = new GamesPage(page);
        await games.gotoAquarium();
    });

    // ══════════════════════════════════════════════════════════════════════
    // ── Fish Size Differentiation ────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════

    test.describe('Fish Size Differentiation', () => {
        test('should load size-showcase scenario successfully', async () => {
            await games.selectScenario('size-showcase');
            await expect(games.canvas).toBeVisible();
            await expect(games.tankWrap).toBeVisible();
        });

        test('should show saltwater fish in size-showcase', async () => {
            await games.selectScenario('size-showcase');
            await games.openInventory();
            const fishItems = games.inventoryList.locator('[data-sell-fish]');
            // 8 fish in the saltwater tank
            expect(await fishItems.count()).toBe(8);
        });

        test('should have chromis and moray in inventory', async () => {
            await games.selectScenario('size-showcase');
            await games.openInventory();
            await expect(games.inventoryList).toContainText('Green Chromis');
            await expect(games.inventoryList).toContainText('Moray Eel');
        });

        test('should have tropical fish visible when switching tanks', async () => {
            await games.selectScenario('size-showcase');
            // size-showcase starts on salt; order: [fresh, tropical, salt]
            // prev goes salt → tropical
            await games.tnPrev.click();
            await games.page.waitForTimeout(800);
            await games.openInventory();
            await expect(games.inventoryList).toContainText('Neon Tetra');
            await expect(games.inventoryList).toContainText('Discus');
        });

        test('should render canvas without errors for tiny fish', async () => {
            await games.selectScenario('size-showcase');
            await games.page.waitForTimeout(2000);
            await expect(games.canvas).toBeVisible();
            await expect(games.coinDisplay).toBeVisible();
        });

        test('should render canvas without errors for very large fish', async () => {
            await games.selectScenario('size-showcase');
            await games.page.waitForTimeout(2000);
            await expect(games.canvas).toBeVisible();
            await expect(games.hungerBar).toBeVisible();
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // ── Layered Decoration Rendering ─────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════

    test.describe('Layered Decoration Rendering', () => {
        test('should load lush-planted scenario successfully', async () => {
            await games.selectScenario('lush-planted');
            await expect(games.canvas).toBeVisible();
            await expect(games.tankWrap).toBeVisible();
        });

        test('should show multiple decorations in lush-planted inventory', async () => {
            await games.selectScenario('lush-planted');
            await games.openInventory();
            const decorItems = games.inventoryList.locator('[data-sell-decor]');
            expect(await decorItems.count()).toBeGreaterThanOrEqual(6);
        });

        test('should render densely planted tank without errors', async () => {
            await games.selectScenario('lush-planted');
            await games.page.waitForTimeout(3000);
            await expect(games.canvas).toBeVisible();
            await expect(games.coinDisplay).toBeVisible();
        });

        test('should show plant names in inventory', async () => {
            await games.selectScenario('lush-planted');
            await games.openInventory();
            await expect(games.inventoryList).toContainText('Java Fern');
            await expect(games.inventoryList).toContainText('Amazon Sword');
        });

        test('should show floating plants in lush tank inventory', async () => {
            await games.selectScenario('lush-planted');
            await games.openInventory();
            await expect(games.inventoryList).toContainText('Floating Plants');
        });

        test('should show decor size info in inventory', async () => {
            await games.selectScenario('lush-planted');
            await games.openInventory();
            await expect(games.inventoryList).toContainText('Size:');
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // ── Territorial Fish Behavior ────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════

    test.describe('Territorial Fish Behavior', () => {
        test('should load territorial-showcase scenario successfully', async () => {
            await games.selectScenario('territorial-showcase');
            await expect(games.canvas).toBeVisible();
            await expect(games.tankWrap).toBeVisible();
        });

        test('should show territorial fish in inventory', async () => {
            await games.selectScenario('territorial-showcase');
            await games.openInventory();
            await expect(games.inventoryList).toContainText('Clownfish');
            await expect(games.inventoryList).toContainText('Moray Eel');
        });

        test('should have territorial decor in tank', async () => {
            await games.selectScenario('territorial-showcase');
            await games.openInventory();
            await expect(games.inventoryList).toContainText('Anemone');
            await expect(games.inventoryList).toContainText('Cave');
            await expect(games.inventoryList).toContainText('Brain Coral');
        });

        test('should render territorial behavior without errors over time', async () => {
            await games.selectScenario('territorial-showcase');
            await games.page.waitForTimeout(5000);
            await expect(games.canvas).toBeVisible();
            await expect(games.coinDisplay).toBeVisible();
        });

        test('should have intruder fish (blue tangs) in tank', async () => {
            await games.selectScenario('territorial-showcase');
            await games.openInventory();
            // Blue tangs are intruders with no territory — count sell buttons for all fish
            const fishSellBtns = games.inventoryList.locator('[data-sell-fish]');
            const total = await fishSellBtns.count();
            // Should have 10 fish total in the scenario
            expect(total).toBe(10);
            // Blue Tang should appear in the inventory text
            const inventoryText = await games.inventoryList.textContent() || '';
            const blueTangCount = (inventoryText.match(/Blue Tang/g) || []).length;
            expect(blueTangCount).toBe(2);
        });

        test('should show clownfish in store with cost info', async () => {
            await games.selectScenario('territorial-showcase');
            await games.openStore();
            const clownItem = games.storeList.locator('.s-item:has-text("Clownfish")');
            await expect(clownItem).toBeVisible();
            await expect(clownItem).toContainText('owned');
        });

        test('should show moray eel in store with cost info', async () => {
            await games.selectScenario('territorial-showcase');
            await games.openStore();
            const morayItem = games.storeList.locator('.s-item:has-text("Moray")');
            await expect(morayItem).toBeVisible();
            await expect(morayItem).toContainText('owned');
        });

        test('should show firefish in store', async () => {
            await games.selectScenario('territorial-showcase');
            await games.openStore();
            const item = games.storeList.locator('.s-item:has-text("Firefish")');
            await expect(item).toBeVisible();
        });

        test('should show royal gramma in store', async () => {
            await games.selectScenario('territorial-showcase');
            await games.openStore();
            const item = games.storeList.locator('.s-item:has-text("Royal Gramma")');
            await expect(item).toBeVisible();
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // ── Plant Trim & Move ────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════

    test.describe('Plant Trim & Move', () => {
        test('should show growable plants in inventory', async () => {
            await games.selectScenario('lush-planted');
            await games.openInventory();
            const decorItems = games.inventoryList.locator('[data-sell-decor]');
            expect(await decorItems.count()).toBeGreaterThan(0);
        });

        test('should show decor in store for buying more plants', async () => {
            await games.selectScenario('lush-planted');
            await games.openStore();
            await games.switchStoreTab('decor');
            const decorItems = games.storeList.locator('.s-item');
            expect(await decorItems.count()).toBeGreaterThan(0);
        });

        test('should show Size info for growable decor', async () => {
            await games.selectScenario('lush-planted');
            await games.openInventory();
            await expect(games.inventoryList).toContainText('Size:');
        });

        test('should sell decor from inventory', async () => {
            await games.selectScenario('lush-planted');
            const coinsBefore = await games.getCoins();
            await games.openInventory();
            const sellBtns = games.inventoryList.locator('[data-sell-decor]');
            const count = await sellBtns.count();
            expect(count).toBeGreaterThan(0);
            await sellBtns.first().click();
            await games.page.waitForTimeout(500);
            const coinsAfter = await games.getCoins();
            expect(coinsAfter).toBeGreaterThanOrEqual(coinsBefore);
        });

        test('should have less decor after selling', async () => {
            await games.selectScenario('lush-planted');
            await games.openInventory();
            const decorBefore = await games.inventoryList.locator('[data-sell-decor]').count();
            await games.inventoryList.locator('[data-sell-decor]').first().click();
            await games.page.waitForTimeout(500);
            const decorAfter = await games.inventoryList.locator('[data-sell-decor]').count();
            expect(decorAfter).toBe(decorBefore - 1);
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // ── Visual Rendering Stability ───────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════

    test.describe('Visual Rendering Stability', () => {
        test('should render fresh tank without errors', async () => {
            await games.page.waitForTimeout(2000);
            await expect(games.canvas).toBeVisible();
            await expect(games.coinDisplay).toBeVisible();
        });

        test('should render tier-3-endgame with all fish types', async () => {
            await games.selectScenario('tier-3-endgame');
            await games.page.waitForTimeout(3000);
            await expect(games.canvas).toBeVisible();
            await expect(games.coinDisplay).toBeVisible();
        });

        test('should handle rapid scenario switching without crashes', async () => {
            await games.selectScenario('size-showcase');
            await games.page.waitForTimeout(500);
            await games.selectScenario('territorial-showcase');
            await games.page.waitForTimeout(500);
            await games.selectScenario('lush-planted');
            await games.page.waitForTimeout(500);
            await expect(games.canvas).toBeVisible();
        });

        test('should render movement-showcase with updated sprites', async () => {
            await games.selectScenario('movement-showcase');
            await games.page.waitForTimeout(3000);
            await expect(games.canvas).toBeVisible();
            await expect(games.coinDisplay).toBeVisible();
        });

        test('should render schooling-showcase with small fish sprites', async () => {
            await games.selectScenario('schooling-showcase');
            await games.page.waitForTimeout(3000);
            await expect(games.canvas).toBeVisible();
            await expect(games.coinDisplay).toBeVisible();
        });

        test('should keep canvas running after feeding', async () => {
            await games.selectScenario('size-showcase');
            await games.activateFeedMode();
            const box = await games.tankWrap.boundingBox();
            if (box) {
                await games.page.mouse.click(box.x + box.width / 2, box.y + box.height / 3);
            }
            await games.page.waitForTimeout(1000);
            await expect(games.canvas).toBeVisible();
        });

        test('should keep canvas running after laser in territorial scenario', async () => {
            await games.selectScenario('territorial-showcase');
            await games.openMenu();
            await games.menuBtn('laser').click();
            await expect(games.toolDock).toHaveClass(/visible/);
            const box = await games.tankWrap.boundingBox();
            if (box) {
                await games.page.mouse.move(box.x + box.width / 3, box.y + box.height / 2);
                await games.page.mouse.down();
                await games.page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2);
                await games.page.mouse.up();
            }
            await games.page.waitForTimeout(1000);
            await expect(games.canvas).toBeVisible();
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // ── Decor Store Integration ──────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════

    test.describe('Decor Store Integration', () => {
        test('should show salt decor types in store', async () => {
            await games.selectScenario('territorial-showcase');
            await games.openStore();
            await games.switchStoreTab('decor');
            await expect(games.storeList).toContainText('Anemone');
            await expect(games.storeList).toContainText('Cave');
        });

        test('should show tropical decor in lush-planted store', async () => {
            await games.selectScenario('lush-planted');
            await games.openStore();
            await games.switchStoreTab('decor');
            const items = games.storeList.locator('.s-item');
            expect(await items.count()).toBeGreaterThan(0);
        });

        test('should buy a decor in territorial tank', async () => {
            await games.selectScenario('territorial-showcase');
            await games.openStore();
            await games.switchStoreTab('decor');
            const buyBtns = games.storeList.locator('.buy-btn:not(:disabled)');
            const count = await buyBtns.count();
            if (count > 0) {
                await buyBtns.first().click();
                await games.page.waitForTimeout(500);
                await expect(games.toast).toBeVisible();
            }
        });

        test('should show fish species in salt tank store', async () => {
            await games.selectScenario('territorial-showcase');
            await games.openStore();
            const fishItems = games.storeList.locator('.s-item');
            expect(await fishItems.count()).toBeGreaterThanOrEqual(7);
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // ── Tank Navigation with New Scenarios ───────────────────────────────
    // ══════════════════════════════════════════════════════════════════════

    test.describe('Tank Navigation', () => {
        test('should show tank nav in size-showcase', async () => {
            await games.selectScenario('size-showcase');
            await expect(games.tankNav).toBeVisible();
            await expect(games.tnLabel).toContainText(/Saltwater/i);
        });

        test('should switch to tropical and show canvas', async () => {
            await games.selectScenario('size-showcase');
            // salt → prev → tropical
            await games.tnPrev.click();
            await games.page.waitForTimeout(800);
            await expect(games.canvas).toBeVisible();
        });

        test('should show all tanks unlocked in size-showcase', async () => {
            await games.selectScenario('size-showcase');
            await games.openTanks();
            const tankItems = games.tanksList.locator('.s-item');
            expect(await tankItems.count()).toBe(3);
        });

        test('should start on saltwater in territorial-showcase', async () => {
            await games.selectScenario('territorial-showcase');
            await expect(games.tankNav).toBeVisible();
            await expect(games.tnLabel).toContainText(/Saltwater/i);
        });

        test('should start on tropical in lush-planted', async () => {
            await games.selectScenario('lush-planted');
            await expect(games.tankNav).toBeVisible();
            await expect(games.tnLabel).toContainText(/Tropical/i);
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // ── Long Running Stability ───────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════

    test.describe('Long Running Stability', () => {
        test('should run territorial scenario for 10s without crash', async () => {
            await games.selectScenario('territorial-showcase');
            await games.page.waitForTimeout(10000);
            await expect(games.canvas).toBeVisible();
            await expect(games.coinDisplay).toBeVisible();
            await games.openMenu();
            await expect(games.menuOverlay).toHaveClass(/visible/);
        });

        test('should run size-showcase for 10s without crash', async () => {
            await games.selectScenario('size-showcase');
            await games.page.waitForTimeout(10000);
            await expect(games.canvas).toBeVisible();
            await expect(games.coinDisplay).toBeVisible();
        });

        test('should run lush-planted for 10s without crash', async () => {
            await games.selectScenario('lush-planted');
            await games.page.waitForTimeout(10000);
            await expect(games.canvas).toBeVisible();
            await expect(games.coinDisplay).toBeVisible();
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // ── Full-Grown Scenarios ─────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════

    test.describe('Full-Grown Scenarios', () => {
        test('should load full-grown-fresh with max-level fish', async () => {
            await games.selectScenario('full-grown-fresh');
            await expect(games.canvas).toBeVisible();
            await games.openInventory();
            // Full-grown fresh has max-capacity fish
            const fishItems = games.inventoryList.locator('[data-sell-fish]');
            expect(await fishItems.count()).toBeGreaterThan(0);
            // Fish should be high level
            await expect(games.inventoryList).toContainText('Lv.');
        });

        test('should load full-grown-tropical with high coin balance', async () => {
            await games.selectScenario('full-grown-tropical');
            await expect(games.canvas).toBeVisible();
            const tier = await games.getTankTier();
            expect(tier).toBe('2');
            const coins = await games.getCoins();
            expect(coins).toBeGreaterThanOrEqual(1000);
        });

        test('should load full-grown-salt with all tools', async () => {
            await games.selectScenario('full-grown-salt');
            await expect(games.canvas).toBeVisible();
            const tier = await games.getTankTier();
            expect(tier).toBe('3');
            await games.openStore();
            await games.switchStoreTab('tools');
            // Salt has filter, skimmer, UV sterilizer — all should be owned at high level
            await expect(games.storeList).toContainText('Filter');
            await expect(games.storeList).toContainText('UV Sterilizer');
        });

        test('should render full-grown-fresh for 5s without errors', async () => {
            await games.selectScenario('full-grown-fresh');
            await games.page.waitForTimeout(5000);
            await expect(games.canvas).toBeVisible();
            await expect(games.coinDisplay).toBeVisible();
        });

        test('should render full-grown-tropical for 5s without errors', async () => {
            await games.selectScenario('full-grown-tropical');
            await games.page.waitForTimeout(5000);
            await expect(games.canvas).toBeVisible();
            await expect(games.coinDisplay).toBeVisible();
        });

        test('should render full-grown-salt for 5s without errors', async () => {
            await games.selectScenario('full-grown-salt');
            await games.page.waitForTimeout(5000);
            await expect(games.canvas).toBeVisible();
            await expect(games.coinDisplay).toBeVisible();
        });

        test('should show max-grown decor in full-grown-fresh inventory', async () => {
            await games.selectScenario('full-grown-fresh');
            await games.openInventory();
            const decorItems = games.inventoryList.locator('[data-sell-decor]');
            expect(await decorItems.count()).toBeGreaterThan(0);
            await expect(games.inventoryList).toContainText('Decoration');
        });

        test('should show store in full-grown scenario with owned fish', async () => {
            await games.selectScenario('full-grown-salt');
            await games.openStore();
            // Should show fish as purchasable or owned
            const items = games.storeList.locator('.s-item');
            expect(await items.count()).toBeGreaterThan(0);
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // ── FAB Animation State ──────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════

    test.describe('FAB Animation', () => {
        test('should add active class to FAB when menu opens', async () => {
            await games.openMenu();
            await expect(games.fab).toHaveClass(/active/);
        });

        test('should remove active class from FAB when menu closes', async () => {
            await games.openMenu();
            await expect(games.fab).toHaveClass(/active/);
            await games.closeMenu();
            await expect(games.fab).not.toHaveClass(/active/);
        });

        test('should have three fab-line spans for hamburger icon', async () => {
            const lines = games.fab.locator('.fab-line');
            expect(await lines.count()).toBe(3);
        });
    });
});
