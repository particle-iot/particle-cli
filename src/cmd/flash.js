const fs = require('fs-extra');
const ParticleApi = require('./api');
const VError = require('verror');
const ModuleParser = require('binary-version-reader').HalModuleParser;
const ModuleInfo = require('binary-version-reader').ModuleInfo;
const deviceSpecs = require('../lib/device-specs');
const ensureError = require('../lib/utilities').ensureError;
const { errors: { usageError } } = require('../app/command-processor');
const dfu = require('../lib/dfu');
const CLICommandBase = require('./base');
const usbUtils = require('./usb-util');
const particleUsb = require('particle-usb');
const platforms = require('@particle/device-constants');
const settings = require('../../settings');
const path = require('path');
const utilities = require('../lib/utilities');
const CloudCommand = require('./cloud');

module.exports = class FlashCommand extends CLICommandBase {
	constructor(...args){
		super(...args);
	}

	// Should be part fo CLICommandBase??
	_particleApi() {
		const auth = settings.access_token;
		const api = new ParticleApi(settings.apiUrl, { accessToken: auth });
		return { api: api.api, auth };
	}

	async _getDevice(deviceIdentifier) {
		const { api, auth } = this._particleApi();
		if (deviceIdentifier) {
			return usbUtils.openUsbDeviceByIdOrName(deviceIdentifier, api, auth, { dfuMode: true });
		}
		//TODO (hmontero): change it in favor of getOneUsbDevice
		const devices = await usbUtils.getUsbDevices({ dfuMode: true });
		if (devices.length === 0) {
			throw new VError('No devices found.');
		}

		return particleUsb.openDeviceById(devices[0].id);
	}
	// should be part of usb util?
	async _getDeviceInfo(deviceIdentifier) {
		const device = await this._getDevice(deviceIdentifier);
		const deviceInfo = await this._extractDeviceInfo(device);
		await device.close();
		return deviceInfo;
	}

	// should be part of usb util?
	async _extractDeviceInfo(device) {
		const isDfuMode = device._info.dfu;
		const deviceMode = isDfuMode ? 'DFU' : await device.getDeviceMode();
		const platform = platforms[device._info.type];

		return {
			deviceId: device._id,
			platform,
			deviceOsVersion: device._fwVer,
			deviceMode,
		};
	}

	async _parseLocalFlashArguments({  binary, files }) {
		const parsedFiles = [...files];
		let device = undefined;
		if (!binary && !files.length) {
			parsedFiles.push('.');
		} else {
			try {
				const stats = await fs.stat(binary);
				if (stats.isFile() || stats.isDirectory()) {
					parsedFiles.unshift(binary);
					device = undefined; // Reset device if it's a file or directory
				}
			} catch (error) {
				// file does not exist
				device = binary;
				if (!files.length){
					parsedFiles.push('.');
				}
			}
		}
		return {
			device: device,
			files: parsedFiles,
		};
	}

	// I think this should be part of utilities
	_getDefaultIncludes(dirname, includes, { followSymlinks }) {
		// Recursively find source files
		const set = new Set();
		const result = utilities.globList(dirname, includes, { followSymlinks });
		result.forEach((file) => set.add(file));
		return set;
	}

	async _prepareFilesToFlash(files) {
		const sourceExtensions = ['**/*.h', '**/*.hpp', '**/*.hh', '**/*.hxx', '**/*.ino', '**/*.cpp', '**/*.c',
			'**/build.mk', 'project.properties'];
		const binaryExtensions = ['**/*.bin', '**/.zip'];
		const binaryFileExtensions = ['.zip', '.bin'];

		const binary = files[0];
		// check if is a known app
		const binaryStats = await fs.stat(binary);
		if (binaryStats.isFile()) {
			if (binaryFileExtensions.includes(path.extname(binary))) {
				try {
					if (dfu.checkKnownApp(binary)) {
						return { skipDeviceOSFlash: true, compile: false, files };
					}
				} catch (error) {
					// unknown app
					return { skipDeviceOSFlash: false, compile: false, files };
				}
			}
			// send to compile
			return { skipDeviceOSFlash: false, compile: true, files };
		}

		// check if is a directory
		if (binaryStats.isDirectory()) {
			// check if it has no sources
			const binaries = this._getDefaultIncludes(binary, binaryExtensions, { followSymlinks: true });
			const sources = this._getDefaultIncludes(binary, sourceExtensions, { followSymlinks: true });
			if (binaries.length > 0 && sources.length === 0) {
				return { skipDeviceOSFlash: false, compile: false, files: binaries };
			}
			if (sources.length > 0) {
				return { skipDeviceOSFlash: false, compile: true, files };
			}
			return { skipDeviceOSFlash: true, compile: true, files };
		}
	}

	async flash(device, binary, files, { local, usb, serial, factory, force, target, port, yes, 'application-only': applicationOnly }){
		if (!device && !binary && !local){
			// if no device nor files are passed, show help
			throw usageError('You must specify a device or a file');
		}

		this.ui.logFirstTimeFlashWarning();

		if (usb){
			await this.flashDfu({ binary, factory, force });
		} else if (serial){
			await this.flashYModem({ binary, port, yes });
		} else if (local){
			// TODO: implement local flash
			// Analyze argument list to determine user intent
			const { device: deviceIdentifier, files: parsedFiles } = await this._parseLocalFlashArguments({ binary, files });

			console.log(deviceIdentifier, parsedFiles, applicationOnly);
			// Get device info
			const { deviceId, platform, deviceMode , deviceOsVersion } = await this._getDeviceInfo(deviceIdentifier);
			console.log('connected device', platform.name, deviceId, deviceMode, deviceOsVersion);
			const preparedFiles = await this._prepareFilesToFlash(parsedFiles);
			console.log('prepared files', preparedFiles);
			if (preparedFiles.compile) {
				const cloudCommand = new CloudCommand();
				await cloudCommand.compileCode({
					target,
					saveTo: './name.bin',
					params: { deviceType: platform.name, files }
				});
			}
		} else {
			await this.flashCloud({ device, files, target });
		}

		this.ui.write('Flash success!');
	}

	flashCloud({ device, files, target }){
		const CloudCommands = require('../cmd/cloud');
		const args = { target, params: { device, files } };
		return new CloudCommands().flashDevice(args);
	}

	flashYModem({ binary, port, yes }){
		const SerialCommands = require('../cmd/serial');
		return new SerialCommands().flashDevice(binary, { port, yes });
	}

	flashDfu({ binary, factory, force, requestLeave }){
		return Promise.resolve()
			.then(() => dfu.isDfuUtilInstalled())
			.then(() => dfu.findCompatibleDFU())
			.then(() => {
				//only match against knownApp if file is not found
				let stats;

				try {
					stats = fs.statSync(binary);
				} catch (error){
					// file does not exist
					binary = dfu.checkKnownApp(binary);

					if (binary === undefined){
						throw new Error(`file does not exist and no known app found. tried: \`${error.path}\``);
					}
					return;
				}

				if (!stats.isFile()){
					throw new Error('You cannot flash a directory over USB');
				}
			})
			.then(() => {
				const parser = new ModuleParser();
				return parser.parseFile(binary)
					.catch(err => {
						throw new VError(ensureError(err), `Could not parse ${binary}`);
					});
			})
			.then(info => {
				if (info.suffixInfo.suffixSize === 65535){
					this.ui.write('warn: unable to verify binary info');
					return;
				}

				if (!info.crc.ok && !force){
					throw new Error('CRC is invalid, use --force to override');
				}

				const specs = deviceSpecs[dfu.dfuId];
				if (info.prefixInfo.platformID !== specs.productId && !force){
					throw new Error(`Incorrect platform id (expected ${specs.productId}, parsed ${info.prefixInfo.platformID}), use --force to override`);
				}

				let segmentName;
				if (factory) {
					if (info.prefixInfo.moduleFunction !== ModuleInfo.FunctionType.USER_PART) {
						throw new Error('Cannot flash a non-application binary to the factory reset location');
					}
					segmentName = 'factoryReset';
					if (!specs[segmentName]) {
						throw new Error('The platform does not support a factory reset application');
					}
				}

				if (requestLeave === undefined) {
					// todo - leave on factory firmware write too?
					requestLeave = (!factory && info.prefixInfo.moduleFunction === ModuleInfo.FunctionType.USER_PART);
				}

				return dfu.writeModule(binary, { segmentName, leave: requestLeave });
			})
			.catch((err) => {
				throw new VError(ensureError(err), 'Error writing firmware');
			});
	}
};

