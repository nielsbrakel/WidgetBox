import { expect } from '@playwright/test';
import { SandboxPage } from './SandboxPage';

export class ClocksPage extends SandboxPage {

    // Analog
    get widgetCard() { return this.iframe.locator('.widget-card'); }
    get analogClock() { return this.iframe.locator('#clock-svg'); }
    get secondHand() { return this.iframe.locator('.analog-second-hand, #second-hand-group'); }
    get dateGroup() { return this.iframe.locator('#date-group'); }

    // Digital
    get digitalTime() { return this.iframe.locator('.digital-time, #time'); }
    get digitalDate() { return this.iframe.locator('.digital-date, #date'); }

    // Flip
    get flipClock() { return this.iframe.locator('.flip-clock'); }
    get flipSeconds() { return this.iframe.locator('#seconds-group'); }
    get flipColons() { return this.iframe.locator('.colon'); }

    // Binary
    get binaryClock() { return this.iframe.locator('#clock'); }
    get binaryLabels() { return this.iframe.locator('.label'); }

    // Word
    get wordGrid() { return this.iframe.locator('.matrix'); }
    get wordSentence() { return this.iframe.locator('.time-text'); }
    get activeWords() { return this.iframe.locator('.word.active, .time-text span.active'); }

    async verifyAnalogLoaded() {
        await expect(this.analogClock).toBeVisible();
    }

    async verifyDigitalLoaded() {
        await expect(this.digitalTime).toBeVisible();
    }

    async verifyFlipLoaded() {
        await expect(this.flipClock).toBeVisible();
    }
}
