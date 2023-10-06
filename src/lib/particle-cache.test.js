const { expect } = require('../../test/setup');
const ParticleCache = require('./particle-cache');
const { PATH_TMP_DIR } = require('../../test/lib/env');
const fs = require('fs-extra');
const path = require('path');

describe('Cache', () => {
	const originalEnv = process.env;
	beforeEach(() => {
		process.env = {
			...originalEnv,
			home: PATH_TMP_DIR,
		};
	});

	afterEach(async() => {
		process.env = originalEnv;
		await fs.remove(path.join(PATH_TMP_DIR, '.particle/'));
	});

	it('should create a cache file', () => {
		const cache = new ParticleCache();
		const requestOptions = { test: 'test' };
		const key = cache._generateKey('test', requestOptions);
		cache.set(key, { deviceId: 'abc123', platformId: 6 });
		const result = cache.get(key);
		expect(result).to.eql({ deviceId: 'abc123', platformId: 6 });
	});

	it('should create a cache file with names with special characters', () => {
		const cache = new ParticleCache();
		const requestOptions = {
			platformId: 6,
			deviceName: 'my_device@!$%&()[]{}\\|;:\'",<>?/`~',
		};
		const key = cache._generateKey('device', requestOptions);
		cache.set(key, { deviceId: 'abc123' });
		const result = cache.get(key);
		expect(result).to.eql({ deviceId: 'abc123' });
	});
});
