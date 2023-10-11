const _ = require('lodash');
const usbUtils = require('../cmd/usb-util');
const { delay } = require('./utilities');
const { PLATFORMS } =require('./platform');
const { moduleTypeToString, sortBinariesByDependency } = require('./dependency-walker');
const { HalModuleParser: ModuleParser, ModuleInfo } = require('binary-version-reader');
const path = require('path');
const os = require('os');
const semver = require('semver');

// Flashing an NCP firmware can take a few minutes
const FLASH_TIMEOUT = 4 * 60000;

async function flashFiles({ device, flashSteps, resetAfterFlash = true, ui }) {
	const progress = _createFlashProgress({ flashSteps, ui });
	try {
		for (const step of flashSteps) {
			device = await prepareDeviceForFlash({ device, mode: step.flashMode, progress });
			if (step.flashMode === 'normal') {
				device = await _flashDeviceInNormalMode(device, step.data, { name: step.name, progress: progress });
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

async function _flashDeviceInNormalMode(device, data, { name, progress } = {}) {
	// flash the file in normal mode
	if (progress) {
		progress({ event: 'flash-file', filename: name });
	}

	const start = Date.now();
	while (Date.now() - start < FLASH_TIMEOUT) {
		try {
			device = await usbUtils.reopenDevice(device);
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
		const moduleType = moduleTypeToString(moduleInfo.prefixInfo.moduleFunction);
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

async function createFlashSteps({ modules, isInDfuMode, factory, platformId }) {
	const platform = PLATFORMS.find(p => p.id === platformId);
	const sortedModules = await sortBinariesByDependency(modules);
	const assetModules = [], normalModules = [], dfuModules = [];
	sortedModules.forEach(module => {
		const data = module.prefixInfo.moduleFlags === ModuleInfo.Flags.DROP_MODULE_INFO ? module.fileBuffer.slice(module.prefixInfo.prefixSize) : module.fileBuffer;
		const flashStep = {
			name: path.basename(module.filename),
			data
		};
		const moduleType = moduleTypeToString(module.prefixInfo.moduleFunction);
		const moduleDefinition = platform.firmwareModules
			.find(firmwareModule => firmwareModule.type === moduleType);

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

		if (moduleType === 'assets') {
			flashStep.flashMode = 'normal';
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

function validateDFUSupport({ device, ui }) {
	if (!device.isInDfuMode && (!semver.valid(device.firmwareVersion) || semver.lt(device.firmwareVersion, '2.0.0'))) {
		const { chalk } = ui;
		ui.write(`${chalk.red('!!!')} The device needs to be in DFU mode for this command.\n`);
		ui.write(`${chalk.cyan('>')} This version of Device OS doesn't support automatically switching to DFU mode.`);
		ui.write(`${chalk.cyan('>')} To put your device in DFU manually, please:\n`);
		ui.write([
			chalk.bold.white('1)'),
			'Press and hold both the',
			chalk.bold.cyan('RESET'),
			'and',
			chalk.bold.cyan('MODE/SETUP'),
			'buttons simultaneously.\n'
		].join(' '));
		ui.write([
			chalk.bold.white('2)'),
			'Release only the',
			chalk.bold.cyan('RESET'),
			'button while continuing to hold the',
			chalk.bold.cyan('MODE/SETUP'),
			'button.\n'
		].join(' '));
		ui.write([
			chalk.bold.white('3)'),
			'Release the',
			chalk.bold.cyan('MODE/SETUP'),
			'button once the device begins to blink yellow.\n'
		].join(' '));
		throw new Error('Put the device in DFU mode and try again');
	}
}

module.exports = {
	flashFiles,
	filterModulesToFlash,
	parseModulesToFlash,
	createFlashSteps,
	prepareDeviceForFlash,
	validateDFUSupport
};
