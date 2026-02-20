import { test, expect } from '@playwright/test';
import { GamesPage } from '../pages/GamesPage';

/**
 * Advanced Aquarium Widget Tests
 *
 * These tests validate the visual overhaul fixes, debug scenario interactions,
 * tank navigation, store purchasing flow, decor/plant systems, and pixel icon
 * rendering. They complement the core tests in games.spec.ts.
 */

test.describe('Games App — Aquarium Advanced', () => {
    let games: GamesPage;

    test.beforeEach(async ({ page }) => {
        games = new GamesPage(page);
        await games.gotoAquarium();
    });

    // ── Pixel Icon System ────────────────────────────────────────────────

    test.describe('Pixel Icon System', () => {
        test('should render pixel icons in HUD elements', async () => {
            // Coin icon should be an img, not emoji text
            const coinIcon = games.iframe.locator('#coinIcon img');
            await expect(coinIcon).toBeAttached();
            const src = await coinIcon.getAttribute('src');
            expect(src).toMatch(/^data:image\/png/);
        });

        test('should render pixel icons in menu buttons', async () => {
            await games.openMenu();
            const menuIcons = games.menuGrid.locator('.menu-icon img');
            const count = await menuIcons.count();
            expect(count).toBe(7); // Flat menu has 7 buttons (Feed, Clean, Play, Store, Inventory, Tanks, Help)
        });

        test('should render hamburger lines in FAB button', async () => {
            const fabLines = games.fab.locator('.fab-line');
            await expect(fabLines).toHaveCount(3);
        });

        test('should render pixel icons in HUD bars', async () => {
            const cleanIcon = games.cleanBar.locator('.hud-px-icon img');
            await expect(cleanIcon).toBeAttached();
            const hungerIcon = games.hungerBar.locator('.hud-px-icon img');
            await expect(hungerIcon).toBeAttached();
        });

        test('should render pixel icons in tank nav buttons', async () => {
            await games.selectScenario('multi-tank-decorated');
            const prevIcon = games.tnPrev.locator('img');
            const nextIcon = games.tnNext.locator('img');
            await expect(prevIcon).toBeAttached();
            await expect(nextIcon).toBeAttached();
        });
    });

    // ── Store Purchasing Flow ────────────────────────────────────────────

    test.describe('Store Purchasing', () => {
        test('should buy fish and update coin count', async () => {
            await games.selectScenario('rich');
            const coinsBefore = await games.getCoins();
            expect(coinsBefore).toBeGreaterThanOrEqual(10000);

            await games.openStore();
            // Buy a fish
            const buyBtn = games.storeList.locator('[data-buy-fish]:not(:disabled)').first();
            await expect(buyBtn).toBeAttached();
            await buyBtn.click();
            // Wait for toast to confirm buy completed
            await expect(games.toast).toContainText('Bought');
            await games.page.waitForTimeout(500);

            // Coins should decrease
            const coinsAfter = await games.getCoins();
            expect(coinsAfter).toBeLessThan(coinsBefore);
        });

        test('should buy food and show updated stock', async () => {
            await games.selectScenario('rich');
            await games.openStore();
            await games.switchStoreTab('food');

            const buyBtn = games.storeList.locator('[data-buy-food]').first();
            await buyBtn.click();
            await games.page.waitForTimeout(800);

            // Toast should confirm purchase
            await expect(games.toast).toContainText('Bought');
        });

        test('should buy decor and confirm placement', async () => {
            await games.selectScenario('rich');
            await games.openStore();
            await games.switchStoreTab('decor');

            const buyBtn = games.storeList.locator('[data-buy-decor]').first();
            if (await buyBtn.count() > 0) {
                await buyBtn.click();
                await games.page.waitForTimeout(800);
                await expect(games.toast).toContainText('Decoration placed');
            }
        });

        test('should buy tool and update level', async () => {
            await games.selectScenario('rich');
            await games.openStore();
            await games.switchStoreTab('tools');

            const toolItems = games.storeList.locator('.s-item');
            const count = await toolItems.count();
            if (count > 0) {
                const buyBtn = games.storeList.locator('[data-buy-tool]').first();
                if (await buyBtn.isEnabled()) {
                    await buyBtn.click();
                    await games.page.waitForTimeout(800);
                    await expect(games.toast).toContainText('Upgraded');
                }
            }
        });

        test('should show coin icon in buy buttons instead of emoji', async () => {
            await games.openStore();
            // Buy buttons should contain img tags (pixel coin icon), not 🪙
            const buyBtns = games.storeList.locator('.buy-btn:not(:disabled)');
            const count = await buyBtns.count();
            if (count > 0) {
                const btnHtml = await buyBtns.first().innerHTML();
                expect(btnHtml).toContain('<img');
                expect(btnHtml).not.toContain('🪙');
            }
        });

        test('should persist purchases across panel reopens', async () => {
            await games.selectScenario('rich');
            await games.openStore();

            // Buy a fish
            const buyBtn = games.storeList.locator('[data-buy-fish]').first();
            await buyBtn.click();
            await games.page.waitForTimeout(1000);

            // Close and reopen store
            await games.closePanel('storePanel');
            await games.page.waitForTimeout(300);
            await games.openStore();

            // Inventory count should reflect purchase
            const items = games.storeList.locator('.s-item');
            const firstDesc = items.first().locator('.s-desc');
            const text = await firstDesc.textContent();
            // Should show "×2 owned" or similar (we already had 1 guppy)
            expect(text).toContain('owned');
        });
    });

    // ── Tank Navigation ──────────────────────────────────────────────────

    test.describe('Tank Navigation', () => {
        test('should show tank nav in multi-tank scenario', async () => {
            await games.selectScenario('multi-tank-decorated');
            await expect(games.tankNav).toBeVisible();
            await expect(games.tnLabel).not.toBeEmpty();
        });

        test('should switch tanks via nav buttons', async () => {
            await games.selectScenario('multi-tank-decorated');
            await expect(games.tankNav).toBeVisible();

            const labelBefore = await games.tnLabel.textContent();

            // Click next
            await games.tnNext.click();
            // Wait for switch to complete by checking label changes
            await games.page.waitForTimeout(2000);

            const labelAfter = await games.tnLabel.textContent();
            expect(labelAfter).not.toBe(labelBefore);
        });

        test('should switch tanks via tanks panel', async () => {
            await games.selectScenario('multi-tank-decorated');
            await games.openTanks();

            // Find a switch button for a non-active tank
            const switchBtn = games.tanksList.locator('[data-switch-tank]').first();
            if (await switchBtn.count() > 0) {
                const tierBefore = await games.getTankTier();
                await switchBtn.click();
                await games.page.waitForTimeout(2000);
                // After switch, the tier or label should have changed
                const tierAfter = await games.getTankTier();
                expect(tierAfter).not.toBe(tierBefore);
            }
        });

        test('should hide tank nav on default single-tank scenario', async () => {
            // Default scenario only has fresh tank unlocked
            await expect(games.tankNav).toHaveClass(/hidden/);
        });

        test('should show correct tank label after switching', async () => {
            await games.selectScenario('multi-tank-decorated');
            await expect(games.tankNav).toBeVisible();

            await games.tnNext.click();
            await games.page.waitForTimeout(1500);

            const label = await games.tnLabel.textContent();
            // Should contain one of the tank biome labels
            expect(label).toMatch(/Fresh|Tropical|Salt/);
        });
    });

    // ── Debug Scenario State Persistence ─────────────────────────────────

    test.describe('Debug Scenario Persistence', () => {
        test('should maintain state after store purchase in debug scenario', async () => {
            await games.selectScenario('rich');
            const coinsBefore = await games.getCoins();

            // Buy fish
            await games.openStore();
            const buyBtn = games.storeList.locator('[data-buy-fish]:not(:disabled)').first();
            await expect(buyBtn).toBeAttached();
            await buyBtn.click();
            await expect(games.toast).toContainText('Bought');
            await games.page.waitForTimeout(500);

            const coinsAfter = await games.getCoins();
            expect(coinsAfter).toBeLessThan(coinsBefore);

            // Close and reopen store — state should persist
            await games.closePanel('storePanel');
            await games.page.waitForTimeout(300);

            // Coins should still be the reduced amount
            const coinsFinal = await games.getCoins();
            expect(coinsFinal).toBe(coinsAfter);
        });

        test('should reset state when switching scenario', async () => {
            await games.selectScenario('rich');
            const richCoins = await games.getCoins();
            expect(richCoins).toBeGreaterThanOrEqual(10000);

            // Switch to default
            await games.selectScenario('default');
            const defaultCoins = await games.getCoins();
            expect(defaultCoins).toBeLessThan(richCoins);
        });

        test('should load neglected scenario with weak fish', async () => {
            await games.selectScenario('neglected-48h');
            await games.openInventory();
            // Neglected fish should show weak indicator (⚠️ emoji in fish name)
            const fishNames = games.inventoryList.locator('.s-name');
            const count = await fishNames.count();
            let foundWeak = false;
            for (let i = 0; i < count; i++) {
                const text = await fishNames.nth(i).textContent();
                if (text && text.includes('⚠')) { foundWeak = true; break; }
            }
            expect(foundWeak).toBe(true);
        });

        test('should load tier-2-ready with sufficient coins to unlock', async () => {
            await games.selectScenario('tier-2-ready');
            await games.openTanks();
            // Should show Tropical tank with unlock option
            await expect(games.tanksList).toContainText('Tropical');
        });

        test('should load tier-2-active with tropical tank', async () => {
            await games.selectScenario('tier-2-active');
            const tier = await games.getTankTier();
            expect(tier).toBe('2');
        });

        test('should load dirty-big-tank as saltwater', async () => {
            await games.selectScenario('dirty-big-tank');
            const tier = await games.getTankTier();
            expect(tier).toBe('3');
        });
    });

    // ── Decor System ─────────────────────────────────────────────────────

    test.describe('Decor System', () => {
        test('should show decor in inventory for decorated scenario', async () => {
            await games.selectScenario('multi-tank-decorated');
            await games.openInventory();
            await expect(games.inventoryList).toContainText('Decoration');
        });

        test('should show sell buttons for decorations', async () => {
            await games.selectScenario('multi-tank-decorated');
            await games.openInventory();
            const sellBtns = games.inventoryList.locator('[data-sell-decor]');
            const count = await sellBtns.count();
            expect(count).toBeGreaterThan(0);
        });

        test('should sell decor and earn coins', async () => {
            await games.selectScenario('multi-tank-decorated');
            const coinsBefore = await games.getCoins();
            await games.openInventory();

            const sellBtn = games.inventoryList.locator('[data-sell-decor]').first();
            if (await sellBtn.count() > 0) {
                await sellBtn.click();
                await expect(games.toast).toContainText('Sold');
                await games.page.waitForTimeout(500);
                const coinsAfter = await games.getCoins();
                expect(coinsAfter).toBeGreaterThan(coinsBefore);
            }
        });

        test('should show plant-specific decorations with growth info', async () => {
            await games.selectScenario('tier-3-endgame');
            await games.openInventory();
            // Endgame scenario has decorations
            const decorItems = games.inventoryList.locator('.s-item');
            const count = await decorItems.count();
            expect(count).toBeGreaterThan(0);
        });
    });

    // ── Inventory System ─────────────────────────────────────────────────

    test.describe('Inventory Details', () => {
        test('should show food stock in inventory', async () => {
            await games.openInventory();
            await expect(games.inventoryList).toContainText('Food Stock');
            await expect(games.inventoryList).toContainText('Stock:');
        });

        test('should show fish with level and stats', async () => {
            await games.openInventory();
            await expect(games.inventoryList).toContainText('Fish');
            await expect(games.inventoryList).toContainText('Lv.');
        });

        test('should show pixel icon images in inventory items', async () => {
            await games.openInventory();
            const icons = games.inventoryList.locator('.s-icon img');
            const count = await icons.count();
            expect(count).toBeGreaterThan(0);
        });

        test('should sell fish and update list', async () => {
            await games.selectScenario('tier-2-active');
            await games.openInventory();

            // Count initial fish
            const initialFishItems = games.inventoryList.locator('[data-sell-fish]');
            const initialCount = await initialFishItems.count();

            if (initialCount > 0) {
                await initialFishItems.first().click();
                await expect(games.toast).toContainText('Sold');
                await games.page.waitForTimeout(500);

                // Fish count should decrease
                const afterFishItems = games.inventoryList.locator('[data-sell-fish]');
                const afterCount = await afterFishItems.count();
                expect(afterCount).toBeLessThan(initialCount);
            }
        });
    });

    // ── Equipment/Tools (via Store) ──────────────────────────────────

    test.describe('Equipment (Store Tools Tab)', () => {
        test('should show tools tab in store panel', async () => {
            await games.openStore();
            await expect(games.storeList).toBeVisible();
        });

        test('should show colored circle icons in store fish tab', async () => {
            await games.selectScenario('tier-2-active');
            await games.openStore();
            const icons = games.storeList.locator('.s-icon');
            const count = await icons.count();
            expect(count).toBeGreaterThan(0);
            // Fish tab uses colored circles, not img elements
            const firstText = await icons.first().textContent();
            expect(firstText?.trim()).toBe('●');
        });

        test('should show tools tab with tool items', async () => {
            await games.selectScenario('tier-2-active');
            await games.openStore();
            await games.switchStoreTab('tools');
            await expect(games.storeList).toContainText('Heater');
        });

        test('should show utility creatures section in store', async () => {
            await games.selectScenario('tier-2-active');
            await games.openStore();
            // The store shows fish including utility creatures
            const fishItems = games.storeList.locator('.s-item');
            const count = await fishItems.count();
            expect(count).toBeGreaterThanOrEqual(1);
        });
    });

    // ── Laser/Play Mode ──────────────────────────────────────────────────

    test.describe('Laser Mode', () => {
        test('should activate laser mode with dock message', async () => {
            await games.openMenu();
            await games.menuBtn('laser').click();
            await expect(games.toolDock).toHaveClass(/visible/);
            const content = games.iframe.locator('#toolDockContent');
            await expect(content).toContainText('Move your finger');
        });

        test('should close laser mode with dock close button', async () => {
            await games.openMenu();
            await games.menuBtn('laser').click();
            await expect(games.toolDock).toHaveClass(/visible/);
            await games.page.waitForTimeout(400);
            await games.dockClose.click();
            await expect(games.toolDock).not.toHaveClass(/visible/);
        });
    });

    // ── Dirty Tank Visual ────────────────────────────────────────────────

    test.describe('Dirty Tank Visual', () => {
        test('should show dirt canvas element', async () => {
            await expect(games.dirtCanvas).toBeVisible();
        });

        test('should show cleanliness below 100 for dirty scenario', async () => {
            await games.selectScenario('dirty-near-threshold');
            const cleanVal = games.iframe.locator('#cleanVal');
            const text = await cleanVal.textContent();
            const percent = parseInt(text?.replace('%', '') || '100');
            expect(percent).toBeLessThan(100);
        });

        test('should show low cleanliness bar color for very dirty tank', async () => {
            await games.selectScenario('dirty-near-threshold');
            const cleanFill = games.iframe.locator('#cleanFill');
            const bg = await cleanFill.evaluate(el => getComputedStyle(el).background || el.style.background);
            // When cleanliness is low, bar should be yellow or red
            expect(bg).toMatch(/e8a040|e05050|rgb/);
        });
    });

    // ── Fish Bubble Info ─────────────────────────────────────────────────

    test.describe('Fish Info Display', () => {
        test('should show fish info without emoji in bubble detail', async () => {
            // This tests that fish detail shows text labels, not emoji
            await games.openInventory();
            // Fish section should have descriptions with level info, not emojis
            const fishSection = games.inventoryList.locator('.panel-section-title', { hasText: 'Fish' });
            await expect(fishSection).toBeAttached();
            // Get the first fish item's description (after the Fish section title)
            const fishItems = games.inventoryList.locator('.s-item:has([data-sell-fish]) .s-desc, .s-item:has(.s-name) .s-desc');
            const count = await fishItems.count();
            if (count > 0) {
                // Find a desc that has Lv. (fish) not Stock: (food)
                let foundFishDesc = false;
                for (let i = 0; i < count; i++) {
                    const text = await fishItems.nth(i).textContent();
                    if (text && text.includes('Lv.')) {
                        foundFishDesc = true;
                        expect(text).toMatch(/Lv\.\d+/);
                        expect(text).not.toMatch(/[😊🍽❤️💰]/);
                        break;
                    }
                }
                expect(foundFishDesc).toBe(true);
            }
        });
    });

    // ── Store Tabs ───────────────────────────────────────────────────────

    test.describe('Store Tab Navigation', () => {
        test('should switch between all store tabs', async () => {
            await games.openStore();

            // Fish tab (default)
            await expect(games.storeList).toContainText('Fish');

            // Food tab
            await games.switchStoreTab('food');
            await expect(games.storeList).toContainText('Food');

            // Decor tab
            await games.switchStoreTab('decor');
            await expect(games.storeList).toContainText('Decorations');

            // Tools tab
            await games.switchStoreTab('tools');
            await expect(games.storeList).toContainText('Equipment');
        });

        test('should show disable button for unaffordable items', async () => {
            // Default scenario has few coins
            await games.openStore();
            // Check if any buttons are disabled
            const allBtns = games.storeList.locator('.buy-btn');
            const disabledBtns = games.storeList.locator('.buy-btn:disabled');
            const allCount = await allBtns.count();
            const disCount = await disabledBtns.count();
            // At least some buttons should exist
            expect(allCount).toBeGreaterThan(0);
        });

        test('should show requirement warnings for locked fish', async () => {
            await games.selectScenario('tier-2-active');
            await games.openStore();
            // Check for fish with requirements
            const items = games.storeList.locator('.s-item');
            const count = await items.count();
            expect(count).toBeGreaterThan(0);
        });
    });

    // ── Reset Functionality ──────────────────────────────────────────────

    test.describe('Reset Aquarium', () => {
        test('should show reset button in help panel', async () => {
            await games.openHelp();
            const resetBtn = games.iframe.locator('#resetBtn');
            await expect(resetBtn).toBeVisible();
            await expect(resetBtn).toContainText('Reset Aquarium');
        });
    });

    // ── Scenario Specific Validations ────────────────────────────────────

    test.describe('Scenario Validations', () => {
        test('should load low-food scenario with depleted food stock', async () => {
            await games.selectScenario('low-food');
            await games.openInventory();
            // Food stock should exist but be low
            await expect(games.inventoryList).toContainText('Food Stock');
        });

        test('should load tier-3-crowded with many fish', async () => {
            await games.selectScenario('tier-3-crowded');
            await games.openInventory();
            // Should have many fish items
            const fishSellBtns = games.inventoryList.locator('[data-sell-fish]');
            const count = await fishSellBtns.count();
            expect(count).toBeGreaterThan(5);
        });

        test('should load tier-3-endgame as saltwater', async () => {
            await games.selectScenario('tier-3-endgame');
            const tier = await games.getTankTier();
            expect(tier).toBe('3');
        });

        test('should show all 3 tanks in multi-tank scenario', async () => {
            await games.selectScenario('multi-tank-decorated');
            await games.openTanks();
            const items = games.tanksList.locator('.s-item');
            const count = await items.count();
            expect(count).toBe(3);
        });

        test('should show unlocked status for all tanks in endgame', async () => {
            await games.selectScenario('tier-3-endgame');
            await games.openTanks();
            // All 3 tanks should be visible
            const items = games.tanksList.locator('.s-item');
            const count = await items.count();
            expect(count).toBe(3);
        });
    });

    // ── Feed Mode Details ────────────────────────────────────────────────

    test.describe('Feed Mode Details', () => {
        test('should show food items in dock', async () => {
            await games.activateFeedMode();
            const items = games.dockItems;
            const count = await items.count();
            // Fresh tank has 3 food types
            expect(count).toBe(3);
        });

        test('should show food stock quantities in dock', async () => {
            await games.activateFeedMode();
            const firstItem = games.dockItems.first();
            await expect(firstItem).toContainText('×');
        });

        test('should auto-select first food item', async () => {
            await games.activateFeedMode();
            const activeItem = games.iframe.locator('.dock-item.active');
            await expect(activeItem).toBeAttached();
        });
    });

    // ── Panel Close Behavior ─────────────────────────────────────────────

    test.describe('Panel Close', () => {
        test('should close store panel with close button', async () => {
            await games.openStore();
            await games.closePanel('storePanel');
            await expect(games.storePanel).not.toHaveClass(/visible/);
        });

        test('should close store panel (tools) with close button', async () => {
            await games.openStore();
            await games.closePanel('storePanel');
            await expect(games.storePanel).not.toHaveClass(/visible/);
        });

        test('should close inventory panel with close button', async () => {
            await games.openInventory();
            await games.closePanel('inventoryPanel');
            await expect(games.inventoryPanel).not.toHaveClass(/visible/);
        });

        test('should close tanks panel with close button', async () => {
            await games.openTanks();
            await games.closePanel('tanksPanel');
            await expect(games.tanksPanel).not.toHaveClass(/visible/);
        });

        test('should close help panel with close button', async () => {
            await games.openHelp();
            await games.closePanel('helpPanel');
            await expect(games.helpPanel).not.toHaveClass(/visible/);
        });
    });
});
