import { expect } from "@playwright/test";
import { SandboxPage } from "./SandboxPage";

export class LayoutPage extends SandboxPage {
  get body() {
    return this.iframe.locator("body");
  }

  get header() {
    return this.iframe.locator("#header");
  }

  get line() {
    return this.iframe.locator("#line");
  }

  async toggleTheme() {
    await this.page.getByTitle("Toggle Theme").click();
  }

  async getWidgetHeight() {
    const container = this.page.locator(".device-frame > div").first();
    return container.evaluate((el: HTMLElement) => el.style.height);
  }

  // ── Spacer ──
  // Each verify*Loaded waits for something onHomeyReady does, so settings changed
  // afterwards reach the live mock.
  async verifySpacerLoaded() {
    await expect(this.iframe.locator("#spacer")).toBeAttached();
    await this.expectWidgetHeight("32px");
  }

  async expectWidgetHeight(height: string) {
    await expect
      .poll(() => this.getWidgetHeight(), { message: `widget height should be ${height}` })
      .toBe(height);
  }

  // ── Separator ──
  async verifySeparatorLoaded() {
    await expect(this.line).toBeVisible();
    await expect(this.line).not.toHaveCSS("border-top-style", "none");
  }

  async getSeparatorStyle() {
    return this.line.evaluate((el: HTMLElement) => {
      const style = getComputedStyle(el);
      return `${style.borderTopWidth} ${style.borderTopStyle} ${style.borderTopColor}`;
    });
  }

  async getSeparatorMargin() {
    return this.line.evaluate((el: HTMLElement) => el.style.margin);
  }

  // ── Header ──
  async verifyHeaderLoaded() {
    await expect(this.header).toBeVisible();
    await this.expectWidgetHeight("40px");
  }

  async getHeaderText() {
    return this.header.textContent();
  }

  async getHeaderStyle(prop: "fontSize" | "fontWeight" | "textAlign" | "color") {
    return this.header.evaluate(
      (el: HTMLElement, p) => getComputedStyle(el)[p as "fontSize"],
      prop,
    );
  }

  async isHeaderTruncated() {
    return this.header.evaluate((el: HTMLElement) => {
      const style = getComputedStyle(el);
      return (
        el.scrollWidth > el.clientWidth &&
        style.textOverflow === "ellipsis" &&
        style.whiteSpace === "nowrap"
      );
    });
  }
}
