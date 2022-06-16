const deviceConstants = require('@particle/device-constants');

const platforms = Object.values(deviceConstants).filter(p => p.public);

module.exports.MAX_FILE_SIZE = 1024 * 1024 * 2;

// TODO: The name is misleading. There's also knownPlatformDisplayForId() that returns a similar object
module.exports.platformsById = platforms.reduce((out, p) => {
	out[p.id] = p.displayName;
	return out;
}, {});

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
module.exports.PlatformId = platforms.reduce((out, p) => {
	out[p.name.toUpperCase()] = p.id;
	return out;
}, {});
