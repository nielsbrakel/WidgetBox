import { expect } from '@playwright/test';
import { SandboxPage } from './SandboxPage';

export class UtilitiesPage extends SandboxPage {

    // Stopwatch
    get stopwatchItem() { return this.iframe.locator('.stopwatch-item'); }
    get timeDisplay() { return this.iframe.locator('.time-display'); }
    get btnPlay() { return this.iframe.locator('.btn-primary .icon-play'); }
    get btnPause() { return this.iframe.locator('.btn-primary .icon-pause'); }
    get btnReset() { return this.iframe.locator('.btn-secondary .icon-reset'); }
    get btnLap() { return this.iframe.locator('.icon-lap'); }
    get lapItem() { return this.iframe.locator('.lap-item'); }
    get btnAdd() { return this.iframe.locator('.btn-add'); }
    get btnClose() { return this.iframe.locator('.stopwatch-close, .timer-close').first(); }

    // Timer
    get timerItem() { return this.iframe.locator('.timer-item'); }
    get countdown() { return this.iframe.locator('.countdown'); }
    get picker() { return this.iframe.locator('.picker'); }

    async startStopwatch() {
        await this.btnPlay.click();
    }

    async pauseStopwatch() {
        await this.btnPause.click();
    }

    async resetStopwatch() {
        await this.btnReset.click();
    }

    async clickLap() {
        await this.btnLap.click({ force: true });
    }

    async setTimerDuration(seconds: number) {
        // Find specific value to click
        const valStr = seconds.toString();
        const valEl = this.iframe.locator('.picker-scroll[data-field="seconds"] .picker-val').filter({ hasText: new RegExp(`^${valStr}$`) });
        await expect(valEl).toHaveCount(1);
        await valEl.click({ force: true });
    }
}
