'use strict';

const Homey = require('homey');

class WidgetBoxYouTube extends Homey.App {
    async onInit() {
        this.log('WidgetBox YouTube has been initialized');
    }
}

module.exports = WidgetBoxYouTube;
