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
const fs = require('fs');
const _ = require('lodash');
const temp = require('temp').track();
const chalk = require('chalk');
const inquirer = require('inquirer');
const childProcess = require('child_process');
const { HalModuleParser, ModuleInfo } = require('binary-version-reader');
const { systemSupportsUdev, promptAndInstallUdevRules } = require('../cmd/udev');
const settings = require('../../settings');
const utilities = require('./utilities');
const deviceSpecs = require('./device-specs');
const { platformForId } = require('./platform');
const log = require('./log');

const prompt = inquirer.prompt;

// Creates a temporary binary with module info stripped out and returns the path to it
function dropModuleInfo(binary) {
	return new Promise((resolve, reject) => {
		const rStream = fs.createReadStream(binary, { start: ModuleInfo.MODULE_PREFIX_SIZE });
		const wStream = temp.createWriteStream({ suffix: '.bin' });
		rStream.pipe(wStream)
			.on('error', reject)
			.on('finish', () => resolve(wStream.path));
	});
}

function makeDfuId(vendorId, productId) {
	return vendorId.toString(16).padStart(4, '0') + ':' + productId.toString(16).padStart(4, '0');
}

module.exports = {
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
					return dfuId && deviceSpecs[dfuId];
				});
		return _.uniq(dfuIds);
	},

	dfuId: undefined,
	listDFUDevices() {
		const { getCommand, _dfuIdsFromDfuOutput, _missingDevicePermissions } = module.exports;

		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error('Timed out attempting to list DFU devices')), 6000);
			const cmd = getCommand() + ' -l';

			childProcess.exec(cmd, (error, stdout, stderr) => {
				clearTimeout(timer);

				if (error) {
					return reject(error);
				}

				if (stderr) {
					if (_missingDevicePermissions(stderr) && systemSupportsUdev()) {
						const error = new Error('Missing permissions to use DFU');
						return promptAndInstallUdevRules(error)
							.then(() => reject(error))
							.catch((e) => reject(e));
					}
				}

				// find DFU devices that match specs
				stdout = stdout || '';
				let dfuIds = _dfuIdsFromDfuOutput(stdout);
				let dfuDevices = dfuIds.map((d) => {
					return {
						type: deviceSpecs[d].productName,
						dfuId: d,
						specs: deviceSpecs[d]
					};
				});

				resolve(dfuDevices);
			});
		});
	},

	findCompatibleDFU(showHelp = true) {
		const { listDFUDevices, showDfuModeHelp } = module.exports;

		return listDFUDevices()
			.then((dfuDevices) => {
				if (dfuDevices.length > 1) {
					const question = {
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
					};
					return prompt([question])
						.then((ans) => {
							const dfuId = ans.device;
							module.exports.dfuId = dfuId; // Ok, now this is weird
							return dfuId;
						});
				} else if (dfuDevices.length === 1) {
					const dfuId = dfuDevices[0].dfuId;
					module.exports.dfuId = dfuId;
					log.verbose('Found DFU device %s', dfuId);
					return dfuId;
				} else {
					if (showHelp) {
						showDfuModeHelp();
					}
					return Promise.reject('No DFU device found');
				}
			});
	},

	isDfuUtilInstalled() {
		const { getCommand } = module.exports;
		let cmd = getCommand() + ' -l';
		let installCheck = utilities.deferredChildProcess(cmd);
		return utilities.replaceDfdResults(installCheck, true, false);
	},

	readDfu(memoryInterface, destination, firmwareAddress, leave) {
		const { dfuId, getCommand } = module.exports;
		let prefix = `${getCommand()} -d ${dfuId}`;
		let leaveStr = leave ? ':leave' : '';
		let cmd = `${prefix} -a ${memoryInterface} -s ${firmwareAddress}${leaveStr} -U ${destination}`;
		return utilities.deferredChildProcess(cmd);
	},

	writeDfu(memoryInterface, binaryPath, firmwareAddress, leave, { vendorId, productId, serial } = {}) {
		const dfuId = (vendorId && productId) ? makeDfuId(vendorId, productId) : module.exports.dfuId;
		const { checkBinaryAlignment } = module.exports;
		let leaveStr = (leave) ? ':leave' : '';
		let cmd = 'dfu-util';
		let args = [
			'-d', dfuId,
			'-a', memoryInterface,
			'-i', '0',
			'-s', firmwareAddress + leaveStr,
			'-D', binaryPath
		];
		if (serial) {
			args.push('-S', serial);
		}

		if (settings.useSudoForDfu) {
			cmd = 'sudo';
			args.unshift('dfu-util');
		}

		let specs = deviceSpecs[dfuId] || { };
		checkBinaryAlignment(binaryPath, specs);
		return utilities.deferredSpawnProcess(cmd, args)
			.then((output) => {
				return Promise.resolve(output.stdout.join('\n'));
			})
			.catch((output) => {
				// If this line is printed, it actually worked. Ignore other errors.
				if (output.stdout.indexOf('File downloaded successfully') >= 0) {
					return Promise.resolve(output.stdout.join('\n'));
				}
				return Promise.reject(output.stderr.join('\n'));
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
		const { appendToEvenBytes } = module.exports;

		if (specs.writePadding === 2) {
			appendToEvenBytes(filepath);
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
				let buf = Buffer.alloc(1);
				buf[0] = 0;

				fs.appendFileSync(filepath, buf);
			}
		}
	},

	checkKnownApp(appName) {
		const { _validateKnownApp } = module.exports;

		if (typeof _validateKnownApp(appName, 'knownApps') !== 'undefined') {
			return _validateKnownApp(appName, 'knownApps');
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
		const { _validateSegmentSpecs } = module.exports;
		let segment = _validateSegmentSpecs(segmentName);

		if (segment.error) {
			throw new Error('App is unknown: ' + segment.error);
		}
		return segment.specs[appName];
	},

	_validateSegmentSpecs(segmentName) {
		const { dfuId } = module.exports;
		let specs = deviceSpecs[dfuId] || {};
		let params = specs[segmentName];
		let err = null;

		if (!segmentName) {
			err = "segmentName required. Don't know where to read/write.";
		} else if (!specs) {
			err = "dfuId has no specification. Don't know how to read/write.";
		} else if (!params) {
			err = `segment ${segmentName} has no specs. Not aware of this segment.`;
		}

		if (err) {
			return { error: err, specs: undefined };
		}

		return { error: null, specs: params };
	},

	read(destination, segmentName, leave) {
		const { readDfu, _validateSegmentSpecs } = module.exports;
		let segment = _validateSegmentSpecs(segmentName);
		let address;

		if (segment.error) {
			throw new Error('dfu.read: ' + segment.error);
		}

		if (segment.specs.size) {
			address = `${segment.specs.address}:${segment.specs.size}`;
		} else {
			address = segment.specs.address;
		}

		return readDfu(
			segment.specs.alt,
			destination,
			address,
			leave
		);
	},

	readBuffer(segmentName, leave) {
		const { read } = module.exports;
		let filename = temp.path({ suffix: '.bin' });

		return read(filename, segmentName, leave)
			.then(() => utilities.readFile(filename))
			.then((buf) => buf)
			.finally(() => {
				fs.unlink(filename, () => {
					// do nothing
				});
			});
	},

	write(binaryPath, segmentName, leave) {
		const { writeDfu, _validateSegmentSpecs } = module.exports;
		let segment = _validateSegmentSpecs(segmentName);

		if (segment.error) {
			throw new Error(`dfu.write: ${segment.error}`);
		}

		return writeDfu(
			segment.specs.alt,
			binaryPath,
			segment.specs.address,
			leave
		);
	},

	writeBuffer(buffer, segmentName, leave) {
		const { write } = module.exports;
		let filename = temp.path({ suffix: '.bin' });

		return utilities.writeFile(filename, buffer)
			.then(() => {
				return write(filename, segmentName, leave)
					.finally(() => {
						fs.unlink(filename, () => {
							// do nothing
						});
					});
			});
	},

	/**
	 * Write a firmware module.
	 *
	 * @param {String} binaryPath The path to the module binary.
	 * @param {Object} [options] The options.
	 * @param {Number} [options.vendorId] The USB vendor ID. If not specified, the device discovered
	 *        via a prior call to `findCompatibleDFU()` will be used.
	 * @param {Number} [options.productId] The USB product ID.
	 * @param {String} [options.serial] The serial number.
	 * @param {String} [options.segmentName] The segment name. This parameter can be used to override
	 *        the destination address of the module.
	 * @param {Boolean} [options.leave] Whether to leave DFU mode after writing. If not specified,
	 *        the device will stay in DFU mode.
	 */
	async writeModule(binaryPath, { vendorId, productId, serial, segmentName, leave } = {}) {
		const parser = new HalModuleParser();
		const info = await parser.parseFile(binaryPath);
		let alt;
		let address;
		if (segmentName) {
			const dfuId = (vendorId && productId) ? makeDfuId(vendorId, productId) : module.exports.dfuId;
			let spec = module.exports._deviceSpecForDfuId(dfuId);
			if (!spec) {
				throw new Error('Missing device specification');
			}
			spec = spec[segmentName];
			if (!spec) {
				throw new Error('Unknown segment name');
			}
			if (spec.alt === undefined || spec.address === undefined) {
				throw new Error('Invalid device specification');
			}
			alt = spec.alt;
			address = spec.address;
		} else {
			alt = module.exports.interfaceForModule(info.prefixInfo.moduleFunction, info.prefixInfo.moduleIndex,
				info.prefixInfo.platformID);
			if (alt === null) {
				throw new Error('Firmware module of this type cannot be flashed via DFU');
			}
			address = '0x' + info.prefixInfo.moduleStartAddy;
		}
		if (info.prefixInfo.moduleFlags & ModuleInfo.Flags.DROP_MODULE_INFO) {
			binaryPath = await dropModuleInfo(binaryPath);
		}
		await module.exports.writeDfu(alt, binaryPath, address, !!leave, { vendorId, productId, serial });
	},

	/**
	 * Get the number of the DFU interface that can be used to flash a firmware module of the
	 * specified type.
	 *
	 * @param {Number} moduleFunc The module type as defined by the `FunctionType` enum of the
	 *        binary-version-reader package.
	 * @param {Number} moduleIndex The module index.
	 * @param {Number} platformId The platform ID.
	 * @returns {?Number} The number of the DFU interface or `null` if the module cannot be flashed
	 *          via DFU.
	 */
	interfaceForModule(moduleFunc, moduleIndex, platformId) {
		let modType; // Module type as defined in device-constants
		switch (moduleFunc) {
			case ModuleInfo.FunctionType.SYSTEM_PART:
			case ModuleInfo.FunctionType.MONO_FIRMWARE:
				modType = 'systemPart';
				break;
			case ModuleInfo.FunctionType.USER_PART:
				modType = 'userPart';
				break;
			case ModuleInfo.FunctionType.NCP_FIRMWARE:
				modType = 'ncpFirmware';
				break;
			case ModuleInfo.FunctionType.RADIO_STACK:
				modType = 'radioStack';
				break;
			case ModuleInfo.FunctionType.BOOTLOADER:
			case ModuleInfo.FunctionType.RESOURCE:
			case ModuleInfo.FunctionType.SETTINGS:
				return null;
			default:
				throw new Error('Unknown module type');
		}
		const platform = module.exports._platformForId(platformId);
		const mods = platform.firmwareModules.filter((m) => m.type === modType);
		if (!mods.length) {
			return null;
		}
		let mod;
		if (moduleFunc === ModuleInfo.FunctionType.MONO_FIRMWARE) {
			// It is assumed here that a monolithic firmware uses the same storage as system part modules.
			// As a sanity check, if there are multiple system part modules defined for the platform,
			// ensure that all of them use the same storage
			mod = mods[0];
			if (!mods.every((m) => m.storage === mod.storage)) {
				throw new Error('Cannot determine storage for a monolithic firmware');
			}
		} else if (mods.length === 1) {
			// The module index is optional in device-constants if only one module of the given type is
			// defined for the platform
			mod = mods[0];
			if (mod.index !== undefined && mod.index !== moduleIndex) {
				return null;
			}
		} else {
			mod = mods.find((m) => m.index === moduleIndex);
			if (!mod) {
				return null;
			}
		}
		const storage = platform.dfu.storage.find((s) => s.type === mod.storage);
		if (!storage) {
			return null;
		}
		return storage.alt;
	},

	_platformForId(id) { // Mocked in unit tests
		return platformForId(id);
	},

	_deviceSpecForDfuId(id) { // Mocked in unit tests
		return deviceSpecs[id];
	},

	_missingDevicePermissions(stderr) {
		return stderr && stderr.indexOf('Cannot open DFU device') >= 0;
	},

	specsForPlatform(platformID) {
		let result = {};
		Object.keys(deviceSpecs).forEach((id) => {
			let specs = deviceSpecs[id];
			if (specs.productId===platformID) {
				result = specs;
			}
		});
		return result;
	}
};

