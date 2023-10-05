const path = require('path');
const { ensureFolder } = require('../../settings');
const fs = require('fs-extra');
const CACHE_FILE_NAME = '.device-os-version.cache';
const CACHE_DIR_NAME = 'device-os-flash/binaries';


class DeviceOsVersionCache {
	// TODO (hmontero) : Transform it in more generic cache
	constructor() {
		this.cache = {};
	}

	async init() {
		await this._loadCache();
	}

	get(key) {
		return this.cache[key];
	}

	/**
	 * @param key - combination of platformId and version
	 * @param value
	 */
	async set(key, value) {
		const latest = value.latest;
		delete value.latest;
		this.cache[key] = value;
		// save to file
		if (latest) {
			// reassign latest version
			const platformId = value.platformId;
			const latestKey = this.generateKey(platformId, 'latest');
			this.cache[latestKey] = value;
		}
		await this._saveCache();

	}

	async _loadCache() {
		// load from file
		const particleDir = ensureFolder();
		const filePath =  path.join(particleDir, CACHE_DIR_NAME, CACHE_FILE_NAME);
		try {
			const exits = await fs.pathExists(filePath);
			if (exits) {
				const data = await fs.readJson(filePath);
				this.cache = data;
			} else {
				await fs.writeJson(filePath, this.cache);
			}
		} catch (error) {
			throw new Error(`Error opening or creating the cache file: ${error.message}`);
		}
	}

	async _saveCache() {
		const particleDir = ensureFolder();
		const filePath =  path.join(particleDir, CACHE_DIR_NAME, CACHE_FILE_NAME);
		try {
			await fs.writeJson(filePath, this.cache);
		} catch (error) {
			throw new Error(`Error when writing the cache file: ${error.message}`);
		}
	}

	generateKey(platformId, version) {
		return `p-${platformId}-v-${version}`;
	}
}

module.exports = DeviceOsVersionCache;
