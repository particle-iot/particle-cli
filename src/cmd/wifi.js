const WifiControlRequest = require('../lib/wifi-control-request');
const CLICommandBase = require('./base');
const spinnerMixin = require('../lib/spinner-mixin');

// add checks that if the device < 6.2.0, then use the old wifi command

module.exports = class WiFiCommands extends CLICommandBase {
    constructor() {
        super();
        spinnerMixin(this);
        this.wifiControlRequest = new WifiControlRequest(null, { ui: this.ui, newSpin: this.newSpin, stopSpin: this.stopSpin });
    }

    addNetwork(args) {
        this.wifiControlRequest.file = args.file;
        return this.wifiControlRequest.addNetwork();
    }

    joinNetwork(args) {
        this.wifiControlRequest.file = args.file;
        return this.wifiControlRequest.joinNetwork();
    }

    joinKnownNetwork(args) {
        this.wifiControlRequest.file = args.file;
        return this.wifiControlRequest.joinKnownNetwork({ ssid: args.ssid });
    }

    clearNetworks() {
        return this.wifiControlRequest.clearNetworks();
    }

    listNetworks() {
        return this.wifiControlRequest.listNetworks();
    }

    removeNetwork(ssid) {
        return this.wifiControlRequest.removeNetwork(ssid);
    }
}