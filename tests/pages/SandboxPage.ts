import { expect, type FrameLocator, type Locator, type Page } from "@playwright/test";

export class SandboxPage {
  readonly page: Page;
  readonly iframe: FrameLocator;

  constructor(page: Page) {
    this.page = page;
    this.iframe = page.frameLocator('iframe[title="Widget Sandbox"]');
  }

  async goto() {
    await this.page.goto("/");
  }

  async selectWidget(name: string) {
    await expect(this.page.locator(".sidebar")).toBeVisible();
    await this.page.locator(".widget-item").getByText(name, { exact: true }).click();
    await expect(this.page.locator(".preview-toolbar")).toContainText(name);
  }

  async setSettingCheckbox(label: string, checked: boolean) {
    const checkbox = this.settingControl(label, 'input[type="checkbox"]');
    await checkbox.setChecked(checked);
    await this.waitForSetting(checkbox, checked);
  }

  async setSettingInput(label: string | RegExp, value: string) {
    const input = this.settingControl(label, "input");
    await input.fill(value);
    await this.waitForSetting(input, value);
  }

  async setSettingSelect(
    label: string,
    optionLabelOrValue: string | { label?: string; value?: string; index?: number },
  ) {
    const select = this.settingControl(label, "select");
    // The debug scenario select reloads the widget instead of changing a setting.
    const id = await select.getAttribute("id");
    if (!id) await this.markWidget();
    await select.selectOption(optionLabelOrValue);
    if (id) await this.waitForSetting(select, await select.inputValue());
    else await this.waitForWidgetReload();
  }

  private settingControl(label: string | RegExp, selector: string) {
    return this.page.locator(".setting-group").filter({ hasText: label }).locator(selector);
  }

  /** Waits until the widget's Homey reports the control's new value (no fixed sleeps). */
  protected async waitForSetting(control: Locator, value: string | boolean) {
    const id = (await control.getAttribute("id"))?.replace(/^setting-/, "");
    if (!id) throw new Error("Setting control has no id");
    await expect
      .poll(() =>
        this.widgetHtml
          .evaluate((html, key) => {
            const win = html.ownerDocument.defaultView as SandboxWindow;
            return String(win.Homey?.getSettings()[key]);
          }, id)
          .catch(() => undefined),
      )
      .toBe(String(value));
  }

  /** Tags the current widget page so waitForWidgetReload() can tell the new one apart. */
  async markWidget() {
    await this.widgetHtml.evaluate((html) => {
      (html.ownerDocument.defaultView as SandboxWindow).__sandboxStale = true;
    });
  }

  /** Waits for a reloaded widget page that has called Homey.ready(). */
  async waitForWidgetReload() {
    await expect
      .poll(() =>
        this.widgetHtml
          .evaluate((html) => {
            const win = html.ownerDocument.defaultView as SandboxWindow;
            return !win.__sandboxStale && (win.Homey?.readyCount ?? 0) > 0;
          })
          .catch(() => false),
      )
      .toBe(true);
  }

  private get widgetHtml() {
    return this.iframe.locator("html");
  }
}

type SandboxWindow = Window & {
  __sandboxStale?: boolean;
  Homey?: { readyCount: number; getSettings(): Record<string, unknown> };
};
