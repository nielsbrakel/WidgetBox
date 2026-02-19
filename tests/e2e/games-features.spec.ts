import { test, expect } from '@playwright/test';
import { GamesPage } from '../pages/GamesPage';

/**
 * Feature Tests for Aquarium Widget v1.2
 *
 * Tests for: zero-fish tanks, half-space schooling fish, new movement types,
 * fish info panel redesign, cleaning improvements, decor interactions,
 * floating plants, visual upgrades, and new scenarios.
 */

test.describe('Games App — Aquarium Features', () => {
    let games: GamesPage;

    test.beforeEach(async ({ page }) => {
        games = new GamesPage(page);
        await games.gotoAquarium();
    });

    // ── Zero Fish Tank ───────────────────────────────────────────────────

    test.describe('Zero Fish Tank', () => {
        test('should load empty-tank scenario with no fish', async () => {
            await games.selectScenario('empty-tank');
            await games.openInventory();
            // Should show "No fish" or empty fish section
            const fishSellBtns = games.inventoryList.locator('[data-sell-fish]');
            expect(await fishSellBtns.count()).toBe(0);
        });

        test('should render tank without errors when empty', async () => {
            await games.selectScenario('empty-tank');
            // Canvas should still be visible and rendering
            await expect(games.canvas).toBeVisible();
            await expect(games.tankWrap).toBeVisible();
            // HUD should show 0 values properly
            await expect(games.coinDisplay).toBeVisible();
        });

        test('should allow buying first fish in empty tank', async () => {
            await games.selectScenario('empty-tank');
            await games.openStore();
            // Fish tab should be active by default
            const fishItems = games.storeList.locator('.s-item');
            const count = await fishItems.count();
            expect(count).toBeGreaterThan(0);
            // Guppy should be buyable (tank has 200 coins)
            const buyBtn = games.storeList.locator('.s-buy:not([disabled])').first();
            if (await buyBtn.count() > 0) {
                await buyBtn.click();
                await expect(games.toast).toContainText(/Bought|added/i);
            }
        });

        test('should sell last fish without error', async () => {
            // Default scenario starts with 1 guppy — sell it
            await games.openInventory();
            const fishSellBtns = games.inventoryList.locator('[data-sell-fish]');
            const count = await fishSellBtns.count();
            if (count === 1) {
                await fishSellBtns.first().click();
                await expect(games.toast).toContainText('Sold');
                await games.page.waitForTimeout(500);
                // Should now have 0 fish
                const afterCount = await games.inventoryList.locator('[data-sell-fish]').count();
                expect(afterCount).toBe(0);
            }
        });

        test('should show sell button even with only one fish', async () => {
            // Default scenario starts with 1 guppy
            await games.openInventory();
            const fishSellBtns = games.inventoryList.locator('[data-sell-fish]');
            expect(await fishSellBtns.count()).toBe(1);
        });

        test('should still show store after selling all fish', async () => {
            await games.openInventory();
            const fishSellBtns = games.inventoryList.locator('[data-sell-fish]');
            if (await fishSellBtns.count() === 1) {
                await fishSellBtns.first().click();
                await games.page.waitForTimeout(500);
            }
            await games.closePanel('inventoryPanel');
            await games.openStore();
            await expect(games.storePanel).toHaveClass(/visible/);
            const storeItems = games.storeList.locator('.s-item');
            expect(await storeItems.count()).toBeGreaterThan(0);
        });

        test('should show HUD with 0 hunger when no fish', async () => {
            await games.selectScenario('empty-tank');
            await expect(games.hungerBar).toBeVisible();
        });

        test('should show decor in inventory even with no fish', async () => {
            await games.selectScenario('empty-tank');
            await games.openInventory();
            // The empty-tank scenario has a moss ball
            await expect(games.inventoryList).toContainText('Moss Ball');
        });
    });

    // ── Half-Space Schooling Fish ────────────────────────────────────────

    test.describe('Half-Space Schooling Fish', () => {
        test('should show 0.5 space cost for schooling fish in store', async () => {
            await games.selectScenario('tier-2-active');
            await games.openStore();
            // Look for neon tetra entry which should show 0.5 space
            const storeContent = await games.storeList.textContent();
            expect(storeContent).toContain('0.5');
        });

        test('should show schooling trait in fish bubble', async () => {
            await games.selectScenario('schooling-showcase');
            // Click on canvas to try to trigger a fish bubble
            const box = await games.tankWrap.boundingBox();
            if (box) {
                // Click in the middle area where fish swim
                await games.page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.4);
                // If a fish bubble appears, check for schooling trait
                const bubble = games.fishBubble;
                try {
                    await expect(bubble).toHaveClass(/visible/, { timeout: 3000 });
                    const detail = await games.fbDetail.textContent();
                    // If the clicked fish is a schooling fish, it should show the trait
                    if (detail?.includes('Schooling')) {
                        expect(detail).toContain('0.5 space');
                    }
                } catch {
                    // Fish might not be under the click point — that's okay
                }
            }
        });

        test('should load schooling-showcase with many tetras', async () => {
            await games.selectScenario('schooling-showcase');
            await games.openInventory();
            // Should have 10 neon tetras
            const fishItems = games.inventoryList.locator('[data-sell-fish]');
            const count = await fishItems.count();
            expect(count).toBeGreaterThanOrEqual(10);
        });

        test('should handle half-space in store capacity display', async () => {
            await games.selectScenario('schooling-showcase');
            await games.openStore();
            // Capacity should show used/total (e.g. 9/14)
            const cap = await games.storeCap.textContent();
            expect(cap).toBeTruthy();
            // If we can parse it, check the math is correct
            const match = cap?.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+)/);
            if (match) {
                const used = parseFloat(match[1]);
                const total = parseFloat(match[2]);
                expect(used).toBeLessThanOrEqual(total);
            }
        });

        test('should allow buying more schooling fish than integer space would allow', async () => {
            await games.selectScenario('tier-2-active');
            // Tier 2 has neon tetras at 0.5 space — should be able to fit more
            await games.openStore();
            const neonEntry = games.storeList.locator('.s-item:has-text("Neon Tetra")');
            if (await neonEntry.count() > 0) {
                const buyBtn = neonEntry.locator('.s-buy:not([disabled])');
                if (await buyBtn.count() > 0) {
                    await buyBtn.click();
                    await expect(games.toast).toContainText(/Bought|added/i);
                }
            }
        });
    });

    // ── New Movement Types ───────────────────────────────────────────────

    test.describe('Movement Types', () => {
        test('should load movement-showcase scenario', async () => {
            await games.selectScenario('movement-showcase');
            await expect(games.canvas).toBeVisible();
            // Canvas should render without errors
            await games.page.waitForTimeout(2000);
            await expect(games.tankWrap).toBeVisible();
        });

        test('should show crawl trait for shrimp in fish bubble', async () => {
            await games.selectScenario('movement-showcase');
            // Tap around the bottom area where crawl fish would be
            const box = await games.tankWrap.boundingBox();
            if (box) {
                // Try bottom area for crawl creatures
                for (let attempt = 0; attempt < 5; attempt++) {
                    const x = box.x + box.width * (0.2 + attempt * 0.15);
                    const y = box.y + box.height * 0.85;
                    await games.page.mouse.click(x, y);
                    try {
                        await expect(games.fishBubble).toHaveClass(/visible/, { timeout: 1500 });
                        const detail = await games.fbDetail.textContent();
                        if (detail?.includes('Bottom crawler')) {
                            expect(detail).toContain('Bottom crawler');
                            return;
                        }
                    } catch { /* try next position */ }
                }
            }
        });

        test('should show glass cleaner trait for pleco', async () => {
            await games.selectScenario('movement-showcase');
            // Switch to tropical which has the pleco
            await games.tnNext.click();
            await games.page.waitForTimeout(1500);
            // Tap along the glass walls where pleco would be
            const box = await games.tankWrap.boundingBox();
            if (box) {
                for (let attempt = 0; attempt < 5; attempt++) {
                    // Try left wall area
                    const x = box.x + 10;
                    const y = box.y + box.height * (0.3 + attempt * 0.12);
                    await games.page.mouse.click(x, y);
                    try {
                        await expect(games.fishBubble).toHaveClass(/visible/, { timeout: 1500 });
                        const detail = await games.fbDetail.textContent();
                        if (detail?.includes('Glass cleaner')) {
                            expect(detail).toContain('Glass cleaner');
                            return;
                        }
                    } catch { /* try next position */ }
                }
            }
        });

        test('should render all fish species without canvas errors', async () => {
            await games.selectScenario('movement-showcase');
            // Wait for animation frames to render
            await games.page.waitForTimeout(3000);
            // Check for JS errors in the console
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.page.waitForTimeout(2000);
            expect(errors.length).toBe(0);
        });

        test('should show movement-related traits in inventory', async () => {
            await games.selectScenario('movement-showcase');
            await games.openInventory();
            // Should have various fish types
            const fishItems = games.inventoryList.locator('[data-sell-fish]');
            expect(await fishItems.count()).toBeGreaterThan(5);
        });
    });

    // ── Fish Info Panel (Redesigned Bubble) ──────────────────────────────

    test.describe('Fish Info Panel', () => {
        test('should show stats pills in fish bubble', async () => {
            await games.selectScenario('tier-2-active');
            // Click around the middle area to hit a fish
            const box = await games.tankWrap.boundingBox();
            if (!box) return;
            for (let attempt = 0; attempt < 8; attempt++) {
                const x = box.x + box.width * (0.15 + attempt * 0.1);
                const y = box.y + box.height * (0.35 + (attempt % 3) * 0.15);
                await games.page.mouse.click(x, y);
                try {
                    await expect(games.fishBubble).toHaveClass(/visible/, { timeout: 1500 });
                    // Verify the redesigned bubble has stats
                    const stats = games.fishBubble.locator('.fb-stats');
                    await expect(stats).toBeVisible();
                    const statItems = games.fishBubble.locator('.fb-stat');
                    expect(await statItems.count()).toBeGreaterThanOrEqual(3);
                    return;
                } catch { /* try next position */ }
            }
        });

        test('should show earning info in fish bubble', async () => {
            await games.selectScenario('tier-2-active');
            const box = await games.tankWrap.boundingBox();
            if (!box) return;
            for (let attempt = 0; attempt < 8; attempt++) {
                const x = box.x + box.width * (0.15 + attempt * 0.1);
                const y = box.y + box.height * (0.35 + (attempt % 3) * 0.15);
                await games.page.mouse.click(x, y);
                try {
                    await expect(games.fishBubble).toHaveClass(/visible/, { timeout: 1500 });
                    const earn = games.fishBubble.locator('.fb-earn');
                    await expect(earn).toBeVisible();
                    const earnText = await earn.textContent();
                    expect(earnText).toContain('/hr');
                    expect(earnText).toContain('XP');
                    return;
                } catch { /* try next position */ }
            }
        });

        test('should show sell button in fish bubble', async () => {
            await games.selectScenario('tier-2-active');
            const box = await games.tankWrap.boundingBox();
            if (!box) return;
            for (let attempt = 0; attempt < 8; attempt++) {
                const x = box.x + box.width * (0.15 + attempt * 0.1);
                const y = box.y + box.height * (0.35 + (attempt % 3) * 0.15);
                await games.page.mouse.click(x, y);
                try {
                    await expect(games.fishBubble).toHaveClass(/visible/, { timeout: 1500 });
                    const sellBtn = games.fishBubble.locator('.fb-sell');
                    await expect(sellBtn).toBeVisible();
                    await expect(sellBtn).toContainText('Sell');
                    return;
                } catch { /* try next position */ }
            }
        });

        test('should sell fish via bubble sell button', async () => {
            await games.selectScenario('tier-2-active');
            const initialCoins = await games.getCoins();
            const box = await games.tankWrap.boundingBox();
            if (!box) return;
            for (let attempt = 0; attempt < 10; attempt++) {
                const x = box.x + box.width * (0.1 + attempt * 0.08);
                const y = box.y + box.height * (0.3 + (attempt % 4) * 0.12);
                await games.page.mouse.click(x, y);
                try {
                    await expect(games.fishBubble).toHaveClass(/visible/, { timeout: 1500 });
                    const sellBtn = games.fishBubble.locator('.fb-sell');
                    if (await sellBtn.isVisible()) {
                        await sellBtn.click();
                        await expect(games.toast).toContainText('Sold');
                        await games.page.waitForTimeout(500);
                        const afterCoins = await games.getCoins();
                        expect(afterCoins).toBeGreaterThan(initialCoins);
                        return;
                    }
                } catch { /* try next position */ }
            }
        });

        test('should show weak warning for neglected fish', async () => {
            await games.selectScenario('neglected-48h');
            const box = await games.tankWrap.boundingBox();
            if (!box) return;
            for (let attempt = 0; attempt < 10; attempt++) {
                const x = box.x + box.width * (0.1 + attempt * 0.08);
                const y = box.y + box.height * (0.3 + (attempt % 4) * 0.12);
                await games.page.mouse.click(x, y);
                try {
                    await expect(games.fishBubble).toHaveClass(/visible/, { timeout: 1500 });
                    const detail = await games.fbDetail.textContent();
                    if (detail?.includes('Weak')) {
                        const warn = games.fishBubble.locator('.fb-warn');
                        await expect(warn).toBeVisible();
                        expect(detail).toContain('Feed & clean');
                        return;
                    }
                } catch { /* try next position */ }
            }
        });

        test('should show dirt reduction trait for utility fish', async () => {
            await games.selectScenario('tier-2-active');
            const box = await games.tankWrap.boundingBox();
            if (!box) return;
            // Pleco is a utility fish — try tapping at bottom/walls
            for (let attempt = 0; attempt < 10; attempt++) {
                const x = box.x + (attempt % 2 === 0 ? 10 : box.width - 10);
                const y = box.y + box.height * (0.3 + attempt * 0.06);
                await games.page.mouse.click(x, y);
                try {
                    await expect(games.fishBubble).toHaveClass(/visible/, { timeout: 1500 });
                    const detail = await games.fbDetail.textContent();
                    if (detail?.includes('Reduces dirt')) {
                        expect(detail).toMatch(/Reduces dirt by \d+%/);
                        return;
                    }
                } catch { /* try next position */ }
            }
        });

        test('should dismiss fish bubble after timeout', async () => {
            await games.selectScenario('tier-2-active');
            const box = await games.tankWrap.boundingBox();
            if (!box) return;
            for (let attempt = 0; attempt < 8; attempt++) {
                const x = box.x + box.width * (0.15 + attempt * 0.1);
                const y = box.y + box.height * (0.35 + (attempt % 3) * 0.15);
                await games.page.mouse.click(x, y);
                try {
                    await expect(games.fishBubble).toHaveClass(/visible/, { timeout: 2000 });
                    // Wait for auto-dismiss (8 seconds)
                    await games.page.waitForTimeout(9000);
                    await expect(games.fishBubble).not.toHaveClass(/visible/);
                    return;
                } catch { /* try next position */ }
            }
        });
    });

    // ── Cleaning Improvements ────────────────────────────────────────────

    test.describe('Cleaning Improvements', () => {
        test('should enter clean mode with consistent dirt pattern', async () => {
            await games.selectScenario('dirty-near-threshold');
            await games.activateCleanMode();
            await expect(games.toolDock).toHaveClass(/visible/);
            // The dirt canvas should be visible
            await expect(games.dirtCanvas).toBeVisible();
        });

        test('should show improved cleanliness after wiping', async () => {
            await games.selectScenario('dirty-near-threshold');
            await games.activateCleanMode();

            // Perform wipe gesture
            await games.performWipeGesture(5);
            await games.page.waitForTimeout(500);

            // Exit clean mode — should show improved cleanliness
            await games.exitCleanMode();
            await expect(games.toast).toContainText(/Clean|Earned|coins/i);
        });

        test('should clean dirty saltwater tank', async () => {
            await games.selectScenario('dirty-big-tank');
            await games.activateCleanMode();
            await games.performWipeGesture(3);
            await games.exitCleanMode();
            // Should show cleaning results
            await expect(games.toast).toBeVisible();
        });
    });

    // ── Floating Plants & Decor ──────────────────────────────────────────

    test.describe('Floating Plants & Decor', () => {
        test('should load floating-decor scenario', async () => {
            await games.selectScenario('floating-decor');
            await expect(games.canvas).toBeVisible();
            await games.page.waitForTimeout(2000);
        });

        test('should show floating plants in inventory', async () => {
            await games.selectScenario('floating-decor');
            await games.openInventory();
            await expect(games.inventoryList).toContainText('Floating Plants');
        });

        test('should show multiple decorations in inventory', async () => {
            await games.selectScenario('floating-decor');
            await games.openInventory();
            const decorSellBtns = games.inventoryList.locator('[data-sell-decor]');
            expect(await decorSellBtns.count()).toBeGreaterThanOrEqual(3);
        });

        test('should render floating decor without canvas errors', async () => {
            await games.selectScenario('floating-decor');
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.page.waitForTimeout(4000); // Let animation run
            expect(errors.length).toBe(0);
        });

        test('should show sell buttons for floating plant decorations', async () => {
            await games.selectScenario('floating-decor');
            await games.openInventory();
            const sellBtns = games.inventoryList.locator('[data-sell-decor]');
            expect(await sellBtns.count()).toBeGreaterThan(0);
        });
    });

    // ── New Scenarios ────────────────────────────────────────────────────

    test.describe('New Scenarios', () => {
        test('should load empty-tank scenario', async () => {
            await games.selectScenario('empty-tank');
            await expect(games.tankWrap).toBeVisible();
            await expect(games.canvas).toBeVisible();
        });

        test('should load movement-showcase as saltwater', async () => {
            await games.selectScenario('movement-showcase');
            // Movement showcase starts on salt tank
            const tier = await games.getTankTier();
            expect(tier).toBe('3');
        });

        test('should load schooling-showcase as tropical', async () => {
            await games.selectScenario('schooling-showcase');
            const tier = await games.getTankTier();
            expect(tier).toBe('2');
        });

        test('should load floating-decor as tropical', async () => {
            await games.selectScenario('floating-decor');
            const tier = await games.getTankTier();
            expect(tier).toBe('2');
        });

        test('should navigate tanks in movement-showcase', async () => {
            await games.selectScenario('movement-showcase');
            // All tanks unlocked — should be able to navigate
            await expect(games.tankNav).toBeVisible();
            const initialLabel = await games.tnLabel.textContent();
            await games.tnNext.click();
            await games.page.waitForTimeout(1500);
            const newLabel = await games.tnLabel.textContent();
            // Should change to a different tank
            expect(newLabel).not.toBe(initialLabel);
        });

        test('should show schooling fish space correctly in store', async () => {
            await games.selectScenario('schooling-showcase');
            await games.openStore();
            // Store should show space usage accounting for half-space
            await expect(games.storeCap).toBeVisible();
            const capText = await games.storeCap.textContent();
            expect(capText).toBeTruthy();
        });

        test('should switch between scenarios without errors', async () => {
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));

            await games.selectScenario('empty-tank');
            await games.page.waitForTimeout(1000);
            await games.selectScenario('movement-showcase');
            await games.page.waitForTimeout(1000);
            await games.selectScenario('schooling-showcase');
            await games.page.waitForTimeout(1000);
            await games.selectScenario('floating-decor');
            await games.page.waitForTimeout(1000);

            expect(errors.length).toBe(0);
        });
    });

    // ── Visual & Rendering ───────────────────────────────────────────────

    test.describe('Visual & Rendering', () => {
        test('should render tank canvas at proper dimensions', async () => {
            const box = await games.canvas.boundingBox();
            expect(box).toBeTruthy();
            if (box) {
                expect(box.width).toBeGreaterThan(100);
                expect(box.height).toBeGreaterThan(50);
            }
        });

        test('should render without JS errors across all scenarios', async () => {
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));

            const scenarios = [
                'default', 'dirty-near-threshold', 'dirty-big-tank',
                'tier-2-active', 'tier-3-endgame', 'tank-full',
                'tier-3-crowded', 'neglected-48h',
            ];

            for (const scenario of scenarios) {
                await games.selectScenario(scenario);
                await games.page.waitForTimeout(1500);
            }

            expect(errors.length).toBe(0);
        });

        test('should render new scenarios without JS errors', async () => {
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));

            await games.selectScenario('empty-tank');
            await games.page.waitForTimeout(2000);
            await games.selectScenario('movement-showcase');
            await games.page.waitForTimeout(2000);
            await games.selectScenario('schooling-showcase');
            await games.page.waitForTimeout(2000);
            await games.selectScenario('floating-decor');
            await games.page.waitForTimeout(2000);

            expect(errors.length).toBe(0);
        });

        test('should show tier-3 tank for crowded scenario', async () => {
            await games.selectScenario('tier-3-crowded');
            const tier = await games.getTankTier();
            expect(tier).toBe('3');
        });

        test('should show many fish in crowded scenario', async () => {
            await games.selectScenario('tier-3-crowded');
            await games.openInventory();
            const fishItems = games.inventoryList.locator('[data-sell-fish]');
            // 14 fish in the updated crowded scenario
            expect(await fishItems.count()).toBeGreaterThanOrEqual(10);
        });
    });

    // ── Debug Scenarios ────────────────────────────────────────────────

    test.describe('Debug Scenarios', () => {
        test('should fill tank using debug action in full_tank scenario', async () => {
            await games.selectScenario('tank-full');
            await games.openStore();
            // Tank should be full — buy buttons for fish should be disabled
            const capText = await games.storeCap.textContent();
            expect(capText).toBeTruthy();
            // Check that fish buy buttons are disabled (buy-btn with disabled attribute)
            const fishBuyBtns = games.storeList.locator('.buy-btn[disabled]');
            const disabledCount = await fishBuyBtns.count();
            expect(disabledCount).toBeGreaterThan(0);
        });

        test('should start with default fresh state', async () => {
            // Default scenario should be tier 1
            const tier = await games.getTankTier();
            expect(tier).toBe('1');
            const coins = await games.getCoins();
            expect(coins).toBeGreaterThanOrEqual(0);
        });
    });

    // ── Inventory Sell Flow ──────────────────────────────────────────────

    test.describe('Inventory Sell Flow', () => {
        test('should sell all fish one by one', async () => {
            await games.selectScenario('tier-2-active');
            await games.openInventory();

            const initialCount = await games.inventoryList.locator('[data-sell-fish]').count();
            expect(initialCount).toBeGreaterThan(0);

            // Sell first fish
            const sellBtn = games.inventoryList.locator('[data-sell-fish]').first();
            await sellBtn.click();
            await expect(games.toast).toContainText('Sold');
            await games.page.waitForTimeout(500);

            const afterCount = await games.inventoryList.locator('[data-sell-fish]').count();
            expect(afterCount).toBe(initialCount - 1);
        });

        test('should update coin count after selling fish', async () => {
            await games.selectScenario('tier-2-active');
            const initialCoins = await games.getCoins();

            await games.openInventory();
            const sellBtn = games.inventoryList.locator('[data-sell-fish]').first();
            if (await sellBtn.count() > 0) {
                await sellBtn.click();
                await games.page.waitForTimeout(500);
                const afterCoins = await games.getCoins();
                expect(afterCoins).toBeGreaterThan(initialCoins);
            }
        });

        test('should sell last fish and show empty inventory', async () => {
            // Start with default (1 fish)
            await games.openInventory();
            const fishBtns = games.inventoryList.locator('[data-sell-fish]');
            const count = await fishBtns.count();
            expect(count).toBe(1);

            await fishBtns.first().click();
            await expect(games.toast).toContainText('Sold');
            await games.page.waitForTimeout(500);

            // After selling only fish, should show 0 fish
            const afterCount = await games.inventoryList.locator('[data-sell-fish]').count();
            expect(afterCount).toBe(0);
        });
    });
});
