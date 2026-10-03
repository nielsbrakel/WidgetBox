const Homey = require("homey");
const { DAY_MS, pruneStaleStates } = require("./lib/widgetState");

class WidgetBoxClocks extends Homey.App {
  async onInit() {
    this.pruneWidgetStates();
    this.homey.setInterval(() => this.pruneWidgetStates(), DAY_MS);
    this.log("WidgetBox Clocks & Timers has been initialized");
  }

  pruneWidgetStates() {
    const removed = pruneStaleStates(this.homey);
    if (removed > 0) this.log(`Removed ${removed} stale stopwatch/timer state(s)`);
  }
}

module.exports = WidgetBoxClocks;
