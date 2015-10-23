/**
 ******************************************************************************
 * @file    commands/SerialCommand.js
 * @author  David Middlecamp (david@spark.io)
 * @company Particle ( https://www.particle.io/ )
 * @source  https://github.com/spark/particle-cli
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
var _ = require('lodash');

var when = require('when');
var extend = require('xtend');
var pipeline = require('when/pipeline');
var SerialPortLib = require('serialport');
var SerialPort = SerialPortLib.SerialPort;
var inquirer = require('inquirer');
var chalk = require('chalk');
var wifiScan = require('node-wifiscanner2').scan;
var specs = require('../lib/deviceSpecs');
var log = require('../lib/log');
var settings = require('../settings')

var BaseCommand = require('./BaseCommand.js');
var utilities = require('../lib/utilities.js');
var SerialBoredParser = require('../lib/SerialBoredParser.js');
var SerialTrigger = require('../lib/SerialTrigger');

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

			ports.forEach(function (port) {
				// manufacturer value
				// Mac - Spark devices
				// Devices on old driver - Spark Core, Photon
				// Devices on new driver - Particle IO (https://github.com/spark/firmware/pull/447)
				// Windows only contains the pnpId field
				
				var device;
				var serialDeviceSpec = _.find(specs, function (deviceSpec) {
					if (!deviceSpec.serial) {
						return false;
					}
					var vid = deviceSpec.serial.vid;
					var pid = deviceSpec.serial.pid;

					var usbMatches = (port.vendorId === '0x' + vid.toLowerCase() && port.productId === '0x' + pid.toLowerCase());
					var pnpMatches = !!(port.pnpId && (port.pnpId.indexOf('VID_' + vid.toUpperCase()) >= 0) && (port.pnpId.indexOf('PID_' + pid.toUpperCase()) >= 0));

					if (usbMatches || pnpMatches) {
						return true;
					}
					return false;
				});
				if (serialDeviceSpec) {
					device = {
						port: port.comName,
						type: serialDeviceSpec.productName
					};
				}

				var matchesManufacturer = port.manufacturer && (port.manufacturer.indexOf('Particle') >= 0 || port.manufacturer.indexOf('Spark') >= 0 || port.manufacturer.indexOf('Photon') >= 0);
				if (!device && matchesManufacturer) {
					device = { port: port.comName, type: 'Core' };
				}

				if (device) {
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
					if (_.isObject(data)) {
						console.log();
						console.log('Your device id is', chalk.bold.cyan(data.id));
						if (data.imei) {
							console.log('Your IMEI is', chalk.bold.cyan(data.imei));
						}
						if (data.iccid) {
							console.log('Your ICCID is', chalk.bold.cyan(data.iccid));
						}
						return;
					}

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
					return next([]);
				});
				return;
			}

			networkList = networkList.filter(function (ap) {
				if (!ap) {
					return false;
				}

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
		// TODO remove once we have verbose flag
		settings.verboseOutput = false;

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
				}
			], function(ans) {
				if (ans.scan) {
					return self._scanNetworks(function (networks) {
						self._getWifiInformation(device, networks).then(wifi.resolve, wifi.reject);
					});
				} else {
					self._getWifiInformation(device).then(wifi.resolve, wifi.reject);
				}
			});
		});

		return wifi.promise;
	},

	_getWifiInformation: function(device, networks) {
		var wifiInfo = when.defer();
		var self = this;
		var rescanLabel = '[rescan networks]';

		networks = networks || [];
		var networkMap = _.indexBy(networks, 'ssid');

		inquirer.prompt([
			{
				type: 'list',
				name: 'ap',
				message: chalk.bold.white('Select the Wi-Fi network with which you wish to connect your device:'),
				choices: function () {
					var ns = _.pluck(networks, 'ssid');
					ns.unshift(new inquirer.Separator());
					ns.unshift(rescanLabel);
					ns.unshift(new inquirer.Separator());

					return ns;
				},
				when: function () { return networks.length; }
			},
			{
				type: 'confirm',
				name: 'detectSecurity',
				message: chalk.bold.white('Should I try to auto-detect the wireless security type?'),
				when: function (answers) { return !!answers.ap && !!networkMap[answers.ap] && !!networkMap[answers.ap].security; },
				default: true
			}
		], function (answers) {
			if (answers.ap === rescanLabel) {
				return self._scanNetworks(function (networks) {
					self._getWifiInformation(device, networks).then(wifiInfo.resolve, wifiInfo.reject);
				});
			}

			var ssid = answers.ap;
			var ap = networkMap[ssid];
			var security = answers.detectSecurity && ap && ap.security;
			
			self.serialWifiConfig(device, ssid, security).then(wifiInfo.resolve, wifiInfo.reject);
		});

		return wifiInfo.promise;
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


	serialWifiConfig: function (device, ssid, securityType) {
		if (!device) {
			return when.reject('No serial port available');
		}

		log.verbose('Attempting to configure Wi-Fi on ' + device.port);

		var serialPort = this.serialPort || new SerialPort(device.port, {
			baudrate: 9600,
			parser: SerialBoredParser.makeParser(250)
		}, false);

		var wifiDone = when.defer();
		serialPort.on('error', function (err) {
			wifiDone.reject(err);
		});
		function serialClosedEarly() {
			wifiDone.reject('Serial port closed early');
		}
		serialPort.on('close', serialClosedEarly);

		var self = this;
		function startTimeout(to) {
			self._serialTimeout = setTimeout(function () {
				wifiDone.reject('Serial timed out');
			}, to);
		}
		function resetTimeout() {
			clearTimeout(self._serialTimeout);
			self._serialTimeout = null;
		}

		var st = new SerialTrigger(serialPort);
		
		st.addTrigger('SSID:', function(cb) {
			resetTimeout();
			if (ssid) {
				return cb(ssid + '\n');
			}

			inquirer.prompt([{
				type: 'input',
				name: 'ssid',
				message: 'SSID',
				validate: function(input) {
					if (!input || !input.trim()) {
						return 'Please enter a valid SSID';
					} else {
						return true;
					}
				},
				filter: function(input) {
					return input.trim();
				}
			}], function(ans) {
				cb(ans.ssid + '\n', startTimeout.bind(self, 5000));
			});
		});

		st.addTrigger('Security 0=unsecured, 1=WEP, 2=WPA, 3=WPA2:', function(cb) {
			resetTimeout();
			if (securityType) {
				var security = 3;
				if (securityType.indexOf('WPA2') >= 0) { security = 3; }
				else if (securityType.indexOf('WPA') >= 0) { security = 2; }
				else if (securityType.indexOf('WEP') >= 0) { security = 1; }
				else if (securityType.indexOf('NONE') >= 0) { security = 0; }

				return cb(security + '\n', startTimeout.bind(self, 5000));
			}

			inquirer.prompt([{
				type: 'list',
				name: 'security',
				message: 'Security Type',
				choices: [
					{ name: 'WPA2', value: 3 },
					{ name: 'WPA', value: 2 },
					{ name: 'WEP', value: 1 },
					{ name: 'Unsecured', value: 0 }
				]
			}], function(ans) {
				cb(ans.security + '\n', startTimeout.bind(self, 5000));
			});
		});

		st.addTrigger('Security Cipher 1=AES, 2=TKIP, 3=AES+TKIP:', function(cb) {
			resetTimeout();
			if (securityType !== undefined) {
				var cipherType = 1;
				if (securityType.indexOf('AES') >= 0 && securityType.indexOf('TKIP') >= 0) { cipherType = 3; }
				else if (securityType.indexOf('TKIP') >= 0) { cipherType = 2; }
				else if (securityType.indexOf('AES') >= 0) { cipherType = 1; }
				
				return cb(cipherType + '\n', startTimeout.bind(self, 5000));
			}

			inquirer.prompt([{
				type: 'list',
				name: 'cipher',
				message: 'Cipher Type',
				choices: [
					{ name: 'AES+TKIP', value: 3 },
					{ name: 'TKIP', value: 2 },
					{ name: 'AES', value: 1 }
				]
			}], function(ans) {
				cb(ans.cipher + '\n', startTimeout.bind(self, 5000));
			});
		});

		st.addTrigger('Password:', function(cb) {
			resetTimeout();
			inquirer.prompt([{
				type: 'input',
				name: 'password',
				message: 'Wi-Fi Password',
				validate: function(val) {
					return !!val;
				}
			}], function(ans) {
				cb(ans.password + '\n', startTimeout.bind(self, 15000));
			});
		});

		st.addTrigger('Spark <3 you!', function() {
			resetTimeout();
			wifiDone.resolve();
		});

		st.addTrigger('Particle <3 you!', function() {
			resetTimeout();
			wifiDone.resolve();
		});

		serialPort.open(function (err) {
			if (err) {
				return wifiDone.reject(err);
			}

			serialPort.flush(function() {
				serialPort.on('data', function(data) {
					log.serialOutput(data.toString());
				});

				st.start();
				serialPort.write('w', function() {
					serialPort.drain();
				});
			});
		});

		when(wifiDone.promise).then(
			function () {
				console.log('Done! Your device should now restart.');
			},
			function (err) {
				log.error('Something went wrong:', err);
			});

		when(wifiDone.promise).ensure(function () {
			resetTimeout();
			serialPort.removeListener('close', serialClosedEarly);
			serialPort.close();
		});

		return wifiDone.promise;
	},

	_issueSerialCommand: function(device, command, timeout) {
		if (!device) {
			return when.reject('no serial port provided');
		}
		var failDelay = timeout || 5000;

		var serialPort;
		return when.promise(function (resolve, reject) {
			serialPort = new SerialPort(device.port, {
				baudrate: 9600,
				parser: SerialBoredParser.makeParser(250)
			}, false);

			var failTimer = setTimeout(function () {
				reject('Serial timed out');
			}, failDelay);

			serialPort.on('data', function (data) {
				clearTimeout(failTimer);
				resolve(data);
			});

			serialPort.open(function (err) {
				if (err) {
					console.error('Serial err: ' + err);
					console.error('Serial problems, please reconnect the device.');
					reject('Serial problems, please reconnect the device.');
					return;
				}

				serialPort.write(command, function (werr) {
					if (werr) {
						reject(err);
					}
				});
			});
		}).finally(function () {
			if (serialPort) {
				serialPort.removeAllListeners('open');
				serialPort.removeAllListeners('data');
				if (serialPort.isOpen()) {
					serialPort.close();
				}
			}
		});
	},

	getDeviceMacAddress: function (device) {
		if (!device) {
			return when.reject('getDeviceMacAddress - no serial port provided');
		}
		if (device.type === 'Core') {
			return when.reject('Unable to get MAC address of a Core');
		}

		return this._issueSerialCommand(device, 'm').then(function (data) {
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
				return mac;
			}
			throw new Error('Unable to find mac address in response');
		});
	},

	askForDeviceID: function (device) {
		if (!device) {
			return when.reject('askForDeviceID - no serial port provided');
		}

		return this._issueSerialCommand(device, 'i').then(function (data) {
			var matches = data.match(/Your (core|device) id is\s+(\w+)/);
			if (matches && matches.length === 3) {
				return matches[2];
			}
			var electronMatches = data.match(/\s+([a-fA-F0-9]{24})\s+/);
			if (electronMatches && electronMatches.length === 2) {
				var info = { id: electronMatches[1] };
				var imeiMatches = data.match(/IMEI: (\w+)/);
				if (imeiMatches) {
					info.imei = imeiMatches[1];
				}
				var iccidMatches = data.match(/ICCID: (\w+)/);
				if (iccidMatches) {
					info.iccid = iccidMatches[1];
				}

				return info;
			}
		});
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
	}
});

module.exports = SerialCommand;
