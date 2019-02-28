/**
 ******************************************************************************
 * @file    lib/dfu.js
 * @author  David Middlecamp (david@particle.io)
 * @company Particle ( https://www.particle.io/ )
 * @source https://github.com/spark/particle-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   DFU helper module
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


const _ = require('lodash');

const fs = require('fs');
const when = require('when');
const whenNode = require('when/node');
const utilities = require('./utilities.js');
const childProcess = require('child_process');
const settings = require('../../settings.js');
const specs = require('./deviceSpecs');
const log = require('./log');
const usb = require('../cmd/usb-util');

const inquirer = require('inquirer');
const prompt = inquirer.prompt;
const chalk = require('chalk');
const temp = require('temp');

const dfu = {

	_dfuIdsFromDfuOutput(stdout) {
		// find DFU devices that match specs
		let dfuIds =
			stdout
				.split('\n')
				.filter((line) => {
					return (line.indexOf('Found DFU') >= 0);
				})
				.map((foundLine) => {
					return foundLine.match(/\[(.*:.*)\]/)[1];
				})
				.filter((dfuId) => {
					return dfuId && specs[dfuId];
				});
		return _.unique(dfuIds);
	},

	dfuId: undefined,
	listDFUDevices() {
		let temp = when.defer();

		let failTimer = utilities.timeoutGenerator('listDFUDevices timed out', temp, 6000);
		let cmd = dfu.getCommand() + ' -l';
		childProcess.exec(cmd, (error, stdout, stderr) => {
			clearTimeout(failTimer);
			if (error) {
				return temp.reject(error);
			}
			if (stderr) {
				if (dfu._missingDevicePermissions(stderr) && usb.systemSupportsUdev()) {
					const error = new Error('Missing permissions to use DFU');
					return usb.promptAndInstallUdevRules(error).then(() => temp.reject(error), e => temp.reject(e));
				}
			}

			// find DFU devices that match specs
			stdout = stdout || '';
			let dfuIds = dfu._dfuIdsFromDfuOutput(stdout);
			let dfuDevices = dfuIds.map((d) => {
				return {
					type: specs[d].productName,
					dfuId: d,
					specs: specs[d]
				};
			});
			temp.resolve(dfuDevices);
		});

		return temp.promise;
	},

	findCompatibleDFU(showHelp = true) {
		return dfu.listDFUDevices()
			.then((dfuDevices) => {
				if (dfuDevices.length > 1) {
					return prompt([{
						type: 'list',
						name: 'device',
						message: 'Which device would you like to select?',
						choices() {
							return dfuDevices.map((d) => {
								return {
									name: d.type,
									value: d.dfuId
								};
							});
						}
					}]).then((ans) => {
						dfu.dfuId = ans.device;
						return dfu.dfuId;
					});
				} else if (dfuDevices.length === 1) {
					dfu.dfuId = dfuDevices[0].dfuId;
					log.verbose('Found DFU device %s', dfu.dfuId);
					return dfu.dfuId;
				} else {
					if (showHelp) {
						dfu.showDfuModeHelp();
					}
					return when.reject('No DFU device found');
				}
			});
	},

	isDfuUtilInstalled() {
		let cmd = dfu.getCommand() + ' -l';
		let installCheck = utilities.deferredChildProcess(cmd);
		return utilities.replaceDfdResults(installCheck, 'Installed', 'dfu-util is not installed');
	},

	readDfu(memoryInterface, destination, firmwareAddress, leave) {
		let prefix = dfu.getCommand() + ' -d ' + dfu.dfuId;
		let leaveStr = (leave) ? ':leave' : '';
		let cmd = prefix + ' -a ' + memoryInterface + ' -s ' + firmwareAddress + leaveStr + ' -U ' + destination;

		return utilities.deferredChildProcess(cmd);
	},

	writeDfu(memoryInterface, binaryPath, firmwareAddress, leave) {
		let leaveStr = (leave) ? ':leave' : '';
		let args = [
			'-d', dfu.dfuId,
			'-a', memoryInterface,
			'-i', '0',
			'-s', firmwareAddress + leaveStr,
			'-D', binaryPath
		];
		let cmd = 'dfu-util';
		if (settings.useSudoForDfu) {
			cmd = 'sudo';
			args.unshift('dfu-util');
		}

		let deviceSpecs = specs[dfu.dfuId] || { };
		dfu.checkBinaryAlignment(binaryPath, deviceSpecs);
		return utilities.deferredSpawnProcess(cmd, args).then((output) => {
			return when.resolve(output.stdout.join('\n'));
		}).catch((output) => {
			// If this line is printed, it actually worked. Ignore other errors.
			if (output.stdout.indexOf('File downloaded successfully') >= 0) {
				return when.resolve(output.stdout.join('\n'));
			}
			return when.reject(output.stderr.join('\n'));
		});
	},

	getCommand() {
		if (settings.useSudoForDfu) {
			return 'sudo dfu-util';
		} else {
			return 'dfu-util';
		}
	},

	checkBinaryAlignment(filepath, specs) {
		if (specs.writePadding===2) {
			dfu.appendToEvenBytes(filepath);
		}
	},

	/**
	 * Append to the file until it has an even size
	 * @param  {String} filepath
	 */
	appendToEvenBytes(filepath) {
		if (fs.existsSync(filepath)) {
			let stats = fs.statSync(filepath);

			//is the filesize even?
			//console.log(filepath, ' stats are ', stats);
			if ((stats.size % 2) !== 0) {
				let buf = new Buffer(1);
				buf[0] = 0;

				fs.appendFileSync(filepath, buf);
			}
		}
	},

	checkKnownApp(appName) {
		if (typeof dfu._validateKnownApp(appName, 'knownApps') !== 'undefined') {
			return dfu._validateKnownApp(appName, 'knownApps');
		} else {
			return;
		}
	},

	showDfuModeHelp() {
		console.log();
		console.log(chalk.red('!!!'), 'I was unable to detect any devices in DFU mode...');
		console.log();
		console.log(chalk.cyan('>'), 'Your device will blink yellow when in DFU mode.');
		console.log(chalk.cyan('>'), 'If your device is not blinking yellow, please:');
		console.log();
		console.log(
			chalk.bold.white('1)'),
			'Press and hold both the',
			chalk.bold.cyan('RESET/RST'),
			'and',
			chalk.bold.cyan('MODE/SETUP'),
			'buttons simultaneously.'
		);
		console.log();
		console.log(
			chalk.bold.white('2)'),
			'Release only the',
			chalk.bold.cyan('RESET/RST'),
			'button while continuing to hold the',
			chalk.bold.cyan('MODE/SETUP'),
			'button.'
		);
		console.log();
		console.log(
			chalk.bold.white('3)'),
			'Release the',
			chalk.bold.cyan('MODE/SETUP'),
			'button once the device begins to blink yellow.'
		);
		console.log();
	},

	_validateKnownApp(appName, segmentName) {
		let segment = dfu._validateSegmentSpecs(segmentName);
		if (segment.error) {
			throw new Error('App is unknown: ' + segment.error);
		}
		return segment.specs[appName];
	},

	_validateSegmentSpecs(segmentName) {
		let err = null;
		let deviceSpecs = specs[dfu.dfuId] || { };
		let params = deviceSpecs[segmentName] || undefined;
		if (!segmentName) {
			err = "segmentName required. Don't know where to read/write.";
		} else if (!deviceSpecs) {
			err = "dfuId has no specification. Don't know how to read/write.";
		} else if (!params) {
			err = 'segment ' + segmentName + ' has no specs. Not aware of this segment.';
		}

		if (err) {
			return { error: err, specs: undefined };
		}
		return { error: null, specs: params };
	},
	read(destination, segmentName, leave) {

		let address;
		let segment = dfu._validateSegmentSpecs(segmentName);
		if (segment.error) {
			throw new Error('dfu.read: ' + segment.error);
		}
		if (segment.specs.size) {
			address = segment.specs.address + ':' + segment.specs.size;
		} else {
			address = segment.specs.address;
		}

		return dfu.readDfu(
			segment.specs.alt,
			destination,
			address,
			leave
		);
	},
	readBuffer(segmentName, leave) {
		let filename = temp.path({ suffix: '.bin' });
		return this.read(filename, segmentName, leave)
			.then(() => {
				return whenNode.lift(fs.readFile)(filename);
			})
			.then((buf) => {
				return buf;
			})
			.finally(() => {
				fs.unlink(filename, () => {
					// do nothing
				});
			});
	},
	write(binaryPath, segmentName, leave) {

		let segment = dfu._validateSegmentSpecs(segmentName);
		if (segment.error) {
			throw new Error('dfu.write: ' + segment.error);
		}

		return dfu.writeDfu(
			segment.specs.alt,
			binaryPath,
			segment.specs.address,
			leave
		);
	},
	writeBuffer(buffer, segmentName, leave) {
		let filename = temp.path({ suffix: '.bin' });
		let self = this;
		return whenNode.lift(fs.writeFile)(filename, buffer)
			.then(() => {
				return self.write(filename, segmentName, leave)
					.finally(() => {
						fs.unlink(filename, () => {
							// do nothing
						});
					});
			});
	},

	_missingDevicePermissions(stderr) {
		return stderr && stderr.indexOf('Cannot open DFU device') >= 0;
	},

	specsForPlatform(platformID) {
		let result = {};
		Object.keys(specs).forEach((id) => {
			let deviceSpecs = specs[id];
			if (deviceSpecs.productId===platformID) {
				result = deviceSpecs;
			}
		});
		return result;
	}
};

module.exports = dfu;
