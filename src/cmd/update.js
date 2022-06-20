const { openUsbDeviceById, getUsbDevices, UsbPermissionsError } = require('./usb-util');
const dfu = require('../lib/dfu');
const { spin } = require('../app/ui');
const { delay } = require('../lib/utilities');
const settings = require('../../settings');

const { HalModuleParser } = require('binary-version-reader');
const chalk = require('chalk');

const path = require('path');
const fs = require('fs');

// Flashing an NCP firmware can take a few minutes
const FLASH_TIMEOUT = 4 * 60000;

// Default timeout when opening a USB device
const OPEN_TIMEOUT = 3000;

// Timeout when reopening a USB device after an update via control requests. This timeout should be
// long enough to allow the bootloader apply the update
const REOPEN_TIMEOUT = 60000;

// When reopening a device that was about to reset, give it some time to boot into the firmware
const REOPEN_DELAY = 3000;

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
	const alt = dfu.interfaceForModule(info.prefixInfo.moduleFunction, info.prefixInfo.moduleIndex,
		info.prefixInfo.platformID);
	return alt !== null;
}

async function doUpdate(deviceId, files) {
	let openDelay = 0;
	let openTimeout = OPEN_TIMEOUT;
	let dev;
	files = [...files];
	try {
		while (files.length) {
			await delay(openDelay);
			dev = await openDevice(deviceId, { timeout: openTimeout });
			const file = files.shift();
			if (await canFlashInDfuMode(file)) {
				// Use DFU
				if (!dev.isInDfuMode) {
					await dev.enterDfuMode();
				}
				// Close the device before flashing it via dfu-util
				await dev.close();
				await dfu.writeModule(file, { vendorId: dev.vendorId, productId: dev.productId, serial: deviceId, leave: !files.length });
				openDelay = 0;
				openTimeout = OPEN_TIMEOUT;
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
				openDelay = REOPEN_DELAY;
				openTimeout = REOPEN_TIMEOUT;
			}
		}
	} finally {
		if (dev && dev.isOpen) {
			try {
				await dev.close();
			} catch (err) {
				// Ignore
			}
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

		files = files.map(f => path.resolve(__dirname, '../../assets/updates', f));
		try {
			await spin(doUpdate(dev.id, files), 'Updating system firmware on the device...');

			console.log(chalk.cyan('!'), 'System firmware update successfully completed!');
			console.log();
			console.log(chalk.cyan('>'), 'Your device should now restart automatically.');
			console.log();
		} catch (err) {
			console.log(chalk.red('!'), 'An error occurred while attempting to update the system firmware of your device:');
			console.log();
			console.log(chalk.bold.white(err.toString()));
			console.log();
			console.log(chalk.cyan('>'), 'Please visit our community forums for help with this error:');
			console.log(chalk.bold.white('https://community.particle.io/'));
			console.log();
		}
	}
};
