const Homey = require("homey");

class WidgetBoxLayout extends Homey.App {
  async onInit() {
    this.log("Glance Layout has been initialized");
  }
}

module.exports = WidgetBoxLayout;
