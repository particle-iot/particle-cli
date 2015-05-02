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
var BaseCommand = require("./BaseCommand.js");
var utilities = require('../lib/utilities.js');
var settings = require('../settings.js');
var prompt = require('inquirer').prompt;
var chalk = require('chalk');
var scan = require('node-wifiscanner').scan;
var SAP = require('softap-setup')
var path = require('path');

var strings = {

	'monitorPrompt': "Would you like to wait and monitor for Photons entering setup mode?",
	'scanError': "Unable to scan for WiFi networks. Do you have permission to do that on this system?",
	'credentialsNeeded': "Heads Up: You will need to know the password and security type for your WiFi network (if any) to proceed.",
	'selectNetwork': "Select the WiFi network with which you wish to connect your Photon:"
};

var WirelessCommand = function (cli, options) {

	WirelessCommand.super_.call(this, cli, options);

	this.options = extend({}, this.options, options);
	this.deviceFilterPattern = settings.wirelessSetupFilter;
	this.init();
};

util.inherits(WirelessCommand, BaseCommand);

WirelessCommand.prototype.name = "wireless";
WirelessCommand.prototype.options = null;
WirelessCommand.prototype.description = "simple wireless interface to your Photons";

WirelessCommand.prototype.init = function init() {

	this.addOption("list", this.list.bind(this), "Show nearby Photons in setup mode (blinking blue)");
	this.addOption("monitor", this.monitor.bind(this), "Begin monitoring nearby WiFi networks for Photons in setup mode.");

	// this.addOption("identify", this.identifyCore.bind(this), "Ask for and display core ID via serial");
};

WirelessCommand.prototype.list = function list(args) {

	if(args) { this.deviceFilterPattern = args; }

	this.newSpin('%s ' + chalk.bold.white('Scanning for nearby Photons in setup mode...')).start();
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
				'Found "%s". Would you like to perform setup on this Photon now?',
				chalk.bold.cyan(detectedDevices[0].ssid)
			),
			default: true,

		}], singleChoice);
	}
	else {

		console.log(
			arrow,
			chalk.bold.white('No nearby Photons detected.'),
			chalk.bold.white('Try the', '`' + chalk.bold.cyan(cmd + ' wireless help') + '` command for more information.')
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

			self.__batch = true;
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

	function multipleAnswers(ans) { ans.selected.forEach(self.setup); };

	function singleChoice(ans) {

		if(ans.setupSingle) {

			self.setup(detectedDevices[0]);
		}
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

			console.log(arrow, chalk.bold.white('Monitoring nearby WiFi networks for Photons. This may take up to a minute.'));
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

	var self = this;
	var list = { };

	var selected;
	var security;

	console.log();
	console.log(arrow, chalk.bold.white('Congratulations, you\'re on your way to awesome!'));
	console.log();
	console.log(chalk.yellow('!'), chalk.bold.white(strings.credentialsNeeded));
	console.log(chalk.grey('	(press ctrl + C at any time to exit)'));

	this.newSpin('Scanning for nearby WiFi networks...').start();
	scan(networks);
	function networks(err, dat) {

		console.log(list);
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

				if(ans.rescan) { scan(networks); }
				else { self.exit(); }
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

				console.log(chalk.yellow('!'), chalk.bold.white('I will encrypt any password sent to the Photon during configuration.'));

				// what password to use?
				prompt([{

					name: 'password',
					type: 'password',
					message: 'Please enter the password for your wireless network:',

				}], passwordChoice);
			}
			else {

				passwordChoice({ password: null });
			}
		};

		function passwordChoice(ans) {

			if(ans.password) { self.__password = ans.password; }
			// single Photon configuration
			if(photon) {

				// TODO: Abstract into cross platform module
				self.newSpin('Attempting to connect to ' + photon.ssid + '...').start();
				exec('networksetup -setairportnetwork en0 ' + photon.ssid, function(err, stdout, stderr) {

					self.stopSpin();
					if(err || stderr) {

						console.log(chalk.bold.red('!'), chalk.bold.white('Woops. Something went wrong. Trying again...'));
						passwordChoice(ans);
					}

					console.log(arrow, chalk.bold.white(util.format(
						'Hey! We successfully connected to %s!',
						chalk.bold.cyan(photon.ssid)
					)));

					self.newSpin('Attempting to send configuration details...').start();

					var sap = new SAP();

					info(pubKey);

					function info(cb) {

						sap.deviceInfo(pubKey).on('error', function() {

							setTimeout(function() { info(pubKey); }, 1000);
						});
					};
					function pubKey(cb) {

						sap.publicKey(configure).on('error', function() {

							setTimeout(function() { pubKey(configure); }, 1000);
						});
					};
					function configure(cb) {
						var conf = {

							ssid: selected,
							security: self.__security,
							password: self.__password

						};

						sap.configure(conf, connect).on('error', function() {

							setTimeout(function() { configure(connect); }, 1000);
						});
					};
					function connect(cb) {

						sap.connect(done);
					};
					function done(err) {

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

							exec('networksetup -setairportnetwork en0  ' + selected + ' ' + self.__password,
							function (err, stdin, stderr) {
								if(err && !stderr) {

									self.error('Whoops! I couldn\'t do that. Please reconnect manually.');
								}
								console.log(arrow, chalk.bold.white('Fantastic! You should be back to normal now!'));
								self.exit();
							})
						}
					}
				});
			}
			// Bulk Photon configuratiojn
			else if(self.__batch) {

				// do all of the photons...
			}
			else {

				console.log(chalk.bold.red('!'), 'No wireless Photon selected, and not configuring all Photons.');
				self.exit();
			}
		};
	}
};

WirelessCommand.prototype.connect = function(args) {

};

WirelessCommand.prototype.exit = function() {

		console.log();
		console.log(arrow, chalk.bold.white('Ok, bye! Don\'t forget `' +
			chalk.bold.cyan(cmd + ' wireless help') + '` if you\'re stuck!',
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

var cmd = path.basename(process.argv[1]);
var arrow = chalk.green('>');

module.exports = WirelessCommand;
