import { expect, test } from "@playwright/test";
import { VideoPage } from "../pages/VideoPage";

const VIDEO_ID = "dQw4w9WgXcQ";
const PLAYLIST_ID = "PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf";

test.describe("Video App", () => {
  let video: VideoPage;

  test.beforeEach(async ({ page }) => {
    video = new VideoPage(page);
    await video.open();
  });

  test.describe("Empty and invalid states", () => {
    test("should show a friendly empty state instead of a YouTube error", async () => {
      await expect(video.messageTitle).toHaveText("No video yet");
      await expect(video.messageText).toContainText("widget settings");
      await expect(video.player).toHaveCount(0);
    });

    test("should explain when the input is not a YouTube link or ID", async () => {
      await video.setVideo("https://example.com/watch?v=dQw4w9WgXcQ");
      await expect(video.messageTitle).toHaveText("Link not recognized");
      await expect(video.player).toHaveCount(0);
    });

    test("should reject a random word", async () => {
      await video.setVideo("hello");
      await expect(video.messageTitle).toHaveText("Link not recognized");
    });
  });

  test.describe("Input parsing", () => {
    const cases: [string, string][] = [
      ["bare ID", VIDEO_ID],
      ["watch link", `https://www.youtube.com/watch?v=${VIDEO_ID}&feature=share`],
      ["mobile watch link", `m.youtube.com/watch?v=${VIDEO_ID}`],
      ["short link", `https://youtu.be/${VIDEO_ID}?si=abc`],
      ["shorts link", `https://www.youtube.com/shorts/${VIDEO_ID}`],
      ["live link", `https://www.youtube.com/live/${VIDEO_ID}?feature=shared`],
      ["embed link", `https://www.youtube-nocookie.com/embed/${VIDEO_ID}`],
    ];

    for (const [name, input] of cases) {
      test(`should extract the video ID from a ${name}`, async () => {
        await video.setVideo(input);
        const url = await video.getEmbedUrl();
        expect(url.origin).toBe("https://www.youtube-nocookie.com");
        expect(url.pathname).toBe(`/embed/${VIDEO_ID}`);
      });
    }

    test("should use the t= timestamp of a link as start time", async () => {
      await video.setVideo(`https://youtu.be/${VIDEO_ID}?t=1m30s`);
      const url = await video.getEmbedUrl();
      expect(url.searchParams.get("start")).toBe("90");
    });

    test("should prefer the Start At setting over the link timestamp", async () => {
      await video.setVideo(`https://youtu.be/${VIDEO_ID}?t=90`);
      await video.setSettingInput("Start at (seconds)", "30");
      const url = await video.getEmbedUrl();
      expect(url.searchParams.get("start")).toBe("30");
    });

    test("should play a playlist from a playlist link", async () => {
      await video.setPlaylist(`https://www.youtube.com/playlist?list=${PLAYLIST_ID}`);
      const url = await video.getEmbedUrl();
      expect(url.pathname).toBe("/embed/videoseries");
      expect(url.searchParams.get("list")).toBe(PLAYLIST_ID);
    });

    test("should accept a bare playlist ID", async () => {
      await video.setPlaylist(PLAYLIST_ID);
      const url = await video.getEmbedUrl();
      expect(url.pathname).toBe("/embed/videoseries");
    });

    test("should start a playlist at the video from a watch link with list", async () => {
      await video.setVideo(`https://www.youtube.com/watch?v=${VIDEO_ID}&list=${PLAYLIST_ID}`);
      const url = await video.getEmbedUrl();
      expect(url.pathname).toBe(`/embed/${VIDEO_ID}`);
      expect(url.searchParams.get("list")).toBe(PLAYLIST_ID);
    });
  });

  test.describe("Player parameters", () => {
    test.beforeEach(async () => {
      await video.setVideo(VIDEO_ID);
    });

    test("should autoplay muted by default", async () => {
      const url = await video.getEmbedUrl();
      expect(url.searchParams.get("autoplay")).toBe("1");
      expect(url.searchParams.get("mute")).toBe("1");
      expect(url.searchParams.get("playsinline")).toBe("1");
    });

    test("should set referrer policy, title and a minimal allow list", async () => {
      await expect(video.player).toHaveAttribute(
        "referrerpolicy",
        "strict-origin-when-cross-origin",
      );
      await expect(video.player).toHaveAttribute("title", "YouTube video player");
      await expect(video.player).toHaveAttribute(
        "allow",
        "autoplay; encrypted-media; picture-in-picture; fullscreen",
      );
    });

    test("should hide controls by default and show them when enabled", async () => {
      expect((await video.getEmbedUrl()).searchParams.get("controls")).toBe("0");
      await video.setSettingCheckbox("Show controls", true);
      expect((await video.getEmbedUrl()).searchParams.has("controls")).toBe(false);
    });

    test("should loop a single video by passing it as its own playlist", async () => {
      await video.setSettingCheckbox("Loop", true);
      const url = await video.getEmbedUrl();
      expect(url.searchParams.get("loop")).toBe("1");
      expect(url.searchParams.get("playlist")).toBe(VIDEO_ID);
    });

    test("should loop a playlist without overriding it", async () => {
      await video.setPlaylist(PLAYLIST_ID);
      await video.setSettingCheckbox("Loop", true);
      const url = await video.getEmbedUrl();
      expect(url.searchParams.get("list")).toBe(PLAYLIST_ID);
      expect(url.searchParams.has("playlist")).toBe(false);
    });

    test("should update start time", async () => {
      await video.setSettingInput("Start at (seconds)", "30");
      expect((await video.getEmbedUrl()).searchParams.get("start")).toBe("30");
    });

    test("should resize the widget to the aspect ratio", async () => {
      await expect.poll(() => video.getCardAspectRatio()).toBeCloseTo(16 / 9, 2);
      await video.setSettingSelect("Aspect ratio", "4:3");
      await expect.poll(() => video.getCardAspectRatio()).toBeCloseTo(4 / 3, 2);
      await video.setSettingSelect("Aspect ratio", "9:16");
      await expect.poll(() => video.getCardAspectRatio()).toBeCloseTo(9 / 16, 2);
    });

    test("should not reload the player when only the aspect ratio changes", async () => {
      await video.player.evaluate((el) => el.setAttribute("data-marker", "first"));
      await video.setSettingSelect("Aspect ratio", "1:1");
      await expect(video.player).toHaveAttribute("data-marker", "first");
    });
  });

  test.describe("Tap to play (autoplay off)", () => {
    test.beforeEach(async () => {
      await video.setVideo(VIDEO_ID);
      await video.setSettingCheckbox("Autoplay", false);
    });

    test("should show a thumbnail with a play button instead of loading the player", async () => {
      await expect(video.facade).toBeVisible();
      await expect(video.facade).toHaveAttribute("aria-label", "Play video");
      await expect(video.thumbnail).toHaveAttribute(
        "src",
        `https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`,
      );
      await expect(video.player).toHaveCount(0);
    });

    test("should load and autoplay the player with sound after a tap", async () => {
      await video.facade.click();
      const url = await video.getEmbedUrl();
      expect(url.searchParams.get("autoplay")).toBe("1");
      expect(url.searchParams.has("mute")).toBe(false);
    });

    test("should respect Muted after a tap", async () => {
      await video.setSettingCheckbox("Muted", true);
      await video.facade.click();
      expect((await video.getEmbedUrl()).searchParams.get("mute")).toBe("1");
    });

    test("should have a touch-sized play target", async () => {
      const box = await video.facade.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    });
  });
});

test.describe("Video App — iOS", () => {
  let video: VideoPage;

  test.beforeEach(async ({ page }) => {
    video = new VideoPage(page);
    await video.open();
    await video.setVideo(VIDEO_ID);
    await video.setSettingSelect("Debug Scenarios", { value: "ios" });
  });

  test("should show a translated unsupported notice and no player", async () => {
    await expect(video.messageTitle).toHaveText("Video is not available on iPhone and iPad");
    await expect(video.messageText).toContainText("Android and in the web dashboard");
    await expect(video.player).toHaveCount(0);
  });
});
