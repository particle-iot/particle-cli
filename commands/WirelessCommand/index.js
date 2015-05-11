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

WirelessCommand.prototype.list = function list(args) {

	if(args) { this.deviceFilterPattern = args; }

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

	detectedDevices = filter(dat, self.deviceFilterPattern);

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
				chalk.bold.cyan(detectedDevices[0].ssid)
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
				choices: ssids(detectedDevices)

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

		if(ans.setupSingle) { self.setup(detectedDevices[0].ssid); }
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
		if(!photon && !self.__batch) {
			return console.log(alert, "No Photons selected for setup.");
		}
		self.__claimCode = dat.claim_code;

		self.newSpin('Attempting to connect to ' + photon + '...').start();
		mgr.connect({ ssid: photon }, connected);
	};
	function connected(err, opts) {

		self.stopSpin();
		if(err) {

			console.log(chalk.bold.red('!'), chalk.bold.white('Woops. Something went wrong. Trying again...'));
			return passwordChoice(ans);
		}

		console.log(arrow, chalk.bold.white(util.format(
			'Hey! We successfully connected to %s!',
			chalk.bold.cyan(opts.ssid)
		)));

		self.newSpin('Attempting to send configuration details...').start();

		self.__configure(opts.ssid);
	};

	function networks(err, dat) {

		self.stopSpin();

		if(err) { self.error(err); }

		if(dat.length == 0) {

			// No networks found, retry?
			prompt([{

				type: 'confirm',
				name: 'rescan',
				message: 'Uh oh, no networks found. Try again?'
				, default: true

			}], rescanChoice);
			function rescanChoice(ans) {

				if(ans.rescan) { return scan(networks); }
				self.exit();
			}
		}
		else {

			// TODO: Allow user to re-scan if their network isn't in the list

			dat.forEach(function map(ap) { list[ap.ssid] = ap; });

			// to which network should the Photon connect?
			prompt([{

				type: 'list',
				name: 'network',
				message: chalk.bold.white(strings.selectNetwork),
				choices: ssids(dat)

			}], securityDetection);

		}

		function securityDetection(ans) {

			selected = ans.network;

			// Auto-detect security?
			prompt([{

				type: 'confirm',
				name: 'auto',
				message: chalk.bold.white('Should I try to auto-detect the wireless security type?'),
				default: true

			}], detectionChoice);
		};

		function detectionChoice(ans) {

			if(ans.auto) {

				var security = list[selected].security;

				// TODO: simplify this logic.

				if(security.indexOf('WPA2') >= 0) {
					if(security.indexOf('AES') && security.indexOf('PSK')) {
						self.__security = 'wpa2_mixed';
					}
					else if(security.indeOf('AES') >= 0) {
						self.__security = 'wpa2_aes';
					}
					else if(security.indexOf('TKIP') >= 0) {
						self.__security = 'wpa2_tkip';
					}
				}
				else if(security.indexOf('WPA') >= 0) {

					if(security.indexOf('AES') >= 0) {
						self.__security = 'wpa_aes';
					}
					else {
						self.__security = 'wpa_tkip';
					}
				}
				else if(security.indexOf('NONE') >= 0) {
					self.__security = 'none';
				}
				else if(security.indexOf('WEP') >= 0) {
					self.__security = 'wep_psk';
				}

				securityChoice({ security: self.__security });
			}
			else {

				// select type of security
				prompt([{

					type: 'list',
					name: 'security',
					message: "Please select the type of wireless security you wish the Photon to use:",
					choices: [
						'WPA2 Mixed',
						'WPA2 TKIP',
						'WPA2 AES',
						'WPA TKIP',
						'WPA AES',
						'None',
						'WEP'
					]

				}], securityChoice);
			}
		};

		function securityChoice(ans) {


			// TODO: Abstract for cross-platform compat

			self.__security = ans.security.toLowerCase().replace(' ', '_');

			if(self.__security !== 'none') {

				console.log();
				console.log(
					chalk.cyan('!'),
					"PROTIP:",
					chalk.grey("Your secret is safe with me. I encrypt any password before sending it to the device.")
				);
				console.log();

				// what password to use?
				prompt([{

					name: 'password',
					type: 'input',
					message: 'Please enter the password for your Wi-Fi network:',

				}], passwordChoice);
			}
			else {

				passwordChoice({ password: null });
			}
		};

		function passwordChoice(ans) {

			if(ans.password) { self.__password = ans.password; }

			if(!photon && self.__batch) {
				var photon = { };
				photon.ssid = self.__batch.pop();
			}

			if(photon) {


			}
			else {

				// TODO: Maybe give them another chance to select at least one Photon?
				console.log(chalk.bold.red('!'), 'No wireless Photon selected, and not configuring all Photons.');
				self.exit();
			}
		};
	}
};

WirelessCommand.prototype.__configure = function configure(ssid, cb) {

	var self = this;
	var sap = this.__sap;

	sap.scan(info);

	function info(err, res) {

		sap.deviceInfo(pubKey).on('error', function() {

			setTimeout(info, 1000);
		});
	};
	function pubKey() {

		sap.publicKey(code).on('error', function() {

			setTimeout(pubKey, 1000);
		});
	};
	function code() {

		sap.setClaimCode(self.__claimCode, configure).on('error', function() {

			setTimeout(code, 1000);
		});
	};
	function configure() {
		var conf = {

			ssid: ssid,
			security: self.__security,
			password: self.__password

		};

		sap.configure(conf, connect).on('error', function() {

			setTimeout(configure, 1000);
		});
	};
	function connect() { sap.connect(done); };
	function done(err) {

		if(self.__batch && self.__batch.length) { self.__configure(self.__batch.pop()); }

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

	return list.filter(function filter(ap) {
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
