/**
 * WidgetKit: small helpers every WidgetBox widget page needs (docs/decisions.md D-014).
 *
 * This file is the source. `pnpm kit:sync` copies it into `widgets/<id>/public/vendor/` of every
 * widget that loads `vendor/widget-kit.js`, so each Homey app stays self-contained. In a widget
 * page it defines the global `WidgetKit`; in Node (tests) it is a CommonJS module.
 */
((root, factory) => {
  const kit = factory();
  if (typeof module === "object" && module.exports) module.exports = kit;
  else root.WidgetKit = kit;
})(globalThis, () => {
  /**
   * Reports the widget's height to Homey: the first call is `Homey.ready({ height })`, later calls
   * use `Homey.setHeight()` and only when the height changed (so a ResizeObserver can call it
   * freely without feedback loops).
   */
  const createHeightReporter = (
    Homey,
    measure = () => document.body.getBoundingClientRect().height,
  ) => {
    let reported = null;
    return () => {
      const height = Math.ceil(measure());
      if (height === reported) return;
      if (reported === null) Homey.ready({ height });
      else Homey.setHeight(height);
      reported = height;
    };
  };

  /**
   * Runs `tick` now and then just after every `getInterval()` boundary of the wall clock (every
   * second, every minute), so a clock changes when the time does. Stops while the page is hidden
   * and ticks again as soon as it is shown. `getInterval` is read on every tick.
   */
  const createTicker = (tick, getInterval, { slackMs = 20 } = {}) => {
    let timer = null;
    const stop = () => {
      clearTimeout(timer);
      timer = null;
    };
    const run = () => {
      tick();
      const interval = getInterval();
      timer = setTimeout(run, interval - (Date.now() % interval) + slackMs);
    };
    const start = () => {
      stop();
      run();
    };
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stop();
      else start();
    });
    return { start, stop };
  };

  /**
   * Returns `t(key, fallback, tokens)` that reads `<namespace>.<key>` from the app's locales and
   * fills `{token}` placeholders. A missing translation gives `fallback`.
   */
  const createTranslator = (Homey, namespace = "") => {
    const prefix = namespace ? `${namespace}.` : "";
    return (key, fallback = "", tokens) => {
      const fullKey = `${prefix}${key}`;
      const value = Homey.__(fullKey);
      const text = !value || value === fullKey || value === key ? fallback : value;
      if (!tokens) return text;
      return text.replace(/\{(\w+)\}/g, (match, name) =>
        name in tokens ? String(tokens[name]) : match,
      );
    };
  };

  /** The width available for content: clientWidth minus horizontal padding. */
  const contentWidth = (element) => {
    const style = getComputedStyle(element);
    return element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  };

  return { contentWidth, createHeightReporter, createTicker, createTranslator };
});
