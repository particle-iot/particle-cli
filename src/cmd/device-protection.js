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
			const s = await this._getDeviceProtection();

			let res;
			if (!s.protected && !s.overridden) {
				res = `Open (not protected)${os.EOL}Run ${chalk.yellow('particle device-protection enable')} to protect the device`;
			} else if (s.protected && !s.overridden) {
				res = `Protected${os.EOL}Run ${chalk.yellow('particle device-protection disable')} unlock the device`;
			} else if (s.overridden) {
				res = `Protected (service mode)${os.EOL}Run ${chalk.yellow('particle device-protection enable')} to enable protection`;
			}

			this.ui.stdout.write(`Device protection : ${res}${os.EOL}`);

			return s;
		});
	}

    async disableProtection({ open } = {}) {
		return this._withDevice(async () => {
			let s = await this._getDeviceProtection();

			if (!s.protected && !s.overridden) {
				this.ui.stdout.write(`Device is not protected${os.EOL}`);
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
				this.ui.stdout.write(`Device is not protected${os.EOL}`);
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

			s = await this._getDeviceProtection();
			if (!open) {
				this.ui.stdout.write(`Device protection temporarily disabled.${os.EOL}Device is put into service mode for 20 reboots or 24 hours.${os.EOL}`);
				return;
			}

			const localBootloaderPath = await this._downloadBootloader();

			await this._flashBootloader(localBootloaderPath, 'disable');

			this.ui.stdout.write(`Device protection disabled. Device is now open${os.EOL}`);
			this.ui.stdout.write(`Putting device in developement mode to prevent cloud from enabling protection...${os.EOL}`);

			const success = await this._markAsDevelopmentDevice(true);

			if (!success) {
				this.ui.stdout.write(`Failed to mark device as development device. Protection will be automatically enabled after a power cycle${os.EOL}`);
			} else {
				this.ui.stdout.write(`Device is now in development mode${os.EOL}`);
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



	async enableProtection({ file } = {}) {
		// TODO: Option to provide bootloader binary in the path

		// TODO: Log better error if device protection is not supported on this firmware version
		let protectedBinary = file;

		return this._withDevice(async () => {
			const s = await this._getDeviceProtection();
			
			const attrs = await this.api.getDeviceAttributes(this.deviceId);
			let deviceProtectionActiveInProduct = false;
			if (attrs.platform_id !== attrs.product_id) {
				// it's in a product
				const res = await this.api.getProduct({ product: attrs.product_id, auth: settings.access_token });
				deviceProtectionActiveInProduct = res.product.device_protection;
			}

			if (s.protected && !s.overridden) {
				this.ui.stdout.write(`Device is protected${os.EOL}`);
				return;
			}

			if (s.overridden) {
				// terminate unlock
				await this.device.unprotectDevice({ action: 'reset' });
				
				this.ui.stdout.write(`Device is protected${os.EOL}`);
				this.ui.stdout.write(`Removing device from developement mode...${os.EOL}`);
				
				const success = await this._markAsDevelopmentDevice(false);
				if (!success) {
					this.ui.stdout.write(`Failed to remove device from development mode. Ensure it is not in development mode for protection to work properly${os.EOL}`);
				}
				return;
			}

			if (!s.protected && !s.overridden && deviceProtectionActiveInProduct) {
				// Protect device (permanently)

				if (!protectedBinary) {
					const localBootloaderPath = await this._downloadBootloader();
					protectedBinary = await this.protectBinary({ file: localBootloaderPath, verbose: false });
				}

				await this._flashBootloader(protectedBinary, 'enable');

				this.ui.write(`Device is protected${os.EOL}`);
				this.ui.stdout.write(`Removing device from developement mode...${os.EOL}`);

				const success = await this._markAsDevelopmentDevice(false);
				
				if (!success) {
					this.ui.stdout.write(`Failed to remove device from development mode. Ensure it is not in development mode for protection to work properly${os.EOL}`);
				}
			}
		});
	}

	async _getDeviceProtection() {
		try {
			const s = await this.device.getProtectionState();
			return s;
		} catch (error) {
			if (error.message === 'Not supported') {
				throw new Error(`Device protection feature is not supported on this device${os.EOL}`);
			}
		}
	}

	async _flashBootloader(path, action) {
		let msg;
		switch (action) {
			case 'enable':
				msg = 'Enabling protection on the device. Please wait...';
				break;
			case 'disable':
				msg = 'Disabling protection on the device. Please wait...';
				break;
			default:
				throw new Error('Invalid action');
		}

		const flashCmdInstance = new FlashCommand();
	
		const flashPromise = flashCmdInstance.flashLocal({ files: [path], applicationOnly: true, verbose: false });
	
		await this.ui.showBusySpinnerUntilResolved(msg, flashPromise);
	}

	async _markAsDevelopmentDevice(state) {
		let attrs;
		try {
			// TODO: Refactor
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
				this.ui.stdout.write(`Done! Device is now in normal mode${os.EOL}`);
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

	_particleApi() {
		const auth = settings.access_token;
		const api = new ParticleApi(settings.apiUrl, { accessToken: auth } );
		const apiCache = createApiCache(api);
		return { api: apiCache, auth };
	}
};
