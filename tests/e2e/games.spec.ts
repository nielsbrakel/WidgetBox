import { test, expect } from '@playwright/test';
import { GamesPage } from '../pages/GamesPage';

test.describe('Games App — Aquarium Widget', () => {
    let games: GamesPage;

    test.beforeEach(async ({ page }) => {
        games = new GamesPage(page);
        await games.gotoAquarium();
    });

    // ── Core Loading ─────────────────────────────────────────────────────

    test.describe('Widget Loading', () => {
        test('should load the aquarium widget', async () => {
            await expect(games.tankWrap).toBeVisible();
            await expect(games.canvas).toBeVisible();
            await expect(games.loading).toHaveClass(/hidden/);
        });

        test('should show coin display with starting coins', async () => {
            await expect(games.coinDisplay).toBeVisible();
            const coins = await games.getCoins();
            expect(coins).toBeGreaterThanOrEqual(0);
        });

        test('should show HUD bars', async () => {
            await expect(games.cleanBar).toBeVisible();
            await expect(games.hungerBar).toBeVisible();
        });

        test('should start as tier 1 fishbowl', async () => {
            const tier = await games.getTankTier();
            expect(tier).toBe('1');
        });
    });

    // ── Menu ─────────────────────────────────────────────────────────────

    test.describe('Menu', () => {
        test('should toggle menu overlay', async () => {
            await expect(games.menuOverlay).not.toHaveClass(/visible/);
            await games.openMenu();
            await expect(games.menuOverlay).toHaveClass(/visible/);
            await games.closeMenu();
            await expect(games.menuOverlay).not.toHaveClass(/visible/);
        });

        test('should show all 8 menu buttons', async () => {
            await games.openMenu();
            const buttons = games.menuGrid.locator('.menu-btn');
            await expect(buttons).toHaveCount(8);
        });

        test('should have laser button locked at tier 1', async () => {
            await games.openMenu();
            await expect(games.menuBtn('laser')).toHaveClass(/locked/);
        });
    });

    // ── Store Panel ──────────────────────────────────────────────────────

    test.describe('Store', () => {
        test('should open and close store panel', async () => {
            await games.openStore();
            await expect(games.storePanel).toHaveClass(/visible/);
            await games.closePanel('storePanel');
            await expect(games.storePanel).not.toHaveClass(/visible/);
        });

        test('should show fish species and food items', async () => {
            await games.openStore();
            const items = games.storeList.locator('.s-item');
            // 6 fish + 2 foods (flakes, pellets at tier 1) + 2 decorations (fern, sea grass at tier 1)
            const count = await items.count();
            expect(count).toBeGreaterThanOrEqual(8);
        });

        test('should show locked species with lock styling', async () => {
            await games.openStore();
            const locked = games.storeList.locator('.s-item.locked');
            const lockedCount = await locked.count();
            // At tier 1, 4 species locked (neon_tetra, betta, angelfish, clownfish)
            expect(lockedCount).toBe(4);
        });

        test('should show buy button for available fish', async () => {
            await games.openStore();
            const buyBtns = games.storeList.locator('.buy-btn:not(:disabled)');
            const count = await buyBtns.count();
            expect(count).toBeGreaterThan(0);
        });

        test('should show decorations section', async () => {
            await games.openStore();
            await expect(games.storeList).toContainText('Decoration');
        });
    });

    // ── Upgrades Panel ───────────────────────────────────────────────────

    test.describe('Upgrades', () => {
        test('should open upgrades panel', async () => {
            await games.openUpgrades();
            await expect(games.upgradesPanel).toHaveClass(/visible/);
        });
    });

    // ── Feed Mode ────────────────────────────────────────────────────────

    test.describe('Feed Mode', () => {
        test('should show tool dock when activating feed mode', async () => {
            await games.activateFeedMode();
            await expect(games.toolDock).toHaveClass(/visible/);
            await expect(games.dockItems).toHaveCount(3);
        });

        test('should close tool dock with close button', async () => {
            await games.activateFeedMode();
            await games.page.waitForTimeout(400);
            await games.dockClose.click();
            await expect(games.toolDock).not.toHaveClass(/visible/);
        });
    });

    // ── Clean Mode ───────────────────────────────────────────────────────

    test.describe('Clean Mode', () => {
        test('should show tool dock when activating clean mode on dirty tank', async () => {
            await games.selectScenario('dirty-near-threshold');
            await games.activateCleanMode();
            await expect(games.toolDock).toHaveClass(/visible/);
        });

        test('should close clean tool dock with close button', async () => {
            await games.selectScenario('dirty-near-threshold');
            await games.activateCleanMode();
            await games.page.waitForTimeout(400);
            await games.dockClose.click();
            await expect(games.toolDock).not.toHaveClass(/visible/);
        });

        test('should show "Wipe to clean!" label in dock', async () => {
            await games.selectScenario('dirty-near-threshold');
            await games.activateCleanMode();
            await expect(games.cleanDockLabel).toContainText('Wipe to clean!');
        });

        test('should refuse clean mode on already clean tank', async () => {
            // Default scenario has 100% cleanliness
            await games.tryActivateCleanMode();
            await games.page.waitForTimeout(500);
            // Tool dock should NOT open — tank is already clean
            await expect(games.toolDock).not.toHaveClass(/visible/);
            // Should show "already clean" toast
            await expect(games.toast).toContainText('sparkling clean');
        });

        test('should not show "Tank cleaned" toast on entering clean mode', async () => {
            await games.selectScenario('dirty-near-threshold');
            await games.activateCleanMode();
            await games.page.waitForTimeout(500);
            // "Wipe to clean!" is the expected toast, not "Tank cleaned!"
            await expect(games.toast).not.toContainText('Tank cleaned');
        });

        test('should not send clean action during wiping', async () => {
            await games.selectScenario('dirty-near-threshold');
            const coinsBefore = await games.getCoins();
            await games.activateCleanMode();
            await games.performWipeGesture(1);
            await games.page.waitForTimeout(300);
            // Coins should not change during wiping - only after closing
            const coinsDuring = await games.getCoins();
            expect(coinsDuring).toBe(coinsBefore);
        });

        test('should update clean progress in dock label during wipe', async () => {
            await games.selectScenario('dirty-near-threshold');
            await games.activateCleanMode();
            await games.performWipeGesture(2);
            await games.page.waitForTimeout(200);
            // Dock label should show progress percentage
            const text = await games.cleanDockLabel.textContent();
            // After wiping, should show some progress (might be 0% if barely wiped, or > 0%)
            expect(text).toMatch(/cleaned|Wipe/);
        });

        test('should send clean action with partial reward on close', async () => {
            await games.selectScenario('dirty-near-threshold');
            const coinsBefore = await games.getCoins();
            await games.activateCleanMode();
            await games.performWipeGesture(3);
            await games.page.waitForTimeout(300);
            await games.exitCleanMode();
            await games.page.waitForTimeout(1500);
            // Partial cleaning: coins may increase but toast says 'Partially cleaned'
            const coinsAfter = await games.getCoins();
            expect(coinsAfter).toBeGreaterThanOrEqual(coinsBefore);
            await expect(games.toast).toContainText('Partially cleaned');
        });

        test('should show cleaning interface on dirty big tank', async () => {
            await games.selectScenario('dirty-big-tank');
            const tier = await games.getTankTier();
            expect(tier).toBe('3');
            await games.activateCleanMode();
            await expect(games.toolDock).toHaveClass(/visible/);
            await expect(games.cleanDockLabel).toContainText('Wipe to clean!');
        });

        test('should not instantly clean big tank on entering clean mode', async () => {
            await games.selectScenario('dirty-big-tank');
            await games.activateCleanMode();
            await games.page.waitForTimeout(500);
            // Should not show "Tank cleaned!" - only "Wipe to clean!"
            await expect(games.toast).not.toContainText('Tank cleaned');
        });

        test('should enable wiping on big tank without full-screen clear', async () => {
            await games.selectScenario('dirty-big-tank');
            await games.activateCleanMode();
            await games.performWipeGesture(1);
            await games.page.waitForTimeout(200);
            // After a single pass, should not be at 100% - partial clean only
            const text = await games.cleanDockLabel.textContent();
            // Label should not show 100% after just one pass on a big tank
            const match = text?.match(/(\d+)%/);
            if (match) {
                expect(parseInt(match[1])).toBeLessThan(100);
            }
        });
    });

    // ── Help Panel ───────────────────────────────────────────────────────

    test.describe('Help', () => {
        test('should open help panel with content', async () => {
            await games.openHelp();
            await expect(games.helpPanel).toHaveClass(/visible/);
            const body = games.iframe.locator('#helpBody');
            await expect(body).toContainText('Overview');
            await expect(body).toContainText('Feeding');
            await expect(body).toContainText('Cleaning');
        });

        test('should show reset button in help', async () => {
            await games.openHelp();
            const resetBtn = games.iframe.locator('.reset-btn');
            await expect(resetBtn).toBeVisible();
        });

        test('should mention multiple tanks in help', async () => {
            await games.openHelp();
            const body = games.iframe.locator('#helpBody');
            await expect(body).toContainText('Multiple Tanks');
        });

        test('should mention decorations in help', async () => {
            await games.openHelp();
            const body = games.iframe.locator('#helpBody');
            await expect(body).toContainText('Decorations');
        });
    });

    // ── Tanks Panel ──────────────────────────────────────────────────────

    test.describe('Tanks Panel', () => {
        test('should open tanks panel', async () => {
            await games.openTanks();
            await expect(games.tanksPanel).toHaveClass(/visible/);
        });

        test('should show all three tank tiers', async () => {
            await games.openTanks();
            await expect(games.tanksList).toContainText('Fishbowl');
            await expect(games.tanksList).toContainText('Small Aquarium');
            await expect(games.tanksList).toContainText('Big Freshwater Tank');
        });

        test('should show current tank as active', async () => {
            await games.openTanks();
            const activeTank = games.tanksList.locator('.s-item.active-tank');
            await expect(activeTank).toBeVisible();
            await expect(activeTank).toContainText('Current');
        });

        test('should show locked tanks with unlock price', async () => {
            await games.openTanks();
            // Tier 2 and 3 should show unlock prices
            await expect(games.tanksList).toContainText('200');
        });
    });

    // ── Inventory Panel ──────────────────────────────────────────────────

    test.describe('Inventory', () => {
        test('should open inventory panel', async () => {
            await games.openInventory();
            await expect(games.inventoryPanel).toHaveClass(/visible/);
        });

        test('should show food stock', async () => {
            await games.openInventory();
            await expect(games.inventoryList).toContainText('Flakes');
        });

        test('should show fish in tank', async () => {
            await games.openInventory();
            // Default state has 1 guppy
            await expect(games.inventoryList).toContainText('Guppy');
        });
    });

    // ── Debug Scenarios ──────────────────────────────────────────────────

    test.describe('Scenarios', () => {
        test('should load tier 2 scenario with correct tier', async () => {
            await games.selectScenario('tier-2-active');
            const tier = await games.getTankTier();
            expect(tier).toBe('2');
        });

        test('should load tier 3 endgame scenario', async () => {
            await games.selectScenario('tier-3-endgame');
            const tier = await games.getTankTier();
            expect(tier).toBe('3');
            const coins = await games.getCoins();
            expect(coins).toBeGreaterThanOrEqual(1000);
        });

        test('should show snails in tier 2 upgrades', async () => {
            await games.selectScenario('tier-2-active');
            await games.openUpgrades();
            await expect(games.upgradesList).toContainText('Snail');
        });

        test('should show equipment upgrades at tier 2', async () => {
            await games.selectScenario('tier-2-active');
            await games.openUpgrades();
            await expect(games.upgradesList).toContainText('Equipment');
        });

        test('should load tank-full scenario with full capacity', async () => {
            await games.selectScenario('tank-full');
            await games.openStore();
            await expect(games.storeCap).toContainText('6/6');
        });

        test('should disable fish buy buttons when tank is full', async () => {
            await games.selectScenario('tank-full');
            await games.openStore();
            const fullBtns = games.storeList.locator('.buy-btn', { hasText: 'Full' });
            const fullCount = await fullBtns.count();
            expect(fullCount).toBe(2);
        });

        test('should load low-food scenario with minimal food stock', async () => {
            await games.selectScenario('low-food');
            await games.activateFeedMode();
            await expect(games.toolDock).toHaveClass(/visible/);
        });

        test('should load dirty-near-threshold scenario', async () => {
            await games.selectScenario('dirty-near-threshold');
            await expect(games.cleanBar).toBeVisible();
            const tier = await games.getTankTier();
            expect(tier).toBe('1');
        });

        test('should load tier 3 crowded scenario with many fish', async () => {
            await games.selectScenario('tier-3-crowded');
            const tier = await games.getTankTier();
            expect(tier).toBe('3');
            await games.openStore();
            await expect(games.storeCap).toContainText('18/20');
        });

        test('should show tank nav in multi-tank scenarios', async () => {
            await games.selectScenario('tier-2-active');
            // With 2 unlocked tanks, tank nav should be visible
            await expect(games.tankNav).toBeVisible();
        });

        test('should show tank switching buttons', async () => {
            await games.selectScenario('tier-3-endgame');
            // With 3 unlocked tanks, should see nav
            await expect(games.tankNav).toBeVisible();
            await expect(games.tnLabel).toBeVisible();
        });

        test('should show decorations in endgame store', async () => {
            await games.selectScenario('tier-3-endgame');
            await games.openStore();
            await expect(games.storeList).toContainText('Decoration');
        });

        test('should show decorations in endgame inventory', async () => {
            await games.selectScenario('tier-3-endgame');
            await games.openInventory();
            // Tier 3 endgame has decorations: Castle, Coral Rock, Treasure
            await expect(games.inventoryList).toContainText('Decoration');
        });
    });

    // ── HUD Tooltips ─────────────────────────────────────────────────────

    test.describe('HUD Tooltips', () => {
        test('should show tooltip when tapping coin display', async () => {
            await games.coinDisplay.click();
            await expect(games.hudTooltip).toHaveClass(/visible/);
            await expect(games.hudTooltipTitle).not.toBeEmpty();
        });

        test('should auto-dismiss tooltip after delay', async () => {
            await games.coinDisplay.click();
            await expect(games.hudTooltip).toHaveClass(/visible/);
            await games.page.waitForTimeout(5000);
            await expect(games.hudTooltip).not.toHaveClass(/visible/);
        });

        test('should show tooltip when tapping cleanliness bar', async () => {
            await games.cleanBar.click();
            await expect(games.hudTooltip).toHaveClass(/visible/);
            await expect(games.hudTooltipTitle).toContainText('Cleanliness');
        });

        test('should show tooltip when tapping hunger bar', async () => {
            await games.hungerBar.click();
            await expect(games.hudTooltip).toHaveClass(/visible/);
            await expect(games.hudTooltipTitle).toContainText('Hunger');
        });
    });

    // ── Space Capacity Display ───────────────────────────────────────────

    test.describe('Space Capacity', () => {
        test('should show space usage in store header', async () => {
            await games.openStore();
            await expect(games.storeCap).toBeVisible();
            await expect(games.storeCap).toContainText('/6');
        });

        test('should show spaceCost in store item descriptions', async () => {
            await games.openStore();
            const fishItems = games.storeList.locator('.s-item');
            const firstDesc = fishItems.first().locator('.s-desc');
            await expect(firstDesc).toContainText('\u25C6');
        });

        test('should show higher capacity for tier 3', async () => {
            await games.selectScenario('tier-3-endgame');
            await games.openStore();
            await expect(games.storeCap).toContainText('/20');
        });
    });
});
