'use strict';
const path = require('path');
const settings = require('../../settings');
const fs = require('fs-extra');
const crypto = require('crypto');


class ParticleCache {
	constructor() {
		const particleDir = settings.ensureFolder();
		this.path = path.join(particleDir, 'cli-cache');
	}

	/**
	 * Get cached data by key
	 * @param {string} key - Cache key
	 * @returns {*} - Cached data or null if not found
	 */
	get(key) {
		try {
			const cached = fs.readJsonSync(path.join(this.path, `${key}.json`));
			// Handle both old format (data only) and new format (with timestamp)
			if (cached && typeof cached === 'object' && 'data' in cached && 'timestamp' in cached) {
				return cached.data;
			}
			// Legacy format: return as-is
			return cached;
		} catch (_err) {
			return null;
		}
	}

	/**
	 * Get cached data with age information
	 * @param {string} key - Cache key
	 * @returns {{ data: *, ageMs: number } | null} - Cached data with age, or null if not found
	 */
	getWithAge(key) {
		try {
			const cached = fs.readJsonSync(path.join(this.path, `${key}.json`));
			if (!cached) {
				return null;
			}

			// Handle new format with timestamp
			if (typeof cached === 'object' && 'data' in cached && 'timestamp' in cached) {
				const ageMs = Date.now() - cached.timestamp;
				return { data: cached.data, ageMs };
			}

			// Legacy format: no timestamp available, assume very old (1 year)
			return { data: cached, ageMs: 365 * 24 * 60 * 60 * 1000 };
		} catch (_err) {
			return null;
		}
	}

	/**
	 * Set cached data with timestamp
	 * @param {string} key - Cache key
	 * @param {*} value - Data to cache
	 */
	set(key, value) {
		const cacheEntry = {
			data: value,
			timestamp: Date.now()
		};
		fs.outputJsonSync(path.join(this.path, `${key}.json`), cacheEntry);
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
