/**
 ******************************************************************************
 * @file    commands/SerialCommand.js
 * @author  David Middlecamp (david@particle.io)
 * @company Particle ( https://www.particle.io/ )
 * @source  https://github.com/spark/particle-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   Serial commands module
 ******************************************************************************
Copyright (c) 2016 Particle Industries, Inc.  All rights reserved.

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
var fs = require('fs');
var prompt = require('inquirer').prompt;

var path = require('path');
var when = require('when');
var sequence = require('when/sequence');
var extend = require('xtend');
var SerialPort = require('serialport');
var inquirer = require('inquirer');
var chalk = require('chalk');
var wifiScan = require('node-wifiscanner2').scan;
var specs = require('../oldlib/deviceSpecs');
var ApiClient = require('../oldlib/ApiClient2');
var OldApiClient = require('../oldlib/ApiClient');
var log = require('../oldlib/log');
var settings = require('../settings');
var DescribeParser = require('binary-version-reader').HalDescribeParser;
var YModem = require('../oldlib/ymodem');

var BaseCommand = require('./BaseCommand');
var utilities = require('../oldlib/utilities');
var SerialBatchParser = require('../oldlib/SerialBatchParser');
var SerialTrigger = require('../oldlib/SerialTrigger');

// TODO: DRY this up somehow
// The categories of output will be handled via the log class, and similar for protip.
var cmd = path.basename(process.argv[1]);
var arrow = chalk.green('>');
var alert = chalk.yellow('!');
var protip = function() {
	var args = Array.prototype.slice.call(arguments);
	args.unshift(chalk.cyan('!'), chalk.bold.white('PROTIP:'));
	console.log.apply(null, args);
};


var timeoutError = 'Serial timed out';

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
	timeoutError: timeoutError,
	init: function () {
		this.addOption('list', this.listDevices.bind(this), 'Show devices connected via serial to your computer');
		this.addOption('monitor', this.monitorSwitch.bind(this), 'Connect and display messages from a device');
		this.addOption('identify', this.identifyDevice.bind(this), 'Ask for and display device ID via serial');
		this.addOption('wifi', this.configureWifi.bind(this), 'Configure Wi-Fi credentials over serial');
		this.addOption('mac', this.deviceMac.bind(this), 'Ask for and display MAC address via serial');
		this.addOption('inspect', this.inspectDevice.bind(this), 'Ask for and display device module information via serial');
		this.addOption('flash', this.flashDevice.bind(this), 'Flash firmware over serial using YMODEM protocol');
		this.addOption('claim', this.claimDevice.bind(this), 'Claim a device with the given claim code');
		//this.addOption(null, this.helpCommand.bind(this));
	},

	findDevices: function (callback) {
		var devices = [];
		SerialPort.list(function (err, ports) {
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
					var serialNumber = deviceSpec.serial.serialNumber;

					var usbMatches = (port.vendorId === vid.toLowerCase() && port.productId === pid.toLowerCase());
					var pnpMatches = !!(port.pnpId && (port.pnpId.indexOf('VID_' + vid.toUpperCase()) >= 0) && (port.pnpId.indexOf('PID_' + pid.toUpperCase()) >= 0));
					var serialNumberMatches = port.serialNumber && port.serialNumber.indexOf(serialNumber) >= 0;

					return !!(usbMatches || pnpMatches || serialNumberMatches);

				});
				if (serialDeviceSpec) {
					device = {
						port: port.comName,
						type: serialDeviceSpec.productName,
						deviceId: serialDeviceSpec.serial.deviceId && serialDeviceSpec.serial.deviceId(port.serialNumber || port.pnpId),
						specs: serialDeviceSpec
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
					} else if (port.comName.indexOf('/dev/cuaU') === 0) {
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

	// TODO: Unfortunately we have to use this switch function in order to remove
	// the "--follow" argument before passing on to monitorPort.
	// This follows FlashCommand's precedent, but we should create a universal
	// way to handle this properly.
	monitorSwitch: function(comPort) {
		this.checkArguments(arguments);

		var args = Array.prototype.slice.call(arguments);
		if (this.options.follow) {
			//trim

			var idx = utilities.indexOf(args, '--follow');
			args.splice(idx, 1);
		}

		return this.monitorPort.apply(this, args);
	},

	monitorPort: function (comPort) {
		var cleaningUp = false;
		var selectedDevice;
		var serialPort;

		var displayError = function (err) {
			if (err) {
				console.error('Serial err: ' + err);
				console.error('Serial problems, please reconnect the device.');
			}
		};

		// Called when port closes
		var handleClose = function () {
			if (self.options.follow && !cleaningUp) {
				console.log(
					chalk.bold.white(
						'Serial connection closed.  Attempting to reconnect...'));
				reconnect();
			} else {
				console.log(chalk.bold.white('Serial connection closed.'));
			}
		};

		// Handle interrupts and close the port gracefully
		var handleInterrupt = function () {
			if (!cleaningUp) {
				console.log(chalk.bold.red('Caught Interrupt.  Cleaning up.'));
				cleaningUp = true;
				if (serialPort && serialPort.isOpen) {
					serialPort.close();
				}
			}
		};

		// Called only when the port opens successfully
		var handleOpen = function () {
			console.log(chalk.bold.white('Serial monitor opened successfully:'));
		};

		var handlePortFn = function (device) {
			if (!device) {
				if (self.options.follow) {
					setTimeout(function () {
						self.whatSerialPortDidYouMean(comPort, true, handlePortFn);
					}, 5);
					return;
				} else {
					console.error(chalk.bold.white('No serial device identified'));
				return;
			}
			}

			console.log('Opening serial monitor for com port: "' + device.port + '"');
			selectedDevice = device;
			openPort();
		};

		var openPort = function () {
			serialPort = new SerialPort(selectedDevice.port, {
				baudRate: 9600,
				autoOpen: false
			});
			serialPort.on('close', handleClose);
			serialPort.on('readable', function () {
				process.stdout.write(port.read().toString());
			});
			serialPort.on('error', displayError);
			serialPort.open(function (err) {
				if (err && self.options.follow) {
					reconnect(selectedDevice);
				} else if (err) {
					displayError(err);
				} else {
					handleOpen();
				}
			});
		};

		var reconnect = function () {
			setTimeout(function () {
				openPort(selectedDevice);
			}, 5);
		};

		process.on('SIGINT', handleInterrupt);
		process.on('SIGQUIT', handleInterrupt);
		process.on('SIGTERM', handleInterrupt);
		process.on('exit', handleInterrupt);

		if (this.options.follow) {
			console.log('Polling for available serial device...');
		}

		var self = this;
		this.whatSerialPortDidYouMean(comPort, true, handlePortFn);
	},

	/**
	 * Check to see if the device is in listening mode, try to get the device ID via serial
	 * @param {Number|String} comPort
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
					} else {
						console.log();
						console.log('Your device id is', chalk.bold.cyan(data));
					}

					return self.askForSystemFirmwareVersion(device, 2000)
						.then(function(version) {
							console.log('Your system firmware version is', chalk.bold.cyan(version));
						})
						.catch(function(err) {
							console.log('Unable to determine system firmware version');
							return when.resolve();
						});
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

	inspectDevice: function(comPort) {
		var self = this;
		this.whatSerialPortDidYouMean(comPort, true, function (device) {
			if (!device) {
				return self.error('No serial port identified');
			}

			var functionMap = {
				s: 'System',
				u: 'User',
				b: 'Bootloader',
				r: 'Reserved',
				m: 'Monolithic'
			};
			var locationMap = {
				m: 'main',
				b: 'backup',
				f: 'factory',
				t: 'temp'
			};

			self.getSystemInformation(device)
				.then(function (data) {
					var d = JSON.parse(data);
					var parser = new DescribeParser();
					var modules = parser.getModules(d);

					if (d.p !== undefined) {
						var platformName = settings.knownPlatforms[d.p];
						console.log('Platform:', d.p, platformName ? ('- ' + chalk.bold.cyan(platformName)) : '');
					}
					if (modules && modules.length > 0) {
						console.log(chalk.underline('Modules'));
						modules.forEach(function(m) {
							var func = functionMap[m.func];
							if (!func) {
								console.log(util.format('  empty - %s location, %d bytes max size', locationMap[m.location], m.maxSize));
								return;
							}

							console.log(util.format('  %s module %s - version %s, %s location, %d bytes max size', chalk.bold.cyan(func), chalk.bold('#' + m.name), chalk.bold(m.version), locationMap[m.location], m.maxSize));

							if (m.isUserModule() && m.uuid) {
								console.log('    UUID:', m.uuid);
							}

							console.log('    Integrity: %s', m.hasIntegrity() ? chalk.green('PASS') : chalk.red('FAIL'));
							console.log('    Address Range: %s', m.isImageAddressInRange() ? chalk.green('PASS') : chalk.red('FAIL'));
							console.log('    Platform: %s', m.isImagePlatformValid() ? chalk.green('PASS') : chalk.red('FAIL'));
							console.log('    Dependencies: %s', m.areDependenciesValid() ? chalk.green('PASS') : chalk.red('FAIL'));
							if (m.dependencies.length > 0) {
								m.dependencies.forEach(function(dep) {
									var df = functionMap[dep.func];
									console.log(util.format('      %s module #%d - version %d', df, dep.name, dep.version));
								});
							}
						});
					}
				})
				.catch(function (err) {
					self.error(err, false);
				});
		});
	},

	_promptForListeningMode: function() {
		return when.promise(function(resolve, reject) {
			console.log(
				chalk.cyan('!'),
				'PROTIP:',
				chalk.white('Hold the'),
				chalk.cyan('SETUP'),
				chalk.white('button on your device until it'),
				chalk.cyan('blinks blue!')
			);

			prompt([
				{
					type: 'input',
					name: 'listening',
					message: 'Press ' + chalk.bold.cyan('ENTER') + ' when your device is blinking ' + chalk.bold.blue('BLUE')
				}
			]).then(function() {
				resolve();
			});
		});
	},

	flashDevice: function(firmware) {
		var self = this;
		settings.verboseOutput = false;

		this._promptForListeningMode().then(function() {
			self.whatSerialPortDidYouMean(null, true, function(device) {
				if (!device) {
					return self.error('No serial port identified');
				}
				if (device.type === 'Core') {
					return self.error('serial flashing is not supported on the Core');
				}

				var complete = sequence([
					function() {
						//only match against knownApp if file is not found
						var stats;
						try {
							stats = fs.statSync(firmware);
						} catch (ex) {
							// file does not exist
							var specsByProduct = _.indexBy(specs, 'productName');
							var productSpecs = specsByProduct[device.type];
							firmware = productSpecs && productSpecs.knownApps[firmware];
							if (firmware === undefined) {
								return when.reject('file does not exist and no known app found.');
							} else {
								return;
							}
						}

						if (!stats.isFile()){
							return when.reject('You cannot flash a directory over USB');
						}
					},
					function() {
						var serialPort = new SerialPort(device.port, {
							baudRate: 28800,
							autoOpen: false
						});

						function closePort() {
							if (serialPort.isOpen) {
								serialPort.close();
							}
							process.exit(0);
						}
						process.on('SIGINT', closePort);
						process.on('SIGTERM', closePort);

						var ymodem = new YModem(serialPort, { debug: true });
						return ymodem.send(firmware);
					}
				]);

				return complete.then(function() {
					console.log('\nFlash success!');
				}, function(err) {
					self.error('\nError writing firmware...' + err + '\n' + err.stack, true);
				});
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

			// todo - if the prompt is auto answering, then only auto answer once, to prevent
			// never ending loops
			if (networkList.length === 0) {
				self.prompt([{
					type: 'confirm',
					name: 'rescan',
					message: 'Uh oh, no networks found. Try again?',
					default: true
				}]).then(function(answers) {
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
		settings.verboseOutput = true;

		function parameterMissing(param) {
			return 'The "'+param+'" parameter was missing. Please specify a filename of a valid JSON object, ie {"network":"myNetwork","security":"WPA_AES","channel":2,"password":"mySecret!"}';
		}

		var wifi = when.defer();
		this.checkArguments(arguments);

        // So we can read it inside the function
        var args = arguments;

		this.whatSerialPortDidYouMean(comPort, true, function (device) {
			function parameterMissing(param) {
				return 'The "'+param+'" parameter was missing. Please specify a filename of a valid JSON object, ie {"network":"myNetwork","security":"WPA_AES","channel":2,"password":"mySecret!"}';
			}

			if (!device) {
				return self.error('No serial port identified');
			}

            // Lets track whether we found a json argument
            var json = null;

            Object.keys(args).forEach(function (key) {
                if (args[key].indexOf(".json") != -1) {
                    // Save it
                    json = args[key];
                }
            });

            /*
            for (var i=0; i<args.length; i++) {
                console.log(i, ":", arr[i]);
                if (args[i].indexOf(".json") != -1) {
                    // Save it
                    json = args[i];
                    break;
                }
            }
            */

            // Did we find it?
            if (json){
                console.log('Using Wi-Fi config file: ', json);

                // Directly
                var obj = JSON.parse(fs.readFileSync(json, "utf-8"));

                if (!obj.hasOwnProperty('network') || obj.network.length < 2){
                    _jsonErr(parameterMissing('network'));
                } else {
                    var ssid = obj.network;
                }
                if (!obj.hasOwnProperty('password') || obj.password.length < 2){
	                _jsonErr(parameterMissing('password'));
                } else {
                    var password = obj.password;
                }
                if (!obj.hasOwnProperty('security') || obj.security.length < 2){
	                _jsonErr(parameterMissing('security'));
                }else {
                    var security = obj.security;
                }

                // Configure it
                self.serialWifiConfig(device, ssid, security, password).then(wifi.resolve, wifi.reject); //.then(self.wifiInfo.resolve, self.wifiInfo.reject);
            } else {
            	self._promptWifiScan(wifi, device);
            }
		});

		return wifi.promise;
	},

	_promptWifiScan(wifi, device) {
		var self = this;
		self.prompt([
			{
				type: 'confirm',
				name: 'scan',
				message: chalk.bold.white('Should I scan for nearby Wi-Fi networks?'),
				default: true
			}
		]).then(function (ans) {
			if (ans.scan) {
				return self._scanNetworks(function (networks) {
					self._getWifiInformation(device, networks).then(wifi.resolve, wifi.reject);
				});
			} else {
				self._getWifiInformation(device).then(wifi.resolve, wifi.reject);
			}
		});
	},

    _jsonErr: function(err) {
        return console.log(chalk.red('!'), 'An error occurred:', err);
    },

	_removePhotonNetworks: function(ssids) {
		return ssids.filter(function (ap) {
			if (ap.indexOf('Photon-') === 0) {
				return false;
			}
			return true;
		});
	},

	_getWifiInformation: function(device, networks) {
		var wifiInfo = when.defer();
		var self = this;
		var rescanLabel = '[rescan networks]';

		networks = networks || [];
		var networkMap = _.indexBy(networks, 'ssid');

		var ssids = _.pluck(networks, 'ssid');
		ssids = this._removePhotonNetworks(ssids);

		self.prompt([
			{
				type: 'list',
				name: 'ap',
				message: chalk.bold.white('Select the Wi-Fi network with which you wish to connect your device:'),
				choices: function () {
					var ns = ssids.slice();
					ns.unshift(new inquirer.Separator());
					ns.unshift(rescanLabel);
					ns.unshift(new inquirer.Separator());

					return ns;
				},
				when: function () {
					return networks.length;
				}
			},
			{
				type: 'confirm',
				name: 'detectSecurity',
				message: chalk.bold.white('Should I try to auto-detect the wireless security type?'),
				when: function (answers) {
					return !!answers.ap && !!networkMap[answers.ap] && !!networkMap[answers.ap].security;
				},
				default: true
			}
		]).then(function (answers) {
			if (answers.ap === rescanLabel) {
				return self._scanNetworks(function (networks) {
					self._getWifiInformation(device, networks).then(wifiInfo.resolve, wifiInfo.reject);
				});
			}

			var ssid = answers.ap;
			var ap = networkMap[ssid];
			var security = answers.detectSecurity && ap && ap.security;
			if (security) {
				console.log(arrow, 'Detected', security, 'security');
			}

			self.serialWifiConfig(device, ssid, security).then(wifiInfo.resolve, wifiInfo.reject);
		});

		return wifiInfo.promise;
	},

	supportsClaimCode: function(device) {
		if (!device) {
			return when.reject('No serial port available');
		}
		return this._issueSerialCommand(device, 'c', 500).then(function (data) {
			var matches = data.match(/Device claimed: (\w+)/);
			return !!matches;
		}).catch(function(err) {
			if (err!==timeoutError) {
				throw err;
			}
			return false;
		});
	},

	/**
	 * Performs device setup via serial. The device should already be in listening mode.
	 * Setup comprises these steps:
	 * - fetching the claim code from the API
	 * - setting the claim code on the device
	 * - configuring
	 * @param device
	 */
	setup: function(device) {
		var self = this;
		var _deviceID = '';
		var api = new ApiClient();

		// todo - factor this out from here and also the WiFiCommand
		function getClaim() {
			self.newSpin('Obtaining magical secure claim code from the cloud...').start();
			api.getClaimCode(undefined, afterClaim);
		}
		function afterClaim(err, dat) {
			self.stopSpin();
			if (err) {
				// TODO: Graceful recovery here
				// How about retrying the claim code again
				// console.log(arrow, arrow, err);
				if (err.code === 'ENOTFOUND') {
					protip("Your computer couldn't find the cloud...");
				} else {
					protip('There was a network error while connecting to the cloud...');
				}
				protip('We need an active internet connection to successfully complete setup.');
				protip('Are you currently connected to the internet? Please double-check and try again.');
				return;
			}

			console.log(arrow, 'Obtained magical secure claim code.');
			console.log();
			return self.sendClaimCode(device, dat.claim_code)
				.then(function() {
					console.log('Claim code set. Now setting up Wi-Fi');
					// todo - add additional commands over USB to have the device scan for Wi-Fi
					var wifi = when.defer();
					self._promptWifiScan(wifi, device);
					return wifi.promise;
				})
				.then(revived);
		}

		function revived() {
			// if (err) {
			// 	manualReconnectPrompt();
			// 	return;
			// }

			self.stopSpin();
			self.newSpin("Attempting to verify the Photon's connection to the cloud...").start();

			setTimeout(function () {
				api.listDevices(checkDevices);
			}, 2000);
		}

		function updateWarning() {

		}

		function checkDevices(err, dat) {
			self.stopSpin();
			if (err) {
				if (err.code === 'ENOTFOUND') {
					// todo - limit the number of retries here.
					console.log(alert, 'Network not ready yet, retrying...');
					console.log();
					return revived(null);
				}
				console.log(alert, 'Unable to verify your Photon\'s connection.');
				console.log(alert, "Please make sure you're connected to the internet.");
				console.log(alert, 'Then try', chalk.bold.cyan(cmd + ' list'), "to verify it's connected.");
				updateWarning();
				self.exit();
			}

			// self.__deviceID -> _deviceID
			var onlinePhoton = _.find(dat, function (device) {
				return (device.id.toUpperCase() === _deviceID.toUpperCase()) && device.connected === true;
			});

			if (onlinePhoton) {
				console.log(arrow, 'It looks like your Photon has made it happily to the cloud!');
				console.log();
				updateWarning();
				namePhoton(onlinePhoton.id);
				return;
			}

			console.log(alert, "It doesn't look like your Photon has made it to the cloud yet.");
			console.log();
			self.prompt([{

				type: 'list',
				name: 'recheck',
				message: 'What would you like to do?',
				choices: [
					{ name: 'Check again to see if the Photon has connected', value: 'recheck' },
					{ name: 'Reconfigure the Wi-Fi settings of the Photon', value: 'reconfigure' }
				]

			}]).then(recheck);

			function recheck(ans) {
				if (ans.recheck === 'recheck') {
					api.listDevices(checkDevices);
				} else {
					self._promptForListeningMode()
					self.setup(device);
				}
			}
		}

		function namePhoton(deviceId) {
			var __oldapi = new OldApiClient();

			self.prompt([
				{
					type: 'input',
					name: 'deviceName',
					message: 'What would you like to call your Photon (Enter to skip)?'
				}
			]).then(function(ans) {
				// todo - retrieve existing name of the device?
				var deviceName = ans.deviceName;
				if (deviceName) {
					__oldapi.renameDevice(deviceId, deviceName).then(function () {
						console.log();
						console.log(arrow, 'Your Photon has been given the name', chalk.bold.cyan(deviceName));
						console.log(arrow, "Congratulations! You've just won the internet!");
						console.log();
						self.exit();
					}, function (err) {
						console.error(alert, 'Error naming your Photon: ', err);
						namePhoton(deviceId);
					});
				} else {
					console.log('Skipping device naming.');
					self.exit();
				}
			});
		}

		return self.askForDeviceID(device).
			then(function (deviceID) {
				_deviceID = deviceID;
				console.log('setting up device', deviceID);
				return getClaim();
			})
			.catch(function (err) {
				self.stopSpin();
				console.log(err);
				throw err;
			});
	},

	setDeviceClaimCode: function (device, claimCode) {
		var self = this;
		return this.supportsClaimCode(device).then(function (supported) {
			if (!supported) {
				return when.reject('device does not support claiming over USB');
			}

			return self.sendClaimCode(device, claimCode);
		});
	},

	claimDevice: function (comPort, claimCode) {
		var self = this;
		if (!claimCode) {
			// todo - why do we need to duplicate exceptions?
			log.error('claimCode required');
			return when.reject('claimCode required');
		}

		return this.whatSerialPortDidYouMean(comPort, true, function (device) {
			return self.sendClaimCode(device, claimCode)
				.then(function () {
					console.log('Claim code set.');
					return true;
				});
		});
	},

	sendClaimCode: function (device, claimCode, withLogging) {
		var prompt = 'Enter 63-digit claim code: ';
		var confirmation = 'Claim code set to: '+claimCode;
		return this.doSerialInteraction(device, 'C', [
			[ prompt, 2000, function(promise, next) {
				next(claimCode+'\n');
			}],
			[ confirmation, 2000, function(promise, next) {
				next();
				promise.resolve();
			}]
		], !withLogging);
	},

	/**
	 *
	 * @param {Device} device        The device to interact with
	 * @param {String} command      The initial command to send to the device
	 * @param {Array} interactions  an array of interactions. Each interaction is
	 *  an array, with these elements:
	 *  [0] - the prompt text to interact with
	 *  [1] - the timeout to wait for this prompt
	 *  [2] - the callback when the prompt has been received. The callback takes
	 *      these arguments:
	 *          promise: the deferred result (call resolve/reject)
	 *          next: the response callback, should be called with (response) to send a response.
	 *              Response can be undefined
	 * $param {Boolean} nologging   when truthy, logging is disabled.
	 * @returns {Promise}
	 */
	doSerialInteraction: function(device, command, interactions, noLogging) {
		if (!device) {
			return when.reject('No serial port available');
		}

		if (!interactions.length) {
			return when.resolve();
		}

		var serialPort = this.serialPort || new SerialPort(device.port, {
			baudRate: 9600,
			autoOpen: false
		});
		var parser = new SerialBatchParser({ timeout: 250 });
		serialPort.pipe(parser);

		var done = when.defer();
		serialPort.on('error', function (err) {
			done.reject(err);
		});
		function serialClosedEarly() {
			done.reject('Serial port closed early');
		}
		serialPort.on('close', serialClosedEarly);

		var self = this;
		function startTimeout(to) {
			self._serialTimeout = setTimeout(function () {
				done.reject('Serial timed out');
			}, to);
		}
		function resetTimeout() {
			clearTimeout(self._serialTimeout);
			self._serialTimeout = null;
		}

		var st = new SerialTrigger(serialPort, parser);

		var addTrigger = function (prompt, timeout, callback) {
			st.addTrigger(prompt, function (cb) {
				resetTimeout();
				function next(response) {
					cb(response, timeout ? startTimeout.bind(self, timeout) : undefined);
				}
				callback(done, next);
			});
		};

		var prompt = interactions[0][0];
		var callback = interactions[0][2];
		for (var i=1; i<interactions.length; i++) {
			var timeout = interactions[i][1];
			addTrigger(prompt, timeout, callback);
			prompt = interactions[i][0];
			callback = interactions[i][2];
		}
		// the last interaction completes without a timeout
		addTrigger(prompt, undefined, callback);

		serialPort.open(function (err) {
			if (err) {
				return done.reject(err);
			}

			parser.on('data', function(data) {
				if (!noLogging) {
					log.serialOutput(datatoString());
				}
			});

			st.start(noLogging);
			var next = function () {
				startTimeout(interactions[0][1]);
			};
			if (command) {
				serialPort.write(command);
				serialPort.drain(next);
			} else {
				next();
			}
		});

		when(done.promise).finally(function () {
			resetTimeout();
			serialPort.removeListener('close', serialClosedEarly);
			return when.promise(function (resolve) {
				serialPort.close(resolve);
			});
		});

		return done.promise;
	},

	serialWifiConfig: function (device, ssid, securityType, password, opts) {
		if (!device) {
			return when.reject('No serial port available');
		}

		if (!opts) {
			opts = {};
		}

		var isEnterprise = false;

		log.verbose('Attempting to configure Wi-Fi on ' + device.port);

		var serialPort = this.serialPort || new SerialPort(device.port, {
			baudRate: 9600,
			autoOpen: false
		});
		var parser = new SerialBatchParser({ timeout: 250 });
		serialPort.pipe(parser);

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

		var st = new SerialTrigger(serialPort, parser);

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
			}]).then(function(ans) {
				cb(ans.ssid + '\n', startTimeout.bind(self, 5000));
			});
		});

		function parseSecurityType(ent, cb) {
			resetTimeout();
			if (securityType) {
				var security = 3;
				if (securityType.indexOf('WPA2') >= 0 && securityType.indexOf('802.1x') >= 0) {
					security = 5;
					isEnterprise = true;
				} else if (securityType.indexOf('WPA') >= 0 && securityType.indexOf('802.1x') >= 0) {
					security = 4;
					isEnterprise = true;
				} else if (securityType.indexOf('WPA2') >= 0) {
					security = 3;
				} else if (securityType.indexOf('WPA') >= 0) {
					security = 2;
				} else if (securityType.indexOf('WEP') >= 0) {
					security = 1;
				} else if (securityType.indexOf('NONE') >= 0) {
					security = 0;
				}

				return cb(security + '\n', startTimeout.bind(self, 10000));
			}

			var choices = [
				{ name: 'WPA2', value: 3 },
				{ name: 'WPA', value: 2 },
				{ name: 'WEP', value: 1 },
				{ name: 'Unsecured', value: 0 }
			];

			if (ent) {
				choices.push({name: 'WPA Enterprise', value: 4});
				choices.push({name: 'WPA2 Enterprise', value: 5});
			}

			inquirer.prompt([{
				type: 'list',
				name: 'security',
				message: 'Security Type',
				choices: choices
			}]).then(function(ans) {
				if (ans.security > 3) {
					isEnterprise = true;
				}
				cb(ans.security + '\n', startTimeout.bind(self, 10000));
			});
		}

		st.addTrigger('Security 0=unsecured, 1=WEP, 2=WPA, 3=WPA2:', parseSecurityType.bind(null, false));
		st.addTrigger('Security 0=unsecured, 1=WEP, 2=WPA, 3=WPA2, 4=WPA Enterprise, 5=WPA2 Enterprise:', parseSecurityType.bind(null, true));

		st.addTrigger('Security Cipher 1=AES, 2=TKIP, 3=AES+TKIP:', function(cb) {
			resetTimeout();
			if (securityType !== undefined) {
				var cipherType = 1;
				if (securityType.indexOf('AES') >= 0 && securityType.indexOf('TKIP') >= 0) {
					cipherType = 3;
				} else if (securityType.indexOf('TKIP') >= 0) {
					cipherType = 2;
				} else if (securityType.indexOf('AES') >= 0) {
					cipherType = 1;
				}

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
			}]).then(function(ans) {
				cb(ans.cipher + '\n', startTimeout.bind(self, 5000));
			});
		});

		st.addTrigger('EAP Type 0=PEAP/MSCHAPv2, 1=EAP-TLS:', function(cb) {
			resetTimeout();

			isEnterprise = true;

			if (opts.eap !== undefined) {
				var eapType = 0;
				if (opts.eap.toLowerCase().indexOf('peap') >= 0) {
					eapType = 0;
				} else if (opts.eap.toLowerCase().indexOf('tls')) {
					eapType = 1;
				}
				return cb(eapType + '\n', startTimeout.bind(self, 5000));
			}

			inquirer.prompt([{
				type: 'list',
				name: 'eap',
				message: 'EAP Type',
				choices: [
					{ name: 'PEAP/MSCHAPv2', value: 0 },
					{ name: 'EAP-TLS', value: 1 }
				]
			}]).then(function(ans) {
				cb(ans.eap + '\n', startTimeout.bind(self, 5000));
			});
		});

		st.addTrigger('Username:', function(cb) {
			resetTimeout();

            if (opts.username) {
                cb(opts.username + '\n', startTimeout.bind(self, 15000));
            } else {
                inquirer.prompt([{
                    type: 'input',
                    name: 'username',
                    message: 'Username',
                    validate: function (val) {
                        return !!val;
                    }
                }]).then(function (ans) {
                    cb(ans.username + '\n', startTimeout.bind(self, 15000));
                });
            }
		});

		st.addTrigger('Outer identity (optional):', function(cb) {
			resetTimeout();

            if (opts.outer_identity) {
                cb(opts.outer_identity.trim + '\n', startTimeout.bind(self, 15000));
            } else {
                inquirer.prompt([{
                    type: 'input',
                    name: 'outer_identity',
                    message: 'Outer identity (optional)'
                }]).then(function (ans) {
                    cb(ans.outer_identity + '\n', startTimeout.bind(self, 15000));
                });
            }
		});

		st.addTrigger('Client certificate in PEM format:', function(cb) {
			resetTimeout();

            if (opts.client_certificate) {
                cb(opts.client_certificate.trim() + '\n\n', startTimeout.bind(self, 15000));
            } else {
                inquirer.prompt([{
                    type: 'editor',
                    name: 'client_certificate',
                    message: 'Client certificate in PEM format',
                    validate: function (val) {
                        return !!val;
                    }
                }]).then(function (ans) {
                    cb(ans.client_certificate.trim() + '\n\n', startTimeout.bind(self, 15000));
                });
            }
		});

		st.addTrigger('Private key in PEM format:', function(cb) {
			resetTimeout();

            if (opts.private_key) {
                cb(opts.private_key.trim() + '\n\n', startTimeout.bind(self, 15000));
            } else {
                inquirer.prompt([{
                    type: 'editor',
                    name: 'private_key',
                    message: 'Private key in PEM format',
                    validate: function (val) {
                        return !!val;
                    }
                }]).then(function (ans) {
                    cb(ans.private_key.trim() + '\n\n', startTimeout.bind(self, 15000));
                });
            }
		});

		st.addTrigger('Root CA in PEM format (optional):', function(cb) {
			resetTimeout();

            if (opts.root_ca) {
                cb(opts.root_ca.trim() + '\n\n', startTimeout.bind(self, 15000));
            } else {
            	inquirer.prompt([
            	{
            		type: 'confirm',
            		name: 'provide_root_ca',
            		message: 'Would you like to provide CA certificate?',
            		default: true
            	},
            	{
					type: 'editor',
                    name: 'root_ca',
                    message: 'CA certificate in PEM format',
                    when: function(answers) {
                    	return answers.provide_root_ca;
                    },
                    validate: function (val) {
                        return !!val;
                    },
                    default: ''
            	}
            	]).then(function (ans) {
            		if (ans.root_ca === undefined) {
            			ans.root_ca = '';
            		}
                    cb(ans.root_ca.trim() + '\n\n', startTimeout.bind(self, 15000));
            	});
            }
		});


		st.addTrigger('Password:', function(cb) {
			resetTimeout();
            // Skip password prompt as appropriate
            if (password){
                //console.log('Password: ' + password);
                cb(password + '\n', startTimeout.bind(self, 15000));

            } else {
                inquirer.prompt([{
                    type: 'input',
                    name: 'password',
                    message: !isEnterprise ? 'Wi-Fi Password' : 'Password',
                    validate: function (val) {
                        return !!val;
                    }
                }]).then(function (ans) {
                    cb(ans.password + '\n', startTimeout.bind(self, 15000));
                });
            }
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

			st.start(true);
			serialPort.write('w');
			serialPort.drain();
		});

		when(wifiDone.promise).then(
			function () {
				console.log('Done! Your device should now restart.');
			},
			function (err) {
				log.error('Something went wrong:', err);
			});

		when(wifiDone.promise).finally(function () {
			resetTimeout();
			serialPort.removeListener('close', serialClosedEarly);
			return when.promise(function (resolve) {
				serialPort.close(resolve);
			});
		});

		return wifiDone.promise;
	},

	/**
	 * Sends a command to the device and retrieves the response.
	 * @param device    The device to send the command to
	 * @param command   The command text
	 * @param timeout   How long in milliseconds to wait for a response
	 * @returns {Promise} to send the command.
	 * The serial port should not be open, and is closed after the command is sent.
	 * @private
	 */
	_issueSerialCommand: function(device, command, timeout) {
		if (!device) {
			return when.reject('no serial port provided');
		}
		var failDelay = timeout || 5000;

		var serialPort;
		var self = this;
		return when.promise(function (resolve, reject) {
			serialPort = self.serialPort || new SerialPort(device.port, {
				baudRate: 9600,
				autoOpen: false
			});
			var parser = new SerialBatchParser({ timeout: 250 });
			serialPort.pipe(parser);

			var failTimer = setTimeout(function () {
				reject(timeoutError);
			}, failDelay);

			parser.on('data', function (data) {
				clearTimeout(failTimer);
				resolve(data.toString());
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
				if (serialPort.isOpen) {
					return when.promise(function (resolve) {
						serialPort.close(resolve);
					});
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

	getSystemInformation: function(device) {
		if (!device) {
			return when.reject('getSystemInformation - no serial port provided');
		}

		return this._issueSerialCommand(device, 's');
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

	askForSystemFirmwareVersion: function(device, timeout) {
		if (!device) {
			return when.reject('askForSystemFirmwareVersion - no serial port provided');
		}

		return this._issueSerialCommand(device, 'v', timeout).then(function (data) {
			var matches = data.match(/system firmware version:\s+([\w.]+)/);
			if (matches && matches.length === 2) {
				return matches[1];
			}
		});
	},

	sendDoctorAntenna: function(device, antenna, timeout) {
		if (!device) {
			return when.reject('sendDoctorAntenna - no serial port provided');
		}

		var antennaValues = {
			'Internal': 'i',
			'External': 'e'
		};
		var command = 'a' + antennaValues[antenna];

		return this._issueSerialCommand(device, command, timeout).then(function (data) {
			return data;
		});
	},

	sendDoctorIP: function(device, mode, ipAddresses, timeout) {
		if (!device) {
			return when.reject('sendDoctorIP - no serial port provided');
		}

		var modeValues = {
			'Dynamic IP': 'd',
			'Static IP': 's'
		};
		var command = 'i' + modeValues[mode];

		if (mode === 'Static IP') {
			var ipAddressValues = [ipAddresses.device_ip, ipAddresses.netmask, ipAddresses.gateway, ipAddresses.dns];
			var ipAddressesInt = _.map(ipAddressValues, this._ipToInteger);
			command += ipAddressesInt.join(' ') + '\n';
		}

		return this._issueSerialCommand(device, command, timeout).then(function (data) {
			return data;
		});
	},

	sendDoctorSoftAPPrefix: function(device, prefix, timeout) {
		if (!device) {
			return when.reject('sendDoctorSoftAPPrefix - no serial port provided');
		}

		var command = 'p' + prefix + '\n';

		return this._issueSerialCommand(device, command, timeout).then(function (data) {
			return data;
		});
	},

	sendDoctorClearEEPROM: function(device, timeout) {
		if (!device) {
			return when.reject('sendDoctorClearEEPROM - no serial port provided');
		}

		var command = 'e';

		return this._issueSerialCommand(device, command, timeout).then(function (data) {
			return data;
		});
	},

	sendDoctorClearWiFi: function(device, timeout) {
		if (!device) {
			return when.reject('sendDoctorClearWiFi - no serial port provided');
		}

		var command = 'c';

		return this._issueSerialCommand(device, command, timeout).then(function (data) {
			return data;
		});
	},

	sendDoctorListenMode: function(device, timeout) {
		if (!device) {
			return when.reject('sendDoctorListenMode - no serial port provided');
		}

		var command = 'l';

		return this._issueSerialCommand(device, command, timeout).then(function (data) {
			return data;
		});
	},

	_ipToInteger: function (ip) {
		var parts = ip.split('.');
		if (parts.length !== 4) {
			return 0;
		}

		return (((parts[0] * 256) + parts[1]) * 256 + parts[2]) * 256 + parts[3];
	},

	_parsePort: function(devices, comPort) {
		if (!comPort) {
			//they didn't give us anything.
			if (devices.length === 1) {
				//we have exactly one device, use that.
				return devices[0];
			}
			//else - which one?
		} else {
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
			} else {
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
				return callback(undefined);
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
			]).then(function (answers) {
				callback(answers.port);
			});
		});
	},

	// todo - any reason not to move this down to BaseCommand, or better still to a set of utility functions
	exit: function() {
		console.log();
		console.log(arrow, chalk.bold.white('Ok, bye! Don\'t forget `' +
			chalk.bold.cyan(cmd + ' help') + '` if you\'re stuck!',
			chalk.bold.magenta('<3'))
		);
		process.exit(0);
	},

	prompt: prompt
});



module.exports = SerialCommand;
