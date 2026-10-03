const Homey = require("homey");
const { WeatherError, WeatherService } = require("./lib/WeatherService");
const { isBlank, parseCoordinate, parseLocation } = require("./lib/location");

class WidgetBoxWeather extends Homey.App {
  async onInit() {
    this.weather = new WeatherService();
    this.log("Glance Weather has been initialized");
  }

  /** The location configured on the Homey itself, or null when it is unknown. */
  getHomeyLocation() {
    try {
      const lat = parseCoordinate(this.homey.geolocation.getLatitude(), 90);
      const lon = parseCoordinate(this.homey.geolocation.getLongitude(), 180);
      if (lat === null || lon === null || (lat === 0 && lon === 0)) return null;
      return { lat, lon };
    } catch (error) {
      this.error("Could not read the Homey location", error);
      return null;
    }
  }

  /** Uses the widget's latitude/longitude settings, falling back to the Homey location. */
  resolveLocation(query = {}) {
    const location = parseLocation(query.latitude, query.longitude) ?? this.getHomeyLocation();
    if (!location) throw new WeatherError("LOCATION_REQUIRED");
    return location;
  }

  async getRainForecast(query) {
    return this.handle(() => this.weather.getRainForecast(this.resolveLocation(query)));
  }

  async getStation(query = {}) {
    return this.handle(() => {
      const stationId = isBlank(query.stationId) ? null : String(query.stationId).trim();
      const location = stationId ? null : this.resolveLocation(query);
      return this.weather.getStation({ location, stationId });
    });
  }

  async getForecast(query = {}) {
    return this.handle(() =>
      this.weather.getForecast(this.resolveLocation(query), Number(query.days)),
    );
  }

  /** Lets widgets that run in the browser (the weather map) use the Homey location. */
  async getLocation() {
    const location = this.getHomeyLocation();
    return location ? { latitude: location.lat, longitude: location.lon } : null;
  }

  /** Logs unexpected failures and passes a short error code on to the widget. */
  async handle(task) {
    try {
      return await task();
    } catch (error) {
      if (error instanceof WeatherError || error.code === "INVALID_LOCATION") {
        if (error.code === "UPSTREAM_UNAVAILABLE") this.error("Buienradar request failed", error);
        throw new Error(error.code);
      }
      this.error("Unexpected weather error", error);
      throw new Error("UNKNOWN");
    }
  }
}

module.exports = WidgetBoxWeather;
