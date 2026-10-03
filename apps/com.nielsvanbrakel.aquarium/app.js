const Homey = require("homey");

class PocketAquarium extends Homey.App {
  async onInit() {
    this.log("Pocket Aquarium has been initialized");
  }
}

module.exports = PocketAquarium;
