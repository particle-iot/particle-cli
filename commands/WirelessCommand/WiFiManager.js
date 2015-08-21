var _ = require('lodash');
var os = require('os');
var scan = require('node-wifiscanner2').scan;
var connect = {
	'darwin': require('./connect/darwin')
};

function WiFiManager(opts) {
	if (opts) {
		// TODO: something fancy with the interfaces.
		// Some users will need to be able to customize this.
	}

	this.platform = os.platform();
	this.osConnect = connect[this.platform];
	this.supported = {
		getCurrentNetwork: !!(this.osConnect && this.osConnect.getCurrentNetwork),
		connect: !!(this.osConnect && this.osConnect.connect)
	};

	this.__cache = undefined;
};

WiFiManager.prototype.getCurrentNetwork = function(cb) {
	if (!this.supported.getCurrentNetwork) {
		// default to nothing
		return cb();
	}
	this.osConnect.getCurrentNetwork(cb);
};

WiFiManager.prototype.scan = function scan(opts, cb) {

	var self = this;
	scan(function results(err, dat) {

		if (err) { return cb(err); }
		if (dat.length) {

			self.__cache = dat;
			return cb(null, dat);
		}
		cb(null, [ ]);
	});
};

WiFiManager.prototype.connect = function(opts, cb) {

	var self = this;
	var ap;

	if (!opts) { var opts = { }; }
	if (!opts.mac && !opts.ssid) {

		cb(new Error('Must specify either ssid or mac of network with which to connect.'));
	}

	if (opts.mac) {

		if (!(ap = this.__lookupMAC(opts.mac))) { return this.scan(null, recheck); }
		opts.ssid = ap.ssid;
		return self.__connect(opts, cb);
	}

	self.__connect(opts, cb);

	function recheck(err, dat) {

		if (err) { return cb(new Error('Unknown MAC address and unable to perform a Wi-Fi scan.')); }
		if (!(ap = self.__lookupMAC(identifier))) {
			return cb(new Error('Unable to locate SSID matching provided MAC address.'));
		}
		opts.ssid = ap.ssid;
		return self.__connect(opts, cb);
	};
};


// actually connect via OS-dependent binary execution
WiFiManager.prototype.__connect = function(opts, cb) {
	if (!this.supported.connect) { 
		return cb(new Error('Unsupported platform. Don\'t know how to automatically connect to Wi-Fi on ' + this.platform));
	}
	this.osConnect.connect(opts, cb);
};

WiFiManager.prototype.__lookupMAC = function(mac) {
	return _.find(this.__cache, 'mac', mac);
};

module.exports = WiFiManager;
