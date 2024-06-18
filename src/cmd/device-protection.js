const CLICommandBase = require('./base');
const spinnerMixin = require('../lib/spinner-mixin');
const usbUtils = require('../cmd/usb-util');
const ParticleApi = require('../cmd/api');
const settings = require('../../settings');
const createApiCache = require('../lib/api-cache');
const os = require('os');
const { createProtectedModule } = require('binary-version-reader');
const path = require('path');
const fs = require('fs-extra');
const { downloadDeviceOsVersionBinaries } = require('../lib/device-os-version-util');
const FlashCommand = require('./flash');
const { platformForId } = require('../lib/platform');
const chalk = require('chalk');

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
	 * constructs a message indicating whether the device is protected, in service mode, or not protected.
	 * The device protection status is then displayed in the console.
	 *
	 * @async
	 * @returns {Promise<Object>} The protection state of the device.
	 * @throws {Error} Throws an error if any of the async operations fail.
	 */
	async getStatus() {

		// FIXME: Fix this logic to accommodate devices in dfu mode.
		// To get information for dfu devices, a new API needs to be exposed from Particle-USB to get the dfu segments
		// and verify that the segment containing the system-part1 is writable or not. If the segment is writable,
		// then the device is not pretected. For now though, let's assume the device is in normal mode and not in dfu mode.

		return this._withDevice(async () => {
			const s = await this._getDeviceProtection();
			let res;
			let helper;

			if (s.overridden) {
				res = 'Protected device (service mode)';
				helper = `Run ${chalk.yellow('particle device-protection enable')} to take the device out of service mode.`;
			} else if (s.protected) {
				res = 'Protected device';
				helper = `Run ${chalk.yellow('particle device-protection disable')} to put the device in service mode.`;
			} else {
				res = 'Open device';
				helper = `Run ${chalk.yellow('particle device-protection enable')} to protect the device.`;
			}

			const deviceStr = await this._getDeviceString();
			this.ui.stdout.write(`${deviceStr}: ${chalk.bold.white(res)}${os.EOL}${helper}${os.EOL}`);
			return s;
		});
	}

	/**
	 * Disables protection on the device.
	 *
	 * This method checks the current protection status of the device and proceeds to disable protection
	 * if the device is protected. If the device is not protected or is already in service mode,
	 * appropriate messages are logged to the console. If the `open` parameter is true, the device will be
	 * flashed with an unprotected bootloader and marked as a development device to prevent re-enabling protection.
	 *
	 * @async
	 * @param {Object} [options={}] - Options for disabling protection.
	 * @param {boolean} [options.open] - If true, flashes an unprotected bootloader and marks the device as a development device to make it an open device.
	 * @returns {Promise<void>}
	 * @throws {Error} - Throws an error if any of the async operations fail.
	 */
	async disableProtection({ open } = {}) {
		return this._withDevice(async () => {
			const deviceStr = await this._getDeviceString();
			let s = await this._getDeviceProtection();

			if (!s.protected && !s.overridden) {
				this.ui.stdout.write(`${deviceStr} is not a protected device.${os.EOL}`);
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

			// TODO: Error handling (Run CLI configured to local api but device to staging and vice versa)
			await this.device.unprotectDevice({ action: 'confirm', serverSignature, serverPublicKeyFingerprint });

			if (!open) {
				this.ui.stdout.write(`${deviceStr} is in service mode.${os.EOL}A protected device stays in service mode for a total of 20 reboots or 24 hours.${os.EOL}`);
				return;
			}

			const localBootloaderPath = await this._downloadBootloader();
			await this._flashBootloader(localBootloaderPath, 'disable');
			this.ui.stdout.write(`${deviceStr} is now an open device.${os.EOL}`);

			const success = await this._markAsDevelopmentDevice(true);
			this.ui.stdout.write(success ?
				`Device placed in development mode to maintain current settings.${os.EOL}` :
				`Failed to mark device as development device. Device protection may be enabled on next cloud connection.${os.EOL}`
			);
		});
	}

	/**
	 * Downloads the bootloader binary for the device.
	 *
	 * This method retrieves the firmware module information from the device to determine the version and platform ID.
	 * It then downloads the device OS version binaries and returns the path to the bootloader binary.
	 *
	 * @async
	 * @returns {Promise<string>} The file path to the downloaded bootloader binary.
	 * @throws {Error} Throws an error if any of the async operations fail.
	 */
	async _downloadBootloader() {
		const modules = await this.device.getFirmwareModuleInfo();
		const version = modules.find(m => m.type === 'SYSTEM_PART').version;
		const platformId = this.device.platformId;
		const downloadedFilePaths = await downloadDeviceOsVersionBinaries({ api: this.api, platformId, version, ui: this.ui });
		const platformName = platformForId(platformId).name;
		return downloadedFilePaths.find(f => path.basename(f).includes(`${platformName}-bootloader`));
	}

	/**
	 * Enables protection on the device.
	 *
	 * This method checks the current protection status of the device and proceeds to enable protection by
	 * either terminating the protection if the device is already protected or enabling protection on the device
	 * if the device is not protected and the device protection feature is active in the product.
	 * It flashes a protected bootloader binary to the device if necessary and marks the device as not in development mode.
	 *
	 * @async
	 * @param {Object} [options={}] - Options for enabling protection.
	 * @param {string} [options.file] - The path to a bootloader binary file to use for protection.
	 * @returns {Promise<void>}
	 * @throws {Error} Throws an error if any of the asynchronous operations fail.
	 */
	async enableProtection({ file } = {}) {
		let protectedBinary = file;
		return this._withDevice(async () => {
			const deviceStr = await this._getDeviceString();
			const s = await this._getDeviceProtection();

			if (s.protected && !s.overridden) {
				this.ui.stdout.write(`${deviceStr} is a protected device.${os.EOL}`);
				return;
			}

			const deviceProtectionActiveInProduct = await this._isDeviceProtectionActiveInProduct();
			if (s.overridden) {
				await this.device.unprotectDevice({ action: 'reset' });
				this.ui.stdout.write(`${deviceStr} is now a protected device.${os.EOL}`);
				if (deviceProtectionActiveInProduct) {
					const success = await this._markAsDevelopmentDevice(false);
					this.ui.stdout.write(success ?
						`Device removed from development mode to maintain current settings.${os.EOL}` :
						`Failed to remove device from development mode. Device protection may be disabled on next cloud connection.${os.EOL}`
					);
				}
				return;
			}

			if (!s.protected && !s.overridden && deviceProtectionActiveInProduct) {
				if (!protectedBinary) {
					const localBootloaderPath = await this._downloadBootloader();
					protectedBinary = await this.protectBinary({ file: localBootloaderPath, verbose: false });
				}
				await this._flashBootloader(protectedBinary, 'enable');
				this.ui.stdout.write(`${deviceStr} is now a protected device.${os.EOL}`);
				const success = await this._markAsDevelopmentDevice(false);
				this.ui.stdout.write(success ?
					`Device removed from development mode to maintain current settings.${os.EOL}` :
					`Failed to remove device from development mode. Device protection may be disabled on next cloud connection.${os.EOL}`
				);
			}
		});
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
				throw new Error(`Device protection feature is not supported on this device${os.EOL}`);
			}
			throw new Error(error);
		}
	}

	/**
	 * Flashes the bootloader on the device.
	 *
	 * @async
	 * @param {string} path - The path to the bootloader binary.
	 * @param {string} action - The action to perform ('enable' or 'disable').
	 * @returns {Promise<void>}
	 */
	async _flashBootloader(path, action) {
		let msg;
		switch (action) {
			case 'enable':
				msg = 'Enabling protection on the device...';
				break;
			case 'disable':
				msg = 'Disabling protection on the device...';
				break;
			default:
				throw new Error('Invalid action');
		}

		const flashCmdInstance = new FlashCommand();
		const flashPromise = flashCmdInstance.flashLocal({ files: [path], applicationOnly: true, verbose: false });
		await this.ui.showBusySpinnerUntilResolved(msg, flashPromise);
	}

	/**
	 * Marks the device as a development device.
	 *
	 * @async
	 * @param {boolean} state - The state to set for the development device.
	 * @returns {Promise<boolean>} True if the device was successfully marked, false otherwise.
	 */
	async _markAsDevelopmentDevice(state) {
		try {
			if (this.productId) {
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
		return res?.product?.device_protection;
	}

	/**
	 * Retrieves the product ID of the device.
	 *
	 * @async
	 * @returns {Promise<string|null>} The product ID if available, otherwise null.
	 */

	async _getProductId() {
		if (this.productId) {
			return;
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
	 *
	 * @async
	 * @param {Function} fn - The function to execute with the device.
	 * @returns {Promise<*>} The result of the function execution.
	 */
	async _withDevice(fn) {
		try {
			await this.getUsbDevice(this.device);

			if (this.device.isInDfuMode) {
				await this._resetDevice(this.device);
				await this.getUsbDevice(this.device);
			}

			return await fn();
		} finally {
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
	async getUsbDevice(dev) {
		if (!dev || dev.isOpen === false) {
			this.device = await usbUtils.getOneUsbDevice({ api: this.api, idOrName: this.deviceId, ui: this.ui });
			this.deviceId = this.device._id;
		}
	}

	/**
	 * Resets the device and waits for it to restart.
	 *
	 * @async
	 * @param {Object} device - The device to reset.
	 * @returns {Promise<void>}
	 */
	async _resetDevice(device) {
		await device.reset();
		if (device.isOpen) {
			await device.close();
		}
		await new Promise(resolve => setTimeout(resolve, 3000));
	}

	/**
	 * Protects a binary file by adding device protection.
	 *
	 * @async
	 * @param {Object} options - The options for protecting the binary.
	 * @param {string} options.file - The path to the binary file.
	 * @param {boolean} [options.verbose=true] - Whether to log verbose output.
	 * @returns {Promise<string>} The path to the protected binary file.
	 * @throws {Error} Throws an error if the file is not provided.
	 */
	async protectBinary({ file, verbose=true }) {
		if (!file) {
			throw new Error('Please provide a file to add device protection');
		}

		await fs.ensureFile(file);
		const fileName = path.basename(file);
		const resBinaryName = fileName.replace('.bin', '-protected.bin');
		const resBinaryPath = path.join(path.dirname(file), resBinaryName);

		const binary = await fs.readFile(file);
		const protectedBinary = await createProtectedModule(binary);
		await fs.writeFile(resBinaryPath, protectedBinary);

		if (verbose) {
			this.ui.stdout.write(`Protected binary saved at ${resBinaryPath}`);
		}

		return resBinaryPath;
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
