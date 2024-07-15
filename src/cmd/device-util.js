const usbUtils = require('./usb-util');
/**
 * Check if the string can represent a valid device ID.
 *
 * @param {String} str A string.
 * @return {Boolean}
 */
module.exports.isDeviceId = (str) => {
	return /^[0-9a-f]{24}$/i.test(str);
};

/**
 * Format device info.
 *
 * @param {Object} device Device info.
 * @param {String} device.id Device ID.
 * @param {String} device.type Device type, e.g. 'Photon'.
 * @param {String} [device.name] Device name.
 * @return {String}
 */
module.exports.formatDeviceInfo = ({ id, type, name = null }) => {
	return `${name || '<no name>'} [${id}] (${type})`;
};

/**
 * Get device attributes.
 *
 * @param {Object} options Options.
 * @param {String} options.id Device ID or name.
 * @param {Object} options.api API client.
 * @param {String} options.auth Access token.
 * @param {String} [options.displayName] Device name as shown to the user.
 * @param {Boolean} [options.dontThrow] Return 'null' instead of throwing an error if the device cannot be found.
 * @param {Promise<Object>}
 */
module.exports.getDevice = ({ id, api, auth, displayName = null, dontThrow = false }) => {
	return api.getDevice({ deviceId: id, auth })
		.then(res => res.body)
		.catch(error => {
			if (error.statusCode === 403 || error.statusCode === 404) {
				if (dontThrow) {
					return null;
				}
				throw new Error(`Device not found: ${displayName || id}`);
			}
			throw error;
		});
};

/**
* Waits for the device to reboot to reboot by checking if the device is ready to accept control requests.
* It waits for a maximum of 60 seconds with a 1-second interval.
*/
module.exports.waitForDeviceToReboot = async (deviceId) => {
	const REBOOT_TIME_MSEC = 60000;
	const REBOOT_INTERVAL_MSEC = 1000;
	const start = Date.now();
	while (Date.now() - start < REBOOT_TIME_MSEC) {
		try {
			await _delay(REBOOT_INTERVAL_MSEC);
			const device = await usbUtils.reopenDevice({ id: deviceId });
			// Waiting for any control request to work to ensure the device is ready
			await device.getDeviceId();
			return device;
		} catch (error) {
			// ignore error
		}
	}
};

async function _delay(ms){
	return new Promise((resolve) => setTimeout(resolve, ms));
}
