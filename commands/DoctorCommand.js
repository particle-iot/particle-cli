'use strict';
var extend = require('xtend');
var util = require('util');
var when = require('when');
var pipeline = require('when/pipeline');
var _ = require('lodash');
var chalk = require('chalk');
var prompts = require('../oldlib/prompts');
var BaseCommand = require('./BaseCommand');

var EarlyReturnError = function() {
	this.isEarlyReturn = true;
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

	init: function () {
		this.addOption('*', this.deviceDoctor.bind(this), 'Puts your device back into a healthy state');
	},

	deviceDoctor: function () {
		return pipeline([
			this._showDoctorWelcome.bind(this),
			this._findDevice.bind(this),
			this._nameDevice.bind(this),
			this._updateSystemFirmware.bind(this),
			this._flashTinker.bind(this),
			this._resetKeys.bind(this),
			this._clearCredentials.bind(this),
			this._setupCredentials.bind(this),
			this._showDoctorGoodbye.bind(this)
		])
			.catch(this._showDoctorError.bind(this));
	},

	_showDoctorWelcome: function() {
		console.log(chalk.bold.white('The Device Doctor will put your device back into a healthy state'));
		console.log('It will:');
		_.map([
			'Upgrade system firmware',
			'Flash the default Tinker app',
			'Reset the device and server keys',
			'Clear the Wi-Fi settings (credentials, antenna, IP address)',
		], function (line) {
			console.log('  - ' + line);
		});
	},

	_findDevice: function() {
		var serialCommand = this.cli.getCommandModule('serial');
		return when.promise(function (resolve) {
			serialCommand.findDevices(function (devices) {
				this.device = devices && devices[0];
				resolve(devices);
			}.bind(this));
		}.bind(this));
	},

	_nameDevice: function(devices) {
		// TODO: doesn't work if device is in DFU mode already!

		if (devices.length == 0) {
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
		console.log('The Doctor will operate on your ' + deviceName + ' on port ' + this.device.port);
	},

	_enterDfuMode: function() {
		console.log('Put the device in ' + chalk.bold.yellow('DFU mode'));
		console.log('Tap ' + chalk.bold.cyan('RESET/RST') + ' while holding ' + chalk.bold.cyan('MODE/SETUP') +
			' until the device blinks ' + chalk.bold.yellow('yellow.'));
		return this.promptDfd(chalk.cyan('>') + ' Press ENTER when ready');
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
			}.bind(this));
	},

	_flashTinker: function() {
		this._displayStepTitle('Flashing the default Particle Tinker app');
		return this._enterDfuMode()
			.then(function() {
				return this.cli.runCommand('flash', ['--usb', 'tinker']);
			}.bind(this));
	},

	_resetKeys: function() {
		this._displayStepTitle('Reseting server and device keys');

		// do this again to refresh the device data with latest firmware
		return this._waitForSerialDevice(3000)
			.then(this._enterDfuMode.bind(this))
			.then(function() {
				return this.cli.runCommand('keys', ['server']);
				// keys servers doesn't cause the device to reset so it is still in DFU mode
			}.bind(this))
			.then(function () {
				if (!this.device || !this.device.deviceId) {
					console.log(chalk.red('!'), 'Skipping device key because the device ID is not known');
					return;
				}
				return this.cli.runCommand('keys', ['doctor', this.device.deviceId, '--force']);
			}.bind(this));
	},

	_waitForSerialDevice: function(timeout) {
		var timeoutReached = false;
		when().delay(timeout).then(function() {
			timeoutReached = true;
		});

		var tryFindDevice = function() {
			return this._findDevice().then(function (devices) {
				if (devices.length > 0) {
					return devices;
				} else if (timeoutReached) {
					return null;
				} else {
					return when().delay(250).then(tryFindDevice);
				}
			});
		}.bind(this);

		return tryFindDevice();
	},

	_clearCredentials: function() {
		if (!this._deviceHasFeature('wifi')) {
			return;
		}

		this._displayStepTitle('Clearing Wi-Fi settings');
		console.log('Hold ' + chalk.bold.cyan('MODE/SETUP') +
			' untils the device blinks ' + chalk.bold.blue('blue rapidly') + ' to clear Wi-Fi settings');
		return this.promptDfd(chalk.cyan('>') + ' Press ENTER when done');
	},

	_setupCredentials: function() {
		if (!this._deviceHasFeature('wifi')) {
			return;
		}

		this._displayStepTitle('Setting up Wi-Fi');
		return this.cli.runCommand('serial', ['wifi']);
	},

	_deviceHasFeature: function(feature) {
	 var features = (this.device && this.device.specs && this.device.specs.features) || [];
	 return _.includes(features, feature);
	},

	_showDoctorGoodbye: function() {
		this._displayStepTitle('The Doctor has restored your device!');
		console.log(chalk.cyan('>'), "Please visit our community forums if you device still can't connect to the Particle cloud");
		console.log(chalk.bold.white('https://community.particle.io/'));
	},

	_showDoctorError: function(e) {
		if (e.isEarlyReturn) {
			return;
		}
		console.log("The Doctor didn't complete sucesfully. " + e.message);
		console.log(chalk.cyan('>'), 'Please visit our community forums for help with this error:');
		console.log(chalk.bold.white('https://community.particle.io/'));
	},
});

module.exports = DoctorCommand;
