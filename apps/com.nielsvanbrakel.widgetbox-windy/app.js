'use strict';

const Homey = require('homey');

class WidgetBoxWindy extends Homey.App {
    async onInit() {
        this.log('WidgetBox Windy has been initialized');
    }
}

module.exports = WidgetBoxWindy;
