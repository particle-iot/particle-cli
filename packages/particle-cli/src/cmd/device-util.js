const { spin } = require('../app/ui');

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
	const getDeviceInfo = api.getDevice({ deviceId: id, auth })
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

	return spin(getDeviceInfo, 'Getting device information...');
};

