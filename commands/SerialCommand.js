/**
 ******************************************************************************
 * @file    commands/SerialCommand.js
 * @author  David Middlecamp (david@spark.io)
 * @company Spark ( https://www.spark.io/ )
 * @source  https://github.com/spark/spark-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   Serial commands module
 ******************************************************************************
Copyright (c) 2014 Spark Labs, Inc.  All rights reserved.

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
'use strict';

var util = require('util');

var when = require('when');
var extend = require('xtend');
var pipeline = require('when/pipeline');
var SerialPortLib = require('serialport');
var SerialPort = SerialPortLib.SerialPort;
var inquirer = require('inquirer');
var chalk = require('chalk');
var wifiScan = require('node-wifiscanner').scan;

var BaseCommand = require('./BaseCommand.js');
var utilities = require('../lib/utilities.js');
var SerialBoredParser = require('../lib/SerialBoredParser.js');

var SerialCommand = function (cli, options) {
	SerialCommand.super_.call(this, cli, options);
	this.options = extend({}, this.options, options);

	this.init();
};

util.inherits(SerialCommand, BaseCommand);

SerialCommand.prototype = extend(BaseCommand.prototype, {
	options: null,
	name: 'serial',
	description: 'simple serial interface to your devices',

	init: function () {
		this.addOption('list', this.listDevices.bind(this), 'Show devices connected via serial to your computer');
		this.addOption('monitor', this.monitorPort.bind(this), 'Connect and display messages from a device');
		this.addOption('identify', this.identifyDevice.bind(this), 'Ask for and display device ID via serial');
		this.addOption('wifi', this.configureWifi.bind(this), 'Configure Wi-Fi credentials over serial');
		this.addOption('mac', this.deviceMac.bind(this), 'Ask for and display MAC address via serial');

		//this.addOption(null, this.helpCommand.bind(this));
	},

	findDevices: function (callback) {
		var devices = [];
		SerialPortLib.list(function (err, ports) {
			if (err) {
				console.error('Error listing serial ports: ', err);
				return callback([]);
			}

			//grab anything that self-reports as a core
			ports.forEach(function (port) {
				//not trying to be secure here, just trying to be helpful.
				if ((port.manufacturer && port.manufacturer.indexOf('Spark') >= 0) ||
					(port.pnpId && port.pnpId.indexOf('Spark_Core') >= 0) ||
					(port.pnpId && port.pnpId.indexOf('VID_1D50') >= 0)) {

					var device = { port: port.comName, type: 'Spark Core' };

					if (port.vendorId === '0x2b04' && port.productId === '0xc006') {
						device.type = 'Photon';
					} else if (port.vendorId === '0x1d50' && port.productId === '0x607d') {
						device.type = 'Spark Core';
					}

					devices.push(device);
				}
			});

			//if I didn't find anything, grab any 'ttyACM's
			if (devices.length === 0) {
				ports.forEach(function (port) {
					//if it doesn't have a manufacturer or pnpId set, but it's a ttyACM port, then lets grab it.
					if (port.comName.indexOf('/dev/ttyACM') === 0) {
						devices.push({ port: port.comName, type: '' });
					}
					else if (port.comName.indexOf('/dev/cuaU') === 0) {
						devices.push({ port: port.comName, type: '' });
					}
				});
			}

			callback(devices);
		});
	},

	listDevices: function () {
		this.findDevices(function (devices) {
			if (devices.length === 0) {
				console.log(chalk.bold.white('No devices available via serial'));
				return;
			}

			console.log('Found', chalk.cyan(devices.length), (devices.length > 1 ? 'devices' : 'device'), 'connected via serial:');
			devices.forEach(function(device) {
				console.log(util.format('%s - %s', device.port, device.type));
			});
		});
	},

	checkArguments: function (args) {
		this.options = this.options || {};

		if (!this.options.follow) {
			this.options.follow = utilities.tryParseArgs(args,
				'--follow',
				null
			);
		}
	},

	monitorPort: function (comPort) {
		var handlePortFn = function (device) {
			if (!device) {
				console.error('No serial device identified');
				return;
			}

			console.log('Opening serial monitor for com port: "' + device.port + '"');

			//TODO: listen for interrupts, close gracefully?
			var serialPort = new SerialPort(device.port, {
				baudrate: 9600
			}, false);
			serialPort.on('data', function (data) {
				process.stdout.write(data.toString());
			});
			serialPort.open(function (err) {
				if (err) {
					console.error('Serial err: ' + err);
					console.error('Serial problems, please reconnect the device.');
				}
			});
		};

		this.checkArguments(arguments);

		if (this.options.follow) {
			//catch the serial port dying, and keep retrying forever
			//TODO: needs serialPort error / close event / deferred
		}

		this.whatSerialPortDidYouMean(comPort, true, handlePortFn);
	},

	/**
	 * Check to see if the device is in listening mode, try to get the device ID via serial
	 * @param comPort
	 * @returns {promise|*|Promise|promise}
	 */
	identifyDevice: function (comPort) {
		var self = this;
		this.whatSerialPortDidYouMean(comPort, true, function (device) {
			if (!device) {
				return self.error('No serial port identified');
			}

			self.askForDeviceID(device)
				.then(function (data) {
					console.log();
					console.log('Your device id is', chalk.bold.cyan(data));
				})
				.catch(function (err) {
					self.error(err, false);
				});
		});
	},

	deviceMac: function (comPort) {
		var self = this;
		this.whatSerialPortDidYouMean(comPort, true, function (device) {
			if (!device) {
				return self.error('No serial port identified');
			}

			self.getDeviceMacAddress(device)
				.then(function (data) {
					console.log();
					console.log('Your device MAC address is', chalk.bold.cyan(data));
				})
				.catch(function (err) {
					self.error(err, false);
				});
		});
	},

	_scanNetworks: function(next) {
		var self = this;
		this.newSpin('Scanning for nearby Wi-Fi networks...').start();

		wifiScan(function (err, networkList) {
			self.stopSpin();

			if (err) {
				return self.error('Unable to scan for Wi-Fi networks. Do you have permission to do that on this system?');
			}

			if (networkList.length === 0) {
				inquirer.prompt([{
					type: 'confirm',
					name: 'rescan',
					message: 'Uh oh, no networks found. Try again?',
					default: true
				}], function(answers) {
					if (answers.rescan) {
						return self._scanNetworks(next);
					}
					return self.exit();
				});
			}

			networkList = networkList.filter(function (ap) {
				// channel # > 14 === 5GHz
				if (ap.channel && parseInt(ap.channel, 10) > 14) {
					return false;
				}
				return true;
			});

			networkList.sort(function (a, b) {
				return a.ssid.toLowerCase().localeCompare(b.ssid.toLowerCase());
			});
			next(networkList);
		});
	},

	configureWifi: function (comPort) {
		var self = this;

		var wifi = when.defer();
		this.checkArguments(arguments);

		this.whatSerialPortDidYouMean(comPort, true, function (device) {
			if (!device) {
				return self.error('No serial port identified');
			}

			inquirer.prompt([
				{
					type: 'confirm',
					name: 'scan',
					message: chalk.bold.white('Should I scan for nearby Wi-Fi networks?'),
					default: true
				},
				{
					type: 'list',
					name: 'ap',
					message: chalk.bold.white('Select the Wi-Fi network with which you wish to connect your device:'),
					choices: function () {
						var done = this.async();
						self._scanNetworks(function (networks) {
							var choices = networks.map(function (n) {
								return {
									name: n.ssid,
									value: n
								};
							});
							done(choices);
						});
					},
					when: function (answers) { return answers.scan; }
				},
				{
					type: 'input',
					name: 'ssid',
					message: 'SSID',
					when: function (answers) { return !answers.scan || !answers.ap; }
				},
				{
					type: 'confirm',
					name: 'detectSecurity',
					message: chalk.bold.white('Should I try to auto-detect the wireless security type?'),
					when: function (answers) { return !!answers.ap; },
					default: true
				},
				{
					type: 'list',
					name: 'security',
					message: 'Security Type',
					choices: [
						{ name: 'WPA2', value: 3 },
						{ name: 'WPA', value: 2 },
						{ name: 'WEP', value: 1 },
						{ name: 'Unsecured', value: 0 }
					],
					when: function (answers) { return !answers.scan || !answers.detectSecurity; }
				},
				{
					type: 'input',
					name: 'password',
					message: 'Wi-Fi Password',
					when: function (answers) {
						return (answers.detectSecurity && answers.ap.security.indexOf('NONE') === -1) ||
							answers.security !== 0;
					}
				}
			], function (answers) {
				var ssid = answers.ssid || answers.ap.ssid;
				var security = answers.security;
				if (answers.detectSecurity) {
					var ap = answers.ap;
					if (ap.security.indexOf('WPA2') >= 0) { security = 3; }
					else if (ap.security.indexOf('WPA') >= 0) { security = 2; }
					else if (ap.security.indexOf('WEP') >= 0) { security = 1; }
					else if (ap.security.indexOf('NONE') >= 0) { security = 0; }
					else { security = 3; }
				}

				self.serialWifiConfig(device, ssid, answers.password, security).then(wifi.resolve, wifi.reject);
			});

		});

		return wifi.promise;
	},

	//spark firmware version 1:

	//SSID: Test
	//Password: Test
	//Thanks! Wait about 7 seconds while I save those credentials...


	/**
	 * wait for a prompt, optionally write back and answer, and optionally time out if the prompt doesn't appear in time.
	 * @param prompt
	 * @param answer
	 */
	serialPromptDfd: function (serialPort, prompt, answer, timeout, alwaysResolve) {
		//console.log("waiting on " + prompt + " answer will be " + answer);

		var dfd = when.defer(),
			failTimer,
			showTraffic = true;

		var writeAndDrain = function (data, callback) {
			serialPort.write(data, function () {
				serialPort.drain(callback);
			});
		};

		if (timeout) {
			failTimer = setTimeout(function () {
				if (showTraffic) { console.log('timed out on ' + prompt); }
				if (alwaysResolve) {
					dfd.resolve(null);
				}
				else {
					dfd.reject('Serial prompt timed out - Please try restarting your device');
				}
			}, timeout);
		}


		if (prompt) {
			var onMessage = function (data) {
				data = data.toString();

				if (showTraffic) { console.log('Serial said: ' + data); }
				if (data && data.indexOf(prompt) >= 0) {
					if (answer) {
						serialPort.flush(function() {});

						writeAndDrain(answer, function () {
							if (showTraffic) { console.log('I said: ' + answer); }
							//serialPort.pause();     //lets not miss anything
							dfd.resolve(true);
						});
					}
					else {
						dfd.resolve(true);
					}
				}
			};

			serialPort.on('data', onMessage);

			when(dfd.promise).ensure(function () {
				clearTimeout(failTimer);
				serialPort.removeListener('data', onMessage);
			});
		}
		else if (answer) {
			clearTimeout(failTimer);

			if (showTraffic) { console.log('I said: ' + answer); }
			writeAndDrain(answer, function () {
				//serialPort.pause();     //lets not miss anything
				dfd.resolve(true);
			});
		}
		return dfd.promise;
	},


	serialWifiConfig: function (device, ssid, password, securityType) {
		if (!device) {
			return when.reject('No serial port available');
		}

		console.log('Attempting to configure Wi-Fi on ' + device.port);

		var serialPort = this.serialPort || new SerialPort(device.port, {
			baudrate: 9600,
			parser: SerialBoredParser.makeParser(250)
		}, false);

		serialPort.on('error', function () {
			//yeah, don't care.
			console.error('Serial error:', arguments);
		});

		var that = this,
			wifiDone = when.defer();

		serialPort.open(function () {
			var configDone = pipeline([
				function () {
					return that.serialPromptDfd(serialPort, null, 'w', 5000, true);
				},
				function (result) {
					if (!result) {
						return that.serialPromptDfd(serialPort, null, 'w', 5000, true);
					}
					else {
						return when.resolve();
					}
				},
				function () {
					return that.serialPromptDfd(serialPort, 'SSID:', ssid + '\n', 5000, false);
				},
				function () {
					return that.serialPromptDfd(serialPort, 'Security 0=unsecured, 1=WEP, 2=WPA, 3=WPA2:', securityType + '\n', 1500, true);
				},
				function (result) {
					var passPrompt = 'Password:';
					if (!result) {
						//no security prompt, must have had pass prompt.

						//normally we would wait for the password prompt, but the 'security' line will have received the
						//prompt instead, so lets assume we're good since we already got the ssid prompt, and just pipe
						//the pass.

						if (securityType === '0') {
							//we didn't have a password, so just hit return
							serialPort.write('\n');

						}
						passPrompt = null;
					}

					if (!passPrompt || !password || (password === '')) {
						return when.resolve();
					}

					return that.serialPromptDfd(serialPort, passPrompt, password + '\n', 5000);
				},
				function () {
					if (device.type === 'Photon') {
						return that.serialPromptDfd(serialPort, '\n', null, 15000);
					}
					return that.serialPromptDfd(serialPort, 'Spark <3 you!', null, 15000);
				}
			]);
			utilities.pipeDeferred(configDone, wifiDone);
		});


		when(wifiDone.promise).then(
			function () {
				console.log('Done! Your device should now restart.');
			},
			function (err) {
				console.error('Something went wrong ' + err);
			});

		when(wifiDone.promise).ensure(function () {
			serialPort.close();
		});

		return wifiDone.promise;

		//TODO: correct interaction for unsecured networks
		//TODO: drop the pre-prompt creds process entirely when we have the built in serial terminal
	},

	getDeviceMacAddress: function (device) {
		if (!device) {
			return when.reject('getDeviceMacAddress - no serial port provided');
		}
		if (device.type === 'Spark Core') {
			return when.reject('Unable to get MAC address of a Spark Core');
		}

		var failDelay = 5000;

		var dfd = when.defer();

		try {
			//keep listening for data until we haven't received anything for...
			var serialPort = new SerialPort(device.port, {
				baudrate: 9600,
				parser: SerialBoredParser.makeParser(250)
			}, false);
			this.serialPort = serialPort;

			var failTimer = setTimeout(function () {
				dfd.reject('Serial timed out');
			}, failDelay);

			serialPort.on('data', function (data) {
				clearTimeout(failTimer);
				var matches = data.match(/([0-9a-fA-F]{2}:){1,5}([0-9a-fA-F]{2})?/);
				if (matches) {
					var mac = matches[0].toLowerCase();
					// manufacturing firmware can sometimes not report the full MAC
					// lets try and fix it
					if (mac.length < 17) {
						var bytes = mac.split(':');
						while (bytes.length < 6) {
							bytes.unshift('00');
						}
						var usiMacs = [
							['6c', '0b', '84'],
							['44', '39', 'c4']
						];
						usiMacs.some(function (usimac) {
							for (var i = usimac.length - 1; i >= 0; i--) {
								if (bytes[i] === usimac[i]) {
									mac = usimac.concat(bytes.slice(usimac.length)).join(':');
									return true;
								}
							}
						});
					}
					dfd.resolve(mac);
				} else {
					dfd.reject('Unable to find mac address in response');
				}
			});

			serialPort.open(function (err) {
				if (err) {
					console.error('Serial err: ' + err);
					console.error('Serial problems, please reconnect the device.');
					dfd.reject('Serial problems, please reconnect the device.');
				}
				else {
					//serialPort.flush();
					serialPort.write('m', function (werr) {
						if (werr) {
							console.error('Serial err: ' + werr);
							dfd.reject('Serial problems, please reconnect the device.');
						}
					});
				}
			});

			dfd.promise.ensure(function () {
				serialPort.removeAllListeners('open');
				serialPort.removeAllListeners('data');
				if (serialPort.isOpen()) {
					serialPort.close();
				}
			});
		}
		catch (ex) {
			console.error('Errors while trying to get device mac address -- disconnect and reconnect device');
			console.error(ex);
			dfd.reject('Serial errors');
		}

		return dfd.promise;
	},

	askForDeviceID: function (device) {
		if (!device) {
			return when.reject('askForDeviceID - no serial port provided');
		}

		var failDelay = 5000;

		var dfd = when.defer();

		try {
			//keep listening for data until we haven't received anything for...
			var serialPort = new SerialPort(device.port, {
				baudrate: 9600,
				parser: SerialBoredParser.makeParser(250)
			}, false);
			this.serialPort = serialPort;

			var failTimer = setTimeout(function () {
				dfd.reject('Serial timed out');
			}, failDelay);

			serialPort.on('data', function (data) {
				clearTimeout(failTimer);
				var matches = data.match(/Your (core|device) id is\s+(\w+)/);
				if (matches && matches.length === 3) {
					dfd.resolve(matches[2]);
				}
			});

			serialPort.open(function (err) {
				if (err) {
					console.error('Serial err: ' + err);
					console.error('Serial problems, please reconnect the device.');
					dfd.reject('Serial problems, please reconnect the device.');
				}
				else {
					serialPort.write('i', function (werr) {
						if (werr) {
							console.error('Serial err: ' + werr);
							dfd.reject('Serial problems, please reconnect the device.');
						}
					});
				}
			});

			dfd.promise.ensure(function () {
				serialPort.removeAllListeners('open');
				serialPort.removeAllListeners('data');
				serialPort.close();
			});
		}
		catch (ex) {
			console.error('Errors while trying to get deviceID -- disconnect and reconnect device');
			console.error(ex);
			dfd.reject('Serial errors');
		}

		return dfd.promise;
	},

	_parsePort: function(devices, comPort) {
		if (!comPort) {
			//they didn't give us anything.
			if (devices.length === 1) {
				//we have exactly one core, use that.
				return devices[0];
			}
			//else - which one?
		}
		else {
			var portNum = parseInt(comPort);
			if (!isNaN(portNum)) {
				//they gave us a number
				if (portNum > 0) {
					portNum -= 1;
				}

				if (devices.length > portNum) {
					//we have it, use it.
					return devices[portNum];
				}
				//else - which one?
			}
			else {
				var matchedDevices = devices.filter(function (d) {
					return d.port === comPort;
				});
				if (matchedDevices.length) {
					return matchedDevices[0];
				}

				//they gave us a string
				//doesn't matter if we have it or not, give it a try.
				return { port: comPort, type: '' };
			}
		}

		return null;
	},

	whatSerialPortDidYouMean: function (comPort, shouldPrompt, callback) {
		var self = this;

		this.findDevices(function (devices) {
			var port = self._parsePort(devices, comPort);
			if (port) {
				return callback(port);
			}

			if (!devices || devices.length === 0) {
				return self.error('No devices available via serial');
			}

			inquirer.prompt([
				{
					name: 'port',
					type: 'list',
					message: 'Which device did you mean?',
					choices: devices.map(function (d) {
						return {
							name: d.port + ' - ' + d.type,
							value: d
						};
					})
				}
			], function (answers) {
				callback(answers.port);
			});
		});
	},

	_: null
});

module.exports = SerialCommand;
