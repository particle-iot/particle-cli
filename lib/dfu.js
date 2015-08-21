/**
 ******************************************************************************
 * @file    lib/dfu.js
 * @author  David Middlecamp (david@spark.io)
 * @company Particle ( https://www.particle.io/ )
 * @source https://github.com/spark/particle-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   DFU helper module
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

var fs = require('fs');
var when = require('when');
var sequence = require('when/sequence');
var timing = require('./timing.js');
var utilities = require('./utilities.js');
var child_process = require('child_process');
var settings = require('../settings.js');
var specs = require('./deviceSpecs');
var log = require('./log');

var _ = require('lodash');
var inquirer = require('inquirer');
var prompt = inquirer.prompt;
var chalk = require('chalk');

var that = module.exports = {

	deviceID: undefined,
	findCompatibleDFU: function () {
		var temp = when.defer();
		var that = this;

		var failTimer = utilities.timeoutGenerator('findCompatibleDFU timed out', temp, 6000);
		var cmd = that.getCommand() + ' -l';
		child_process.exec(cmd, function (error, stdout, stderr) {
			clearTimeout(failTimer);
			if (error || stderr) {
				console.error(error || stderr);
				return temp.reject(error || stderr);
			}

			// find DFU devices that match specs
			var seen = { };
			var deviceIds = stdout.split('\n').filter(function (line) {
				return (line.indexOf('Found DFU') >= 0);
			}).map(function (foundLine) {
				return foundLine.match(/\[(.*:.*)\]/)[1];
			}).filter(function (dfuId) {
				if (dfuId && !seen[dfuId] && specs[dfuId]) {
					return seen[dfuId] = true;
				}
				return false;
			});

			if (deviceIds.length > 1) {
				prompt([{
					type: 'list',
					name: 'device',
					message: 'Which device would you like to select?',
					choices: function () {
						return deviceIds.map(function (d) {
							return {
								name: specs[d].productName,
								value: d
							};
						});
					}
				}], function (ans) {
					that.deviceID = ans.device;
					return temp.resolve(that.deviceID);
				});
			} else if (deviceIds.length === 1) {
				that.deviceID = deviceIds[0];
				log.verbose('Found DFU device %s', that.deviceID);
				return temp.resolve(that.deviceID);
			} else {
				that.showDfuModeHelp();
				return temp.reject('No DFU device found');
			}
		});

		return temp.promise;
	},

	writeServerKey: function(binaryPath, leave) {
		return that._write(binaryPath, "serverKey", leave);
	},
	writePrivateKey: function(binaryPath, leave) {
		return that._write(binaryPath, "privateKey", leave);
	},
	writeFactoryReset: function(binaryPath, leave) {
		return that._write(binaryPath, "factoryReset", leave);
	},
	writeFirmware: function(binaryPath, leave) {
		return that._write(binaryPath, "userFirmware", leave);
	},
	writeSystemFirmwareOne: function(binaryPath, leave) {
		return that._write(binaryPath, "systemFirmwareOne", leave);
	},
	writeSystemFirmwareTwo: function(binaryPath, leave) {
		return that._write(binaryPath, "systemFirmwareTwo", leave);
	},
	writeSystemFirmware: function(part, binaryPath, leave) {
		return that._write(binaryPath, part, leave);
	},

	readServerKey: function(dest, leave) {
		return that._read(dest, "serverKey", leave);
	},
	readPrivateKey: function(dest, leave) {
		return that._read(dest, "privateKey", leave);
	},
	readFactoryReset: function(dest, leave) {
		return that._read(dest, "factoryReset", leave);
	},
	readFirmware: function(dest, leave) {
		return that._read(dest, "userFirmware", leave);
	},

	isDfuUtilInstalled: function() {
		var cmd = that.getCommand() + " -l";
		var installCheck = utilities.deferredChildProcess(cmd);
		return utilities.replaceDfdResults(installCheck, "Installed", "dfu-util is not installed");
	},

	readDfu: function (memoryInterface, destination, firmwareAddress, leave) {
		var prefix = that.getCommand() + " -d " + that.deviceID;
		var leaveStr = (leave) ? ":leave" : "";
		var cmd = prefix + ' -a ' + memoryInterface + ' -s ' + firmwareAddress + leaveStr + ' -U ' + destination;

		return utilities.deferredChildProcess(cmd);
	},

	writeDfu: function (memoryInterface, binaryPath, firmwareAddress, leave) {
		var leaveStr = (leave) ? ":leave" : "";
		var args = [
			"-d", that.deviceID,
			"-a", memoryInterface,
			"-i", "0",
			"-s", firmwareAddress + leaveStr,
			"-D", binaryPath
		];
		var cmd = 'dfu-util';
		if (settings.useSudoForDfu) {
			cmd = 'sudo';
			args.unshift('dfu-util');
		}

		that.checkBinaryAlignment("-D " + binaryPath);
		return utilities.deferredSpawnProcess(cmd, args);
	},

	getCommand: function () {
		if (settings.useSudoForDfu) {
			return "sudo dfu-util";
		}
		else {
			return "dfu-util";
		}
	},

	checkBinaryAlignment: function (cmdargs) {
		var idx = cmdargs.indexOf('-D ');
		if (idx >= 0) {
			var filepath = cmdargs.substr(idx + 3);
			log.verbose('checking file ', filepath);
			that.appendToEvenBytes(filepath);
		}
		else {
			console.log('uhh, args had no path.');
		}
	},

	/**
	 *
	 * @param filepath
	 */
	appendToEvenBytes: function (filepath) {
		if (fs.existsSync(filepath)) {
			var stats = fs.statSync(filepath);

			//is the filesize even?
			//console.log(filepath, ' stats are ', stats);
			if ((stats.size % 2) != 0) {
				var buf = new Buffer(1);
				buf[0] = 0;

				fs.appendFileSync(filepath, buf);
			}
		}
	},

	checkKnownApp: function(appName) {
		if (typeof that._validateKnownApp(appName, "knownApps") !== 'undefined') {
			return that._validateKnownApp(appName, "knownApps");
		}
		else {
			return;
		}
	},

	showDfuModeHelp: function() {
		console.log();
		console.log(chalk.red('!!!'), 'I was unable to detect any devices in DFU mode...');
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
	},

	_validateKnownApp: function(appName, segmentName) {
		var segment = that._validateSegmentSpecs(segmentName);
		if(segment.error) { throw new Error("App is unknown: " + segment.error); }
		return segment.specs[appName]
	},

	_validateSegmentSpecs: function(segmentName) {
		var err = null;
		var deviceSpecs = specs[that.deviceID] || { };
		var params = deviceSpecs[segmentName] || undefined;
		if(!segmentName) { err = "segmentName required. Don't know where to read/write."; }
		else if(!deviceSpecs) { err = "deviceID has no specification. Don't know how to read/write."; }
		else if(!params) { err = "segmentName has no specs. Not aware of this segment."; }

		if(err) { return { error: err, specs: undefined }; }
		return { error: null, specs: params }
	},
	_read: function(destination, segmentName, leave) {

		var address;
		var segment = that._validateSegmentSpecs(segmentName);
		if(segment.error) { throw new Error("dfu._read: " + segment.error); }
		if(segment.specs.size) { address = segment.specs.address + ":" + segment.specs.size; }
		else { address = segment.specs.address; }

		return that.readDfu(
			segment.specs.alt,
			destination,
			address,
			leave
		);
	},
	_write: function(binaryPath, segmentName, leave) {

		var segment = that._validateSegmentSpecs(segmentName);
		if(segment.error) { throw new Error("dfu._write: " + segment.error); }

		return that.writeDfu(
			segment.specs.alt,
			binaryPath,
			segment.specs.address,
			leave
		);
	},

	_: null
};
