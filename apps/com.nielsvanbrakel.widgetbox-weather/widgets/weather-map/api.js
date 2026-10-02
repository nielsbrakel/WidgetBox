module.exports = {
  async getLocation({ homey }) {
    return homey.app.getLocation();
  },
};
