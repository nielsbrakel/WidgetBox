/**
 * Time-to-sentence logic for the word clock.
 * Loaded by index.html as a plain script and imported by the unit tests.
 * Exposes `globalThis.WordClockSentence`.
 */
(() => {
  // In a phrase, "*" marks a highlighted word and "{hour}" is replaced by the hour name.
  const LANGUAGES = {
    en: {
      prefix: "It is",
      hours: [
        "twelve",
        "one",
        "two",
        "three",
        "four",
        "five",
        "six",
        "seven",
        "eight",
        "nine",
        "ten",
        "eleven",
      ],
      // Minute bucket -> [phrase, use next hour]
      phrases: {
        0: ["*{hour} o'clock", false],
        5: ["*five past *{hour}", false],
        10: ["*ten past *{hour}", false],
        15: ["*quarter past *{hour}", false],
        20: ["*twenty past *{hour}", false],
        25: ["*twenty-five past *{hour}", false],
        30: ["*half past *{hour}", false],
        35: ["*twenty-five to *{hour}", true],
        40: ["*twenty to *{hour}", true],
        45: ["*quarter to *{hour}", true],
        50: ["*ten to *{hour}", true],
        55: ["*five to *{hour}", true],
      },
    },
    nl: {
      prefix: "Het is",
      hours: [
        "twaalf",
        "een",
        "twee",
        "drie",
        "vier",
        "vijf",
        "zes",
        "zeven",
        "acht",
        "negen",
        "tien",
        "elf",
      ],
      phrases: {
        0: ["*{hour} uur", false],
        5: ["*vijf over *{hour}", false],
        10: ["*tien over *{hour}", false],
        15: ["*kwart over *{hour}", false],
        20: ["*tien voor *half *{hour}", true],
        25: ["*vijf voor *half *{hour}", true],
        30: ["*half *{hour}", true],
        35: ["*vijf over *half *{hour}", true],
        40: ["*tien over *half *{hour}", true],
        45: ["*kwart voor *{hour}", true],
        50: ["*tien voor *{hour}", true],
        55: ["*vijf voor *{hour}", true],
      },
    },
  };

  /**
   * Rounds to the nearest five minutes, so 10:58 reads "eleven o'clock".
   * Returns the hour (0-23) and minute bucket (0-55) that the sentence describes.
   */
  function roundToFiveMinutes(hours, minutes) {
    const rounded = Math.round(minutes / 5) * 5;
    if (rounded === 60) return { hours: (hours + 1) % 24, bucket: 0 };
    return { hours, bucket: rounded };
  }

  /** Returns the sentence as a list of words: [{ text, highlight }]. */
  function getSentence(lang, hours, minutes) {
    const language = LANGUAGES[lang] ?? LANGUAGES.en;
    const time = roundToFiveMinutes(hours, minutes);
    const [phrase, useNextHour] = language.phrases[time.bucket];
    const hourName = language.hours[(time.hours + (useNextHour ? 1 : 0)) % 12];
    const words = phrase.replace("{hour}", hourName).split(" ");
    return [
      { text: language.prefix, highlight: false },
      ...words.map((word) =>
        word.startsWith("*")
          ? { text: word.slice(1), highlight: true }
          : { text: word, highlight: false },
      ),
    ];
  }

  globalThis.WordClockSentence = { LANGUAGES, roundToFiveMinutes, getSentence };
})();
