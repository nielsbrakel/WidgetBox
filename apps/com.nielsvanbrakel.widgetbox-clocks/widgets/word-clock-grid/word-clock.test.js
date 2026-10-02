import { beforeAll, describe, expect, it } from "vitest";

let WordClockGrid;

beforeAll(async () => {
  await import("./public/word-clock.js");
  WordClockGrid = globalThis.WordClockGrid;
});

function spell(lang, wordIds) {
  const { rows } = WordClockGrid.GRIDS[lang];
  const cells = WordClockGrid.getActiveCells(lang, wordIds);
  return [...cells]
    .sort((a, b) => a - b)
    .map((cell) => rows[Math.floor(cell / 10)][cell % 10])
    .join("");
}

describe("word clock grid", () => {
  it.each(["en", "nl"])("has a 10x10 grid where every %s word spells its own name", (lang) => {
    const grid = WordClockGrid.GRIDS[lang];
    expect(grid.rows).toHaveLength(10);
    for (const row of grid.rows) expect(row).toHaveLength(10);
    for (const [id, [row, first, last]] of Object.entries(grid.words)) {
      const name = id.replace("_MIN", "");
      expect(grid.rows[row].slice(first, last + 1)).toBe(name);
    }
  });

  it.each(["en", "nl"])("describes every minute of the day in %s", (lang) => {
    for (let hours = 0; hours < 24; hours += 1) {
      for (let minutes = 0; minutes < 60; minutes += 1) {
        const words = WordClockGrid.getActiveWords(lang, hours, minutes);
        for (const id of words) expect(WordClockGrid.GRIDS[lang].words[id]).toBeDefined();
      }
    }
  });

  it("rounds to the nearest five minutes", () => {
    expect(WordClockGrid.getActiveWords("en", 10, 58)).toEqual(["IT", "IS", "ELEVEN", "OCLOCK"]);
    expect(WordClockGrid.getActiveWords("en", 23, 58)).toEqual(["IT", "IS", "TWELVE", "OCLOCK"]);
    expect(WordClockGrid.getActiveWords("en", 10, 2)).toEqual(["IT", "IS", "TEN", "OCLOCK"]);
  });

  it("builds English phrases", () => {
    expect(WordClockGrid.getActiveWords("en", 15, 25)).toEqual([
      "IT",
      "IS",
      "TWENTY",
      "FIVE_MIN",
      "PAST",
      "THREE",
    ]);
    expect(WordClockGrid.getActiveWords("en", 8, 45)).toEqual([
      "IT",
      "IS",
      "QUARTER",
      "TO",
      "NINE",
    ]);
    expect(WordClockGrid.getActiveWords("en", 0, 30)).toEqual([
      "IT",
      "IS",
      "HALF",
      "PAST",
      "TWELVE",
    ]);
  });

  it("builds Dutch phrases relative to the half hour", () => {
    expect(WordClockGrid.getActiveWords("nl", 14, 20)).toEqual([
      "HET",
      "IS",
      "TIEN_MIN",
      "VOOR",
      "HALF",
      "DRIE",
    ]);
    expect(WordClockGrid.getActiveWords("nl", 14, 30)).toEqual(["HET", "IS", "HALF", "DRIE"]);
    expect(WordClockGrid.getActiveWords("nl", 11, 35)).toEqual([
      "HET",
      "IS",
      "VIJF_MIN",
      "OVER",
      "HALF",
      "TWAALF",
    ]);
  });

  it("lights up exactly the letters of the words", () => {
    expect(spell("nl", WordClockGrid.getActiveWords("nl", 9, 0))).toBe("HETISNEGENUUR");
    expect(spell("en", WordClockGrid.getActiveWords("en", 21, 5))).toBe("ITISFIVEPASTNINE");
    expect(spell("en", WordClockGrid.getActiveWords("en", 20, 0))).toBe("ITISEIGHTOCLOCK");
  });

  it("falls back to English for unknown languages", () => {
    expect(WordClockGrid.getActiveWords("de", 9, 0)).toEqual(["IT", "IS", "NINE", "OCLOCK"]);
  });
});
