const Homey = require("homey");

class WidgetBoxVideo extends Homey.App {
  async onInit() {
    this.log("Glance Video has been initialized");
  }
}

module.exports = WidgetBoxVideo;
