import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadWidget } from "../../test/loadWidget.js";

describe("radar-5day widget", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function load(width = 300) {
    return loadWidget("radar-5day", {
      beforeReady(window) {
        Object.defineProperty(window.document.body, "clientWidth", { value: width });
      },
    });
  }

  it("scales the gadget to the width and calls ready with the height", () => {
    const { $, Homey } = load(256);
    expect(Homey.ready).toHaveBeenCalledWith({ height: 406 + 22 });
    expect($("iframe").style.transform).toBe("scale(1)");
  });

  it("caps the width so the gadget does not get blurry", () => {
    const { $, Homey } = load(720);
    expect($("#app").style.width).toBe("360px");
    expect(Homey.ready).toHaveBeenCalledWith({ height: Math.round(406 * (360 / 256)) + 22 });
  });

  it("sandboxes the iframe and reloads it periodically", async () => {
    const { $, document } = load();
    const first = $("iframe");
    expect(first.getAttribute("sandbox")).toBe("");
    expect(first.getAttribute("referrerpolicy")).toBe("strict-origin-when-cross-origin");
    first.dispatchEvent(new first.ownerDocument.defaultView.Event("load"));
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000);
    const frames = document.querySelectorAll("iframe");
    expect(frames).toHaveLength(2);
    frames[1].dispatchEvent(new first.ownerDocument.defaultView.Event("load"));
    expect(document.querySelectorAll("iframe")).toHaveLength(1);
  });

  it("opens Buienradar in a popup when tapped", () => {
    const { $, Homey } = load();
    $("#frame").click();
    expect(Homey.popup).toHaveBeenCalledWith("https://www.buienradar.nl");
  });
});
