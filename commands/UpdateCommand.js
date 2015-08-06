/**
 ******************************************************************************
 * @file    commands/UpdateCommand.js
 * @author  Emily Rose <nexxy@particle.io>
 * @company Particle ( https://www.particle.io/ )
 * @source https://github.com/spark/particle-cli
 * @version V1.0.0
 * @date    3-August-2015
 * @brief   Update command class module
 ******************************************************************************
Copyright (c) 2015 Particle Industries, Inc.  All rights reserved.

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

var path = require('path');
var util = require('util');
var chalk = require('chalk');
var extend = require('xtend');
var settings = require('../settings.js')
var BaseCommand = require('./BaseCommand');
var inquirer = require('inquirer');
var prompt = inquirer.prompt;
var exec = require('child_process').exec;
var dfu = require('../lib/dfu');
var when = require('when');
var specs = require('../lib/deviceSpecs/specifications');
var spinner = require('cli-spinner').Spinner;
var sequence = require('when/sequence');

spinner.setDefaultSpinnerString(spinner.spinners[7]);
var spin = new spinner('Updating system firmware on the device...')

var UpdateCommand = function (cli, options) {
	UpdateCommand.super_.call(this, cli, options);
	this.options = extend({}, this.options, options);

	this.init();
};

util.inherits(UpdateCommand, BaseCommand);

UpdateCommand.prototype = extend(BaseCommand.prototype, {
	options: null,
	name: "update",
	description: "This command allows you to update the system firmware of your device via USB",

	init: function () {
		this.addOption("*", this.updateDevice.bind(this), "Update a device's system firmware via USB");
	},

	updateDevice: function updateDevice() {

		var self = this;

		detectDevice(function deviceDetected(err, devices) {

			if(err) { return dfuError(err); }
			if(!devices.length) { return dfuMode(); }

			var choices = devices.map(function getProduct(id) {
				if(specs[id]) { return specs[id].productName; }
			});

			if(!choices.length) { return dfuMode(); }

			selectDevice(choices, doUpdate);

		});
		function detectDevice(cb) {

			var cmd = dfu.getCommand();
			exec(cmd + ' -l', dfuListResults);
			function dfuListResults(err, stdout, stderr) {

				var seen = { };

				if(err) { return cb(err); }

				return cb(null, stdout.split('\n').filter(function(line) {
						if(line.indexOf('Found DFU') >= 0) { return true; }
					}).map(function(device) {
						return device.match(/\[(.*:.*)\]/)[1];
					}).filter(function(id) {
						if(!seen[id]) { return seen[id] = true; }
						return false;
					})
				);

			};
		};

		function selectDevice(choices) {

			if(choices.length == 1) { return doUpdate(choices[0]); }
			prompt([{

				type: 'list',
				name: 'device',
				message: 'Which device would you like to select for updates?',
				choices: choices

			}], function (chosen) { doUpdate(chosen.device); });
		};

		function doUpdate(device) {

			Object.keys(specs).forEach(function (id) {
				specs[id].productName && specs[id].productName == device && start(id);
			});
			function start(id) {

				var updates = settings.updates[id] || null;
				var steps = [ ];
				var first = true;
				var i = 0;
				if(!updates) {
					return console.log(
						chalk.cyan('!'),
						"There are currently no system firmware updates available for this device."
					);
				}
				Object.keys(updates).forEach(function (part) {
					var leave = !first;
					steps.push(function (cb) {

						var binary = path.resolve(__dirname, '..', 'updates', updates[part]);
						dfu.checkBinaryAlignment('-D ' + binary);
						dfuWrite(id, part, binary, leave, cb);

					});
					first = false;
				});

				console.log();
				console.log(chalk.cyan('>'), 'Your device is ready for a system update.');
				console.log(chalk.cyan('>'), 'This process should take about 30 seconds. Here goes!');
				console.log();

				spin.start();

				flash();
				function flash(err, dat) {
					if(err) { return failure(err); }
					if(steps.length > 0) { return steps.shift()(flash); }
					success();
				};

				function success() {
					spin.stop(true);
					console.log(chalk.cyan('!'), "System firmware update successfully completed!");
					console.log();
					console.log(chalk.cyan('>'), "Your device should now restart automatically.");
					console.log(chalk.cyan('>'), "You may need to re-flash your application to the device.");
					console.log();
				};

				function failure(err) {
					console.log();
					console.log(chalk.red('!'), "An error occurred while attempting to update the system firmware of your device:");
					console.log();
					console.log(chalk.bold.white(err.toString()));
					console.log();
					console.log(chalk.cyan('>'), "Please visit our community forums for help with this error:");
					console.log(chalk.bold.white('https://community.particle.io/'))
				};
			};
		};
	},
	_: null
});


function dfuWrite(id, part, binary, leave, cb) {

	// function exec(cmd, cb) {
	// 	console.log("Executing", cmd);
	// 	cb(null, '', '');
	// }
	var leaveStr = (leave) ? ":leave" : "";
	var args = [
		"-d", id,
		"-a", specs[id][part].alt,
		"-i", "0",
		"-s", specs[id][part].address + leaveStr,
		"-D", binary
	];
	exec(dfu.getCommand() + ' ' + args.join(' '), function(err, stdout, stderr) {

		if(err && err.toString().indexOf('get_status') < 0) {
			console.log(chalk.red('!'), "An error occurred while attempting to flash system firmware:");
			console.log();
			console.log(err);
			return process.exit(1);
		}
		setTimeout(function() {
			cb(null, stdout);
		}, 2000);
	});
};

function dfuMode() {

	console.log();
	console.log(chalk.cyan('!'), 'I was unable to detect any devices in DFU mode...');
	console.log();
	console.log(chalk.cyan('>'), 'Your device will blink yellow when in DFU mode.');
	console.log(chalk.cyan('>'), 'If your device is not blinking yellow, please:');
	console.log();
	console.log(
		chalk.bold.white('1)'),
		"Press and hold both the",
		chalk.bold.cyan("RESET/RST"),
		"and",
		chalk.bold.cyan("MODE/SETUP"),
		"buttons simultaneously."
	);
	console.log();
	console.log(
		chalk.bold.white('2)'),
		"Release only the",
		chalk.bold.cyan("RESET/RST"),
		"button while continuing to hold the",
		chalk.bold.cyan("MODE/SETUP"),
		"button."
	);
	console.log();
	console.log(
		chalk.bold.white('3)'),
		"Release the",
		chalk.bold.cyan("MODE/SETUP"),
		"button once the device begins to blink yellow."
	);
	console.log();
};

function dfuError(err) {

	if(err.code == 127) { dfuInstall(true); }
	else {
		dfuInstall(false);
		console.log(
			chalk.red('!'),
			"You may also find our community forums helpful:\n",
			chalk.bold.white("https://community.particle.io/"),
			"\n"
		);
		console.log(
			chalk.red.bold('>'),
			"Error code:",
			chalk.bold.white(err.code || 'unknown'),
			"\n"
		);
	}
	process.exit(1);
};

function dfuInstall(noent) {

	if(noent) {
		console.log(chalk.red('!'), "It doesn't seem like DFU utilities are installed...");
	}
	else {
		console.log(chalk.red('!'), "There was an error trying execute DFU utilities.");
	}
	console.log("");
	console.log(
		chalk.red('!'),
		"For help with installing DFU Utilities, please see:\n",
		chalk.bold.white("http://support.particle.io/hc/en-us/articles/203265730-Installing-the-Particle-CLI")
	);
	console.log();
};

module.exports = UpdateCommand;
