const { spin } = require('../app/ui');
const { getDevice, isDeviceId } = require('./device-util');
const { systemSupportsUdev, promptAndInstallUdevRules } = require('./udev');
const { delay, asyncMapSeries } = require('../lib/utilities');
const { platformForId, PLATFORMS } = require('../lib/platform');
const {
	getDevices,
	openDeviceById,
	NotFoundError,
	NotAllowedError,
	TimeoutError,
	DeviceProtectionError
} = require('particle-usb');
const deviceProtectionHelper = require('../lib/device-protection-helper');
const { validateDFUSupport } = require('./device-util');

// Timeout when reopening a USB device after an update via control requests. This timeout should be
// long enough to allow the bootloader apply the update
const REOPEN_TIMEOUT = 60000;
// When reopening a device that was about to reset, give it some time to boot into the firmware
const REOPEN_DELAY = 500;

async function _getDeviceInfo(device) {
	let id = null;
	let mode = null;
	try {
		await device.open();
		id = device._id;
		if (device.isInDfuMode) {
			mode = 'DFU';
			return { id, mode };
		}
		mode = await device.getDeviceMode({ timeout: 10 * 1000 });
		// not required to show NORMAL mode to the user
		if (mode === 'NORMAL') {
			mode = '';
		}
		return { id, mode };
	} catch (err) {
		if (err instanceof TimeoutError) {
			return { id, mode: 'UNKNOWN' };
		} else if (err instanceof DeviceProtectionError) {
			return { id, mode: 'PROTECTED' };
		} else {
			throw new Error(`Unable to get device mode: ${err.message}`);
		}
	} finally {
		if (device.isOpen) {
			await device.close();
		}
	}
}

async function _getDeviceName({ id, api, auth, ui }) {
	try {
		const device = await getDevice({ id, api, auth, ui });
		return device && device.name ? device.name : '<no name>';
	} catch (err) {
		return '<unknown>';
	}
}

/**
 * USB permissions error.
 */
class UsbPermissionsError extends Error {
	/**
	 * Construct an error instance.
	 *
	 * @param {String} message Error message.
	 */
	constructor(message) {
		super(message);
		this.name = this.constructor.name;
	}
}

/**
 * Executes a function with a USB device, handling device protection and DFU mode.
 *
 * @param {Object} options - The options for executing with the USB device.
 * @param {Object} options.args - The arguments to identify and configure the USB device.
 * @param {Function} options.func - The function to execute with the USB device.
 * @param {boolean} [options.dfuMode=false] - Flag indicating whether to include devices in DFU mode.
 * @returns {Promise<*>} The result of the executed function.
 * @throws {Error} If the device is protected and cannot be unprotected, or if the executed function throws an error.
 *
 * @example
 * await executeWithUsbDevice({
 *   args: { idOrName: 'e00fce6819ef5f971ea9563a' },
 *   func: async (device) => {
 *     // Perform operations with the device
 *     return result;
 *   },
 *   dfuMode: true
 * });
 */
async function executeWithUsbDevice({ args, func, enterDfuMode = false, allowProtectedDevices = true } = {}) {
	let device = await getOneUsbDevice(args);
	const deviceId = device.id;
	let deviceIsProtected = false; // Protected and Protected Devices in Service Mode
	let disableProtection = false; // Only Protected Devices (not in Service Mode)

	const platform = platformForId(device.platformId);
	if (platform.generation > 2) { // Skipping device protection check for Gen2 platforms
		try {
			const s = await deviceProtectionHelper.getProtectionStatus(device);
			deviceIsProtected = s.overridden || s.protected;
			disableProtection = s.protected && !s.overridden;
			if (deviceIsProtected && !allowProtectedDevices) {
				throw new Error('This command is not allowed on Protected Devices.');
			}
		} catch (err) {
			if (err.message === 'Not supported') {
				// Device Protection is not supported on certain platforms and versions.
				// It means that the device is not protected.
			} else {
				throw err;
			}
		}
		if (disableProtection) {
			const deviceWasInDfuMode = device.isInDfuMode;
			if (deviceWasInDfuMode) {
				device = await _putDeviceInSafeMode(device);
			}
			await deviceProtectionHelper.disableDeviceProtection(device);
			if (deviceWasInDfuMode) {
				device = await reopenInDfuMode(device);
			}
		}
	}

	try {
		if (enterDfuMode) {
			validateDFUSupport({ device, ui: args.ui });
			device = await reopenInDfuMode(device);
		}
		await func(device);
	} finally {
		if (deviceIsProtected) {
			try {
				device = await waitForDeviceToRespond(deviceId);
				await deviceProtectionHelper.turnOffServiceMode(device);
			} catch (error) {
				// Ignore error. At most, device is left in Service Mode
			}
		}
		if (device && device.isOpen) {
			await device.close();
		}
	}
}

/**
 * Waits for device readiness (mainly to send control requsts to it)
 * Useful for enabling Device Protection on a device in after its current operation completes.
 * @param {*} deviceId
 * @returns
 */
async function waitForDeviceToRespond(deviceId, { timeout = 10000 } = {}) {
	const REBOOT_TIME_MSEC = timeout;
	const REBOOT_INTERVAL_MSEC = 500;
	const start = Date.now();
	let device;
	while (Date.now() - start < REBOOT_TIME_MSEC) {
		try {
			if (device && device.isOpen) {
				await device.close();
			}
			await delay(REBOOT_INTERVAL_MSEC);
			device = await reopenDevice({ id: deviceId });
			if (device.isInDfuMode) {
				return device;
			}
			// Check device readiness
			await device.getDeviceId();
			return device;
		} catch (error) {
			// ignore errors
			// device could be open after the last iteration
			if (device && device.isOpen) {
				await device.close();
			}
		}
	}
	return null;
}

/**
	 * Attempts to enter Safe Mode to enable operations on Protected Devices in DFU mode.
	 *
	 * @async
	 * @param {Object} device - The device to reset.
	 * @returns {Promise<void>}
	 */
async function _putDeviceInSafeMode(dev) {
	try {
		await dev.enterSafeMode();
	} catch (error) {
		// ignore errors
	}
	return reopenInNormalMode({ id: this.deviceId });
}

/**
 * Open a USB device.
 *
 * This function checks whether the user has necessary permissions to access the device.
 * Use this function instead of particle-usb's Device.open().
 *
 * @param {Object} usbDevice USB device.
 * @param {Object} options Options.
 * @param {Boolean} [options.dfuMode] Set to `true` if the device can be in DFU mode.
 * @return {Promise}
 */
async function openUsbDevice(usbDevice, { dfuMode = false } = {}){
	if (!dfuMode && usbDevice.isInDfuMode){
		throw new Error('The device should not be in DFU mode');
	}
	try {
		return await usbDevice.open();
	} catch (err) {
		await handleUsbError(err);
	}
}

/**
 * Open a USB device with the specified device ID.
 *
 * This function checks whether the user has necessary permissions to access the device.
 * Use this function instead of particle-usb's openDeviceById().
 *
 * @param {String} id Device ID.
 * @param {Object} [options] Options.
 * @param {String} [options.displayName] Device name as shown to the user.
 * @param {Boolean} [options.dfuMode] Set to `true` if the device can be in DFU mode.
 * @return {Promise}
 */
async function openUsbDeviceById(id, { displayName, dfuMode = false } = {}) {
	let dev;
	try {
		dev = await openDeviceById(id);
	} catch (err) {
		if (err instanceof NotFoundError) {
			throw new Error(`Unable to connect to the device ${displayName || id}. Make sure the device is connected to the host computer via USB`);
		}
		await handleUsbError(err); // Throws the original error or a UsbPermissionsError
	}
	if (dev.isInDfuMode && !dfuMode) {
		await dev.close();
		throw new Error('The device should not be in DFU mode');
	}
	return dev;
}

/**
 * Open a USB device with the specified device ID or name.
 *
 * This function checks whether the user has necessary permissions to access the device.
 *
 * @param {String} idOrName Device ID or name.
 * @param {Object} api API client.
 * @param {String} auth Access token.
 * @param {Object} [options] Options.
 * @param {Boolean} [options.dfuMode] Set to `true` if the device can be in DFU mode.
 * @return {Promise}
 */
async function openUsbDeviceByIdOrName(idOrName, api, auth, { dfuMode = false } = {}) {
	let device;
	if (isDeviceId(idOrName)) {
		// Try to open the device straight away
		try {
			device = await openDeviceById(idOrName);
		} catch (err) {
			// continue if the device is not found
			if (!(err instanceof NotFoundError)) {
				await handleUsbError(err);
			}
		}
	}

	if (!device) {
		let deviceInfo = await getDevice({ id: idOrName, api, auth });
		try {
			device = await openDeviceById(deviceInfo.id);
		} catch (err) {
			// TODO: improve error message when device is not found. Currently it says Device is not found
			await handleUsbError(err);
		}
	}

	if (!dfuMode && device.isInDfuMode){
		await device.close();
		throw new Error('The device should not be in DFU mode');
	}
	return device;
}

/**
 * Get the list of USB devices attached to the host.
 *
 * @param {Object} options Options.
 * @param {Boolean} [options.dfuMode] Set to `true` to include devices in DFU mode.
 * @return {Promise}
 */
async function getUsbDevices({ dfuMode = false } = {}){
	try {
		return await getDevices({ includeDfu: dfuMode });
	} catch (err) {
		await handleUsbError(err);
	}
}

async function getOneUsbDevice({ idOrName, api, auth, ui, flashMode, platformId }) {
	let usbDevice;
	const normalModes = ['NORMAL', 'LISTENING', ''];
	const dfuModes = ['DFU'];
	if (idOrName) {
		const device = await openUsbDeviceByIdOrName(idOrName, api, auth, { dfuMode: true });
		await checkFlashMode({ flashMode, device });
		return device;
	}

	const usbDevices = await getUsbDevices({ dfuMode: true });
	if (!usbDevices.length) {
		throw new Error('No devices found');
	}
	let devices = await Promise.all(usbDevices.map(async (d) => {
		const { id, mode } = await _getDeviceInfo(d);
		const name = await _getDeviceName({ id, api, auth, ui });
		return {
			id,
			name: `${name} [${id}] (${(platformForId(d._info.id)).displayName}${mode ? ', ' + mode : '' })`,
			platformId: d._info.id,
			mode,
			value: d
		};
	}));

	devices = devices.sort((d1, d2) => d1.id.localeCompare(d2.id));

	if (flashMode === 'DFU') {
		devices = devices.filter(d => dfuModes.includes(d.mode));
	}
	if (flashMode === 'NORMAL') {
		devices = devices.filter(d => normalModes.includes(d.mode));
	}
	if (platformId) {
		devices = devices.filter(d => d.platformId === platformId);
	}

	// filter out linux kind devices
	const linuxPlatforms = PLATFORMS.filter(p => p.features.includes('linux'));
	devices = devices.filter(d => !linuxPlatforms.includes(platformForId(d.platformId)));

	if (devices.length > 1) {
		const question = {
			type: 'list',
			name: 'device',
			message: 'Which device would you like to select?',
			choices() {
				return devices;
			}
		};
		const nonInteractiveError = 'Multiple devices found. Connect only one device when running in non-interactive mode.';
		const ans = await ui.prompt([question], { nonInteractiveError });
		usbDevice = ans.device;
	} else if (!devices.length) {
		if (flashMode === 'DFU') {
			ui.logDFUModeRequired();
		} else if (flashMode === 'NORMAL') {
			ui.logNormalModeRequired();
		}
		throw new Error('No devices found');
	} else {
		usbDevice = devices[0].value;
	}

	try {
		await usbDevice.open();
		return usbDevice;
	} catch (err) {
		await handleUsbError(err);
	}
}

async function checkFlashMode({ flashMode, device, ui }){
	switch (flashMode) {
		case 'DFU':
			if (!device.isInDfuMode) {
				ui.logDFUModeRequired();
				throw new Error('Put the device in DFU mode and try again');
			}
			break;
		case 'NORMAL':
			if (device.isInDfuMode) {
				ui.logNormalModeRequired();
				throw new Error('Put the device in Normal mode and try again');
			}
			break;
		default:
			break;
	}
}

async function reopenInDfuMode(device) {
	const { id } = device;
	const start = Date.now();
	while (Date.now() - start < REOPEN_TIMEOUT) {
		await delay(REOPEN_DELAY);
		try {
			if (device && device.isOpen) {
				await device.close();
			}
			device = await openUsbDeviceById(id, { dfuMode: true });
			if (!device.isInDfuMode) {
				await device.enterDfuMode();
				await device.close();
				device = await openUsbDeviceById(id);
			}
			return device;
		} catch (error) {
			// ignore other errors
			if (error instanceof DeviceProtectionError) {
				throw new Error('Operation cannot be completed due to Device Protection.');
			}
		}
	}
	throw new Error('Unable to reconnect to the device. Try again or run particle update to repair the device');
}

async function reopenInNormalMode(device, { reset } = {}) {
	const { id } = device;
	if (reset && device.isOpen) {
		await device.reset();
	}
	if (device.isOpen) {
		await device.close();
	}
	const start = Date.now();
	while (Date.now() - start < REOPEN_TIMEOUT) {
		await delay(REOPEN_DELAY);
		try {
			device = await openDeviceById(id);
			if (device.isInDfuMode) {
				await device.close();
			} else {
				// check if we can communicate with the device
				if (device.isOpen) {
					return device;
				}
			}
		} catch (err) {
			// ignore errors
		}
	}
	throw new Error('Unable to reconnect to the device. Try again or run particle update to repair the device');
}

async function reopenDevice(device) {
	const { id } = device;
	if (device.isOpen) {
		await device.close();
	}
	const start = Date.now();
	while (Date.now() - start < REOPEN_TIMEOUT) {
		await delay(REOPEN_DELAY);
		try {
			device = await openDeviceById(id);
			// check if we can communicate with the device
			if (device.isOpen) {
				return device;
			}

		} catch (err) {
			// ignore error
		}
	}
	throw new Error('Unable to reconnect to the device. Try again or run particle update to repair the device');
}

async function forEachUsbDevice(args, func, { dfuMode = false } = {}){
	const msg = 'Getting device information...';
	const operation = openUsbDevices(args, { dfuMode });
	let lastError = null;
	let outputMsg = [];
	return spin(operation, msg)
		.then(usbDevices => {
			const p = usbDevices.map(async (usbDevice) => {
				return Promise.resolve()
					.then(async () => {
						await executeWithUsbDevice({
							args: { idOrName : usbDevice.id, api: args.api, auth: args.auth },
							func,
							dfuMode
						});
					})
					.catch(e => lastError = e);
			});
			return spin(Promise.all(p), 'Sending a command to the device...');
		})
		.then(() => {
			if (outputMsg.length > 0) {
				outputMsg.forEach(msg => console.log(msg));
			}
			if (lastError){
				throw lastError;
			}
		});
}

async function openUsbDevices(args, { dfuMode = false } = {}){
	const deviceIds = args.params.devices;
	return Promise.resolve()
		.then(() => {
			if (args.all){
				return getUsbDevices({ dfuMode: true })
					.then(usbDevices => {
						return asyncMapSeries(usbDevices, (usbDevice) => {
							return openUsbDevice(usbDevice, { dfuMode })
								.then(() => usbDevice);
						});
					});
			}

			if (deviceIds.length === 0){
				return getUsbDevices({ dfuMode: true })
					.then(usbDevices => {
						if (usbDevices.length === 0){
							throw new Error('No devices found');
						}
						if (usbDevices.length > 1){
							throw new Error('Found multiple devices. Please specify the ID or name of one of them');
						}
						const usbDevice = usbDevices[0];
						return openUsbDevice(usbDevice, { dfuMode })
							.then(() => [usbDevice]);
					});
			}

			return asyncMapSeries(deviceIds, (id) => {
				return openUsbDeviceByIdOrName(id, args.api, args.auth, { dfuMode })
					.then(usbDevice => usbDevice);
			});
		});
}

async function handleUsbError(err){
	if (err instanceof NotAllowedError) {
		err = new UsbPermissionsError('Missing permissions to access the USB device');
		if (systemSupportsUdev()) {
			try {
				await promptAndInstallUdevRules(err);
			} catch (err) {
				throw new UsbPermissionsError(err.message);
			}
		}
	}
	throw err;
}

module.exports = {
	openUsbDevice,
	openUsbDeviceById,
	openUsbDeviceByIdOrName,
	getUsbDevices,
	getOneUsbDevice,
	reopenInDfuMode,
	reopenInNormalMode,
	reopenDevice,
	UsbPermissionsError,
	TimeoutError,
	DeviceProtectionError,
	forEachUsbDevice,
	openUsbDevices,
	executeWithUsbDevice,
	waitForDeviceToRespond
};
