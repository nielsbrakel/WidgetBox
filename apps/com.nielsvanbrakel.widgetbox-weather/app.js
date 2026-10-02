const Homey = require("homey");

class WidgetBoxWeather extends Homey.App {
  async onInit() {
    this.log("WidgetBox Weather has been initialized");
  }
}

module.exports = WidgetBoxWeather;
