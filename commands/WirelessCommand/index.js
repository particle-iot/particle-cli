/**
 ******************************************************************************
 * @file    js/commands/WirelessCommand.js
 * @author  Emily Rose (nexxy@spark.io)
 * @company Spark ( https://www.spark.io/ )
 * @source https://github.com/spark/spark-cli
 * @version V1.0.0
 * @date    5-May-2015
 * @brief   Wireless commands module
 ******************************************************************************
Copyright (c) 2015 Spark Labs, Inc.  All rights reserved.

This program is free software; you can redistribute it and/or
modify it under the terms of the GNU Lesser General Public
License as published by the Free Software Foundation, either
version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public
License along with this program; if not, see <http://www.gnu.org/licenses/>.
 ******************************************************************************
 */
var util = require('util');
var exec = require('child_process').exec
var extend = require('xtend');
var WiFiManager = require('./WiFiManager');
var BaseCommand = require("../BaseCommand.js");
var utilities = require('../../lib/utilities.js');
var APIClient = require('../../lib/ApiClient2');
var settings = require('../../settings.js');
var prompt = require('inquirer').prompt;
var chalk = require('chalk');
var scan = require('node-wifiscanner').scan;
var SAP = require('softap-setup')
var path = require('path');

var strings = {

	'monitorPrompt': "Would you like to wait and monitor for Photons entering setup mode?",
	'scanError': "Unable to scan for Wi-Fi networks. Do you have permission to do that on this system?",
	'credentialsNeeded': "You will need to know the password and security type for your Wi-Fi network (if any) to proceed.",
	'selectNetwork': "Select the Wi-Fi network with which you wish to connect your Photon:"
};

var WirelessCommand = function (cli, options) {

	WirelessCommand.super_.call(this, cli, options);

	this.options = extend({}, this.options, options);
	this.deviceFilterPattern = settings.wirelessSetupFilter;
	this.__sap = new SAP();
	this.__completed = 0;

	this.init();
};

util.inherits(WirelessCommand, BaseCommand);

WirelessCommand.prototype.name = "wireless";
WirelessCommand.prototype.options = null;
WirelessCommand.prototype.description = "simple wireless interface to your Photons";

WirelessCommand.prototype.init = function init() {

	this.addOption("list", this.list.bind(this), "Show nearby Photons in setup mode (blinking blue)");
	this.addOption("monitor", this.monitor.bind(this), "Begin monitoring nearby Wi-Fi networks for Photons in setup mode.");

	// this.addOption("identify", this.identifyCore.bind(this), "Ask for and display core ID via serial");
};

WirelessCommand.prototype.list = function list(macAddress) {
	// if we get passed a MAC address from setup
	if (macAddress && macAddress.length === 17) {
		this._macAddressFilter = macAddress;
	} else {
		this._macAddressFilter = null;
	}

	console.log();
	console.log(
		chalk.cyan('!'),
		"PROTIP:",
		chalk.grey("Wireless setup of Photons works like a"),
		chalk.cyan("wizard!")
	);
	console.log(
		chalk.cyan('!'),
		"PROTIP:",
		chalk.grey("We will",
			chalk.cyan('automagically'),
			"change the",
			chalk.cyan('Wi-Fi'),
			"network to which your computer is connected."
		)
	);
	console.log(
		chalk.cyan('!'),
		"PROTIP:",
		chalk.grey('You may lose your connection to the internet for a moment.'),
		"\n"
	);

	this.newSpin('%s ' + chalk.bold.white('Scanning Wi-Fi for nearby Photons in setup mode...')).start();
	scan(this.__networks.bind(this));

};

WirelessCommand.prototype.__networks = function networks(err, dat) {

	var self = this;
	var detectedDevices = [ ];

	this.stopSpin();

	if(err) { self.error(strings.scanError); }

	detectedDevices = dat;
	if (this._macAddressFilter) {
		var macDevices = detectedDevices.filter(function (ap) {
			return ap.mac.toLowerCase() === self._macAddressFilter;
		});
		if (macDevices && macDevices.length === 1) {
			detectedDevices = macDevices;
		}
	}

	detectedDevices = ssids(filter(detectedDevices, self.deviceFilterPattern));

	if(detectedDevices.length > 1) {

		// Multiple Photons detected
		prompt([{

			type: 'confirm',
			name: 'setupAll',
			message: 'Multiple Photons detected nearby. Would you like to perform setup on all of them now?',
			default: false,

		}], multipleChoice);
	}
	else if(detectedDevices.length == 1) {

		// Perform wireless setup?
		prompt([{

			type: 'confirm',
			name: 'setupSingle',
			message: util.format(
				'Found "%s". Would you like to perform setup on this one now?',
				chalk.bold.cyan(detectedDevices[0])
			),
			default: true,

		}], singleChoice);
	}
	else {

		console.log(
			arrow,
			chalk.bold.white('No nearby Photons detected.'),
			chalk.bold.white('Try the', '`' + chalk.bold.cyan(cmd + ' help') + '` command for more information.')
		);

		// Monitor for new Photons?
		prompt([{

			type: 'confirm',
			name: 'monitor',
			message: strings.monitorPrompt,
			default: true

		}], monitorChoice);
	}

	function multipleChoice(ans) {

		if(ans.setupAll) {

			self.__batch = detectedDevices;
			self.setup(null);
		}
		else {

			// Select any/all Photons to setup
			prompt([{

				type: 'checkbox',
				name: 'selected',
				message: 'Please select which Photons you would like to setup at this time.',
				choices: detectedDevices

			}], multipleAnswers);
		}
	};

	function multipleAnswers(ans) {

		if(ans.selected.length > 1) {

			self.__batch = ans.selected;
			return self.setup(null);
		}
		self.__batch = undefined;
		self.setup(ans.selected[0]);
	};

	function singleChoice(ans) {

		if(ans.setupSingle) { self.setup(detectedDevices[0]); }
		else {

			// Monitor for new Photons?
			prompt([{

				type: 'confirm',
				name: 'monitor',
				message: strings.monitorPrompt,
				default: true

			}], monitorChoice);
		}
	};

	function monitorChoice(ans) {

		if(ans.monitor) {

			console.log(arrow, chalk.bold.white('Monitoring nearby Wi-Fi networks for Photons. This may take up to a minute.'));
			self.monitor();
		}
		else {

			self.exit();
		}
	}
};


WirelessCommand.prototype.monitor = function(args) {

	var self = this;

	this.newSpin('%s ' + chalk.bold.white('Waiting for a wild Photon to appear... ') + chalk.grey('(press ctrl + C to exit)')).start();
	this.__monitor = setInterval(wildPhotons, 5000);
	function wildPhotons() {

		scan(function (err, dat) {

			if(err) {

				// TODO: probably don't just keep trying forever...
			}
			var foundPhotons = filter(dat, args || settings.wirelessSetupFilter);
			if(foundPhotons.length > 0) {

				clearInterval(self.__monitor);
				self.__networks(null, foundPhotons);

			}
		});
	}
};

WirelessCommand.prototype._ = null;

WirelessCommand.prototype.setup = function setup(photon) {

	var api = new APIClient(settings.apiUrl, settings.access_token);
	var mgr = new WiFiManager();
	var sap = this.__sap;

	var self = this;
	var list = { };

	var selected;
	var security;

	if(!photon) {
		if(self.__batch && self.__batch.length > 0) {
			var photon = self.__batch.pop();
		}
		else {
			return console.log(alert, 'No Photons selected for setup!');
		}
	}

	console.log();
	console.log(arrow, chalk.bold.white('Congratulations, you\'re on your way to awesome with'), chalk.cyan(photon));
	console.log();
	console.log(
		chalk.cyan('!'),
		"PROTIP:",
		chalk.grey(strings.credentialsNeeded)
	);
	console.log(
		chalk.cyan('!'),
		"PROTIP:",
		chalk.grey('You can press ctrl + C to quit setup at any time.')
	);
	console.log();

	this.newSpin('Obtaining magical secure claim code from the cloud...').start();

	api.getClaimCode(next);
	function next(err, dat) {

		self.stopSpin();
		if(err) {

			// TODO: Graceful recovery here
			return console.log(alert, "I encountered an error while trying to retrieve a claim code from the cloud. Are you connected to the internet?");
		}
		if(!photon) {
			return console.log(alert, "No Photon selected for setup.");
		}
		self.__claimCode = dat.claim_code;

		self.newSpin('Attempting to connect to ' + photon + '...').start();
		mgr.connect({ ssid: photon }, connected);
	};
	function connected(err, opts) {

		self.stopSpin();
		if(err) {
			// TODO: Max retries, help output when reached.
			console.log(
				chalk.bold.red('!'),
				chalk.bold.white('Woops. Something went wrong connecting to ' + opts.ssid + '. Please manually re-connect to your Wi-Fi network.')
			);
			return;
		}
		console.log(arrow, chalk.bold.white(util.format(
			'Hey! We successfully connected to %s!',
			chalk.bold.cyan(opts.ssid)
		)));
		self.newSpin('Attempting to send configuration details...').start();
		self.__configure(opts.ssid, done);
	};

	function done(err) {

		console.log(arrow, "Done configuring your Photon(s)!");
	};
};

WirelessCommand.prototype.__configure = function __configure(ssid, cb) {

	var self = this;
	var sap = this.__sap;
	var list = [ ];

	var password;
	var network;
	var retry;

	sap.scan(results).on('error', function(err) {

		console.log(alert, 'Your Photon encountered an error while scanning nearby Wi-Fi networks.');
		console.log(alert, 'DEBUG:', chalk.grey(err));
		return;

	});

	function results(err, dat) {

		if(err) {
			return console.log(
				arrow,
				'Your Photon encountered an error while trying to scan for nearby Wi-Fi networks.'
			);
		}

		networks = dat.scans;

		dat.scans.forEach(function save(ap) { list[ap.ssid] = ap; });

		prompt([{

			type: 'list',
			name: 'network',
			message: 'Please select the network to which your Photon should connect:',
			choices: ssids(networks)

		}, {

			type: 'input',
			name: 'password',
			message: 'Please enter your network password (or leave blank for none):'

		}], networkChoices);
	};

	function networkChoices(ans) {

		network = ans.network;
		password = ans.password;
		security = list[network].sec;

		console.log(arrow, "Here's what we're going to send to the Photon:");
		console.log();
		console.log(arrow, "Wi-Fi Network:", chalk.bold.cyan(network));
		console.log(arrow, "Password:", chalk.bold.cyan(password || '[none]'));
		console.log(arrow, "Security:", chalk.bold.cyan(security));
		console.log();

		prompt([{

			type: 'confirm',
			name: 'continue',
			message: 'Would you like to continue with the information shown above?'

		}], continueChoice);
	};

	function continueChoice(ans) {

		if(!ans.continue) {

			console.log(arrow, "Let's try again...");
			console.log();
			return self.__configure(ssid, cb);
		}

		info();
	}

	function info(err, res) {

		clearTimeout(retry);
		sap.deviceInfo(pubKey).on('error', function() {

			retry = setTimeout(info, 1000);
		});
	};
	function pubKey() {

		clearTimeout(retry);
		sap.publicKey(code).on('error', function() {

			retry = setTimeout(pubKey, 1000);
		});
	};
	function code() {

		clearTimeout(retry);
		sap.setClaimCode(self.__claimCode, configure).on('error', function() {

			retry = setTimeout(code, 1000);
		});
	};
	function configure() {
		var conf = {

			ssid: network,
			security: security,
			password: password

		};

		clearTimeout(retry);
		sap.configure(conf, connect).on('error', function() {

			retry = setTimeout(configure, 1000);
		});
	};
	function connect() {

		clearTimeout(retry);
		sap.connect(done);
	};
	function done(err) {

		clearTimeout(retry);
		if(self.__batch && self.__batch.length) { self.__configure(self.__batch.pop(), cb); }

		self.stopSpin();
		console.log(arrow, chalk.bold.white('Configuration request complete! You\'ve just won the internet!'));

		prompt([{

			name: 'revive',
			type: 'confirm',
			message: 'Would you like to return this computer to the wireless network you just configured?',
			default: true

		}], originalPrompt);
	}

	function originalPrompt(ans) {

		if(ans.revive) {

			exec('networksetup -setairportnetwork en0  ' + ssid + ' ' + self.__password,
			function (err, stdin, stderr) {
				if(err && !stderr) {

					self.error('Whoops! I couldn\'t do that. Please reconnect manually.');
				}
				console.log(arrow, chalk.bold.white('Fantastic! You should be back to normal now!'));

				console.log();
				console.log(
					chalk.cyan('!'),
					"PROTIP:",
					chalk.grey("Your Photon may start a firmware update immediately upon connecting for the first time.")
				);
				console.log(
					chalk.cyan('!'),
					"PROTIP:",
					chalk.grey("If it starts an update, you will see it flash"),
					chalk.magenta('MAGENTA'),
					chalk.grey("until the update has completed.")
				);

				self.exit();
			})
		}
	}
};

WirelessCommand.prototype.exit = function() {

	console.log();
	console.log(arrow, chalk.bold.white('Ok, bye! Don\'t forget `' +
		chalk.bold.cyan(cmd + ' help') + '` if you\'re stuck!',
		chalk.bold.magenta('<3'))
	);
	process.exit(0);

};

function filter(list, pattern, inverse) {
	// var returnedOne = false;
	return list.filter(function filter(ap) {
		// if(!returnedOne && ap.ssid.match(pattern)) {
		// 	returnedOne = true
		// 	return true
		// }
		// return false
		return inverse ? !ap.ssid.match(pattern) : ap.ssid.match(pattern);
	});
};

function ssids(list) {

	return clean(list).map(function map(ap) {
		return ap.ssid;
	});
};

function clean(list) {

	var dupes = [ ];

	return list.sort(function compare(a, b) {

		if(a.ssid && !b.ssid) { return 1; }
		else if(b.ssid && !a.ssid) { return -1; }
		return a.ssid.localeCompare(b.ssid);

	}).filter(function dedupe(ap) {

		if(dupes[ap.ssid]) { return false; }

		dupes[ap.ssid] = true;
		return true;

	});
}

// TODO: DRY this up somehow

var cmd = path.basename(process.argv[1]);
var arrow = chalk.green('>');
var alert = chalk.yellow('!');

module.exports = WirelessCommand;
