const { getDevice, isDeviceId } = require('./device-util');
const { systemSupportsUdev, promptAndInstallUdevRules } = require('./udev');
const {
	getDevices,
	openDeviceById,
	NotFoundError,
	NotAllowedError,
	TimeoutError
} = require('../lib/require-optional')('particle-usb');

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
function openUsbDevice(usbDevice, { dfuMode = false } = {}){
	if (!dfuMode && usbDevice.isInDfuMode){
		return Promise.reject(new Error('The device should not be in DFU mode'));
	}
	return Promise.resolve().then(() => usbDevice.open())
		.catch(e => handleDeviceOpenError(e));
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
		await handleDeviceOpenError(err); // Throws the original error or a UsbPermissionsError
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
 * @param {String} [options.displayName] Device name as shown to the user.
 * @param {Boolean} [options.dfuMode] Set to `true` if the device can be in DFU mode.
 * @return {Promise}
 */
function openUsbDeviceByIdOrName(idOrName, api, auth, { displayName, dfuMode = false } = {}) {
	return Promise.resolve()
		.then(() => {
			if (isDeviceId(idOrName)) {
				// Try to open the device straight away
				return openDeviceById(idOrName).catch(e => {
					if (!(e instanceof NotFoundError)){
						return handleDeviceOpenError(e);
					}
				});
			}
		})
		.then(usbDevice => {
			if (!usbDevice){
				return getDevice({ id: idOrName, api, auth, displayName }).then(device => {
					if (device.id === idOrName){
						throw new NotFoundError();
					}
					return openDeviceById(device.id).catch(e => handleDeviceOpenError(e));
				})
					.catch(e => {
						if (e instanceof NotFoundError){
							throw new Error(`Unable to connect to the device ${displayName || idOrName}. Make sure the device is connected to the host computer via USB`);
						}
						throw e;
					});
			}
			return usbDevice;
		})
		.then(usbDevice => {
			if (!dfuMode && usbDevice.isInDfuMode){
				return usbDevice.close().then(() => {
					throw new Error('The device should not be in DFU mode');
				});
			}
			return usbDevice;
		});
}

/**
 * Get the list of USB devices attached to the host.
 *
 * @param {Object} options Options.
 * @param {Boolean} [options.dfuMode] Set to `false` to exclude devices in DFU mode.
 * @return {Promise}
 */
function getUsbDevices({ dfuMode = true } = {}){
	return Promise.resolve().then(() => getDevices({ includeDfu: dfuMode }));
}

function handleDeviceOpenError(err){
	if (err instanceof NotAllowedError){
		err = new UsbPermissionsError('Missing permissions to access the USB device');
		if (systemSupportsUdev()){
			return promptAndInstallUdevRules(err).catch(err => {
				throw new UsbPermissionsError(err.message);
			});
		}
	}
	return Promise.reject(err);
}

module.exports = {
	openUsbDevice,
	openUsbDeviceById,
	openUsbDeviceByIdOrName,
	getUsbDevices,
	UsbPermissionsError,
	TimeoutError
};
