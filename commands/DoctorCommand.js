'use strict';
var extend = require('xtend');
var util = require('util');
var when = require('when');
var pipeline = require('when/pipeline');
var _ = require('lodash');
var chalk = require('chalk');
var inquirer = require('inquirer');
var prompt = inquirer.prompt;
var dfu = require('../dist/lib/dfu.js');
var ApiClient = require('../dist/lib/ApiClient.js');
var BaseCommand = require('./BaseCommand');

var EarlyReturnError = function () {
};
var SkipStepError = function () {
};

var DoctorCommand = function (cli, options) {
	DoctorCommand.super_.call(this, cli, options);
	this.options = extend({}, this.options, options);

	this.init();
};
util.inherits(DoctorCommand, BaseCommand);
DoctorCommand.prototype = extend(BaseCommand.prototype, {
	options: null,
	name: 'doctor',
	description: 'Puts your device back into a healthy state.',
	deviceTimeout: 3000,
	serialTimeout: 3000,

	init: function () {
		this.addOption('*', this.deviceDoctor.bind(this), 'Puts your device back into a healthy state');
	},

	deviceDoctor: function () {
		return pipeline([
			this._showDoctorWelcome.bind(this),
			this._setupApi.bind(this),
			this._findDevice.bind(this),
			this._nameDevice.bind(this),
			this._updateSystemFirmware.bind(this),
			this._updateCC3000.bind(this),
			this._flashDoctor.bind(this),
			this._selectAntenna.bind(this),
			this._selectIP.bind(this),
			this._resetSoftAPPrefix.bind(this),
			this._clearEEPROM.bind(this),
			this._setupWiFi.bind(this),
			this._resetKeys.bind(this),
			this._flashTinker.bind(this),
			this._showDoctorGoodbye.bind(this)
		]).catch(this._showDoctorError.bind(this));
	},

	_showDoctorWelcome: function() {
		console.log(chalk.bold.white('The Device Doctor will put your device back into a healthy state'));
		console.log('It will:');
		_.map([
			'Upgrade system firmware',
			'Flash the default Tinker app',
			'Reset the device and server keys',
			'Clear the Wi-Fi settings',
		], function (line) {
			console.log('  - ' + line);
		});
	},

	_setupApi: function() {
		this.api = new ApiClient();
		if (!this.api.ready()) {
			throw new EarlyReturnError();
		}
	},

	_findDevice: function() {
		var serialCommand = this.cli.getCommandModule('serial');
		return when.promise(function (resolve) {
			// Try to find a "normal" mode device through the serial port
			serialCommand.findDevices(resolve);
		}).then(function (devices) {
			if (devices.length === 0) {
				// Try to find a "DFU" mode device through dfu-util
				return dfu.listDFUDevices();
			} else {
				return devices;
			}
		}).then(function (devices) {
			this.device = devices && devices[0];
			return devices;
		}.bind(this));
	},

	_nameDevice: function(devices) {
		if (devices.length === 0) {
			console.log('');
			console.log(chalk.cyan('>'), 'Connect a Particle device to a USB port and run the command again.');
			throw new EarlyReturnError();
		}

		if (devices.length > 1) {
			console.log('');
			console.log(chalk.cyan('!'), 'You have ' + devices.length + ' devices connected to USB ports.');
			console.log(chalk.cyan('!'), 'To avoid confusion, disconnect all but the one device and run the command again.');
			throw new EarlyReturnError();
		}

		var deviceName = this.device.type || 'Device';
		console.log('');
		console.log('The Doctor will operate on your ' + deviceName + ' connected over USB');
		console.log("You'll be asked to put your device in DFU mode several times to reset different settings.");
	},

	_enterDfuMode: function() {
		console.log('Put the device in ' + chalk.bold.yellow('DFU mode'));
		console.log('Tap ' + chalk.bold.cyan('RESET/RST') + ' while holding ' + chalk.bold.cyan('MODE/SETUP') +
			' until the device blinks ' + chalk.bold.yellow('yellow.'));
		return this._promptReady();
	},

	_promptReady: function() {
		return prompt([{
			type: 'list',
			name: 'choice',
			message: 'Select Continue when ready',
			choices: ['Continue', 'Skip step', 'Exit']
		}]).then(function (ans) {
			switch (ans.choice) {
				case 'Skip step':
					throw new SkipStepError();
				case 'Exit':
					throw new EarlyReturnError();
				default:
					return;
			}
		});
	},

	_catchSkipStep: function(e) {
		if (e instanceof SkipStepError) {
			return;
		} else {
			throw e;
		}
	},

	_displayStepTitle: function(title) {
		console.log(chalk.bold.white('\n' + title + '\n'));
	},

	_updateSystemFirmware: function() {
		if (!this._deviceHasFeature('system-firmware')) {
			return;
		}

		this._displayStepTitle('Updating system firmware');
		return this._enterDfuMode()
			.then(function() {
				return this.cli.runCommand('update');
			}.bind(this)).catch(this._catchSkipStep);
	},

	_updateCC3000: function() {
		if (!this._deviceHasFeature('cc3000')) {
			return;
		}

		this._displayStepTitle('Updating CC3000 firmware');
		return this._enterDfuMode()
			.then(function() {
				return this.cli.runCommand('flash', ['--usb', 'cc3000']);
			}.bind(this)).then(function() {
				console.log('Applying update...');
				console.log('Wait until the device stops blinking ' + chalk.bold.magenta('magenta') + ' and starts blinking ' + chalk.bold.yellow('yellow'));
				return this.promptDfd(chalk.cyan('>') + ' Press ENTER when ready');
			}.bind(this)).catch(this._catchSkipStep);
	},

	_flashDoctor: function() {
		this._displayStepTitle('Flashing the Device Doctor app');
		console.log('This app allows changing more settings on your device\n');
		return this._enterDfuMode()
			.then(function() {
				// See the source code of the doctor app in binaries/doctor.ino
				return this.cli.runCommand('flash', ['--usb', 'doctor']);
			}.bind(this))
			.then(this._waitForSerialDevice.bind(this, this.deviceTimeout))
			.then(function (device) {
				if (!device) {
					throw new Error('Could not find serial device. Ensure the Device Doctor app was flashed');
				}
			}).catch(this._catchSkipStep);
	},

	_selectAntenna: function() {
		if (!this._deviceHasFeature('antenna-selection')) {
			return;
		}

		this._displayStepTitle('Select antenna');
		return prompt([{
			type: 'list',
			name: 'choice',
			message: 'Select the antenna to use to connect to Wi-Fi',
			choices: ['Internal', 'External', 'Skip step', 'Exit']
		}])
			.then(function (ans) {
				switch (ans.choice) {
					case 'Skip step':
						throw new SkipStepError();
					case 'Exit':
						throw new EarlyReturnError();
					default:
						return ans.choice;
				}
			}).then(function (antenna) {
				var serialCommand = this.cli.getCommandModule('serial');
				return serialCommand.sendDoctorAntenna(this.device, antenna, this.serialTimeout);
			}.bind(this)).then(function (message) {
				console.log(message);
			}).catch(this._catchSkipStep);
	},

	_selectIP: function() {
		if (!this._deviceHasFeature('wifi')) {
			return;
		}

		this._displayStepTitle('Configure IP address');
		var mode;
		return prompt([{
			type: 'list',
			name: 'choice',
			message: 'Select how the device will be assigned an IP address',
			choices: ['Dynamic IP', 'Static IP', 'Skip step', 'Exit']
		}])
			.then(function (ans) {
				switch (ans.choice) {
					case 'Skip step':
						throw new SkipStepError();
					case 'Exit':
						throw new EarlyReturnError();
					default:
						mode = ans.choice;
				}
			}).then(function () {
				if (mode === 'Static IP') {
					return this._promptIPAddresses({
						device_ip: 'Device IP',
						netmask: 'Netmask',
						gateway: 'Gateway',
						dns: 'DNS'
					});
				}
			}.bind(this)).then(function (ipAddresses) {
				var serialCommand = this.cli.getCommandModule('serial');
				return serialCommand.sendDoctorIP(this.device, mode, ipAddresses, this.serialTimeout);
			}.bind(this)).then(function (message) {
				console.log(message);
			}).catch(this._catchSkipStep);
	},

	_promptIPAddresses: function(ips) {
		return prompt(_.map(ips, function (label, key) {
			return {
				type: 'input',
				name: key,
				message: label,
				validate: function (val) {
					var parts = val.split('.');
					var allNumbers = _.every(parts, function (n) { return (+n).toString() === n });
					return parts.length === 4 && allNumbers;
				}
			}
		})).then(function (ans) {
			return _.mapValues(ips, function (label, key) {
				return ans[key];
			});
		});
	},

	_resetSoftAPPrefix: function() {
		if (!this._deviceHasFeature('softap')) {
			return;
		}

		this._displayStepTitle('Reset Wi-Fi hotspot name in listening mode');

		return this._promptReady()
			.then(function () {
				var serialCommand = this.cli.getCommandModule('serial');
				return serialCommand.sendDoctorSoftAPPrefix(this.device, '', this.serialTimeout);
			}.bind(this)).then(function (message) {
				console.log(message);
			}).catch(this._catchSkipStep);
	},

	_clearEEPROM: function() {
		this._displayStepTitle('Clear all data in EEPROM storage');

		return this._promptReady()
			.then(function () {
				var serialCommand = this.cli.getCommandModule('serial');
				return serialCommand.sendDoctorClearEEPROM(this.device, this.serialTimeout);
			}.bind(this)).then(function (message) {
				console.log(message);
			}).catch(this._catchSkipStep);
	},

	_flashTinker: function() {
		this._displayStepTitle('Flashing the default Particle Tinker app');
		return this._enterDfuMode()
			.then(function() {
				return this.cli.runCommand('flash', ['--usb', 'tinker']);
			}.bind(this)).catch(this._catchSkipStep);
	},

	_resetKeys: function() {
		this._displayStepTitle('Resetting server and device keys');

		// do this again to refresh the device data with latest firmware
		return this._waitForSerialDevice(this.deviceTimeout)
			.then(this._verifyDeviceOwnership.bind(this))
			.then(this._enterDfuMode.bind(this))
			.then(function() {
				return this.cli.runCommand('keys', ['server']);
				// keys servers doesn't cause the device to reset so it is still in DFU mode
			}.bind(this))
			.then(function () {
				if (!this.device || !this.device.deviceId) {
					console.log(chalk.red('!'), 'Skipping device key because it does not report its device ID over USB');
					return;
				}
				return this.cli.runCommand('keys', ['doctor', this.device.deviceId, '--force']);
			}.bind(this)).catch(this._catchSkipStep);
	},

	_waitForSerialDevice: function(timeout) {
		var timeoutReached = false;
		when().delay(timeout).then(function() {
			timeoutReached = true;
		});

		var tryFindDevice = function() {
			return this._findDevice().then(function () {
				if (this.device && this.device.port) {
					return this.device;
				} else if (timeoutReached) {
					return null;
				} else {
					return when().delay(250).then(tryFindDevice);
				}
			}.bind(this));
		}.bind(this);

		return tryFindDevice();
	},

	_verifyDeviceOwnership: function() {
		return when().then(function() {
			if (!this.device || !this.device.deviceId) {
				return false;
			}

			return this.api.getAttributes(this.device.deviceId).then(function (attributes) {
				if (attributes.error === 'Permission Denied') {
					return false;
				}
				return true;
			}, function (error) {
				return false;
			});
		}.bind(this)).then(function (ownsDevice) {
			if (ownsDevice) {
				return;
			}
			console.log(chalk.red('!'), "This device is not claimed to your Particle account.");
			console.log(chalk.red('!'), 'Resetting keys for a device you do not own may permanently prevent it from connecting to the Particle cloud.');
			return prompt([{
				type: 'confirm',
				name: 'choice',
				message: 'Skip resetting keys?',
				default: true
			}]).then(function (ans) {
				if (ans.choice) {
					throw new SkipStepError();
				}
			});
		});
	},

	_setupWiFi: function() {
		if (!this._deviceHasFeature('wifi')) {
			return;
		}
		var serialCommand = this.cli.getCommandModule('serial');

		this._displayStepTitle('Clearing and setting up Wi-Fi settings');
		return this._promptReady()
			.then(function () {
				return serialCommand.sendDoctorClearWiFi(this.device, this.serialTimeout);
			}.bind(this)).then(function (message) {
				console.log(message);
			}).then(function () {
				return serialCommand.sendDoctorListenMode(this.device, this.serialTimeout);
			}.bind(this)).then(function (message) {
				console.log(message);
			}).then(function() {
				return this.cli.runCommand('serial', ['wifi']);
			}.bind(this)).catch(this._catchSkipStep);
	},

	_deviceHasFeature: function(feature) {
		var features = (this.device && this.device.specs && this.device.specs.features) || [];
		return _.includes(features, feature);
	},

	_showDoctorGoodbye: function() {
		this._displayStepTitle('The Doctor has restored your device!');
		console.log(chalk.cyan('>'), "Please visit our community forums if your device still can't connect to the Particle cloud");
		console.log(chalk.bold.white('https://community.particle.io/'));
	},

	_showDoctorError: function(e) {
		if (e instanceof EarlyReturnError) {
			return;
		}
		console.log("The Doctor didn't complete sucesfully. " + e.message);
		console.log(chalk.cyan('>'), 'Please visit our community forums for help with this error:');
		console.log(chalk.bold.white('https://community.particle.io/'));
	},
});

module.exports = DoctorCommand;
