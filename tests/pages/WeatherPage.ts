import type { Page } from "@playwright/test";
import { SandboxPage } from "./SandboxPage";

const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

/** Sandbox page for the WidgetBox Weather widgets, with third-party content stubbed. */
export class WeatherPage extends SandboxPage {
  constructor(page: Page) {
    super(page);
  }

  async stubThirdParties({ radarImage = "ok" }: { radarImage?: "ok" | "fail" } = {}) {
    await this.page.route(/image\.buienradar\.nl/, (route) =>
      radarImage === "ok"
        ? route.fulfill({ contentType: "image/png", body: PIXEL_PNG })
        : route.fulfill({ status: 503 }),
    );
    await this.page.route(/cdn\.buienradar\.nl/, (route) =>
      route.fulfill({ contentType: "image/png", body: PIXEL_PNG }),
    );
    await this.page.route(/gadgets\.buienradar\.nl/, (route) =>
      route.fulfill({ contentType: "text/html", body: "<p>5-day gadget</p>" }),
    );
    await this.page.route(/windy\.com/, (route) =>
      route.fulfill({ contentType: "text/html", body: "<p>Windy</p>" }),
    );
  }

  async selectScenario(value: string) {
    await this.setSettingSelect("Debug Scenarios", { value });
  }

  async lastPopupUrl() {
    return this.page
      .locator('iframe[title="Widget Sandbox"]')
      .evaluate((iframe: HTMLIFrameElement) => {
        const homey = (iframe.contentWindow as unknown as { Homey: { lastPopupUrl?: string } })
          .Homey;
        return homey.lastPopupUrl;
      });
  }

  get embedIframe() {
    return this.iframe.locator('iframe[src^="https://embed.windy.com/embed.html"]');
  }

  async embedParams() {
    const src = await this.embedIframe.getAttribute("src");
    return new URL(src ?? "").searchParams;
  }
}
