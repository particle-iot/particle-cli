const fs = require('fs-extra');
const ParticleApi = require('./api');
const VError = require('verror');
const { HalModuleParser: ModuleParser, ModuleInfo } = require('binary-version-reader');
const BinaryCommand = require('../cmd/binary');
const deviceSpecs = require('../lib/device-specs');
const ensureError = require('../lib/utilities').ensureError;
const { errors: { usageError } } = require('../app/command-processor');
const dfu = require('../lib/dfu');
const usbUtils = require('./usb-util');
const CLICommandBase = require('./base');
const { platformForId } = require('../lib/platform');
const settings = require('../../settings');
const path = require('path');
const utilities = require('../lib/utilities');
const CloudCommand = require('./cloud');
const BundleCommand = require('./bundle');
const temp = require('temp').track();
const { knownAppNames, knownAppsForPlatform } = require('../lib/known-apps');
const { sourcePatterns, binaryPatterns, binaryExtensions } = require('../lib/file-types');
const deviceOsUtils = require('../lib/device-os-version-util');
const semver = require('semver');

module.exports = class FlashCommand extends CLICommandBase {
	constructor(...args) {
		super(...args);
	}

	async flash(device, binary, files, {
		local,
		usb,
		serial,
		factory,
		force,
		target,
		port,
		yes,
		'application-only': applicationOnly
	}) {
		if (!device && !binary && !local) {
			// if no device nor files are passed, show help
			throw usageError('You must specify a device or a file');
		}

		this.ui.logFirstTimeFlashWarning();

		if (usb) {
			await this.flashDfu({ binary, factory, force });
		} else if (serial) {
			await this.flashYModem({ binary, port, yes });
		} else if (local) {
			let allFiles = binary ? [binary, ...files] : files;
			await this.flashLocal({ files: allFiles, applicationOnly, target });
		} else {
			await this.flashCloud({ device, files, target });
		}

		this.ui.write('Flash success!');
	}

	flashCloud({ device, files, target }) {
		const CloudCommands = require('../cmd/cloud');
		const args = { target, params: { device, files } };
		return new CloudCommands().flashDevice(args);
	}

	flashYModem({ binary, port, yes }) {
		const SerialCommands = require('../cmd/serial');
		return new SerialCommands().flashDevice(binary, { port, yes });
	}

	flashDfu({ binary, factory, force, requestLeave }) {
		return Promise.resolve()
			.then(() => dfu.isDfuUtilInstalled())
			.then(() => dfu.findCompatibleDFU())
			.then(() => {
				//only match against knownApp if file is not found
				let stats;

				try {
					stats = fs.statSync(binary);
				} catch (error) {
					// file does not exist
					binary = dfu.checkKnownApp(binary);

					if (binary === undefined) {
						throw new Error(`file does not exist and no known app found. tried: \`${error.path}\``);
					}
					return;
				}

				if (!stats.isFile()) {
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
				if (info.suffixInfo.suffixSize === 65535) {
					this.ui.write('warn: unable to verify binary info');
					return;
				}

				if (!info.crc.ok && !force) {
					throw new Error('CRC is invalid, use --force to override');
				}

				const specs = deviceSpecs[dfu.dfuId];
				if (info.prefixInfo.platformID !== specs.productId && !force) {
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

	async flashLocal({ files, applicationOnly, target }) {
		const { files: parsedFiles, deviceIdOrName, knownApp } = await this._analyzeFiles(files);
		const { api, auth } = this._particleApi();
		const device = await usbUtils.getOneUsbDevice(deviceIdOrName, api, auth);

		let { skipDeviceOSFlash, files: filesToFlash } = await this._prepareFilesToFlash({
			knownApp,
			parsedFiles,
			platformId: device.platformId,
			platformName: platformForId(device.platformId).name,
			target
		});

		filesToFlash = await this._processBundle({ filesToFlash });

		const deviceOsBinaries = await this._getDeviceOsBinaries({
			skipDeviceOSFlash,
			target,
			files: filesToFlash,
			platformId: device.platformId,
			applicationOnly
		});
		filesToFlash = [...filesToFlash, ...deviceOsBinaries];

		const flashSteps = await this._tmpCreateFlashSteps({ filesToFlash });

		await this._flashFiles({ device, flashSteps });

		await device.close();
		console.log(binaries);
	}


	async _analyzeFiles(files) {
		const apps = knownAppNames();

		// assume the user wants to compile/flash the current directory if no argument is passed
		if (files.length === 0) {
			return {
				files: ['.'],
				deviceIdOrName: null,
				knownApp: null
			};
		}

		// check if the first argument is a known app
		const [knownApp] = files;
		if (apps.includes(knownApp)) {
			return {
				files: [],
				deviceIdOrName: null,
				knownApp
			};
		}

		// check if the second argument is a known app
		if (files.length > 1) {
			const [deviceIdOrName, knownApp] = files;
			if (apps.includes(knownApp)) {
				return {
					files: [],
					deviceIdOrName,
					knownApp
				};
			}
		}

		// check if the first argument exists in the filesystem, regardless if it's a file or directory
		try {
			await fs.stat(files[0]);
			return {
				files,
				deviceIdOrName: null,
				knownApp: null
			};
		} catch (error) {
			// file doesn't exist, assume the first argument is a device
			const [deviceIdOrName, ...remainingFiles] = files;
			return {
				files: remainingFiles,
				deviceIdOrName,
				knownApp: null
			};
		}
	}

	// Should be part fo CLICommandBase??
	_particleApi() {
		const auth = settings.access_token;
		const api = new ParticleApi(settings.apiUrl, { accessToken: auth });
		return { api: api.api, auth, particleApi: api };
	}

	async _prepareFilesToFlash({ knownApp, parsedFiles, platformId, platformName, target }) {
		if (knownApp) {
			const knownAppPath = knownAppsForPlatform(platformName)[knownApp];
			if (knownAppPath) {
				return { skipDeviceOSFlash: true, files: [knownAppPath] };
			} else {
				throw new Error(`Known app ${knownApp} is not available for ${platformName}`);
			}
		}

		const [filePath] = parsedFiles;
		let stats;
		try {
			stats = await fs.stat(filePath);
		} catch (error) {
			// ignore error
		}

		// if a directory, figure out if it's a source directory that should be compiled
		// or a binary directory that should be flashed directly
		if (stats && stats.isDirectory()) {
			const binaries = utilities.globList(filePath, binaryPatterns);
			const sources = utilities.globList(filePath, sourcePatterns);

			if (binaries.length > 0 && sources.length === 0) {
				// this is a binary directory so get all the binaries from all the parsedFiles
				const binaries = this._findBinaries(parsedFiles);
				return { skipDeviceOSFlash: false, files: binaries };
			} else if (sources.length > 0) {
				// this is a source directory so compile it
				const compileResult = await this._compileCode({ parsedFiles, platformId, target });
				return { skipDeviceOSFlash: false, files: compileResult };
			} else {
				throw new Error('No files found to flash');
			}
		} else {
			// this is a file so figure out if it's a source file that should be compiled or a
			// binary that should be flashed directly
			if (binaryExtensions.includes(path.extname(filePath))) {
				const binaries = this._findBinaries(parsedFiles);
				return { skipDeviceOSFlash: false, files: binaries };
			} else {
				const compileResult = await this._compileCode({ parsedFiles, platformId, target });
				return { skipDeviceOSFlash: false, files: compileResult };
			}
		}
	}

	async _compileCode({ parsedFiles, platformId, target }) {
		const cloudCommand = new CloudCommand();
		const saveTo = temp.path({ suffix: '.zip' }); // compileCodeImpl will pick between .bin and .zip as appropriate
		const { filename } = await cloudCommand.compileCodeImpl({ target, saveTo, platformId, files: parsedFiles });
		return [filename];
	}

	_findBinaries(parsedFiles) {
		const binaries = new Set();
		for (const filePath of parsedFiles) {
			try {
				const stats = fs.statSync(filePath);
				if (stats.isDirectory()) {
					const found = utilities.globList(filePath, binaryPatterns);
					for (const binary of found) {
						binaries.add(binary);
					}
				} else {
					binaries.add(filePath);
				}
			} catch (error) {
				throw new Error(`I couldn't find that: ${filePath}`);
			}

		}
		return Array.from(binaries);
	}

	async _processBundle({ filesToFlash }) {
		const bundle = new BundleCommand();
		const processed = await Promise.all(filesToFlash.map(async (filename) => {
			if (path.extname(filename) === '.zip') {
				return bundle.extractModulesFromBundle({ bundleFilename: filename });
			} else {
				return filename;
			}
		}));

		return processed.flat();
	}

	async _getDeviceOsBinaries({ skipDeviceOSFlash, target, files, firmwareVersion, platformId, applicationOnly }) {
		const { particleApi } = this._particleApi();
		const [binary] = files;

		// need to get the binary required version
		if (applicationOnly || (!target && skipDeviceOSFlash)) {
			return [];
		}

		if (target) {
			if (!firmwareVersion || (semver.valid(firmwareVersion) && semver.lt(firmwareVersion, target))) {
				return downloadDeviceOsVersionBinaries({
					api: particleApi,
					platformId,
					version: target,
					ui: this.ui,
					omitUserPart: true
				});
			} else {
				return [];
			}
		}
		return this._downloadDeviceOsBinariesForUserPart({ api: particleApi, binary, platformId });
	}

	async _downloadDeviceOsBinariesForUserPart({ api, binary, platformId }) {
		const binaryCommand = new BinaryCommand();
		const binaryInfo = await binaryCommand._extractFiles(binary);
		const applicationInfo = await binaryCommand._parseApplicationBinary(binaryInfo.application);
		const deviceOsVersion = applicationInfo.prefixInfo.depModuleVersion;
		return deviceOsUtils.downloadDeviceOsVersionBinaries({
			api,
			platformId,
			version: deviceOsVersion,
			ui: this.ui,
			omitUserPart: true
		});
	}

	async _tmpCreateFlashSteps({ filesToFlash }) {
		const parser = new ModuleParser();
		return Promise.all(filesToFlash.map(async (filename) => {
			const moduleInfo = await parser.parseFile(filename);

			let flashMode;
			switch (moduleInfo.prefixInfo.moduleFunction) {
				case ModuleInfo.FunctionType.BOOTLOADER:
				case ModuleInfo.FunctionType.ASSET:
					flashMode = 'normal';
					break;
				default:
					flashMode = 'dfu';
					break;
			}

			return {
				name: path.basename(filename),
				moduleInfo,
				data: moduleInfo.fileBuffer,
				flashMode
			};
		}));
	}

	async _flashFiles({ device, flashSteps }) {
		for (const step of flashSteps) {
			if (step.flashMode === 'normal') {
				if (device.isInDfuMode) {
					// put device in normal mode
					this.ui.write('Putting device in normal mode');
					await device.reset();
					await device.close();
					device = await usbUtils.openUsbDeviceById(device.id);
				}

				// flash the file in normal mode
				this.ui.write(`Flashing file ${step.name}`);
				await device.updateFirmware(step.data);
			} else {
				if (!device.isInDfuMode) {
					// put device in dfu mode
					this.ui.write('Putting device in DFU mode');
					await device.enterDfuMode();
					await device.close();
					device = await usbUtils.openUsbDeviceById(device.id, { dfuMode: true });
				}

				// flash the file over DFU
				this.ui.write(`Flashing file ${step.name}`);
				await device.writeOverDfu(0, step.data, parseInt(step.moduleInfo.prefixInfo.moduleStartAddy, 16));
			}
		}
		await device.reset();
	}
};
