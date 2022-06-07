const deviceConstants = require('@particle/device-constants');


module.exports.MAX_FILE_SIZE = 1024 * 1024 * 2;

module.exports.platformsById = Object.values(deviceConstants)
	.filter(p => p.public)
	.reduce((out, p) => {
		out[p.id] = p.displayName;
		return out;
	}, {});

module.exports.notSourceExtensions = [
	'.ds_store',
	'.jpg',
	'.gif',
	'.png',
	'.include',
	'.ignore',
	'.git',
	'.bin'
];

