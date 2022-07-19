// TODO (mirande): need to find a better home for this file
// see: https://app.shortcut.com/particle/story/107005

const deviceConstants = require('@particle/device-constants');

/**
 * Array of description objects for all supported platforms.
 */
const PLATFORMS = Object.values(deviceConstants).filter(p => p.public);

const PLATFORMS_BY_ID = PLATFORMS.reduce((map, p) => map.set(p.id, p), new Map());

/**
 * Supported platform IDs.
 *
 * @enum {Number}
 * @property {Number} CORE
 * @property {Number} PHOTON
 * @property {Number} P1
 * @property {Number} ELECTRON
 * @property {Number} ARGON
 * @property {Number} BORON
 * @property {Number} XENON
 * @property {Number} ESOMX
 * @property {Number} BSOM
 * @property {Number} B5SOM
 * @property {Number} TRACKER
 * @property {Number} TRACKERM
 * @property {Number} P2
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
