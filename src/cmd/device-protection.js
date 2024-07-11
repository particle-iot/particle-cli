const os = require('os');
const path = require('path');
const chalk = require('chalk');
const CLICommandBase = require('./base');
const spinnerMixin = require('../lib/spinner-mixin');
const usbUtils = require('../cmd/usb-util');
const ParticleApi = require('../cmd/api');
const settings = require('../../settings');
const createApiCache = require('../lib/api-cache');
const { downloadDeviceOsVersionBinaries } = require('../lib/device-os-version-util');
const FlashCommand = require('./flash');
const { platformForId } = require('../lib/platform');
const BinaryCommand = require('./binary');

const REBOOT_TIME_MSEC = 60000;
const REBOOT_INTERVAL_MSEC = 1000;

module.exports = class DeviceProtectionCommands extends CLICommandBase {
	constructor({ ui } = {}) {
		super();
		spinnerMixin(this);
		const { api } = this._particleApi();
		this.api = api;
		this.deviceId = null;
		this.device = null;
		this.ui = ui || this.ui;
		this.productId = null;
	}

	/**
	 * Retrieves and displays the protection status of the device.
	 *
	 * This method assumes the device is in normal mode and not in DFU mode. It retrieves the current protection status and
	 * constructs a message indicating whether the device is Protected, in Service Mode, or Open
	 * The device protection status is then displayed in the console.
	 *
	 * @async
	 * @returns {Promise<Object>} The protection state of the device.
	 * @throws {Error} Throws an error if any of the async operations fail.
	 */
	async getStatus() {

		let addToOutput = [];
		let s;
		try {
			await this._withDevice({ spinner: 'Getting device status', putDeviceBackInDfuMode: true }, async () => {
				s = await this._getDeviceProtection();
				let res;
				let helper;

				if (s.overridden) {
					res = 'Protected Device (Service Mode)';
					helper = `Run ${chalk.yellow('particle device-protection enable')} to take the device out of Service Mode.`;
				} else if (s.protected) {
					res = 'Protected Device';
					helper = `Run ${chalk.yellow('particle device-protection disable')} to put the device in Service Mode.`;
				} else {
					res = 'Open device';
					helper = `Run ${chalk.yellow('particle device-protection enable')} to protect the device.`;
				}

				const deviceStr = await this._getDeviceString();
				addToOutput.push(`${deviceStr}: ${chalk.bold(res)}${os.EOL}${helper}${os.EOL}`);
			});
		} catch (error) {
			// TODO: Log detailed and user-friendly error messages from the device or API instead of displaying the raw error message
			throw new Error(`Unable to get device status: ${error.message}${os.EOL}`);
		}

		addToOutput.forEach((line) => {
			this.ui.stdout.write(line);
		});

		return s;
	}

	/**
	 * Disables protection on the device.
	 *
	 * This method checks the current protection status of the device and proceeds to put the device in Service Mode
	 * if the device is protected. If the device is not protected or is already in Service Mode,
	 * appropriate messages are logged to the console.
	 *
	 * @async
	 * @returns {Promise<void>}
	 * @throws {Error} - Throws an error if any of the async operations fail.
	 */
	async disableProtection() {
		let addToOutput = [];

		await this._withDevice({ spinner: 'Disabling device protection', putDeviceBackInDfuMode: true }, async () => {
			try {
				const deviceStr = await this._getDeviceString();
				let s = await this._getDeviceProtection();

				if (!s.protected && !s.overridden) {
					addToOutput.push(`${deviceStr} is not a Protected Device.${os.EOL}`);
					return;
				}

				let r = await this.api.unprotectDevice({ deviceId: this.deviceId, action: 'prepare', auth: settings.access_token });
				const serverNonce = Buffer.from(r.server_nonce, 'base64');

				const { deviceNonce, deviceSignature, devicePublicKeyFingerprint } = await this.device.unprotectDevice({ action: 'prepare', serverNonce });

				r = await this.api.unprotectDevice({
					deviceId: this.deviceId,
					action: 'confirm',
					serverNonce: serverNonce.toString('base64'),
					deviceNonce: deviceNonce.toString('base64'),
					deviceSignature: deviceSignature.toString('base64'),
					devicePublicKeyFingerprint: devicePublicKeyFingerprint.toString('base64'),
					auth: settings.access_token
				});

				const serverSignature = Buffer.from(r.server_signature, 'base64');
				const serverPublicKeyFingerprint = Buffer.from(r.server_public_key_fingerprint, 'base64');

				await this.device.unprotectDevice({ action: 'confirm', serverSignature, serverPublicKeyFingerprint });

				addToOutput.push(`${deviceStr} is now in Service Mode.${os.EOL}A Protected Device stays in Service Mode for a total of 20 reboots or 24 hours.${os.EOL}`);
			} catch (error) {
				throw new Error(`Failed to disable device protection: ${error.message}${os.EOL}`);
			}
		});

		addToOutput.forEach((line) => {
			this.ui.stdout.write(line);
		});
	}

	/**
	 * Enables protection on the device.
	 *
	 * This method checks the current protection status of the device and proceeds to enable protection by
	 * either terminating the protection if the device is already protected or enabling protection on the device
	 * if the device is not protected and the device protection feature is active in the product.
	 * It flashes a protected bootloader binary to the device if necessary and remove the device from development mode.
	 *
	 * @async
	 * @param {Object} [options={}] - Options for enabling protection.
	 * @param {string} [options.file] - The path to a bootloader binary file to use for protection.
	 * @returns {Promise<void>}
	 * @throws {Error} Throws an error if any of the asynchronous operations fail.
	 */
	async enableProtection({ file } = {}) {
		let addToOutput = [];
		try {
			await this._withDevice({ spinner: 'Enabling device protection', putDeviceBackInDfuMode: false }, async () => {
				const deviceStr = await this._getDeviceString();
				const s = await this._getDeviceProtection();

				if (s.overridden) {
					await this.device.unprotectDevice({ action: 'reset' });
					addToOutput.push(`${deviceStr} is now a Protected Device.${os.EOL}`);
					return;
				}

				if (s.protected) {
					addToOutput.push(`${deviceStr} is already a Protected Device.${os.EOL}`);
					return;
				}

				let localBootloaderPath = file;
				// bypass checking the product and clearing development mode when the bootloader is provided to allow for enabling device protection offline
				const onlineMode = !file;
				if (onlineMode) {
					const deviceProtectionActiveInProduct = await this._isDeviceProtectionActiveInProduct();
					if (!deviceProtectionActiveInProduct) {
						addToOutput.push(`${deviceStr} is not in a product that supports device protection.${os.EOL}`);
						return;
					}

					localBootloaderPath = await this._downloadBootloader();
				}

				const protectedBinary = await this._getProtectedBinary({ file: localBootloaderPath, verbose: false });
				await this._flashBootloader(protectedBinary);
				addToOutput.push(`${deviceStr} is now a Protected Device.${os.EOL}`);

				if (onlineMode) {
					const success = await this._markAsDevelopmentDevice(false);
					if (typeof success !== 'undefined') {
						addToOutput.push(success ?
							// TODO: Improve these lines
							`Device removed from development mode to maintain current settings.${os.EOL}` :
							`Failed to remove device from development mode. Device protection may be disabled on next cloud connection.${os.EOL}`
						);
					}
				}
			});
		} catch (error) {
			throw new Error(`Failed to enable device protection: ${error.message}${os.EOL}`);
		}

		addToOutput.forEach((line) => {
			this.ui.stdout.write(line);
		});
	}

	async _getProtectedBinary({ file, verbose=true }) {
		const res = await new BinaryCommand().createProtectedBinary({ file, verbose });
		return res;
	}

	/**
	 * Retrieves the current protection state of the device.
	 *
	 * @async
	 * @returns {Promise<Object>} The protection state of the device.
	 * @throws {Error} Throws an error if the device protection feature is not supported.
	 */
	async _getDeviceProtection() {
		try {
			const s = await this.device.getProtectionState();
			return s;
		} catch (error) {
			if (error.message === 'Not supported') {
				throw new Error(`Device protection feature is not supported on this device. Visit ${chalk.yellow('https://docs.particle.io')} for more information${os.EOL}`);
			}
			throw new Error(error);
		}
	}

	/**
	 * Downloads the bootloader binary for the device.
	 *
	 * This method retrieves the firmware module information from the device to determine the version and platform ID.
	 * It then downloads the device OS version binaries and returns the path to the bootloader binary.
	 *
	 * @async
	 * @returns {Promise<string>} The file path to the downloaded bootloader
	 * @throws {Error} Throws an error if any of the async operations fail.
	 */
	async _downloadBootloader() {
		const modules = await this.device.getFirmwareModuleInfo();
		const version = modules.find(m => m.type === 'SYSTEM_PART').version;
		const platformId = this.device.platformId;
		const downloadedFilePaths = await downloadDeviceOsVersionBinaries({ api: this.api, platformId, version, ui: this.ui, verbose: false });
		const platformName = platformForId(platformId).name;
		return downloadedFilePaths.find(f => path.basename(f).includes(`${platformName}-bootloader`));
	}

	/**
	 * Flashes the bootloader on the device.
	 *
	 * @async
	 * @param {string} path - The path to the bootloader binary.
	 * @param {string} action - The action to perform ('enable' or 'disable').
	 * @returns {Promise<void>}
	 */
	async _flashBootloader(path) {
		const flashCmdInstance = new FlashCommand();
		await flashCmdInstance.flashLocal({ files: [path], applicationOnly: true, verbose: false });
	}

	/**
	 * Marks the device as a development device.
	 *
	 * @async
	 * @param {boolean} state - The state to set for the development device.
	 * @returns {Promise<boolean|undefined>} Undefined if no need to change mode, true if the mode was successfully changed, false otherwise.
	 */
	async _markAsDevelopmentDevice(state) {
		try {
			if (this.productId) {
				const data = await this.api.getDeviceAttributes(this.deviceId, this.productId);
				if (data.development === state) {
					return;
				}
				await this.api.markAsDevelopmentDevice(this.deviceId, state, this.productId);
				return true;
			}
		} catch (error) {
			// Optionally log the error or handle it as needed
		}
		return false;
	}

	/**
	 * Checks if device protection is active in the product.
	 *
	 * @async
	 * @returns {Promise<boolean>} True if device protection is active, false otherwise.
	 */
	async _isDeviceProtectionActiveInProduct() {
		await this._getProductId();

		if (!this.productId) {
			return false;
		}

		const res = await this.api.getProduct({ product: this.productId, auth: settings.access_token });
		return res?.product?.device_protection === 'active';
	}

	/**
	 * Retrieves the product ID of the device.
	 *
	 * @async
	 * @returns {Promise<string|null>} The product ID if available, otherwise null.
	 */

	async _getProductId() {
		if (this.productId) {
			return this.productId;
		}

		try {
			const attrs = await this.api.getDeviceAttributes(this.deviceId);
			this.productId = attrs.platform_id !== attrs.product_id ? attrs.product_id : null;
		} catch (error) {
			return null;
		}
	}

	/**
	 * Executes a function with the device, ensuring it is in the correct mode.
	 * If it is in DFU mode, the device is reset and re-opened expecting it to be in normal mode.
	 *
	 * @async
	 * @param {Object} options
	 * @param {boolean} options.putDeviceBackInDfuMode - Checks if device should be put back into dfy mode if the device was in dfu mode at the start of the operation
	 * @param {Function} options.spinner - The text to display in a spinner until the operation completes
	 * @param {Function} fn - The function to execute with the device.
	 * @returns {Promise<*>} The result of the function execution.
	 */
	async _withDevice({ putDeviceBackInDfuMode, spinner }, fn) {
		try {
			await this._getUsbDevice(this.device);
			return await this.ui.showBusySpinnerUntilResolved(spinner, (async () => {
				const deviceWasInDfuMode = this.device.isInDfuMode;
				if (deviceWasInDfuMode) {
					await this._putDeviceInSafeMode();
				}
				putDeviceBackInDfuMode = putDeviceBackInDfuMode && deviceWasInDfuMode;
				return await fn();
			})());
		} finally {
			if (putDeviceBackInDfuMode) {
				await this._waitForDeviceToReboot();
				await this.device.enterDfuMode();
			}
			if (this.device && this.device.isOpen) {
				await this.device.close();
			}
		}
	}

	/**
	 * Constructs and returns a string representation of the device, including its product ID.
	 *
	 * @async
	 * @returns {Promise<string>} A string representing the device and its product ID.
	 */
	async _getDeviceString() {
		await this._getProductId();
		return `[${this.deviceId}] (Product ${this.productId || 'N/A'})`;
	}

	/**
	 * Retrieves the USB device and updates the instance's device ID.
	 *
	 * @async
	 * @param {Object} dev - The USB device instance.
	 * @returns {Promise<void>}
	 */
	async _getUsbDevice(dev) {
		if (!dev || dev.isOpen === false) {
			this.device = await usbUtils.getOneUsbDevice({ api: this.api, idOrName: this.deviceId, ui: this.ui });
			this.deviceId = this.device._id;
		}
	}

	/**
	 * Waits for the device to reboot.
	 * This method waits for the device to reboot by checking if the device is ready to accept control requests.
	 * It waits for a maximum of 60 seconds with a 1-second interval.
	 */
	async _waitForDeviceToReboot() {
		const start = Date.now();
		while (Date.now() - start < REBOOT_TIME_MSEC) {
			try {
				await this._delay(REBOOT_INTERVAL_MSEC);
				this.device = await usbUtils.reopenDevice({ id: this.deviceId });
				// Waiting for any control request to work to ensure the device is ready
				await this.device.getProtectionState();
				break;
			} catch (error) {
				// ignore error
			}
		}
	}

	async _delay(ms){
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Resets the device and waits for it to restart.
	 *
	 * @async
	 * @param {Object} device - The device to reset.
	 * @returns {Promise<void>}
	 */
	async _putDeviceInSafeMode() {
		if (this.device.isInDfuMode) {
			await this.device.enterSafeMode();
			await this.device.close();
		}
		this.device = await usbUtils.reopenInNormalMode( { id: this.deviceId });
	}

	/**
	 * Creates and returns the Particle API and authentication token.
	 *
	 * @returns {Object} The Particle API instance and authentication token.
	 */
	_particleApi() {
		const auth = settings.access_token;
		const api = new ParticleApi(settings.apiUrl, { accessToken: auth } );
		const apiCache = createApiCache(api);
		return { api: apiCache, auth };
	}
};
