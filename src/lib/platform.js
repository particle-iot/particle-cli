const deviceConstants = require('@particle/device-constants');

/**
 * Array of description objects for all supported platforms.
 *
 * @see https://github.com/particle-iot-inc/device-constants/blob/main/src/constants.json
 */
const PLATFORMS = Object.values(deviceConstants).filter(p => p.public);

const PLATFORMS_BY_ID = PLATFORMS.reduce((map, p) => map.set(p.id, p), new Map());

/**
 * Enum-like object defining supported platform IDs.
 *
 * Example usage:
 * ```
 * if (platformId === PlatformId.ELECTRON) {
 *   console.log('This device is an Electron');
 * }
 * ```
 */
const PlatformId = PLATFORMS.reduce((out, p) => {
	out[p.name.toUpperCase()] = p.id;
	return out;
}, {});

/**
 * Get the platform description.
 *
 * @param {Number} id The platform ID.
 * @throws Throws an error if `id` is not a known platform ID.
 */
function platformForId(id) {
	const p = PLATFORMS_BY_ID.get(id);
	if (!p) {
		throw new Error(`Unknown platform ID: ${id}`);
	}
	return p;
}

/**
 * Check if a platform ID is known.
 *
 * @param {Number} id The platform ID.
 * @returns {Boolean} `true` if the platform ID is known, otherwise `false`.
 */
function isKnownPlatformId(id) {
	return PLATFORMS_BY_ID.has(id);
}

module.exports = {
	PLATFORMS,
	PlatformId,
	platformForId,
	isKnownPlatformId
};
