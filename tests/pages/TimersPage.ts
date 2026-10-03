import { expect, type Locator } from "@playwright/test";
import { SandboxPage } from "./SandboxPage";

/** Page object for the stopwatch and timer widgets of WidgetBox Clocks & Timers. */
export class TimersPage extends SandboxPage {
  get items() {
    return this.iframe.locator(".item");
  }
  get btnAdd() {
    return this.iframe.locator("button.add");
  }

  item(index = 0) {
    return this.items.nth(index);
  }
  time(index = 0) {
    return this.item(index).locator(".time");
  }
  countdown(index = 0) {
    return this.item(index).locator(".countdown");
  }
  action(name: string, index = 0) {
    return this.item(index).locator(`button[data-action="${name}"]`);
  }
  unitValue(field: "hours" | "minutes" | "seconds", index = 0) {
    return this.item(index).locator(`.unit-value[data-field="${field}"]`);
  }
  stepper(field: "hours" | "minutes" | "seconds", delta: 1 | -1, index = 0) {
    return this.item(index).locator(`button[data-field="${field}"][data-delta="${delta}"]`);
  }

  async press(locator: Locator, times = 1) {
    for (let i = 0; i < times; i++) await locator.click();
  }

  /** Sets an idle timer to the given duration with the stepper buttons. */
  async setTimerDuration({ minutes = 0, seconds = 0 }, index = 0) {
    const current = Number(await this.unitValue("minutes", index).innerText());
    await this.press(this.stepper("minutes", -1, index), current);
    await this.press(this.stepper("seconds", 1, index), seconds);
    await this.press(this.stepper("minutes", 1, index), minutes);
    await expect(this.unitValue("seconds", index)).toHaveText(String(seconds).padStart(2, "0"));
  }

  async reloadWidget() {
    await this.markWidget();
    await this.page.locator('button[title="Reload Widget"]').click();
    await this.waitForWidgetReload();
    await expect(this.items.first()).toBeVisible();
  }

  async setPreviewWidth(width: number) {
    await this.page.evaluate((w) => {
      const frame = document.querySelector('iframe[title="Widget Sandbox"]');
      if (frame?.parentElement) frame.parentElement.style.width = `${w}px`;
    }, width);
  }

  /** The state the widget stored through its /state API (kept in localStorage by MockHomey). */
  storedState(widget: "stopwatch" | "timer") {
    return this.page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? "null"),
      `mock_state_${widget}_mock-widget-id-12345`,
    );
  }

  async hasHorizontalOverflow() {
    return this.iframe
      .locator("body")
      .evaluate((body) => body.scrollWidth > document.documentElement.clientWidth);
  }
}
