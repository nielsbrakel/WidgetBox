'use strict';

const Homey = require('homey');

class WidgetBoxClocks extends Homey.App {
    async onInit() {
        this.log('WidgetBox Clocks has been initialized');
    }
}

module.exports = WidgetBoxClocks;
