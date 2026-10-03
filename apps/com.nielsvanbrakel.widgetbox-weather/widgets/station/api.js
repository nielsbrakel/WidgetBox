module.exports = {
  async getData({ homey, query }) {
    return homey.app.getStation(query);
  },
};
