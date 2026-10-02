import { expect } from "@playwright/test";
import { SandboxPage } from "./SandboxPage";

const VIDEO_LABEL = /^YouTube video/;
const PLAYLIST_LABEL = /^YouTube playlist/;

export class VideoPage extends SandboxPage {
  get player() {
    return this.iframe.locator("#player iframe");
  }
  get facade() {
    return this.iframe.locator(".facade");
  }
  get thumbnail() {
    return this.iframe.locator(".facade img");
  }
  get message() {
    return this.iframe.locator(".message");
  }
  get messageTitle() {
    return this.iframe.locator(".message-title");
  }
  get messageText() {
    return this.iframe.locator(".message-text");
  }

  // Keep tests offline and deterministic: never load the real YouTube player.
  async goto() {
    await this.page.route(/youtube-nocookie\.com|ytimg\.com/, (route) => {
      const isImage = route.request().url().includes("ytimg.com");
      return route.fulfill({
        status: 200,
        contentType: isImage ? "image/svg+xml" : "text/html",
        body: isImage ? '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="3"/>' : "",
      });
    });
    await super.goto();
  }

  async open() {
    await this.goto();
    await this.selectWidget("Video");
    // The widget starts in its empty state; wait for it so settings reach the live mock.
    await expect(this.message).toBeVisible();
  }

  async setVideo(value: string) {
    await this.setSettingInput(VIDEO_LABEL, value);
  }

  // Hints mention other settings ("Autoplay", "Muted"), so match the checkbox by its exact name.
  async setSettingCheckbox(label: string, checked: boolean) {
    const checkbox = this.page.getByRole("checkbox", { name: label, exact: true });
    await checkbox.setChecked(checked);
    await expect(checkbox).toBeChecked({ checked });
    await this.page.waitForTimeout(500);
  }

  async setPlaylist(value: string) {
    await this.setSettingInput(PLAYLIST_LABEL, value);
  }

  async getEmbedUrl() {
    await expect(this.player).toBeAttached();
    const src = await this.player.getAttribute("src");
    return new URL(src ?? "");
  }

  async getCardAspectRatio() {
    const card = this.page.locator(".device-frame > div").first();
    // React writes aspect-ratio as "w / 1"; evaluate the fraction.
    return card.evaluate((el: HTMLElement) => {
      const [width, height = "1"] = el.style.aspectRatio.split("/");
      return Number(width) / Number(height);
    });
  }
}
