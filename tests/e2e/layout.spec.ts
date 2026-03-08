import { test, expect } from '@playwright/test';
import { LayoutPage } from '../pages/LayoutPage';

test.describe('Layout App', () => {
    let layout: LayoutPage;

    test.beforeEach(async ({ page }) => {
        layout = new LayoutPage(page);
        await layout.goto();
    });

    // ── Divider ────────────────────────────────────────────
    test.describe('Divider', () => {
        test.beforeEach(async () => {
            await layout.selectWidget('Divider');
        });

        test('should load and become ready', async () => {
            await layout.verifyDividerLoaded();
        });

        test('should have default height of 32', async () => {
            await layout.verifyDividerLoaded();
            const height = await layout.getWidgetHeight();
            expect(height).toBe('32px');
        });

        test('should update height when setting changes', async () => {
            await layout.setSettingInput('Height (pixels)', '48');
            await layout.verifyDividerLoaded();
            const height = await layout.getWidgetHeight();
            expect(height).toBe('48px');
        });

        test('should handle height of 0', async () => {
            await layout.setSettingInput('Height (pixels)', '0');
            await layout.verifyDividerLoaded();
            const height = await layout.getWidgetHeight();
            expect(height).toBe('0px');
        });
    });

    // ── Separator ──────────────────────────────────────────
    test.describe('Separator', () => {
        test.beforeEach(async () => {
            await layout.selectWidget('Separator');
        });

        test('should load and become ready', async () => {
            await layout.verifySeparatorLoaded();
        });

        test('should render with default style', async () => {
            const style = await layout.getSeparatorStyle();
            expect(style).toContain('1px');
            expect(style).toContain('solid');
        });

        test('should update thickness', async () => {
            await layout.setSettingSelect('Thickness', '3');
            const style = await layout.getSeparatorStyle();
            expect(style).toContain('3px');
        });

        test('should update line style', async () => {
            await layout.setSettingSelect('Style', 'dashed');
            const style = await layout.getSeparatorStyle();
            expect(style).toContain('dashed');
        });

        test('should update color to blue', async () => {
            await layout.setSettingSelect('Color', 'blue');
            const style = await layout.getSeparatorStyle();
            expect(style).toContain('rgb(59, 130, 246)');
        });

        test('should update margin', async () => {
            await layout.setSettingInput('Side Margin', '32');
            const margin = await layout.getSeparatorMargin();
            expect(margin).toContain('32px');
        });
    });

    // ── Header ─────────────────────────────────────────────
    test.describe('Header', () => {
        test.beforeEach(async () => {
            await layout.selectWidget('Header');
        });

        test('should load and become ready', async () => {
            await layout.verifyHeaderLoaded();
        });

        test('should display default text "Section"', async () => {
            const text = await layout.getHeaderText();
            expect(text).toBe('Section');
        });

        test('should update text', async () => {
            await layout.setSettingInput('Text', 'Living Room');
            const text = await layout.getHeaderText();
            expect(text).toBe('Living Room');
        });

        test('should update alignment to center', async () => {
            await layout.setSettingSelect('Horizontal Alignment', 'center');
            const align = await layout.getHeaderStyle('textAlign');
            expect(align).toBe('center');
        });

        test('should update weight to normal', async () => {
            await layout.setSettingSelect('Font Weight', 'normal');
            const weight = await layout.getHeaderStyle('fontWeight');
            expect(weight).toBe('normal');
        });

        test('should update size to large', async () => {
            await layout.setSettingSelect('Size', 'large');
            const size = await layout.getHeaderStyle('fontSize');
            expect(size).toBe('24px');
        });

        test('should update color to red', async () => {
            await layout.setSettingSelect('Color', 'red');
            const color = await layout.getHeaderStyle('color');
            expect(color).toBe('rgb(239, 68, 68)');
        });

        test('should use default Homey color when set to Default', async () => {
            await layout.setSettingSelect('Color', 'default');
            const color = await layout.getHeaderStyle('color');
            expect(color).toBe('');
        });
    });
});
