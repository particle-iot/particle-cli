const { getDevice, isDeviceId } = require('./device-util');
const { systemSupportsUdev, promptAndInstallUdevRules } = require('./udev');
const {
	getDevices,
	openDeviceById,
	NotFoundError,
	NotAllowedError
} = require('../lib/require-optional')('particle-usb');


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
 * Open a USB device with the specified device ID or name.
 *
 * This function checks whether the user has necessary permissions to access the device.
 * Use this function instead of particle-usb's openDeviceById().
 *
 * @param {Object} options Options.
 * @param {String} options.id Device ID or name.
 * @param {Object} options.api API client.
 * @param {String} options.auth Access token.
 * @param {Boolean} [options.dfuMode] Set to `true` if the device can be in DFU mode.
 * @param {String} [options.displayName] Device name as shown to the user.
 * @return {Promise}
 */
function openUsbDeviceById({ id, api, auth, dfuMode = false, displayName = null }){
	return Promise.resolve()
		.then(() => {
			if (isDeviceId(id)){
				// Try to open the device straight away
				return openDeviceById(id).catch(e => {
					if (!(e instanceof NotFoundError)){
						return handleDeviceOpenError(e);
					}
				});
			}
		})
		.then(usbDevice => {
			if (!usbDevice){
				return getDevice({ id, api, auth, displayName }).then(device => {
					if (device.id === id){
						throw new NotFoundError();
					}
					return openDeviceById(device.id).catch(e => handleDeviceOpenError(e));
				})
					.catch(e => {
						if (e instanceof NotFoundError){
							throw new Error(`Unable to connect to the device ${displayName || id}. Make sure the device is connected to the host computer via USB`);
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
		err = new Error('Missing permissions to access the USB device');
		if (systemSupportsUdev()){
			return promptAndInstallUdevRules(err);
		}
	}
	return Promise.reject(err);
}

module.exports = {
	openUsbDevice,
	openUsbDeviceById,
	getUsbDevices
};

