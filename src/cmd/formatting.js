/**
 * Format the device info.
 *
 * @param {String} id Device ID.
 * @param {String} name Device name.
 * @param {String} type Device type.
 * @return {String}
 */
export function formatDeviceInfo({ id, name, type }) {
	return `${name ? name : '<no name>'} [${id}] (${type})`;
}
