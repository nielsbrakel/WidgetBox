module.exports = {
  async getData({ homey, query }) {
    return homey.app.getForecast(query);
  },
};
