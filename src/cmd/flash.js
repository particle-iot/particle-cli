'use strict';
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
const { handleFlashError } = require('../lib/tachyon-utils');

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
const QdlFlasher = require('../lib/qdl');

const { getEDLDevice, addLogHeaders, addLogFooter, addManifestInfoLog } = require('../lib/tachyon-utils');

const TACHYON_MANIFEST_FILE = 'manifest.json';

module.exports = class FlashCommand extends CLICommandBase {
	constructor(...args) {
		super(...args);
	}

	_isUrl(input) {
		return input && (input.startsWith('http://') || input.startsWith('https://'));
	}

	async _downloadIfUrl(input) {
		if (!this._isUrl(input)) {
			return input;
		}

		const outputFileName = input.replace(/.*\//, '');
		const localFilePath = path.join(process.cwd(), outputFileName);
		const progressFilePath = `${localFilePath}.progress`;
process.on('SIGINT', async () => {
			if (fs.existsSync(progressFilePath)) {
				await fs.remove(progressFilePath);
				this.ui.write(`${os.EOL}Process interrupted by user.${os.EOL}`);
				this.ui.write(`Removed incomplete download: ${progressFilePath}${os.EOL}`);
				process.exit(1);
			}
		});
		// Check if file already exists in current directory
		if (fs.existsSync(localFilePath)) {
			this.ui.write(`${os.EOL}Found cached file: ${localFilePath}${os.EOL}`);
			return localFilePath;
		}

		try {
			this.ui.write(`${os.EOL}Downloading ${outputFileName}...${os.EOL}`);
			const filePath = await this._downloadFile(input, localFilePath, progressFilePath);
			return filePath;
		} catch (error) {
			// Clean up partial downloads on interruption
			if (fs.existsSync(progressFilePath)) {
				await fs.remove(progressFilePath);
				this.ui.write(`Removed incomplete download: ${progressFilePath}${os.EOL}`);
			}
			if (fs.existsSync(localFilePath)) {
				await fs.remove(localFilePath);
				this.ui.write(`Removed incomplete download: ${localFilePath}${os.EOL}`);
			}
			throw error;
		}
	}

	async _downloadFile(url, finalFilePath, progressFilePath) {
		const fetch = require('node-fetch');
		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
		}

		const totalBytes = parseInt(response.headers.get('content-length') || '0', 10);
		const progressBar = this.ui.createProgressBar();

		if (progressBar && totalBytes) {
			progressBar.start(totalBytes, 0, { description: `Downloading...` });
		}

		const writer = fs.createWriteStream(progressFilePath);
		let downloadedBytes = 0;

		return new Promise((resolve, reject) => {
			response.body.on('data', (chunk) => {
				downloadedBytes += chunk.length;
				if (progressBar) {
					progressBar.update(downloadedBytes);
				}
			});

			response.body.pipe(writer);

			response.body.on('error', (err) => {
				if (progressBar) {
					progressBar.stop();
				}
				reject(err);
			});

			writer.on('finish', () => {
				if (progressBar) {
					progressBar.stop();
				}
				fs.renameSync(progressFilePath, finalFilePath);
				this.ui.write(`Download complete: ${finalFilePath}${os.EOL}`);
				resolve(finalFilePath);
			});

			writer.on('error', (err) => {
				if (progressBar) {
					progressBar.stop();
				}
				reject(err);
			});
		});
	}

	async flash(device, binary, files, {
		local,
		usb,
		serial,
		factory,
		target,
		port,
		yes,
		tachyon,
		output,
		'skip-reset': skipReset,
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
			const allFiles = binary ? [binary, ...files] : files;
			await this.flashLocal({ files: allFiles, applicationOnly, target });
		} else if (tachyon) {
			const allFiles = binary ? [binary, ...files] : files;
			await this.flashTachyon({ files: allFiles, skipReset, output });
		} else {
			await this.flashCloud({ device, files, target });
		}
	}

	//returns true if successful or false if failed
	async flashTachyon({ device, files, skipReset, output, verbose = true }) {
		let zipFile;
		let includeDir = '';
		let updateFolder = '';

		if (files.length === 0) {
			// If no files are passed, use the current directory
			files = ['.'];
		}

		// Download URLs if provided
		files = await Promise.all(files.map((f) => this._downloadIfUrl(f)));

		const [input, ...rest] = files;
		const stats = await fs.stat(input);
		let filesToProgram;
		let manifestInfo;

		if (stats.isDirectory()) {
			updateFolder = input;
			const dirInfo = await this._extractFlashFilesFromDir(input);
			includeDir = dirInfo.baseDir;
			filesToProgram = dirInfo.filesToProgram.map((file) => path.join(includeDir, file));
			manifestInfo = dirInfo.manifest;
		} else if (utilities.getFilenameExt(input) === '.zip') {
			updateFolder = path.dirname(input);
			zipFile = path.basename(input);
			const zipInfo = await this._extractFlashFilesFromZip(input);
			includeDir = zipInfo.baseDir;
			filesToProgram = zipInfo.filesToProgram.map((file) => path.join(includeDir, file));
			filesToProgram.push(...rest);
			manifestInfo = zipInfo.manifest;
		} else {
			filesToProgram = files;
		}

		const outputLog = await this._getOutputLogPath(output);

		try {
			if (verbose) {
				this.ui.write(`${os.EOL}Starting download. See logs at: ${outputLog}${os.EOL}`);
			}
			const startTime = new Date();
			if (!device) {
				device = await getEDLDevice({ ui: this.ui });
			}

			addLogHeaders({ outputLog, startTime, deviceId: device.id, commandName: 'Tachyon Flash' });
			addManifestInfoLog({ outputLog, manifest: manifestInfo });
			const qdl = new QdlFlasher({
				files: filesToProgram,
				includeDir,
				updateFolder,
				zip: zipFile,
				ui: this.ui,
				outputLogFile: outputLog,
				skipReset,
				currTask: 'OS',
				serialNumber: device.serialNumber
			});
			await qdl.run();
			fs.appendFileSync(outputLog, `OS Download complete.${os.EOL}`);
			addLogFooter({ outputLog, startTime, endTime: new Date() });
		} catch (error) {
			// check retry here
			const { retry } = await handleFlashError({ error, ui: this.ui });
			if (retry) {
				return this.flashTachyon({
					device,
					files,
					skipReset,
					output,
					verbose
				});
			}
			fs.appendFileSync(outputLog, error.message);
			throw error;
		}
	}

	async flashTachyonXml({ device, files, skipReset, output }) {
		try {
			const zipFile = files.find(f => f.endsWith('.zip'));
			const xmlFile = files.find(f => f.endsWith('.xml'));
			if (!device) {
				device = await getEDLDevice({ ui: this.ui });
			}


			const firehoseFile = await this._getFirehoseFileFromZip(zipFile);
			// add log headers
			const startTime = new Date();
			addLogHeaders({ outputLog: output, startTime, deviceId: device.id, commandName: 'Tachyon Flash XML' });
			const qdl = new QdlFlasher({
				files: [firehoseFile, xmlFile],
				ui: this.ui,
				outputLogFile: output,
				skipReset,
				currTask: 'Configuration file',
				serialNumber: device.serialNumber
			});

			await qdl.run();
			fs.appendFileSync(output, `Config file download complete.${os.EOL}`);
			// add log footer
			addLogFooter({ outputLog: output, startTime, endTime: new Date() });
		} catch (error) {
			// check retry here
			const { retry } = await handleFlashError({ error, ui: this.ui });
			if (retry) {
				return this.flashTachyonXml({
					device,
					files,
					skipReset,
					output,
				});
			}
			fs.appendFileSync(output, error.message);
			throw new Error('Download failed with error: ' + error.message);
		}
	}

	async _getOutputLogPath(output) {
		if (output) {
			const stats = await fs.stat(output);
			if (stats.isDirectory()) {
				const logFile = path.join(output, `tachyon_flash_${Date.now()}.log`);
				await fs.ensureFile(logFile);
				return logFile;
			}
			return output;
		}
		const particleDir = settings.ensureFolder();
		const logsDir = path.join(particleDir, 'logs');
		await fs.ensureDir(logsDir);
		const defaultLogFile = path.join(logsDir, `tachyon_flash_${Date.now()}.log`);
		await fs.ensureFile(defaultLogFile);
		return defaultLogFile;
	}

	async _extractFlashFilesFromDir(dirPath) {
		const manifestPath = path.join(dirPath, TACHYON_MANIFEST_FILE);
		if (!fs.existsSync(manifestPath)) {
			throw new Error(`Unable to find ${TACHYON_MANIFEST_FILE}${os.EOL}`);
		}
		const data = await this._loadManifestFromFile(manifestPath);
		const parsed = this._parseManfiestData(data);

		const baseDir = path.normalize(parsed.base);
		const filesToProgram = [
			parsed.firehose,
			...parsed.programXml,
			...parsed.patchXml
		];

		return { baseDir, filesToProgram, manifest: data };
	}

	async _extractFlashFilesFromZip(zipPath) {
		if (!fs.existsSync(zipPath)) {
			throw new Error(`Unable to find ${zipPath}${os.EOL}`);
		}
		const data = await this._loadManifestFromZip(zipPath);
		const parsed = this._parseManfiestData(data);

		const baseDir = path.normalize(parsed.base);
		const filesToProgram = [
			parsed.firehose,
			...parsed.programXml,
			...parsed.patchXml
		];

		return { baseDir, filesToProgram, manifest: data };
	}

	async _loadManifestFromFile(filePath) {
		const manifestFile = await fs.readFile(filePath, 'utf8');
		return JSON.parse(manifestFile);
	}

	async _loadManifestFromZip(zipPath) {
		const dir = await unzip.Open.file(zipPath);
		const manifestFile = dir.files.find(file => file.path === TACHYON_MANIFEST_FILE);
		if (!manifestFile) {
			throw new Error(`Unable to find ${TACHYON_MANIFEST_FILE}${os.EOL}`);
		}

		const manifest = await manifestFile.buffer();
		return JSON.parse(manifest.toString());
	}

	async _getFirehoseFileFromZip(zipPath) {
		const dir = await unzip.Open.file(zipPath);
		const { filesToProgram } = await this._extractFlashFilesFromZip(zipPath);
		const firehoseFile = dir.files.find(file => file.path.endsWith(filesToProgram[0]));
		if (!firehoseFile) {
			throw new Error('Unable to find firehose file');
		}

		const buffer = await firehoseFile.buffer();
		const tempFile = temp.openSync({ prefix: 'firehose_', suffix: '.elf' });
		fs.writeSync(tempFile.fd, buffer);
		fs.closeSync(tempFile.fd);
		return tempFile.path;
	}

	_parseManfiestData(data) {
		return {
			base: data?.targets[0]?.qcm6490?.edl?.base,
			firehose: data?.targets[0]?.qcm6490?.edl?.firehose,
			programXml: data?.targets[0]?.qcm6490?.edl?.program_xml,
			patchXml: data?.targets[0]?.qcm6490?.edl?.patch_xml
		};
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

	async flashLocal({ files, applicationOnly, target, verbose = true }) {
		const { files: parsedFiles, deviceIdOrName, knownApp } = await this._analyzeFiles(files);
		const { api, auth } = this._particleApi();
		await usbUtils.executeWithUsbDevice({
			args: { idOrName: deviceIdOrName, api, auth, ui: this.ui },
			func: (dev) => this._flashLocal(dev, parsedFiles, deviceIdOrName, knownApp, applicationOnly, target, verbose)
		});
	}

	async _flashLocal(device, parsedFiles, deviceIdOrName, knownApp, applicationOnly, target, verbose = true) {
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
		} catch (_err) {
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
		} catch (_err) {
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
			} catch (_err) {
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

	async _getDeviceOsBinaries({ skipDeviceOSFlash, target, modules, currentDeviceOsVersion, platformId, applicationOnly, verbose = true }) {
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
				} catch (_err) {
					// ignore if Device OS version from the application cannot be identified
				}
				return { module, applicationDeviceOsVersion: applicationDeviceOsVersionData.version };
			}
		}
		return { module: null, applicationDeviceOsVersion: null };
	}
};
