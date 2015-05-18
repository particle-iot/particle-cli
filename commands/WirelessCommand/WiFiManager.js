var os = require('os');
var scan = require('node-wifiscanner2').scan;
var connect = {
	'darwin': require('./connect/darwin')
};

function WiFiManager(opts) {

	if(opts) {
		// TODO: something fancy with the interfaces.
		// Some users will need to be able to customize this.
	}

	this.__cache = undefined;
};

WiFiManager.prototype.scan = function scan(opts, cb) {

	var self = this;
	scan(function results(err, dat) {

		if(err) { return cb(err); }
		if(dat.length) {

			self.__cache = dat;
			return cb(null, dat);
		}
		cb(null, [ ]);
	});
};

WiFiManager.prototype.connect = function(opts, cb) {

	var self = this;
	var ap;

	if(!opts) { var opts = { }; }
	if(!opts.mac && !opts.ssid) {

		cb(new Error('Must specify either ssid or mac of network with which to connect.'));
	}

	if(opts.mac) {

		if(!(ap = this.__lookupMAC(opts.mac))) { return this.scan(null, recheck); }
		opts.ssid = ap.ssid;
		return self.__connect(opts, cb);
	}

	self.__connect(opts, cb);

	function recheck(err, dat) {

		if(err) { return cb(new Error('Unknown MAC address and unable to perform a Wi-Fi scan.')); }
		if(!(ap = self.__lookupMAC(identifier))) {
			return cb(new Error('Unable to locate SSID matching provided MAC address.'));
		}
		opts.ssid = ap.ssid;
		return self.__connect(opts, cb);
	};
};


// actually connect via OS-dependent binary execution
WiFiManager.prototype.__connect = function(opts, cb) {

	var platform = os.platform();

	if(!connect[platform]) {

		return cb(new Error('Unsupported platform. Don\'t know how to scan Wi-Fi on ' + platform));
	}
	connect[platform](opts, cb);
};

WiFiManager.prototype.__lookupMAC = function(mac) {

	this.__cache.forEach(function check(ap) {

		if(ap.mac == mac) { return ap; }

	});
	return null;
};

module.exports = WiFiManager;
