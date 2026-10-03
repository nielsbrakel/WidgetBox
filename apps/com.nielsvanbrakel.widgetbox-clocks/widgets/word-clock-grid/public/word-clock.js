/**
 * Word clock grid data and time-to-words logic.
 * Loaded by index.html as a plain script and imported by the unit tests.
 * Exposes `globalThis.WordClockGrid`.
 */
(() => {
  // Each word is [row, firstColumn, lastColumn] in the 10x10 letter grid.
  const GRIDS = {
    en: {
      rows: [
        "ITLISHALFM",
        "TENQUARTER",
        "TWENTYFIVE",
        "PASTRTOONE",
        "TWOKTHREEL",
        "FOURZFIVEM",
        "SIXOSEVENU",
        "TWELVEIGHT",
        "TENXELEVEN",
        "NINEOCLOCK",
      ],
      words: {
        IT: [0, 0, 1],
        IS: [0, 3, 4],
        HALF: [0, 5, 8],
        TEN_MIN: [1, 0, 2],
        QUARTER: [1, 3, 9],
        TWENTY: [2, 0, 5],
        FIVE_MIN: [2, 6, 9],
        PAST: [3, 0, 3],
        TO: [3, 5, 6],
        ONE: [3, 7, 9],
        TWO: [4, 0, 2],
        THREE: [4, 4, 8],
        FOUR: [5, 0, 3],
        FIVE: [5, 5, 8],
        SIX: [6, 0, 2],
        SEVEN: [6, 4, 8],
        TWELVE: [7, 0, 5],
        EIGHT: [7, 5, 9],
        TEN: [8, 0, 2],
        ELEVEN: [8, 4, 9],
        NINE: [9, 0, 3],
        OCLOCK: [9, 4, 9],
      },
      hours: [
        "TWELVE",
        "ONE",
        "TWO",
        "THREE",
        "FOUR",
        "FIVE",
        "SIX",
        "SEVEN",
        "EIGHT",
        "NINE",
        "TEN",
        "ELEVEN",
      ],
      prefix: ["IT", "IS"],
      // Minute bucket -> [words before the hour, use next hour]
      phrases: {
        0: [["OCLOCK"], false],
        5: [["FIVE_MIN", "PAST"], false],
        10: [["TEN_MIN", "PAST"], false],
        15: [["QUARTER", "PAST"], false],
        20: [["TWENTY", "PAST"], false],
        25: [["TWENTY", "FIVE_MIN", "PAST"], false],
        30: [["HALF", "PAST"], false],
        35: [["TWENTY", "FIVE_MIN", "TO"], true],
        40: [["TWENTY", "TO"], true],
        45: [["QUARTER", "TO"], true],
        50: [["TEN_MIN", "TO"], true],
        55: [["FIVE_MIN", "TO"], true],
      },
    },
    nl: {
      rows: [
        "HETKISVIJF",
        "TIENAKWART",
        "VOOROVERHM",
        "HALFTWEEEN",
        "DRIEVIERMK",
        "VIJFZESRTU",
        "ZEVENACHTR",
        "NEGENTIENS",
        "ELFTWAALFD",
        "ONEDRIEUUR",
      ],
      words: {
        HET: [0, 0, 2],
        IS: [0, 4, 5],
        VIJF_MIN: [0, 6, 9],
        TIEN_MIN: [1, 0, 3],
        KWART: [1, 5, 9],
        VOOR: [2, 0, 3],
        OVER: [2, 4, 7],
        HALF: [3, 0, 3],
        TWEE: [3, 4, 7],
        EEN: [3, 7, 9],
        DRIE: [4, 0, 3],
        VIER: [4, 4, 7],
        VIJF: [5, 0, 3],
        ZES: [5, 4, 6],
        ZEVEN: [6, 0, 4],
        ACHT: [6, 5, 8],
        NEGEN: [7, 0, 4],
        TIEN: [7, 5, 8],
        ELF: [8, 0, 2],
        TWAALF: [8, 3, 8],
        UUR: [9, 7, 9],
      },
      hours: [
        "TWAALF",
        "EEN",
        "TWEE",
        "DRIE",
        "VIER",
        "VIJF",
        "ZES",
        "ZEVEN",
        "ACHT",
        "NEGEN",
        "TIEN",
        "ELF",
      ],
      prefix: ["HET", "IS"],
      phrases: {
        0: [["UUR"], false],
        5: [["VIJF_MIN", "OVER"], false],
        10: [["TIEN_MIN", "OVER"], false],
        15: [["KWART", "OVER"], false],
        20: [["TIEN_MIN", "VOOR", "HALF"], true],
        25: [["VIJF_MIN", "VOOR", "HALF"], true],
        30: [["HALF"], true],
        35: [["VIJF_MIN", "OVER", "HALF"], true],
        40: [["TIEN_MIN", "OVER", "HALF"], true],
        45: [["KWART", "VOOR"], true],
        50: [["TIEN_MIN", "VOOR"], true],
        55: [["VIJF_MIN", "VOOR"], true],
      },
    },
  };

  /**
   * Rounds to the nearest five minutes, so 10:58 reads "eleven o'clock".
   * Returns the hour (0-23) and minute bucket (0-55) that the words describe.
   */
  function roundToFiveMinutes(hours, minutes) {
    const rounded = Math.round(minutes / 5) * 5;
    if (rounded === 60) return { hours: (hours + 1) % 24, bucket: 0 };
    return { hours, bucket: rounded };
  }

  /** Returns the word ids to light up, in reading order. */
  function getActiveWords(lang, hours, minutes) {
    const grid = GRIDS[lang] ?? GRIDS.en;
    const time = roundToFiveMinutes(hours, minutes);
    const [words, useNextHour] = grid.phrases[time.bucket];
    const hourWord = grid.hours[(time.hours + (useNextHour ? 1 : 0)) % 12];
    if (time.bucket === 0) return [...grid.prefix, hourWord, ...words];
    return [...grid.prefix, ...words, hourWord];
  }

  /** Returns the set of cell indexes (row * 10 + column) covered by the words. */
  function getActiveCells(lang, wordIds) {
    const grid = GRIDS[lang] ?? GRIDS.en;
    const cells = new Set();
    for (const id of wordIds) {
      const [row, first, last] = grid.words[id];
      for (let column = first; column <= last; column++) cells.add(row * 10 + column);
    }
    return cells;
  }

  globalThis.WordClockGrid = { GRIDS, roundToFiveMinutes, getActiveWords, getActiveCells };
})();
