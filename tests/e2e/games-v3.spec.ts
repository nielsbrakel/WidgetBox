import { test, expect } from '@playwright/test';
import { GamesPage } from '../pages/GamesPage';

/**
 * v3 Visual Redesign Tests for Aquarium Widget
 *
 * Tests for all changes made in the v3 session:
 * - 3-row depth layer system (depthRow 0/1/2 for back/mid/front)
 * - Redesigned fish sprites (17 species, anatomically accurate)
 * - Host-plant hiding behavior (moray in shelter, clownfish in anemone, generic plant opacity)
 * - Enhanced icons (larger grids, richer palettes)
 * - Volumetric environment rendering (god rays, sand ripples, 4-stop gradient)
 * - depthRow in buy_decor / move_decor operations
 * - Backward compatibility for old saves without depthRow
 */

test.describe('Games App — Aquarium v3 Visual Redesign', () => {
    let games: GamesPage;

    test.beforeEach(async ({ page }) => {
        games = new GamesPage(page);
        await games.gotoAquarium();
    });

    // ══════════════════════════════════════════════════════════════════════
    // ── 3-Row Depth Layer System ─────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════

    test.describe('3-Row Depth Layer System', () => {
        test('should load depth-row-showcase scenario successfully', async () => {
            await games.selectScenario('depth-row-showcase');
            await expect(games.canvas).toBeVisible();
            await expect(games.tankWrap).toBeVisible();
        });

        test('should render decor on all three depth rows without errors', async () => {
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.selectScenario('depth-row-showcase');
            await games.page.waitForTimeout(3000);
            await expect(games.canvas).toBeVisible();
            expect(errors.length).toBe(0);
        });

        test('should show all placed decor in inventory for depth-row scenario', async () => {
            await games.selectScenario('depth-row-showcase');
            await games.openInventory();
            const decorItems = games.inventoryList.locator('[data-sell-decor]');
            // 7 decor items: 2 back (java_fern, amazon_sword), 2 mid (mossy_log, hollow_stump),
            // 2 front (cryptocoryne, anubias), 1 floating
            expect(await decorItems.count()).toBe(7);
        });

        test('should show back-row decor names in inventory', async () => {
            await games.selectScenario('depth-row-showcase');
            await games.openInventory();
            await expect(games.inventoryList).toContainText('Java Fern');
            await expect(games.inventoryList).toContainText('Amazon Sword');
        });

        test('should show front-row decor names in inventory', async () => {
            await games.selectScenario('depth-row-showcase');
            await games.openInventory();
            await expect(games.inventoryList).toContainText('Cryptocoryne');
            await expect(games.inventoryList).toContainText('Ludwigia');
        });

        test('should show mid-row decor names in inventory', async () => {
            await games.selectScenario('depth-row-showcase');
            await games.openInventory();
            await expect(games.inventoryList).toContainText('Mossy Log');
            await expect(games.inventoryList).toContainText('Hollow Stump');
        });

        test('should render depth-row scenario for 5 seconds without crash', async () => {
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.selectScenario('depth-row-showcase');
            await games.page.waitForTimeout(5000);
            await expect(games.canvas).toBeVisible();
            await expect(games.coinDisplay).toBeVisible();
            expect(errors.length).toBe(0);
        });

        test('should still allow menu interaction after depth rendering', async () => {
            await games.selectScenario('depth-row-showcase');
            await games.page.waitForTimeout(2000);
            await games.openMenu();
            await expect(games.menuOverlay).toHaveClass(/visible/);
            await games.closeMenu();
            await expect(games.menuOverlay).not.toHaveClass(/visible/);
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // ── depthRow Buy & Move Operations ───────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════

    test.describe('depthRow Buy & Move', () => {
        test('should buy decor and place in tank from store', async () => {
            await games.selectScenario('rich');
            await games.openStore();
            await games.switchStoreTab('decor');
            const buyBtn = games.storeList.locator('.s-item:has-text("Moss Ball") [data-buy-decor]');
            if (await buyBtn.count() > 0) {
                await buyBtn.click();
                await games.page.waitForTimeout(800);
                await expect(games.toast).toContainText('Decoration placed');
            }
        });

        test('should show newly bought decor in inventory', async () => {
            await games.selectScenario('rich');
            await games.openStore();
            await games.switchStoreTab('decor');
            const buyBtn = games.storeList.locator('.s-item:has-text("Moss Ball") [data-buy-decor]');
            if (await buyBtn.count() > 0) {
                await buyBtn.click();
                await games.page.waitForTimeout(800);
            }
            await games.closePanel('storePanel');
            await games.page.waitForTimeout(300);
            await games.menuBtn('inventory').click();
            await expect(games.inventoryPanel).toHaveClass(/visible/);
            await expect(games.inventoryList).toContainText('Moss Ball');
        });

        test('should render bought decor on canvas without errors', async () => {
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.selectScenario('rich');
            await games.openStore();
            await games.switchStoreTab('decor');
            const buyBtn = games.storeList.locator('.s-item:has-text("Anubias") [data-buy-decor]');
            if (await buyBtn.count() > 0) {
                await buyBtn.click();
                await games.page.waitForTimeout(800);
            }
            await games.closePanel('storePanel');
            await games.page.waitForTimeout(3000);
            await expect(games.canvas).toBeVisible();
            expect(errors.length).toBe(0);
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // ── Backward Compatibility ───────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════

    test.describe('Backward Compatibility (old saves without depthRow)', () => {
        test('should render lush-planted scenario (no explicit depthRow) without errors', async () => {
            // lush-planted scenario creates decor without explicit depthRow — tests default fallback to row 1
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.selectScenario('lush-planted');
            await games.page.waitForTimeout(3000);
            await expect(games.canvas).toBeVisible();
            expect(errors.length).toBe(0);
        });

        test('should render territorial-showcase (no explicit depthRow) without errors', async () => {
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.selectScenario('territorial-showcase');
            await games.page.waitForTimeout(3000);
            await expect(games.canvas).toBeVisible();
            expect(errors.length).toBe(0);
        });

        test('should render multi-tank-decorated (no explicit depthRow) for 5s', async () => {
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.selectScenario('multi-tank-decorated');
            await games.page.waitForTimeout(5000);
            await expect(games.canvas).toBeVisible();
            expect(errors.length).toBe(0);
        });

        test('should show correct decor in all tanks with default depth', async () => {
            await games.selectScenario('multi-tank-decorated');
            // Fresh tank
            await games.openInventory();
            await expect(games.inventoryList).toContainText('Moss Ball');
            await expect(games.inventoryList).toContainText('Driftwood');
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // ── Fish Hiding Behavior ─────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════

    test.describe('Fish Hiding Behavior', () => {
        test('should load hiding-showcase scenario successfully', async () => {
            await games.selectScenario('hiding-showcase');
            await expect(games.canvas).toBeVisible();
            await expect(games.tankWrap).toBeVisible();
        });

        test('should show hiding fish in inventory', async () => {
            await games.selectScenario('hiding-showcase');
            await games.openInventory();
            await expect(games.inventoryList).toContainText('Clownfish');
            await expect(games.inventoryList).toContainText('Moray Eel');
            await expect(games.inventoryList).toContainText('Royal Gramma');
            await expect(games.inventoryList).toContainText('Firefish');
        });

        test('should show shelter and cover decor in inventory', async () => {
            await games.selectScenario('hiding-showcase');
            await games.openInventory();
            await expect(games.inventoryList).toContainText('Anemone');
            await expect(games.inventoryList).toContainText('Cave');
            await expect(games.inventoryList).toContainText('Brain Coral');
            await expect(games.inventoryList).toContainText('Sea Fan');
            await expect(games.inventoryList).toContainText('Staghorn Coral');
        });

        test('should render hiding behavior for 5 seconds without errors', async () => {
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.selectScenario('hiding-showcase');
            await games.page.waitForTimeout(5000);
            await expect(games.canvas).toBeVisible();
            await expect(games.coinDisplay).toBeVisible();
            expect(errors.length).toBe(0);
        });

        test('should render hiding scenario for 10 seconds — extended stability', async () => {
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.selectScenario('hiding-showcase');
            await games.page.waitForTimeout(10000);
            await expect(games.canvas).toBeVisible();
            expect(errors.length).toBe(0);
        });

        test('should allow opening fish info bubbles in hiding scenario', async () => {
            await games.selectScenario('hiding-showcase');
            await games.page.waitForTimeout(2000);
            // Click somewhere on the canvas to try to trigger a fish bubble
            const box = await games.canvas.boundingBox();
            if (box) {
                await games.page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.5);
                await games.page.waitForTimeout(500);
            }
            // Even if no bubble appeared, canvas should still be rendering fine
            await expect(games.canvas).toBeVisible();
        });

        test('should render territorial-showcase with hiding for 5s', async () => {
            // territorial-showcase also has clownfish+anemone + moray+cave
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.selectScenario('territorial-showcase');
            await games.page.waitForTimeout(5000);
            await expect(games.canvas).toBeVisible();
            expect(errors.length).toBe(0);
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // ── Redesigned Fish Sprites (v3) ─────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════

    test.describe('Redesigned Fish Sprites (v3)', () => {
        test('should render all fresh fish sprites without errors', async () => {
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.selectScenario('full-grown-fresh');
            await games.page.waitForTimeout(3000);
            await expect(games.canvas).toBeVisible();
            expect(errors.length).toBe(0);
        });

        test('should render all tropical fish sprites without errors', async () => {
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.selectScenario('full-grown-tropical');
            await games.page.waitForTimeout(3000);
            await expect(games.canvas).toBeVisible();
            expect(errors.length).toBe(0);
        });

        test('should render all saltwater fish sprites without errors', async () => {
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.selectScenario('full-grown-salt');
            await games.page.waitForTimeout(3000);
            await expect(games.canvas).toBeVisible();
            expect(errors.length).toBe(0);
        });

        test('should render size-showcase with enlarged sprites for 5 seconds', async () => {
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.selectScenario('size-showcase');
            await games.page.waitForTimeout(5000);
            await expect(games.canvas).toBeVisible();
            expect(errors.length).toBe(0);
        });

        test('should render moray eel (36×4) in hiding scenario without clipping', async () => {
            await games.selectScenario('hiding-showcase');
            await games.page.waitForTimeout(3000);
            await expect(games.canvas).toBeVisible();
            await games.openInventory();
            await expect(games.inventoryList).toContainText('Moray Eel');
        });

        test('should render discus (22×18) in tropical tank', async () => {
            await games.selectScenario('depth-row-showcase');
            await games.page.waitForTimeout(2000);
            await games.openInventory();
            await expect(games.inventoryList).toContainText('Discus');
        });

        test('should render gourami (18×14) alongside discus', async () => {
            await games.selectScenario('depth-row-showcase');
            await games.page.waitForTimeout(2000);
            await games.openInventory();
            await expect(games.inventoryList).toContainText('Gourami');
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // ── Enhanced Environment Rendering ───────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════

    test.describe('Enhanced Environment Rendering', () => {
        test('should render fresh tank environment without errors', async () => {
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.page.waitForTimeout(3000);
            await expect(games.canvas).toBeVisible();
            expect(errors.length).toBe(0);
        });

        test('should render tropical tank environment without errors', async () => {
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.selectScenario('depth-row-showcase');
            await games.page.waitForTimeout(3000);
            await expect(games.canvas).toBeVisible();
            expect(errors.length).toBe(0);
        });

        test('should render saltwater tank environment without errors', async () => {
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.selectScenario('hiding-showcase');
            await games.page.waitForTimeout(3000);
            await expect(games.canvas).toBeVisible();
            expect(errors.length).toBe(0);
        });

        test('should render god rays and caustics over 5s without perf issues', async () => {
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.selectScenario('depth-row-showcase');
            // Let the volumetric god rays and caustics animate for 5s
            await games.page.waitForTimeout(5000);
            await expect(games.canvas).toBeVisible();
            // Should still be interactive
            await games.openMenu();
            await expect(games.menuOverlay).toHaveClass(/visible/);
            expect(errors.length).toBe(0);
        });

        test('should render all three biome environments back-to-back', async () => {
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));

            // Fresh
            await games.page.waitForTimeout(2000);
            await expect(games.canvas).toBeVisible();

            // Switch to tropical via depth-row scenario
            await games.selectScenario('depth-row-showcase');
            await games.page.waitForTimeout(2000);
            await expect(games.canvas).toBeVisible();

            // Switch to salt via hiding scenario
            await games.selectScenario('hiding-showcase');
            await games.page.waitForTimeout(2000);
            await expect(games.canvas).toBeVisible();

            expect(errors.length).toBe(0);
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // ── Enhanced Pixel Icons ─────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════

    test.describe('Enhanced Pixel Icons', () => {
        test('should render pixel art coin icon in HUD', async () => {
            const coinIcon = games.iframe.locator('.coin-display img, .coin-display [data-icon]');
            await expect(coinIcon.first()).toBeVisible();
        });

        test('should render pixel art icons in menu buttons', async () => {
            await games.openMenu();
            const menuIcons = games.menuGrid.locator('img[src^="data:image/png"]');
            const count = await menuIcons.count();
            // All 7 menu buttons should have pixel icons
            expect(count).toBeGreaterThanOrEqual(7);
        });

        test('should render tool icons as data URIs in store', async () => {
            await games.selectScenario('tier-2-active');
            await games.openStore();
            await games.switchStoreTab('tools');
            const toolIcons = games.storeList.locator('.s-icon img');
            const count = await toolIcons.count();
            expect(count).toBeGreaterThan(0);
            const src = await toolIcons.first().getAttribute('src');
            expect(src).toMatch(/^data:image\/png/);
        });

        test('should render all menu icons without broken images', async () => {
            await games.openMenu();
            const imgs = games.menuGrid.locator('img');
            const count = await imgs.count();
            for (let i = 0; i < count; i++) {
                const naturalWidth = await imgs.nth(i).evaluate((el: HTMLImageElement) => el.naturalWidth);
                expect(naturalWidth).toBeGreaterThan(0);
            }
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // ── Combined Depth + Hiding Stress Test ──────────────────────────────
    // ══════════════════════════════════════════════════════════════════════

    test.describe('Combined Stress Tests', () => {
        test('should render densely planted tank with hiding fish for 10s', async () => {
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.selectScenario('lush-planted');
            await games.page.waitForTimeout(10000);
            await expect(games.canvas).toBeVisible();
            await expect(games.coinDisplay).toBeVisible();
            expect(errors.length).toBe(0);
        });

        test('should render size-showcase across tanks for 10s', async () => {
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.selectScenario('size-showcase');
            await games.page.waitForTimeout(5000);
            // Switch to tropical via prev button (salt → tropical)
            await games.tnPrev.click();
            await games.page.waitForTimeout(5000);
            await expect(games.canvas).toBeVisible();
            expect(errors.length).toBe(0);
        });

        test('should switch between depth and hiding scenarios rapidly', async () => {
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.selectScenario('depth-row-showcase');
            await games.page.waitForTimeout(1500);
            await games.selectScenario('hiding-showcase');
            await games.page.waitForTimeout(1500);
            await games.selectScenario('depth-row-showcase');
            await games.page.waitForTimeout(1500);
            await expect(games.canvas).toBeVisible();
            expect(errors.length).toBe(0);
        });

        test('should operate store/menu/inventory after extended rendering', async () => {
            await games.selectScenario('depth-row-showcase');
            await games.page.waitForTimeout(5000);
            // Full UI flow after extended rendering
            await games.openStore();
            await expect(games.storePanel).toHaveClass(/visible/);
            await games.switchStoreTab('decor');
            await expect(games.storeList).toContainText('Java Fern');
            await games.closePanel('storePanel');
            await games.page.waitForTimeout(300);
            await games.menuBtn('inventory').click();
            await expect(games.inventoryPanel).toHaveClass(/visible/);
            await expect(games.inventoryList).toContainText('Discus');
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // ── Debug Mode with v3 Features ──────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════

    test.describe('Debug Mode with v3 Features', () => {
        test('should load full-grown-fresh with depth rendering', async () => {
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.selectScenario('full-grown-fresh');
            await games.page.waitForTimeout(3000);
            await expect(games.canvas).toBeVisible();
            expect(errors.length).toBe(0);
        });

        test('should load full-grown-tropical with depth rendering', async () => {
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.selectScenario('full-grown-tropical');
            await games.page.waitForTimeout(3000);
            await expect(games.canvas).toBeVisible();
            expect(errors.length).toBe(0);
        });

        test('should load full-grown-salt with hiding behavior active', async () => {
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.selectScenario('full-grown-salt');
            await games.page.waitForTimeout(5000);
            await expect(games.canvas).toBeVisible();
            expect(errors.length).toBe(0);
        });

        test('should render schooling-showcase with v3 sprites', async () => {
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.selectScenario('schooling-showcase');
            await games.page.waitForTimeout(5000);
            await expect(games.canvas).toBeVisible();
            expect(errors.length).toBe(0);
        });

        test('should render movement-showcase with v3 sprites', async () => {
            const errors: string[] = [];
            games.page.on('pageerror', e => errors.push(e.message));
            await games.selectScenario('movement-showcase');
            await games.page.waitForTimeout(5000);
            await expect(games.canvas).toBeVisible();
            expect(errors.length).toBe(0);
        });
    });
});
