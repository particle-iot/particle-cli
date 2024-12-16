const fs = require('fs-extra');
const ParticleApi = require('./api');
const { ModuleInfo } = require('binary-version-reader');
const { errors: { usageError } } = require('../app/command-processor');
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
const os = require('os');
const semver = require('semver');
const {
	createFlashSteps,
	filterModulesToFlash,
	parseModulesToFlash,
	maintainDeviceProtection,
	flashFiles,
	getFileFlashInfo
} = require('../lib/flash-helper');
const createApiCache = require('../lib/api-cache');
const { validateDFUSupport } = require('./device-util');
const unzip = require('unzipper');
const qdl = require('../lib/qdl');

const TACHYON_MANIFEST_FILE = 'release.json';

module.exports = class FlashCommand extends CLICommandBase {
	constructor(...args) {
		super(...args);
	}

	async flash(device, binary, files, {
		local,
		usb,
		serial,
		factory,
		target,
		port,
		yes,
		verbose,
		tachyon,
		'application-only': applicationOnly
	}) {
		if (!tachyon && !device && !binary && !local) {
			// if no device nor files are passed, show help
			throw usageError('You must specify a device or a file');
		}

		this.ui.logFirstTimeFlashWarning();

		if (usb) {
			await this.flashOverUsb({ binary, factory });
		} else if (serial) {
			await this.flashSerialDeprecated({ binary, port, yes });
		} else if (local) {
			let allFiles = binary ? [binary, ...files] : files;
			await this.flashLocal({ files: allFiles, applicationOnly, target });
		} else if (tachyon) {
			let allFiles = binary ? [binary, ...files] : files;
			await this.flashTachyon({ verbose, files: allFiles });
		} else {
			await this.flashCloud({ device, files, target });
		}
	}

	async flashTachyon({ verbose, files }) {
		this.ui.write(`${os.EOL}Ensure only one device is connected to the computer${os.EOL}`);

		let zipFile;
		let includeDir;
		let firehoseElfWithPath;
		let programXmlFilesWithPath;
		let patchXmlFilesWithPath;
	
		const readManifest = async (manifestPath) => {
			const manifestFile = await fs.readFile(manifestPath, 'utf8');
			const manifestData = JSON.parse(manifestFile);

			const base = manifestData.targets[0].qcm6490.edl.base;
			const firehose = manifestData.targets[0].qcm6490.edl.firehose;
			const programXmlFiles = manifestData.targets[0].qcm6490.edl.program_xml;
			const patchXmlFiles = manifestData.targets[0].qcm6490.edl.patch_xml;

			const baseDir = path.join(path.dirname(manifestPath), base);
			const firehoseElfWithPath = path.join(baseDir, firehose);
			const programXmlFilesWithPath = programXmlFiles.map(p => path.join(baseDir, p));
			const patchXmlFilesWithPath = patchXmlFiles.map(p => path.join(baseDir, p));

			return { baseDir, firehoseElfWithPath, programXmlFilesWithPath, patchXmlFilesWithPath };
		};
	
		const extractZipManifest = async (zipPath) => {
			const dir = await unzip.Open.file(zipPath);
			const zipName = path.basename(zipPath, '.zip');
			const manifestFile = dir.files.find(file => file.path === path.join(zipName, TACHYON_MANIFEST_FILE));
			if (!manifestFile) {
				throw new Error(`Unable to find ${TACHYON_MANIFEST_FILE}${os.EOL}`);
			}

			const manifest = await manifestFile.buffer();
			const manifestData = JSON.parse(manifest.toString());
			
			const baseDir = manifestData.targets[0].qcm6490.edl.base;
			const firehose = manifestData.targets[0].qcm6490.edl.firehose;
			const programXmlFiles = manifestData.targets[0].qcm6490.edl.program_xml;
			const patchXmlFiles = manifestData.targets[0].qcm6490.edl.patch_xml;
			
			const firehoseElfWithPath = path.join(baseDir, firehose);
			const programXmlFilesWithPath = programXmlFiles.map(p => path.join(baseDir, p));
			const patchXmlFilesWithPath = patchXmlFiles.map(p => path.join(baseDir, p));
			return { baseDir, firehoseElfWithPath, programXmlFilesWithPath, patchXmlFilesWithPath };
		};
	
		const sortByNumber = (a, b) => {
			const extractNumber = str => parseInt(str.match(/(\d+).xml/)[1], 10);
			return extractNumber(a) - extractNumber(b);
		};
	
		if (files.length <= 1) {
			// If no files are passed, use the current directory
			const input = files.length === 1 ? files[0] : process.cwd();
			const stats = await fs.stat(input);
	
			if (stats.isDirectory()) {
				const manifestPath = path.join(input, TACHYON_MANIFEST_FILE);
				if (!fs.existsSync(manifestPath)) {
					throw new Error(`Unable to find ${TACHYON_MANIFEST_FILE}${os.EOL}`);
				}
				({ baseDir: includeDir, firehoseElfWithPath, programXmlFilesWithPath, patchXmlFilesWithPath } = await readManifest(manifestPath));
			} else if (utilities.getFilenameExt(input) === '.zip') {
				zipFile = path.basename(input);
				({ baseDir: includeDir, firehoseElfWithPath, programXmlFilesWithPath, patchXmlFilesWithPath } = await extractZipManifest(input));
			} else {
				throw new Error(`The provided file is not a directory or a zip file${os.EOL}`);
			}
		} else {
			includeDir = path.dirname(files[0]);
			firehoseElfWithPath = files.filter(f => f.includes('firehose') && f.endsWith('.elf'));
			programXmlFilesWithPath = files.filter(f => f.startsWith('rawprogram') && f.endsWith('.xml'));
			patchXmlFilesWithPath = files.filter(f => f.startsWith('patch') && f.endsWith('.xml'));
		}

		if (!firehoseElfWithPath.length || !programXmlFilesWithPath.length) {
			throw new Error('The directory should contain at least one .elf file and one rawprogram file');
		}

		programXmlFilesWithPath.sort(sortByNumber);
		patchXmlFilesWithPath.sort(sortByNumber);

		let filesToProgram = [];
		// interleave the rawprogram files and patch files
		for (let i = 0; i < programXmlFilesWithPath.length; i++) {
			filesToProgram.push(programXmlFilesWithPath[i]);
			filesToProgram.push(patchXmlFilesWithPath[i]);
		}
		filesToProgram.unshift(firehoseElfWithPath);

		this.ui.write(`Found the following files:${os.EOL}`);
		this.ui.write('  Loader file:');
		this.ui.write(`    - ${firehoseElfWithPath}${os.EOL}`);

		this.ui.write('  Program files:');
		for (const file of programXmlFilesWithPath) {
			this.ui.write(`    - ${file}`);
		}
		this.ui.write(os.EOL);

		this.ui.write('  Patch files:');
		for (const file of patchXmlFilesWithPath) {
			this.ui.write(`    - ${file}`);
		}
		this.ui.write(os.EOL);

		this.ui.write(`Starting download. The download may take several minutes...${os.EOL}`);

		try {
			const res = await qdl.run({
				files: filesToProgram,
				updateFolder: includeDir,
				zip: zipFile,
				verbose,
				ui: this.ui
			});
			// put the output in a log file if not verbose
			if (!verbose) {
				const outputLog = path.join(process.cwd(), `qdl-output-${Date.now()}.log`);
				await fs.writeFile(outputLog, res.stdout);
				this.ui.write(`Download complete. Output log available at ${outputLog}${os.EOL}`);
			} else {
				this.ui.write(`Download complete${os.EOL}`);
			}
		} catch (err) {
			throw new Error(`Download failed.${os.EOL}Error: ${err.message}${os.EOL}`);
		}
		// TODO: Handle errors
	}

	async flashOverUsb({ binary, factory }) {
		if (utilities.getFilenameExt(binary) === '.zip') {
			throw new Error("Use 'particle flash --local' to flash a zipped bundle.");
		}

		const { api, auth } = this._particleApi();
		const { flashMode, platformId } = await getFileFlashInfo(binary);
		await usbUtils.executeWithUsbDevice({
			args: { api, auth, ui: this.ui, flashMode, platformId },
			func: (dev) => this._flashOverUsb(dev, binary, factory)
		});
	}

	async _flashOverUsb(device, binary, factory) {
		const platformName = platformForId(device.platformId).name;
		validateDFUSupport({ device, ui: this.ui });

		let files;
		const knownAppPath = knownAppsForPlatform(platformName)[binary];
		if (knownAppPath) {
			files = [knownAppPath];
		} else {
			files = [binary];
		}

		const modulesToFlash = await parseModulesToFlash({ files });

		await this._validateModulesForPlatform({
			modules: modulesToFlash,
			platformId: device.platformId,
			platformName
		});
		await maintainDeviceProtection({ modules: modulesToFlash, device });
		const flashSteps = await createFlashSteps({
			modules: modulesToFlash,
			isInDfuMode: device.isInDfuMode,
			platformId: device.platformId,
			factory
		});

		this.ui.write(`Flashing ${platformName} device ${device.id}`);
		const resetAfterFlash = !factory && modulesToFlash[0].prefixInfo.moduleFunction === ModuleInfo.FunctionType.USER_PART;
		await flashFiles({ device, flashSteps, resetAfterFlash, ui: this.ui });
	}

	flashCloud({ device, files, target }) {
		// We don't check for Device Protection here
		// because it will not matter for cloud flashing
		// These are rejected for Protected Devices even if the device is in Service Mode
		const CloudCommands = require('../cmd/cloud');
		const args = { target, params: { device, files } };
		return new CloudCommands().flashDevice(args);
	}

	flashSerialDeprecated({ binary, port, yes }) {
		const SerialCommands = require('../cmd/serial');
		return new SerialCommands().flashDevice(binary, { port, yes });
	}

	async flashLocal({ files, applicationOnly, target, verbose=true }) {
		const { files: parsedFiles, deviceIdOrName, knownApp } = await this._analyzeFiles(files);
		const { api, auth } = this._particleApi();
		await usbUtils.executeWithUsbDevice({
			args: { idOrName: deviceIdOrName, api, auth, ui: this.ui },
			func: (dev) => this._flashLocal(dev, parsedFiles, deviceIdOrName, knownApp, applicationOnly, target, verbose)
		});
	}

	async _flashLocal(device, parsedFiles, deviceIdOrName, knownApp, applicationOnly, target, verbose=true) {
		const platformId = device.platformId;
		const platformName = platformForId(platformId).name;
		const currentDeviceOsVersion = device.firmwareVersion;

		if (verbose) {
			this.ui.write(`Flashing ${platformName} ${deviceIdOrName || device.id}`);
		}

		validateDFUSupport({ device, ui: this.ui });

		let { skipDeviceOSFlash, files: filesToFlash } = await this._prepareFilesToFlash({
			knownApp,
			parsedFiles,
			platformId,
			platformName,
			target
		});

		filesToFlash = await this._processBundle({ filesToFlash });

		const fileModules = await parseModulesToFlash({ files: filesToFlash });

		await this._validateModulesForPlatform({ modules: fileModules, platformId, platformName });

		const deviceOsBinaries = await this._getDeviceOsBinaries({
			currentDeviceOsVersion,
			skipDeviceOSFlash,
			target,
			modules: fileModules,
			platformId,
			applicationOnly,
			verbose
		});
		const deviceOsModules = await parseModulesToFlash({ files: deviceOsBinaries });
		let modulesToFlash = [...fileModules, ...deviceOsModules];
		modulesToFlash = filterModulesToFlash({ modules: modulesToFlash, platformId });

		await maintainDeviceProtection({ modules: modulesToFlash, device });
		const flashSteps = await createFlashSteps({
			modules: modulesToFlash,
			isInDfuMode: device.isInDfuMode,
			platformId
		});

		await flashFiles({ device, flashSteps, ui: this.ui, verbose });
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
		const api = new ParticleApi(settings.apiUrl, { accessToken: auth } );
		const apiCache = createApiCache(api);
		return { api: apiCache, auth };
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
				const binaries = await this._findBinaries(parsedFiles);
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
				const binaries = await this._findBinaries(parsedFiles);
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

	async _findBinaries(parsedFiles) {
		const binaries = new Set();
		for (const filePath of parsedFiles) {
			try {
				const stats = await fs.stat(filePath);
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

	async _validateModulesForPlatform({ modules, platformId, platformName }) {
		for (const moduleInfo of modules) {
			if (!moduleInfo.crc.ok) {
				throw new Error(`CRC check failed for module ${moduleInfo.filename}`);
			}
			if (moduleInfo.prefixInfo.platformID !== platformId && moduleInfo.prefixInfo.moduleFunction !== ModuleInfo.FunctionType.ASSET) {
				throw new Error(`Module ${moduleInfo.filename} is not compatible with platform ${platformName}`);
			}
		}
	}

	async _getDeviceOsBinaries({ skipDeviceOSFlash, target, modules, currentDeviceOsVersion, platformId, applicationOnly, verbose=true }) {
		const { api } = this._particleApi();
		const { module: application, applicationDeviceOsVersion } = await this._pickApplicationBinary(modules, api);

		// if files to flash include Device OS binaries, don't override them with the ones from the cloud
		const includedDeviceOsModuleFunctions = [ModuleInfo.FunctionType.SYSTEM_PART, ModuleInfo.FunctionType.BOOTLOADER];
		const systemPartBinaries = modules.filter(m => includedDeviceOsModuleFunctions.includes(m.prefixInfo.moduleFunction));
		if (systemPartBinaries.length) {
			return [];
		}

		// no application so no need to download Device OS binaries
		if (!application) {
			return [];
		}

		// need to get the binary required version
		if (applicationOnly) {
			return [];
		}

		// force to flash device os binaries if target is specified
		if (target) {
			return deviceOsUtils.downloadDeviceOsVersionBinaries({
				api,
				platformId,
				version: target,
				ui: this.ui,
				omitUserPart: true,
				verbose
			});
		}

		// avoid downgrading Device OS for known application like Tinker compiled against older Device OS
		if (skipDeviceOSFlash) {
			return [];
		}

		// if Device OS needs to be upgraded, so download the binaries
		if (applicationDeviceOsVersion && currentDeviceOsVersion && semver.lt(currentDeviceOsVersion, applicationDeviceOsVersion)) {
			return deviceOsUtils.downloadDeviceOsVersionBinaries({
				api: api,
				platformId,
				version: applicationDeviceOsVersion,
				ui: this.ui,
				verbose
			});
		} else {
			// Device OS is up to date or we don't know the current Device OS version, so no need to download binaries
			return [];
		}
	}

	async _pickApplicationBinary(modules, api) {
		for (const module of modules) {
			// parse file and look for moduleFunction
			if (module.prefixInfo.moduleFunction === ModuleInfo.FunctionType.USER_PART) {
				const internalVersion = module.prefixInfo.depModuleVersion;
				let applicationDeviceOsVersionData = { version: null };
				try {
					applicationDeviceOsVersionData = await api.getDeviceOsVersions(module.prefixInfo.platformID, internalVersion);
				} catch (error) {
					// ignore if Device OS version from the application cannot be identified
				}
				return { module, applicationDeviceOsVersion: applicationDeviceOsVersionData.version };
			}
		}
		return { module: null, applicationDeviceOsVersion: null };
	}
};
