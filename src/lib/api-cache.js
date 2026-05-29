'use strict';
const ParticleApi = require('../cmd/api');
const ParticleCache = require('./particle-cache');

class ApiCache extends ParticleApi {
	constructor(baseUrl, options) {
		super(baseUrl, options);
		this.cache = new ParticleCache();
	}

	async getDeviceOsVersions({ platformId, version }) {
		const key = this.cache._generateKey('device_os_version', { platformId, version });
		try {
			const deviceOsVersion = await super.getDeviceOsVersions({ platformId, version });
			this.cache.set(key, deviceOsVersion);
			return deviceOsVersion;
		} catch (error) {
			if (isInternetConnectionError(error)) {
				const cachedDeviceOsVersion = this.cache.get(key);
				if (cachedDeviceOsVersion) {
					return cachedDeviceOsVersion;
				}
				throw new Error(`Device OS version not found in cache for platform: ${platformId} version: ${version} and there was an internet connection error`);
			}
			throw error;
		}
	}

	async getDevice({ deviceId }) {
		const key = this.cache._generateKey('device', { deviceIdOrName: deviceId });
		try {
			const device = await super.getDevice({ deviceId });
			this.cache.set(key, device);
			return device;
		} catch (error) {
			if (isInternetConnectionError(error)) {
				const cachedDevice = this.cache.get(key);
				if (cachedDevice) {
					return cachedDevice;
				}
				throw new Error(`Device ${deviceId} not found in cache and there was an internet connection error`);
			}
			throw error;
		}
	}

	async deleteCurrentAccessToken() {
		const result = await super.deleteCurrentAccessToken();
		this.cache.clear();
		return result;
	}

	async revokeAccessToken(args) {
		const result = await super.revokeAccessToken(args);
		this.cache.clear();
		return result;
	}
}

function isInternetConnectionError(error) {
	return error && error.message && (
		error.message.includes('ECONNREFUSED')
		|| error.message.includes('ENOTFOUND')
		|| error.message.includes('Network error')
	);
}

module.exports = ApiCache;
