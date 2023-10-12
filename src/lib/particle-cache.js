const path = require('path');
const settings = require('../../settings');
const fs = require('fs-extra');
const crypto = require('crypto');


class ParticleCache {
	constructor() {
		const particleDir = settings.ensureFolder();
		this.path = path.join(particleDir, 'cli-cache');
	}

	get(key) {
		try {
			return fs.readJsonSync(path.join(this.path, `${key}.json`));
		} catch (error) {
			return null;
		}

	}

	set(key, value) {
		fs.outputJsonSync(path.join(this.path, `${key}.json`), value);
	}

	_generateKey(requestName, options) {
		return `${requestName}_${hashOptions(options)}`;
	}
}

function hashOptions(options) {
	let optionsString = '';
	const optionKeys = Object.keys(options);
	for (const optionKey of optionKeys) {
		const sanitizedValue = options[optionKey].toString().replace(/[^a-zA-Z0-9\-_]/g, '-');
		optionsString += `${optionKey}_${sanitizedValue}`;
	}
	return crypto.createHash('md5').update(optionsString).digest('hex');
}

module.exports = ParticleCache;
