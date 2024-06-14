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
	}

    async getStatus() {

		// I will fix this logic to accommodate devices in dfu mode.
		// To get information for dfu devices, a new API needs to be exposed from Particle-USB to get the dfu segments
		// and verify that the segment containing the system-part1 is writable or not. If the segment is writable,
		// then the device is not pretected. For now though, let's assume the device is in normal mode and not in dfu mode.

        return this._withDevice(async () => {
			let s;
			try {
				s = await this.device.getProtectionState();
			} catch (error) {
				if (error.message === 'Not implemented') {
					throw new Error(`Device protection status is not supported on this device${os.EOL}${os.EOL}`);
				}
				throw new Error('Failed to get device protection status');
			}

			let res;
			if (!s.protected && !s.overridden) {
				res = 'not protected';
			} else if (s.protected && !s.overridden) {
				res = 'protected';
			} else if (s.overridden) {
				res = 'temporarily not protected. A reset is required to re-enable protection.';
			}

			this.ui.stdout.write(`Device (${this.deviceId}) is ${chalk.bold(res)}${os.EOL}${os.EOL}`);

			return s;
		});
	}

    async disableProtection({ permanent }) {
		// TODO : Remove logs with sensitive information

        return this._withDevice(async () => {
			let s = await this.device.getProtectionState();
			if (!s.protected && !s.overridden) {
				this.ui.stdout.write(`Device is not protected${os.EOL}${os.EOL}`);
				return;
			}

			// console.log(`CLI -> Server:\n\taction=prepare`);
			let r = await this.api.unprotectDevice({ deviceId: this.deviceId, action: 'prepare', auth: settings.access_token });
			const serverNonce = Buffer.from(r.server_nonce, 'base64');
			// console.log(`Server -> CLI:\n\tserver_nonce=${serverNonce.toString('base64')}`);

			// Request a device nonce and signature
			// console.log(`CLI -> Device:\n\tserver_nonce=${serverNonce.toString('base64')}`);
			r = await this.device.unprotectDevice({ action: 'prepare', serverNonce });
			if (!r.protected) {
			  console.log('Device is not protected');
			  return;
			}
			const { deviceNonce, deviceSignature, devicePublicKeyFingerprint } = r;
			// console.log(`Device -> CLI:\n\tdevice_signature=${deviceSignature.toString('base64')}`);

			// Verify the device signature and get a server signature
			// console.log(`CLI -> Server:\n\tdevice_signature=${deviceSignature.toString('base64')}`);
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
			// console.log(`Server -> CLI:\n\tserver_signature=${serverSignature.toString('base64')}`);

			// Unprotect the device
			await this.device.unprotectDevice({ action: 'confirm', serverSignature, serverPublicKeyFingerprint });

			s = await this.device.getProtectionState();
			if (!permanent) {
				this.ui.stdout.write(`Device protection ${chalk.bold('temporarily disabled')}${os.EOL}${os.EOL}`);
			}

			if (permanent) {

				const localBootloaderPath = await this._downloadBootloader();

				await this._flashBootloader(localBootloaderPath);

				this.ui.stdout.write(os.EOL);

				this.ui.stdout.write(`Device is permanently unlocked${os.EOL}${os.EOL}`);

				const success = await this._markAsDevelopmentDevice(true);

				if (!success) {
					this.ui.stdout.write(`Failed to mark device as development device. Protection will be automatically enabled after a power cycle${os.EOL}`);
				}
			}
        });
    }

	async _downloadBootloader() {

		let version;
		const modules = await this.device.getFirmwareModuleInfo();
		modules.forEach((m) => {
			if (m.type === 'SYSTEM_PART') {
				version = m.version;
			}
		});

		const platformId = this.device.platformId;

		const downloadedFilePaths = await downloadDeviceOsVersionBinaries({ api: this.api, platformId, version, ui: this.ui });
		const platformName = platformForId(platformId).name;
		const localBootloaderPath = downloadedFilePaths.filter(f => path.basename(f).includes(platformName + '-' + 'bootloader'));

		// FIXME: Currently I am only expecting one bootloader per platform
		return localBootloaderPath[0];
	}



	async enableProtection() {
		// TODO: Option to provide bootloader binary in the path

		// TODO: error if device protection is not supported on this firmware version

		return this._withDevice(async () => {
			let s = await this.device.getProtectionState();
			if (s.protected && !s.overridden) {
				this.ui.stdout.write(`Device is protected${os.EOL}${os.EOL}`);
				return;
			}

			if (s.overridden) {
				// terminate unlock
				await this.device.unprotectDevice({ action: 'reset' });
				this.ui.stdout.write(`Device is ${chalk.bold('protected')}${os.EOL}`);
				const success = await this._markAsDevelopmentDevice(false);
				if (success) {
					this.ui.stdout.write(`Device was removed from development mode to keep in protection mode.${os.EOL}`);
				} else {
					this.ui.stdout.write(`Failed to mark device as development device${os.EOL}`);
				}

				return;
			}

			if (!s.protected && !s.overridden) {
				// Protect device (permanently)

				const localBootloaderPath = await this._downloadBootloader();

				const resPath = await this.protectBinary(localBootloaderPath);

				await this._flashBootloader(resPath);

				this.ui.stdout.write(`Remove device as development device...${os.EOL}${os.EOL}`);

				const success = await this._markAsDevelopmentDevice(false);

				if (success) {
					this.ui.stdout.write(`Device was removed from development mode to enable protection.${os.EOL}`);
				} else {
					this.ui.stdout.write(`Failed to remove device from development mode.${os.EOL}`);
				}
			}
		});
	}

	async _flashBootloader(path) {
		const flashCmdInstance = new FlashCommand();
		await flashCmdInstance.flashLocal({ files: [path], applicationOnly: true });
	}

	async _markAsDevelopmentDevice(state) {
		let attrs;
		try {
			attrs = await this.api.getDeviceAttributes(this.deviceId);
			if (attrs.platform_id !== attrs.product_id) {
				// it's in a product
				await this.api.markAsDevelopmentDevice(this.deviceId, state, attrs.product_id );
				return true;
			}
		} catch (error) {
			// FIXME
			return false;
		}
	}


	// Gets a USB device and performs the given function
	// If the device is in DFU mode, it will reset the device to get it in normal mode
    async _withDevice(fn) {
		try {
			await this.getUsbDevice(this.device);

			if (this.device.isInDfuMode) {
				this.ui.stdout.write(`Device is in DFU mode. Performing a reset to get the device in normal mode. Please wait...${os.EOL}`);
				await this.resetDevice(this.device);
				this.ui.stdout.write(`Done! Device is now in normal mode.${os.EOL}`);
				await this.getUsbDevice(this.device);
			}

			return await fn();
		} finally {
			if (this.device && this.device.isOpen) {
				await this.device.close();
			}
		}
	}

	async getUsbDevice(dev) {
		if (!dev || dev.isOpen === false) {
			this.device = await usbUtils.getOneUsbDevice({ api: this.api, idOrName: this.deviceId, ui: this.ui });
			this.deviceId = this.device._id;
		}
	}

	async resetDevice(device) {
		await device.reset();
		if (device.isOpen) {
			await device.close();
		}
		await new Promise(resolve => setTimeout(resolve, 3000));
	}

	async protectBinary(file) {
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

		this.ui.stdout.write(`Protected binary saved at ${resBinaryPath}${os.EOL}${os.EOL}`);

		return resBinaryPath;
	}

	_particleApi() {
		const auth = settings.access_token;
		const api = new ParticleApi(settings.apiUrl, { accessToken: auth } );
		const apiCache = createApiCache(api);
		return { api: apiCache, auth };
	}
};
