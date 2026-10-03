import { expect } from "@playwright/test";
import { SandboxPage } from "./SandboxPage";

export class ClocksPage extends SandboxPage {
  get app() {
    return this.iframe.locator("#app");
  }

  // Analog
  get analogClock() {
    return this.iframe.locator("#clock-svg");
  }
  get analogTitle() {
    return this.iframe.locator("#clock-title");
  }
  get secondHand() {
    return this.iframe.locator("#second-hand");
  }
  get secondTip() {
    return this.iframe.locator("#second-tip");
  }
  get dateGroup() {
    return this.iframe.locator("#date-group");
  }

  // Digital
  get digitalTime() {
    return this.iframe.locator("#time");
  }
  get digitalSeconds() {
    return this.iframe.locator("#seconds");
  }
  get digitalPeriod() {
    return this.iframe.locator("#period");
  }
  get digitalDate() {
    return this.iframe.locator("#date");
  }

  // Flip
  get flipClock() {
    return this.iframe.locator("#flip-clock");
  }
  get flipSeconds() {
    return this.iframe.locator("#seconds-group");
  }
  get flipPeriod() {
    return this.iframe.locator(".card.period");
  }

  // Binary
  get binaryClock() {
    return this.iframe.locator("#clock");
  }
  get binaryGroups() {
    return this.iframe.locator(".time-group");
  }
  get binaryLabels() {
    return this.iframe.locator(".label");
  }
  get binaryPeriod() {
    return this.iframe.locator(".period");
  }

  // Word clocks
  get wordGrid() {
    return this.iframe.locator("#matrix");
  }
  get wordGridCells() {
    return this.iframe.locator("#matrix .cell");
  }
  get wordGridActiveCells() {
    return this.iframe.locator("#matrix .cell.active");
  }
  get wordSentence() {
    return this.iframe.locator("#time-text");
  }

  async verifyAnalogLoaded() {
    await expect(this.analogClock).toBeVisible();
    await expect(this.analogTitle).toHaveText(/\d{1,2}[:.]\d{2}/);
  }

  async verifyDigitalLoaded() {
    await expect(this.digitalTime).toBeVisible();
    await expect(this.digitalTime).toHaveText(/\d{2}:\d{2}/);
  }

  async verifyFlipLoaded() {
    await expect(this.flipClock).toBeVisible();
    await expect(this.flipClock.locator(".card")).toHaveCount(4);
  }
}
