
var WiFiManager = require('./WiFiManager');
var prompt = require('inquirer').prompt;
var os = require('os');
var scan = require('node-wifiscanner2').scan;


function TestWiFi() {
	this.mgr = new WiFiManager();
	this._next = null;
	this.wirelessSetupFilter = /^Photon-.*$/;
}

TestWiFi.prototype.setNext = function(fn) {
	this._next = fn;
};

TestWiFi.prototype.next = function() {
	var fn = this._next;
	this._next = null;
	if (fn) {
		fn();
	}
};

TestWiFi.prototype.run = function() {
	if (this.mgr.osConnect) {
		console.log('Using Wi-Fi connector for the current platform '+os.platform());
		this.setNext(this.selectNetwork.bind(this));
		this.mgr.getCurrentNetwork(this.handleCurrentNetwork.bind(this));
	}
	else {
		console.error('No Wi-Fi connector for the current platform '+os.platform());
	}
};

TestWiFi.prototype.handleCurrentNetwork = function(err, network) {
	var self = this;
	if (err) {
		console.err('Unable to get current network:', err);
	} else {
		console.log('Current network detected as', network);
		prompt([{
			type: 'confirm',
			message: 'Is that correct?',
			default: true,
			name: 'correct'
		}], function (ans) {
			if (ans.correct) {
				self.originalNetwork = network;
				self.next();
				return;
			}
			console.error('Incorrect network was detected.');
		});
	}
};

TestWiFi.prototype.selectNetwork = function() {
	console.log('Scanning for nearby networks matching', this.wirelessSetupFilter);
	var self = this;
	scan(function(err, aps) {
		if (err) {
			console.log('unable to scan for wifi networks:', err);
			return;
		}

		console.log('Found', aps.length, 'networks.');

		var photons = ssids(filter(aps, self.wirelessSetupFilter));
		console.log('Found', photons.length, 'photons.');
		if (photons.length) {
			console.log(photons);
			return prompt([{
				type: 'list',
				name: 'selected',
				message: 'Please select which Photon network you would like to switch to:',
				choices: photons
			}], function(ans) {
				if (ans.selected) {
					self.setNext(function() {
						console.log('Restoring to original network', self.originalNetwork);
						self.connect(self.originalNetwork);
					});
					self.connect(ans.selected);
				}
			});
		}
	});
};

/**
 * Connect to the given network
 * @param ssid
 */
TestWiFi.prototype.connect = function(ssid) {
	var self = this;
	console.log('Connecting to network', ssid);
	self.mgr.connect({ssid:ssid}, function(err, opts) {
		if (err) {
			console.error('Unable to connect to network', ssid, ':', err);
			return;
		}

		console.log('connected to network ', opts.ssid);
		self.mgr.getCurrentNetwork(function(err, current) {
			if (err) {
				console.error('Unable to detect current network:', err);
				return;
			}
			console.log('current network detected as', current);
			if (current!==ssid) {
				console.error('Current network should have been', ssid);
				return;
			}

			prompt([{
				type: 'confirm',
				message: 'Is that correct? (Please verify your computer is connected to this network.)',
				default: true,
				name: 'correct'
			}], function (ans) {
				if (ans.correct) {
					self.next();
					return;
				}
				console.error('Incorrect network was detected.');
			});
		});
	});
};

function filter(list, pattern) {
	// var returnedOne = false;
	return list.filter(function filter(ap) {
		// if(!returnedOne && ap.ssid.match(pattern)) {
		// 	returnedOne = true
		// 	return true
		// }
		// return false
		return ap.ssid.match(pattern);
	});
}

function ssids(list) {
	return list.map(function map(ap) {
		return ap.ssid;
	});
}

module.exports = TestWiFi;