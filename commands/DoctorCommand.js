'use strict';
var extend = require('xtend');
var util = require('util');
var when = require('when');
var pipeline = require('when/pipeline');
var _ = require('lodash');
var chalk = require('chalk');
var prompts = require('../oldlib/prompts');
var BaseCommand = require('./BaseCommand');

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
			this._updateSystemFirmware.bind(this),
			this._flashTinker.bind(this),
			this._getDeviceId.bind(this),
			this._resetKeys.bind(this),
			this._clearCredentials.bind(this),
			this._setupCredentials.bind(this),
			this._showDoctorGoodbye.bind(this)
		])
			.catch(this._showDoctorError.bind(this));
	},

	_showDoctorWelcome: function() {
		console.log(chalk.bold.white('The Device Doctor will puts your device back into a healthy state'));
		console.log('It will:');
		_.map([
			'Upgrade system firmware',
			'Flash the default Tinker app',
			'Reset the device and server keys',
			'Clear the Wi-Fi settings (credentials, antenna, IP address)',
		], function (line) {
			console.log('  - ' + line);
		});
		console.log('');
		console.log('Start by connecting your Particle device to a USB port');
		console.log('');
	},

	_enterDfuMode: function() {
		console.log('Put the device in ' + chalk.bold.yellow('DFU mode'));
		console.log('Tap ' + chalk.bold.cyan('RESET/RST') + ' while holding ' + chalk.bold.cyan('MODE/SETUP') +
			' until the device blinks ' + chalk.bold.yellow('yellow.'));
		return this.promptDfd(chalk.cyan('>') + ' Press ENTER when ready');
	},

	_enterListenMode: function() {
		console.log('Put the device in ' + chalk.bold.blue('Listen mode'));
		console.log('Tap ' + chalk.bold.cyan('MODE/SETUP') +
			' until the device blinks ' + chalk.bold.blue('blue.'));
		console.log('If the device is already blinking ' + chalk.bold.blue('blue.') + " you're good to go!");
		return this.promptDfd(chalk.cyan('>') + ' Press ENTER when ready');

		console.log('Put the device in Listen mode by holding SETUP/MODE until the device blinks blue.');
		return this.promptDfd('Press ENTER when ready');
	},

	_displayStepTitle: function(title) {
		console.log(chalk.bold.white('\n' + title + '\n'));
	},

	_updateSystemFirmware: function() {
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

	_getDeviceId: function() {
		this._displayStepTitle('Reading the device ID');
		var serialCommand = this.cli.getCommandModule('serial');
		return this._enterListenMode()
			.then(function() {
				return when.promise(function (resolve) {
					serialCommand.whatSerialPortDidYouMean(null, true, resolve);
				});
			})
			.then(function (device) {
				if (!device) {
					return serialCommand.error('No serial port identified');
				}

				return serialCommand.askForDeviceID(device);
			})
			.then(function (data) {
				if (_.isObject(data)) {
					return data.id;
				} else {
					return data;
				}
			});
	},

	_resetKeys: function(deviceId) {
		this._displayStepTitle('Reseting server and device keys');
		return this._enterDfuMode()
			.then(function() {
				return this.cli.runCommand('keys', ['server']);
				// keys servers doesn't cause the device to reset so it is still in DFU mode
			}.bind(this))
			.then(function () {
				return this.cli.runCommand('keys', ['doctor', deviceId, '--force']);
			}.bind(this));
	},

	_clearCredentials: function() {
		this._displayStepTitle('Clearing Wi-Fi settings');
		console.log('Hold ' + chalk.bold.cyan('MODE/SETUP') +
			' untils the device blinks ' + chalk.bold.blue('blue rapidly') + ' to clear Wi-Fi settings');
		return this.promptDfd(chalk.cyan('>') + ' Press ENTER when done');
	},

	_setupCredentials: function() {
		this._displayStepTitle('Setting up Wi-Fi');
		return this.cli.runCommand('serial', ['wifi']);
	},

	_showDoctorGoodbye: function() {
		this._displayStepTitle('The Doctor has restored your device!');
		console.log(chalk.cyan('>'), "Please visit our community forums if you device still can't connect to the Particle cloud");
		console.log(chalk.bold.white('https://community.particle.io/'));
	},

	_showDoctorError: function(e) {
		console.log("The Doctor didn't complete sucesfully. " + e.message);
		console.log(chalk.cyan('>'), 'Please visit our community forums for help with this error:');
		console.log(chalk.bold.white('https://community.particle.io/'));
	},
});

module.exports = DoctorCommand;
