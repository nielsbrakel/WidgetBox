// biome-ignore lint/suspicious/noRedundantUseStrict: Homey loads this as CommonJS
"use strict";

/*
 * Aquarium widget API. Saves live in the app settings, one per widget instance. Request
 * handling is shared with the sandbox (public/server.js) and all rules live in public/engine.js.
 */
const Server = require("./public/server.js");

module.exports = {
  async getState({ homey, query }) {
    return Server.getState(homey.settings, query, Date.now());
  },

  async doAction({ homey, query, body }) {
    return Server.doAction(homey.settings, query, body, Date.now());
  },
};
