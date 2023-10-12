const { getDevice, isDeviceId } = require('./device-util');
const { systemSupportsUdev, promptAndInstallUdevRules } = require('./udev');
const { delay } = require('../lib/utilities');
const { platformForId } = require('../lib/platform');
const {
	getDevices,
	openDeviceById,
	NotFoundError,
	NotAllowedError,
	TimeoutError
} = require('../lib/require-optional')('particle-usb');

// Timeout when reopening a USB device after an update via control requests. This timeout should be
// long enough to allow the bootloader apply the update
const REOPEN_TIMEOUT = 60000;
// When reopening a device that was about to reset, give it some time to boot into the firmware
const REOPEN_DELAY = 500;


async function _getDeviceId(device) {
	let id = null;
	try {
		await device.open();
		return device._id;
	} catch (err) {
		// ignore error
	} finally {
		if (device.isOpen) {
			await device.close();
		}
	}
	return id;
}

async function _getDeviceMode(device) {
	if (device.isInDfuMode) {
		return 'DFU';
	}

	try {
		await device.open();
		const mode = await device.getDeviceMode({ timeout: 10 * 1000 });
		console.log('mode', mode);
		if (mode && (mode !== 'NORMAL')) {
			return mode;
		}
	} catch (err) {
		if (err instanceof TimeoutError) {
			return 'UNKNOWN';
		} else {
			throw new Error(`Unable to get device mode: ${err.message}`);
		}
	} finally {
		if (device.isOpen) {
			await device.close();
		}
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

async function getOneUsbDevice({ idOrName, api, auth, ui }) {
	if (idOrName) {
		return openUsbDeviceByIdOrName(idOrName, api, auth, { dfuMode: true });
	}

	const usbDevices = await getUsbDevices({ dfuMode: true });

	let usbDevice;
	if (usbDevices.length > 1) {
		const question = {
			type: 'list',
			name: 'device',
			message: 'Which device would you like to select?',
			choices() {
				return Promise.all(usbDevices.map(async (d) => {
					const id = await _getDeviceId(d);
					const mode = await _getDeviceMode(d);
					return {
						name: `[${id}] (${platformForId(d._info.id).displayName}${mode ? ', ' + mode : ''})`,
						value: d
					};
				}));
			}
		};
		const nonInteractiveError = 'Multiple devices found. Connect only one device when running in non-interactive mode.';
		const ans = await ui.prompt([question], { nonInteractiveError });
		usbDevice = ans.device;
	} else if (usbDevices.length === 1) {
		usbDevice = usbDevices[0];
	} else {
		throw new NotFoundError('No device found');
	}

	try {
		await usbDevice.open();
		return usbDevice;
	} catch (err) {
		await handleUsbError(err);
	}
}

async function reopenInDfuMode(device) {
	const { id } = device;
	const start = Date.now();
	while (Date.now() - start < REOPEN_TIMEOUT) {
		await delay(REOPEN_DELAY);
		try {
			await device.close();
			device = await openUsbDeviceById(id, { dfuMode: true });
			if (!device.isInDfuMode) {
				await device.enterDfuMode();
				await device.close();
				device = await openUsbDeviceById(id);
			}
			return device;
		} catch (error) {
			// ignore error
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
			// ignore error
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
	TimeoutError
};
