const Homey = require("homey");

class WidgetBoxClocks extends Homey.App {
  async onInit() {
    this.log("WidgetBox Clocks & Timers has been initialized");
  }
}

module.exports = WidgetBoxClocks;
