import { expect, test } from "@playwright/test";
import { AquariumPage } from "../pages/AquariumPage";

test.describe("Aquarium widget", () => {
  let aq: AquariumPage;

  test.beforeEach(async ({ page }) => {
    aq = new AquariumPage(page);
  });

  test("loads a fresh tank with the welcome card and the first lesson", async () => {
    await aq.open();
    await expect(aq.canvas).toBeVisible();
    await expect(aq.coins).toHaveText("40");
    await expect(aq.modal).toBeVisible();
    await aq.closeWelcome();
    await expect(aq.iframe.locator("#coach")).toBeVisible();
    await expect(aq.canvas).toHaveCSS("touch-action", "pan-y");
  });

  test("plays the tutorial with taps only", async () => {
    await aq.open();
    await aq.closeWelcome();

    await aq.tapThing("drop");
    await expect.poll(() => aq.state((g) => g.save.tut)).toBe(1);

    await aq.dock("feed").click();
    await expect(aq.tray).toBeVisible();
    const box = await aq.canvas.boundingBox();
    if (!box) throw new Error("no canvas");
    await aq.tapCanvas({ x: box.width * 0.4, y: box.height * 0.2 });
    await aq.tapCanvas({ x: box.width * 0.55, y: box.height * 0.2 });
    await expect.poll(() => aq.state((g) => g.save.tut), { timeout: 15000 }).toBe(2);

    // Chores stay tappable while the feeding tray is open.
    await aq.tapThing("algae");
    await expect.poll(() => aq.state((g) => g.save.tut)).toBe(3);

    await aq.dock("shop").click();
    await aq.ui("tab", "decor").click();
    await aq.ui("sel", "anubias").click();
    await aq.ui("action", "buyDecor:anubias").click();
    await expect(aq.sheet).toBeHidden();
    await aq.tapThing("slot", 4);
    await expect.poll(() => aq.state((g) => g.save.tanks.pond.decor[4]?.d)).toBe("anubias");

    await aq.dock("shop").click();
    await aq.ui("sel", "guppy").click();
    await aq.ui("action", "buyFish:guppy").click();
    await expect.poll(() => aq.state((g) => g.save.tanks.pond.fish.length)).toBe(3);
    await expect.poll(() => aq.state((g) => g.save.daily.goals.length)).toBe(3);
  });

  test("sends queued taps to the widget api", async () => {
    await aq.open();
    await aq.closeWelcome();
    await aq.tapThing("drop");
    await expect.poll(() => aq.state((g) => g.queue.length)).toBe(0);
    const stored = await aq
      .frame()
      .evaluate(() => JSON.parse(localStorage.getItem("aquarium2_sandbox") || "{}"));
    expect(stored.save.tut).toBe(1);
  });

  test("opens the fish card and asks twice before selling", async () => {
    await aq.open("pond-day2");
    await aq.closeWelcome();
    const before = await aq.state((g) => g.save.tanks.pond.fish.length);
    await expect
      .poll(async () => {
        await aq.tapThing("fish");
        return aq.card.isVisible();
      })
      .toBe(true);
    const sell = aq.card.locator('[data-ui="cardAction"][data-arg^="sellFish"]');
    await sell.click();
    await expect(sell).toHaveClass(/confirm/);
    expect(await aq.state((g) => g.save.tanks.pond.fish.length)).toBe(before);
    await sell.click();
    await expect.poll(() => aq.state((g) => g.save.tanks.pond.fish.length)).toBe(before - 1);
  });

  test("pages through every sheet without raw translation keys", async () => {
    await aq.open("rich");
    await aq.closeWelcome();
    const sheets: Array<[string, string[]]> = [
      ["shop", ["fish", "decor", "food", "upgrades"]],
      ["journal", ["goals", "dex", "trophies"]],
    ];
    for (const [name, tabs] of sheets) {
      await (name === "shop" ? aq.dock("shop") : aq.iframe.locator("#levelBtn")).click();
      for (const tab of tabs) {
        await aq.ui("tab", tab).click();
        await expect(aq.sheet).not.toContainText("widgets.aquarium");
        const next = aq.ui("page", "1");
        if ((await next.count()) && (await next.isEnabled())) {
          await next.click();
          await expect(aq.sheet).not.toContainText("widgets.aquarium");
        }
      }
      await aq.ui("close").click();
      await expect(aq.sheet).toBeHidden();
    }
    await aq.dock("menu").click();
    await aq.ui("go", "help").click();
    await expect(aq.sheet).toContainText("1/");
    await aq.ui("page", "1").click();
    await expect(aq.sheet).toContainText("2/");
  });

  test("travels between tanks", async () => {
    await aq.open("rich");
    await aq.closeWelcome();
    await aq.dock("menu").click();
    await aq.ui("go", "tanks").click();
    await aq.ui("action", "visit:reef").click();
    await expect.poll(() => aq.state((g) => g.save.active)).toBe("reef");
  });

  test("welcomes the player back after a long absence", async () => {
    await aq.open("neglected");
    await expect(aq.modal).toBeVisible();
    await expect(aq.modal).toContainText("3d");
    const coins = await aq.state((g) => g.save.coins);
    await aq.ui("collectAll").click();
    await expect(aq.modal).toBeHidden();
    await expect.poll(() => aq.state((g) => g.save.coins)).toBeGreaterThan(coins);
    await expect.poll(() => aq.state((g) => g.save.tanks.pond.algae.length)).toBeGreaterThan(3);
  });

  test("lets the moray eel leave and return to its cave", async () => {
    await aq.open("reef");
    await aq.closeWelcome();
    const eel = await aq.state((g) =>
      [...g.scene.agents.values()].some((a) => a.move === "eel" && a.home),
    );
    expect(eel).toBe(true);
    await aq.state((g) => {
      const a = [...g.scene.agents.values()].find((x) => x.move === "eel");
      a.timer = 0.01;
      a.peek = 1;
      return true;
    });
    await expect
      .poll(() => aq.state((g) => [...g.scene.agents.values()].find((a) => a.move === "eel").state))
      .not.toBe("home");
    await expect
      .poll(
        () => aq.state((g) => [...g.scene.agents.values()].find((a) => a.move === "eel").state),
        { timeout: 40000 },
      )
      .toBe("home");
  });
});
