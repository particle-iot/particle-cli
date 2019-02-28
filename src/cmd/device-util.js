import { spin } from '../app/ui';

/**
 * Check if the string can represent a valid device ID.
 *
 * @param {String} str A string.
 * @return {Boolean}
 */
export function isDeviceId(str) {
	return /^[0-9a-f]{24}$/i.test(str);
}

/**
 * Format device info.
 *
 * @param {Object} device Device info.
 * @param {String} device.id Device ID.
 * @param {String} device.type Device type, e.g. 'Photon'.
 * @param {String} [device.name] Device name.
 * @return {String}
 */
export function formatDeviceInfo({ id, type, name = null }) {
	return `${name || '<no name>'} [${id}] (${type})`;
}

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
export function getDevice({ id, api, auth, displayName = null, dontThrow = false }) {
	const p = api.getDevice({ deviceId: id, auth })
		.then(r => r.body)
		.catch(e => {
			if (e.statusCode == 403 || e.statusCode == 404) {
				if (dontThrow) {
					return null;
				}
				throw new Error(`Device not found: ${displayName || id}`);
			}
			throw e;
		});
	return spin(p, 'Getting device information...');
}
