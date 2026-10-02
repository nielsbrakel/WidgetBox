import { beforeAll, describe, expect, it } from "vitest";

let WordClockSentence;

beforeAll(async () => {
  await import("./public/word-clock.js");
  WordClockSentence = globalThis.WordClockSentence;
});

const text = (lang, hours, minutes) =>
  WordClockSentence.getSentence(lang, hours, minutes)
    .map((word) => word.text)
    .join(" ");

const highlighted = (lang, hours, minutes) =>
  WordClockSentence.getSentence(lang, hours, minutes)
    .filter((word) => word.highlight)
    .map((word) => word.text);

describe("word clock sentence", () => {
  it("writes English sentences", () => {
    expect(text("en", 9, 0)).toBe("It is nine o'clock");
    expect(text("en", 9, 25)).toBe("It is twenty-five past nine");
    expect(text("en", 9, 40)).toBe("It is twenty to ten");
    expect(text("en", 23, 45)).toBe("It is quarter to twelve");
  });

  it("writes Dutch sentences relative to the half hour", () => {
    expect(text("nl", 9, 0)).toBe("Het is negen uur");
    expect(text("nl", 9, 20)).toBe("Het is tien voor half tien");
    expect(text("nl", 9, 30)).toBe("Het is half tien");
    expect(text("nl", 9, 35)).toBe("Het is vijf over half tien");
    expect(text("nl", 12, 50)).toBe("Het is tien voor een");
  });

  it("rounds to the nearest five minutes, including across midnight", () => {
    expect(text("en", 10, 58)).toBe("It is eleven o'clock");
    expect(text("nl", 23, 58)).toBe("Het is twaalf uur");
    expect(text("en", 10, 2)).toBe("It is ten o'clock");
  });

  it("highlights the time words only", () => {
    expect(highlighted("en", 9, 15)).toEqual(["quarter", "nine"]);
    expect(highlighted("nl", 9, 40)).toEqual(["tien", "half", "tien"]);
  });

  it("has a sentence for every minute of the day", () => {
    for (const lang of ["en", "nl"]) {
      for (let minutes = 0; minutes < 24 * 60; minutes += 1) {
        const sentence = text(lang, Math.floor(minutes / 60), minutes % 60);
        expect(sentence).not.toMatch(/undefined|\{hour\}/);
      }
    }
  });
});
