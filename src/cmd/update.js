const { openUsbDevice, openUsbDeviceById, openUsbDeviceByIdOrName, getUsbDevices, UsbPermissionsError } = require('./usb-util');
const ParticleApi = require('./api');
const dfu = require('../lib/dfu');
const { spin } = require('../app/ui');
const { platformForId, isKnownPlatformId } = require('../lib/platform');
const { delay } = require('../lib/utilities');
const settings = require('../../settings');

const { HalModuleParser } = require('binary-version-reader');
const { prompt } = require('inquirer');
const semver = require('semver');
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

module.exports = class UpdateCommand {
	async updateDevice(args) {
		if (!(await dfu.isDfuUtilInstalled())) {
			console.log(chalk.red('!!!'), "It doesn't seem like DFU utilities are installed...");
			console.log();
			console.log(chalk.cyan('!!!'), 'For help with installing DFU utilities, please see:\n' +
				chalk.bold.white('https://docs.particle.io/guide/tools-and-features/cli/#advanced-install'));
			console.log();
			process.exit(1);
			return;
		}

		let devInfo;
		if (args && args.params.device) {
			const auth = settings.access_token;
			const { api } = new ParticleApi(settings.apiUrl, { accessToken: auth });
			const dev = await spin(openUsbDeviceByIdOrName(args.params.device, api, auth, { dfuMode: true }), 'Getting device information...');
			devInfo = { id: dev.id, platformId: dev.platformId };
			await dev.close();
		} else {
			devInfo = await this._selectDevice();
		}

		let files = settings.updates[devInfo.platformId];
		if (!files) {
			console.log(chalk.cyan('!'), 'There are currently no system firmware updates available for this device.');
			return;
		}

		console.log();
		console.log(chalk.cyan('>'), 'Your device is ready for a system update.');
		console.log(chalk.cyan('>'), 'This process may take a few minutes. Here it goes!');
		console.log();

		files = files.map(f => path.resolve(__dirname, '../../assets/updates', f));
		try {
			await spin(this._doUpdate(devInfo.id, files), 'Updating system firmware on the device...');
		} catch (err) {
			console.log(chalk.red('!'), 'An error occurred while attempting to update the system firmware of your device:');
			console.log();
			console.log(chalk.bold.white(err.toString()));
			if (err.code) {
				console.log('Error code:', err.code);
			}
			console.log();
			console.log(chalk.cyan('>'), 'Please visit our community forums for help with this error:');
			console.log(chalk.bold.white('https://community.particle.io/'));
			console.log();
			process.exit(1);
		}

		console.log(chalk.cyan('!'), 'System firmware update successfully completed!');
		console.log();
		console.log(chalk.cyan('>'), 'Your device should now restart automatically.');
		console.log();
	}

	async _doUpdate(deviceId, files) {
		let openDelay = 0;
		let openTimeout = OPEN_TIMEOUT;
		let dev;
		files = [...files];
		try {
			while (files.length) {
				await delay(openDelay);
				dev = await this._openDevice(deviceId, { timeout: openTimeout });
				const file = files.shift();
				if (await this._canFlashInDfuMode(file)) {
					// Use DFU
					if (!dev.isInDfuMode) {
						// Disconnect the device from the network/cloud to ensure its system thread is unblocked
						await this._disconnectDevice(dev);
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
						dev = await this._openDevice(deviceId);
					}
					await this._disconnectDevice(dev);
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

	async _selectDevice() {
		const devs = await getUsbDevices({ dfuMode: true });
		const devInfo = [];
		for (const dev of devs) {
			// Open the device to get its ID
			await openUsbDevice(dev, { dfuMode: true });
			devInfo.push({ id: dev.id, platformId: dev.platformId });
			await dev.close();
		}
		if (!devInfo.length) {
			throw new Error('No devices found');
		}
		if (devInfo.length === 1) {
			return devInfo[0];
		}
		const answer = await prompt({
			type: 'list',
			name: 'device',
			message: 'Which device would you like to update?',
			choices: devInfo.map((d) => {
				const platformName = isKnownPlatformId(d.platformId) ? platformForId(d.platformId).displayName : `Platform ${d.platformId}`;
				return {
					name: `${d.id} (${platformName})`,
					value: d
				};
			})
		});
		return answer.device;
	}

	async _openDevice(deviceId, { timeout = OPEN_TIMEOUT } = {}) {
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

	async _disconnectDevice(device) {
		const gen3OrHigher = isKnownPlatformId(device.platformId) && platformForId(device.platformId).generation >= 3;
		if (gen3OrHigher && semver.gte(device.firmwareVersion, '2.0.0')) {
			// Device OS 2.0.0 and higher supports the "force" option that allows disconnecting the device
			// from the cloud even if its system thread is blocked
			await device.disconnectFromCloud({ force: true });
		} else {
			// This works more reliably with Gen 2 devices than disconnectFromCloud()
			await device.enterListeningMode();
		}
		await delay(500);
	}

	async _canFlashInDfuMode(file) {
		const parser = new HalModuleParser();
		const info = await parser.parseFile(file);
		const alt = dfu.interfaceForModule(info.prefixInfo.moduleFunction, info.prefixInfo.moduleIndex,
			info.prefixInfo.platformID);
		return alt !== null;
	}
};
