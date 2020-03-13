const os = require('os');
const _ = require('lodash');
const connect = {
	'darwin': require('./connect/darwin'),
	'linux': require('./connect/linux'),
	'win32': require('./connect/windows')
};


module.exports = class WiFiManager {
	constructor(opts) {
		if (opts) {
			// TODO: something fancy with the interfaces.
			// Some users will need to be able to customize this.
		}

		this.platform = os.platform();
		this.osConnect = connect[this.platform];
		// todo - allow the connector to actively check for preconditions, specific OS version support etc
		this.supported = {
			getCurrentNetwork: !!(this.osConnect && this.osConnect.getCurrentNetwork),
			connect: !!(this.osConnect && this.osConnect.connect)
		};

		this.__cache = undefined;
	}

	getCurrentNetwork(cb) {
		if (!this.supported.getCurrentNetwork) {
			// default to nothing
			// todo - why not raise an error?
			return cb();
		}
		this.osConnect.getCurrentNetwork(cb);
	}

	connect(opts, cb) {

		let self = this;
		let ap;

		if (!opts) {
			opts = {};
		}
		if (!opts.mac && !opts.ssid) {
			cb(new Error('Must specify either ssid or mac of network with which to connect.'));
		}

		if (opts.mac) {

			if (!(ap = this.__lookupMAC(opts.mac))) {
				return this.scan(null, recheck);
			}
			opts.ssid = ap.ssid;
			return self.__connect(opts, cb);
		}

		self.__connect(opts, cb);

		function recheck(err) {

			if (err) {
				return cb(new Error('Unknown MAC address and unable to perform a Wi-Fi scan.'));
			}
			if (!(ap = self.__lookupMAC(opts.mac))) {
				return cb(new Error('Unable to locate SSID matching provided MAC address.'));
			}
			opts.ssid = ap.ssid;
			return self.__connect(opts, cb);
		}
	}

	// actually connect via OS-dependent binary execution
	__connect(opts, cb) {
		if (!this.supported.connect) {
			return cb(new Error('Unsupported platform. Don\'t know how to automatically connect to Wi-Fi on ' + this.platform));
		}
		this.osConnect.connect(opts, cb);
	}

	__lookupMAC(mac) {
		return _.find(this.__cache, 'mac', mac);
	}
};

