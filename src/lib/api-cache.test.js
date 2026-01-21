'use strict';
const { expect, sinon } = require('../../test/setup');
const createApiCache = require('./api-cache');
const ParticleCache = require('./particle-cache');

describe('api-cache', () => {
	beforeEach(() => {
		sinon.stub(ParticleCache.prototype, 'get');
		sinon.stub(ParticleCache.prototype, 'getWithAge');
		sinon.stub(ParticleCache.prototype, 'set');
	});

	afterEach(async () => {
		sinon.restore();
	});

	describe('getDeviceOsVersions', () => {
		it('create cache file for device os version if there is no error on getting data', async () => {
			const api = {
				getDeviceOsVersions: sinon.stub().resolves({})
			};

			const apiCache = createApiCache(api);
			const expectedKey = apiCache.cache._generateKey('device_os_version', { platformId: 6, version: 'latest' });
			await apiCache.getDeviceOsVersions(6, 'latest');
			expect(api.getDeviceOsVersions).to.have.been.calledWith(6, 'latest');
			expect(ParticleCache.prototype.set).to.have.been.calledWith(expectedKey, {});
		});

		it('calls cache getWithAge if there is an error on getting data', async () => {
			let error;
			const api = {
				getDeviceOsVersions: sinon.stub().rejects(new Error('ECONNREFUSED'))
			};
			const apiCache = createApiCache(api);
			const expectedKey = apiCache.cache._generateKey('device_os_version', { platformId: 6, version: 'latest' });
			ParticleCache.prototype.getWithAge.returns(null); // No cached data
			try {
				await apiCache.getDeviceOsVersions(6, 'latest');
			} catch (_error) {
				error = _error;
			}
			expect(api.getDeviceOsVersions).to.have.been.calledWith(6, 'latest');
			expect(ParticleCache.prototype.getWithAge).to.have.been.calledWith(expectedKey);
			expect(error.message).to.equal('Device OS version not found in cache for platform: 6 version: latest and there was an internet connection error');
		});

		it('returns cached data on connectivity error', async () => {
			const cachedData = { version: '5.0.0' };
			const api = {
				getDeviceOsVersions: sinon.stub().rejects(new Error('ECONNREFUSED'))
			};
			const apiCache = createApiCache(api);
			ParticleCache.prototype.getWithAge.returns({ data: cachedData, ageMs: 1000 });

			const result = await apiCache.getDeviceOsVersions(6, 'latest');
			expect(result).to.deep.equal(cachedData);
		});
	});

	describe('getDevice', () => {
		it('create cache file for device os version if there is no error on getting data', async () => {
			const api = {
				getDevice: sinon.stub().resolves({})
			};

			const apiCache = createApiCache(api);
			const expectedKey = apiCache.cache._generateKey('device', { deviceIdOrName: 'abc123' });
			await apiCache.getDevice({ deviceId: 'abc123', auth: 'abc' });
			expect(api.getDevice).to.have.been.calledWith({ deviceId: 'abc123', auth: 'abc' });
			expect(ParticleCache.prototype.set).to.have.been.calledWith(expectedKey, {});
		});

		it('calls cache getWithAge if there is an error on getting data', async () => {
			let error;
			const api = {
				getDevice: sinon.stub().rejects(new Error('ECONNREFUSED'))
			};
			const apiCache = createApiCache(api);
			const expectedKey = apiCache.cache._generateKey('device', { deviceIdOrName: 'abc123' });
			ParticleCache.prototype.getWithAge.returns(null); // No cached data
			try {
				await apiCache.getDevice({ deviceId: 'abc123', auth: 'abc' });
			} catch (_error) {
				error = _error;
			}
			expect(api.getDevice).to.have.been.calledWith({ deviceId: 'abc123', auth: 'abc' });
			expect(ParticleCache.prototype.getWithAge).to.have.been.calledWith(expectedKey);
			expect(error.message).to.equal('Device abc123 not found in cache and there was an internet connection error');
		});

		it('returns cached data on connectivity error', async () => {
			const cachedDevice = { id: 'abc123', name: 'my-device' };
			const api = {
				getDevice: sinon.stub().rejects(new Error('ECONNREFUSED'))
			};
			const apiCache = createApiCache(api);
			ParticleCache.prototype.getWithAge.returns({ data: cachedDevice, ageMs: 1000 });

			const result = await apiCache.getDevice({ deviceId: 'abc123', auth: 'abc' });
			expect(result).to.deep.equal(cachedDevice);
		});
	});
});
