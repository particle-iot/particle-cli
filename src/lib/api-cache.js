'use strict';
const ParticleCache = require('./particle-cache');
const {
	isConnectivityError,
	tryWithAuth,
	logCacheStalenessWarning
} = require('./auth-helper');
const log = require('./log');

class ApiCache {
	constructor(api) {
		this.api = api;
		this.cache = new ParticleCache();
	}

	/**
	 * Get cached data with staleness warning
	 * @param {string} key - Cache key
	 * @param {string} context - Context for logging
	 * @returns {{ data: *, ageMs: number } | null}
	 * @private
	 */
	_getCachedWithWarning(key, context) {
		const cached = this.cache.getWithAge(key);
		if (cached) {
			logCacheStalenessWarning({ ageMs: cached.ageMs, context });
			log.verbose(`Using cached data${context ? ` (${context})` : ''}:`, { ageMs: cached.ageMs });
		}
		return cached;
	}

	async getDeviceOsVersions(platformId, version) {
		const key = this.cache._generateKey('device_os_version', { platformId, version });
		const context = `device OS version ${version} for platform ${platformId}`;

		const fallback = () => {
			const cached = this._getCachedWithWarning(key, context);
			return cached ? cached.data : undefined;
		};

		return tryWithAuth(
			async () => {
				const deviceOsVersion = await this.api.getDeviceOsVersions(platformId, version);
				this.cache.set(key, deviceOsVersion);
				return deviceOsVersion;
			},
			{
				optional: false,
				fallback,
				context
			}
		).catch(error => {
			// If tryWithAuth couldn't handle it and there's cached data, use it
			if (isConnectivityError(error)) {
				const cached = this._getCachedWithWarning(key, context);
				if (cached) {
					return cached.data;
				}
				throw new Error(`Device OS version not found in cache for platform: ${platformId} version: ${version} and there was an internet connection error`);
			}
			throw error;
		});
	}

	async getDevice({ deviceId: id, auth, requireAuth = true }) {
		const key = this.cache._generateKey('device', { deviceIdOrName: id });
		const context = `device ${id}`;

		const fallback = () => {
			const cached = this._getCachedWithWarning(key, context);
			return cached ? cached.data : undefined;
		};

		return tryWithAuth(
			async () => {
				const device = await this.api.getDevice({ deviceId: id, auth });
				this.cache.set(key, device);
				return device;
			},
			{
				optional: !requireAuth,
				fallback,
				context
			}
		).catch(error => {
			// If tryWithAuth couldn't handle it and there's cached data, use it
			if (isConnectivityError(error)) {
				const cached = this._getCachedWithWarning(key, context);
				if (cached) {
					return cached.data;
				}
				throw new Error(`Device ${id} not found in cache and there was an internet connection error`);
			}
			throw error;
		});
	}
}

const proxyHandler = {
	get: (target, prop) => {
		if (typeof target[prop] === 'function') {
			return target[prop].bind(target);
		} else if (prop === 'api') {
			return createApiCache(target.api);
		} else if (typeof target.api[prop] === 'function') {
			return target.api[prop].bind(target.api);
		} else {
			return target[prop];
		}
	}
};

function createApiCache(api) {
	const apiCache = new ApiCache(api);
	return new Proxy(apiCache, proxyHandler);
}


module.exports = createApiCache;
