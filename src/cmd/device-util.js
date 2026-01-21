'use strict';
const { platformForId } = require('../lib/platform');
const semver = require('semver');
const { isAuthError, tryWithAuth } = require('../lib/auth-helper');
const log = require('../lib/log');

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
	return tryWithAuth(
		async () => {
			const res = await api.getDevice({ deviceId: id, auth });
			return res.body;
		},
		{
			optional: dontThrow,
			context: `device lookup ${displayName || id}`
		}
	).catch(error => {
		// Handle specific error cases
		if (error.statusCode === 404) {
			if (dontThrow) {
				return null;
			}
			throw new Error(`Device not found: ${displayName || id}`);
		}

		// Auth errors are already handled by tryWithAuth when dontThrow is true
		if (isAuthError(error) && dontThrow) {
			log.verbose(`Auth failed for device lookup, returning null: ${displayName || id}`);
			return null;
		}

		throw error;
	});
};

module.exports.validateDFUSupport = ({ device, ui }) => {
	const platform = platformForId(device.platformId);
	if (!device.isInDfuMode && (!semver.valid(device.firmwareVersion) || semver.lt(device.firmwareVersion, '2.0.0')) && platform.generation === 2) {
		ui.logDFUModeRequired({ showVersionWarning: true });
		throw new Error('Put the device in DFU mode and try again');
	}
};
