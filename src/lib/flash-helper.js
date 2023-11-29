const _ = require('lodash');
const usbUtils = require('../cmd/usb-util');
const { delay } = require('./utilities');
const { PLATFORMS, platformForId } =require('./platform');
const { moduleTypeFromNumber, sortBinariesByDependency } = require('./dependency-walker');
const { HalModuleParser: ModuleParser, ModuleInfo, unwrapAssetModule } = require('binary-version-reader');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const semver = require('semver');
const crypto = require('crypto');

// Flashing an NCP firmware can take a few minutes
const FLASH_TIMEOUT = 4 * 60000;

async function flashFiles({ device, flashSteps, resetAfterFlash = true, ui }) {
	const progress = _createFlashProgress({ flashSteps, ui });
	try {
		for (const step of flashSteps) {
			device = await prepareDeviceForFlash({ device, mode: step.flashMode, progress });
			if (step.flashMode === 'normal') {
				device = await _flashDeviceInNormalMode(device, step.data, { name: step.name, progress: progress, checkSkip: step.checkSkip });
			} else {
				// CLI always flashes to internal flash which is the DFU alt setting 0
				const altSetting = 0;
				device = await _flashDeviceInDfuMode(device, step.data, { name: step.name, altSetting: altSetting, startAddr: step.address, progress: progress });
			}
		}
	} finally {
		progress({ event: 'finish' });
		if (device.isOpen) {
			if (resetAfterFlash) {
				try {
					await device.reset();
				} catch (error) {
					// ignore error: when flashing ncp the device takes too long to connect back to make requests like reset device
				}
			}
			await device.close();
		}
	}
}

async function _flashDeviceInNormalMode(device, data, { name, progress, checkSkip } = {}) {
	// flash the file in normal mode
	if (progress) {
		progress({ event: 'flash-file', filename: name });
	}

	const start = Date.now();
	while (Date.now() - start < FLASH_TIMEOUT) {
		try {
			device = await usbUtils.reopenDevice(device);
			if (checkSkip && await checkSkip(device)) {
				if (progress) {
					progress({ event: 'skip-file', filename: name, bytes: 2*data.length });
				}
				return device;
			}
			await device.updateFirmware(data, { progress, timeout: FLASH_TIMEOUT });
			return device;
		} catch (error) {
			// ignore error from attempts to flash to external flash
		}
	}
	throw new Error('Unable to flash device');
}

async function prepareDeviceForFlash({ device, mode, progress }) {
	// check if open
	device = await usbUtils.reopenDevice(device);
	switch (mode) {
		case 'normal':
			if (device.isInDfuMode) {
				// put device in normal mode
				if (progress) {
					progress({ event: 'switch-mode', mode: 'normal' });
				}
				device = await usbUtils.reopenInNormalMode(device, { reset: true });
			}
			try {
				await device.enterListeningMode();
				await delay(1000); // Just in case
			} catch (error) {
				// ignore
			}
			break;
		case 'dfu':
			if (!device.isInDfuMode) {
				if (progress) {
					progress({ event: 'switch-mode', mode: 'dfu' });
				}
				device = await usbUtils.reopenInDfuMode(device);
			}
			break;
	}
	return device;
}

async function _flashDeviceInDfuMode(device, data, { name, altSetting, startAddr, progress } = {}) {
	if (!device.isInDfuMode) {
		// put device in dfu mode
		if (progress) {
			progress({ event: 'switch-mode', mode: 'DFU' });
		}
		device = await usbUtils.reopenInDfuMode(device);
	}

	// flash the file over DFU
	if (progress) {
		progress({ event: 'flash-file', filename: name });
	}
	await device.writeOverDfu(data, { altSetting, startAddr: startAddr, progress });
	return device;
}

function _createFlashProgress({ flashSteps, ui }) {
	const NORMAL_MULTIPLIER = 10; // flashing in normal mode is slower so count each byte more
	const { isInteractive } = ui;
	let progressBar;
	if (isInteractive) {
		progressBar = ui.createProgressBar();
		// double the size to account for the erase and programming steps
		const total = flashSteps.reduce((total, step) => total + step.data.length * 2 * (step.flashMode === 'normal' ? NORMAL_MULTIPLIER : 1), 0);
		progressBar.start(total, 0, { description: 'Preparing to flash' });
	}

	let flashMultiplier = 1;
	let eraseSize = 0;
	let step = null;
	let description;
	return (payload) => {
		switch (payload.event) {
			case 'flash-file':
				description = `Flashing ${payload.filename}`;
				if (isInteractive) {
					progressBar.update({ description });
				} else {
					ui.stdout.write(`${description}${os.EOL}`);
				}
				step = flashSteps.find(step => step.name === payload.filename);
				flashMultiplier = step.flashMode === 'normal' ? NORMAL_MULTIPLIER : 1;
				eraseSize = 0;
				break;
			case 'switch-mode':
				description = `Switching device to ${payload.mode} mode`;
				if (isInteractive) {
					progressBar.update({ description });
				} else {
					ui.stdout.write(`${description}${os.EOL}`);
				}
				break;
			case 'erased':
				if (isInteractive) {
					// In DFU, entire sectors are erased so the count of bytes can be higher than the actual size
					// of the file. Ignore the extra bytes to avoid issues with the progress bar
					if (step && eraseSize + payload.bytes > step.data.length) {
						progressBar.increment((step.data.length - eraseSize) * flashMultiplier);
						eraseSize = step.data.length;
					} else {
						progressBar.increment(payload.bytes * flashMultiplier);
						eraseSize += payload.bytes;
					}
				}
				break;
			case 'skip-file':
				description = `Skipping ${payload.filename} because it already exists on the device`;
				if (isInteractive) {
					progressBar.update({ description });
					progressBar.increment(payload.bytes * flashMultiplier);
				} else {
					ui.stdout.write(`${description}${os.EOL}`);
				}
				break;
			case 'downloaded':
				if (isInteractive) {
					progressBar.increment(payload.bytes * flashMultiplier);
				}
				break;
			case 'finish':
				if (isInteractive) {
					progressBar.stop();
				}
				break;
		}
	};
}

function filterModulesToFlash({ modules, platformId, allowAll = false }) {
	const platform = PLATFORMS.find(p => p.id === platformId);
	const filteredModules = [];
	// remove encrypted files
	for (const moduleInfo of modules) {
		const moduleType = moduleTypeFromNumber(moduleInfo.prefixInfo.moduleFunction);
		const platformModule = platform.firmwareModules.find(m => m.type === moduleType && m.index === moduleInfo.prefixInfo.moduleIndex);
		// filter encrypted modules
		const isEncrypted = platformModule && platformModule.encrypted;
		const isRadioStack = moduleInfo.prefixInfo.moduleFunction === ModuleInfo.FunctionType.RADIO_STACK;
		const isNcpFirmware = moduleInfo.prefixInfo.moduleFunction === ModuleInfo.FunctionType.NCP_FIRMWARE;
		if (!isEncrypted && (!isRadioStack || allowAll) && (!isNcpFirmware || allowAll)) {
			filteredModules.push(moduleInfo);
		}
	}
	return filteredModules;
}

async function parseModulesToFlash({ files }) {
	return Promise.all(files.map(async (file) => {
		const parser = new ModuleParser();
		const binary = await parser.parseFile(file);
		return {
			filename: file,
			...binary
		};
	}));
}

async function getFileFlashInfo(file) {
	// verify if exist the file in other case could be a knownApp
	// we will check the file in flashSteps
	if (!await fs.pathExists(file)) {
		return { flashMode: 'DFU' };
	}
	const normalModules = ['asset', 'bootloader'];
	const parser = new ModuleParser();
	const binary = await parser.parseFile(file);
	const moduleType = moduleTypeFromNumber(binary.prefixInfo.moduleFunction);
	const moduleDefinition = PLATFORMS.find(p => p.id === binary.prefixInfo.platformID).firmwareModules
		.find(firmwareModule => firmwareModule.type === moduleType);
	if (!moduleDefinition) {
		throw new Error(`Module type ${moduleType} unsupported for ${PLATFORMS.find(p => p.id === binary.prefixInfo.platformID).name}`);
	}
	return {
		flashMode: normalModules.includes(moduleType) || moduleDefinition.storage === 'externalMcu' ? 'NORMAL' : 'DFU',
		platformId: binary.prefixInfo.platformID
	};
}

async function createFlashSteps({ modules, isInDfuMode, factory, platformId }) {
	const platform = PLATFORMS.find(p => p.id === platformId);
	const sortedModules = await sortBinariesByDependency(modules);
	const assetModules = [], normalModules = [], dfuModules = [];
	let availableAssets;

	sortedModules.forEach(module => {
		const data = module.prefixInfo.moduleFlags === ModuleInfo.Flags.DROP_MODULE_INFO ? module.fileBuffer.slice(module.prefixInfo.prefixSize) : module.fileBuffer;
		const flashStep = {
			name: path.basename(module.filename),
			data
		};
		const moduleType = moduleTypeFromNumber(module.prefixInfo.moduleFunction);
		const moduleDefinition = platform.firmwareModules
			.find(firmwareModule => firmwareModule.type === moduleType) || {};

		let factoryAddress;
		if (factory) {
			if (moduleType !== 'userPart') {
				throw new Error('Factory reset is only supported for user part');
			}
			const segment = _.get(platform, 'dfu.segments.factoryReset');
			if (!segment) {
				throw new Error('Factory reset is not supported for this platform');
			}
			factoryAddress = parseInt(segment.address, 16);
		}

		if (moduleType === 'asset') {
			flashStep.flashMode = 'normal';
			flashStep.checkSkip = async (device) => {
				if (availableAssets === undefined) {
					const { available } = await device.getAssetInfo().catch(() => ({
						available: []
					}));
					availableAssets = available;
				}
				return _skipAsset(module, availableAssets);
			};
			assetModules.push(flashStep);
		} else if (moduleType === 'bootloader' || moduleDefinition.storage === 'externalMcu') {
			flashStep.flashMode = 'normal';
			normalModules.push(flashStep);
		} else {
			if (moduleType === 'userPart') {
				const DEVICE_OS_MIN_VERSION_TO_FORMAT_128K_USER = 3103;
				const formerUserPart = _.get(platform, 'dfu.segments.formerUserPart');
				if (formerUserPart && module.prefixInfo.depModuleVersion >= DEVICE_OS_MIN_VERSION_TO_FORMAT_128K_USER) {
					const formerUserPartflashStep = {
						name: 'invalidate-128k-user-part',
						address: parseInt(formerUserPart.address, 16),
						data: Buffer.alloc(formerUserPart.size, 0xFF),
						flashMode: 'dfu'
					};
					dfuModules.push(formerUserPartflashStep);
				}
			}
			flashStep.flashMode = 'dfu';
			flashStep.address = factoryAddress || parseInt(module.prefixInfo.moduleStartAddy, 16);
			dfuModules.push(flashStep);
		}
	});

	// avoid switching to normal mode if device is already in DFU so a device with broken Device OS can get fixed
	if (isInDfuMode) {
		return [...dfuModules, ...normalModules, ...assetModules];
	} else {
		return [...normalModules, ...dfuModules, ...assetModules];
	}
}

async function _skipAsset(module, existingAssets) {
	const hashAssetToBeFlashed = await _get256Hash(module);
	return existingAssets.some((asset) => {
		return hashAssetToBeFlashed === asset.hash;
	});
}

async function _get256Hash(module) {
	if (module && module.fileBuffer) {
		const assetModule = await unwrapAssetModule(module.fileBuffer);
		return crypto.createHash('sha256').update(assetModule).digest('hex');
	}
}

function validateDFUSupport({ device, ui }) {
	const platform = platformForId(device.platformId);
	if (!device.isInDfuMode && (!semver.valid(device.firmwareVersion) || semver.lt(device.firmwareVersion, '2.0.0')) && platform.generation === 2) {
		ui.logDFUModeRequired({ showVersionWarning: true });
		throw new Error('Put the device in DFU mode and try again');
	}
}


module.exports = {
	flashFiles,
	filterModulesToFlash,
	parseModulesToFlash,
	createFlashSteps,
	prepareDeviceForFlash,
	validateDFUSupport,
	getFileFlashInfo,
	_get256Hash,
	_skipAsset
};
