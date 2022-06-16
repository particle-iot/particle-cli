const FlashCommand = require('./flash');
const { openUsbDeviceById, getUsbDevices, UsbPermissionsError } = require('./usb-util');
const { dfuInterfaceForFirmwareModule, delay } = require('../lib/utilities');
const settings = require('../../settings');

const { HalModuleParser } = require('binary-version-reader');
const chalk = require('chalk');

const path = require('path');
const fs = require('fs');

const Spinner = require('cli-spinner').Spinner;

// Flashing an NCP firmware can take a few minutes
const FLASH_TIMEOUT = 4 * 60000;

// Default timeout when opening a USB device
const OPEN_TIMEOUT = 3000;

// This timeout should be long enough to allow the bootloader apply the update when flashing via
// control requests
const REOPEN_TIMEOUT = 60000;

// When reopening a device that was about to reset, give it some time to boot into the firmware
const REOPEN_DELAY = 3000;

Spinner.setDefaultSpinnerString(Spinner.spinners[7]);
const spin = new Spinner('Updating system firmware on the device...');

async function openDevice(deviceId, { timeout = OPEN_TIMEOUT } = {}) {
	const t2 = Date.now() + timeout;
	for (;;) {
		try {
			const dev = await openUsbDeviceById(deviceId, { dfuMode: true });
			await delay(500);
			return dev;
		} catch (err) {
			if (err instanceof UsbPermissionsError) {
				throw err;
			}
			// Ignore other errors
		}
		const dt = t2 - Date.now();
		if (dt <= 0) {
			throw new Error('Unable to open USB device');
		}
		await delay(Math.min(500, dt));
	}
}

async function canFlashInDfuMode(file) {
	const parser = new HalModuleParser();
	const info = await parser.parseFile(file);
	const alt = dfuInterfaceForFirmwareModule(info.prefixInfo.moduleFunction, info.prefixInfo.moduleIndex,
			info.prefixInfo.platformID);
	return alt !== null;
}

async function doUpdate(deviceId, files) {
	let isOpen = false;
	let openDelay = 0;
	let openTimeout = OPEN_TIMEOUT;
	let dev;
	files = [...files];
	try {
		while (files.length) {
			if (!isOpen) {
				await delay(openDelay);
				dev = await openDevice(deviceId, { timeout: openTimeout });
				openDelay = 0;
				openTimeout = OPEN_TIMEOUT;
				isOpen = true;
			}
			const file = files.shift();
			if (await canFlashInDfuMode(file)) {
				// Use DFU
				if (!dev.isInDfuMode) {
					await dev.enterDfuMode();
				}
				await dev.close();
				isOpen = false;
				const flashCmd = new FlashCommand();
				// TODO: Use the serial number or bus/port numbers to identify the device
				await flashCmd.flashDfu({ binary: file, requestLeave: !files.length });
			} else {
				// Use control requests
				if (dev.isInDfuMode) {
					await dev.reset();
					await dev.close();
					await delay(REOPEN_DELAY);
					dev = await openDevice(deviceId);
				}
				const data = fs.readFileSync(file);
				await dev.updateFirmware(data, { timeout: FLASH_TIMEOUT });
				await dev.close(); // Device is about to reset
				isOpen = false;
				openDelay = REOPEN_DELAY;
				openTimeout = REOPEN_TIMEOUT;
			}
		}
	} finally {
		if (isOpen) {
			await dev.close();
			isOpen = false;
		}
	}
}

module.exports = class UpdateCommand {
	async updateDevice() {
		const devs = await getUsbDevices();
		if (!devs.length) {
			throw new Error('No devices found');
		}
		let dev = devs[0];
		let files = settings.updates[dev.platformId];
		if (!files) {
			console.log(chalk.cyan('!'), 'There are currently no system firmware updates available for this device.');
			return;
		}
		await dev.open();
		await dev.close(); // FIXME

		console.log();
		console.log(chalk.cyan('>'), 'Your device is ready for a system update.');
		console.log(chalk.cyan('>'), 'This process can take a few minutes. Here it goes!');
		console.log();

		if (global.verboseLevel > 0) {
			spin.start();
		}

		files = files.map(f => path.resolve(__dirname, '../../assets/updates', f));
		try {
			await doUpdate(dev.id, files);

			spin.stop(true);

			console.log(chalk.cyan('!'), 'System firmware update successfully completed!');
			console.log();
			console.log(chalk.cyan('>'), 'Your device should now restart automatically.');
			console.log();

		} catch (err) {
			spin.stop(true);

			console.log();
			console.log(chalk.red('!'), 'An error occurred while attempting to update the system firmware of your device:');
			console.log();
			console.log(chalk.bold.white(err.toString()));
			console.log();
			console.log(chalk.cyan('>'), 'Please visit our community forums for help with this error:');
			console.log(chalk.bold.white('https://community.particle.io/'));
		}
	}
};

/*
function dfuError(err) {
	if (err === 'No DFU device found') {
		// do nothing
	} else if (err.code === 127) {
		dfuInstall(true);
	} else {
		dfuInstall(false);
		console.log(
			chalk.cyan('!!!'),
			'You may also find our community forums helpful:\n',
			chalk.bold.white('https://community.particle.io/'),
			'\n'
		);
		console.log(
			chalk.red.bold('>'),
			'Error code:',
			chalk.bold.white(err.code || 'unknown'),
			'\n'
		);
	}
	process.exit(1);
}

function dfuInstall(noent) {

	if (noent) {
		console.log(chalk.red('!!!'), "It doesn't seem like DFU utilities are installed...");
	} else {
		console.log(chalk.red('!!!'), 'There was an error trying execute DFU utilities.');
	}
	console.log('');
	console.log(
		chalk.cyan('!!!'),
		'For help with installing DFU Utilities, please see:\n',
		chalk.bold.white('https://docs.particle.io/guide/tools-and-features/cli/#advanced-install')
	);
	console.log();
}

*/
