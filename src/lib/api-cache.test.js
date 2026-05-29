'use strict';
const { expect, sinon } = require('../../test/setup');
const ApiCache = require('./api-cache');
const ParticleApi = require('../cmd/api');
const ParticleCache = require('./particle-cache');

describe('ApiCache', () => {
	let apiCache;

	beforeEach(() => {
		sinon.stub(ParticleCache.prototype, 'get');
		sinon.stub(ParticleCache.prototype, 'set');
		sinon.stub(ParticleCache.prototype, 'clear');
		apiCache = new ApiCache('test-base-url', { accessToken: 'test-token' });
	});

	afterEach(() => {
		sinon.restore();
	});

	it('extends ParticleApi', () => {
		expect(apiCache).to.be.instanceof(ParticleApi);
	});

	describe('getDeviceOsVersions', () => {
		it('caches the response on success', async () => {
			const osVersion = { version: '5.6.0' };
			sinon.stub(ParticleApi.prototype, 'getDeviceOsVersions').resolves(osVersion);

			const expectedKey = apiCache.cache._generateKey('device_os_version', { platformId: 6, version: 'latest' });
			const result = await apiCache.getDeviceOsVersions({ platformId: 6, version: 'latest' });

			expect(result).to.deep.equal(osVersion);
			expect(ParticleCache.prototype.set).to.have.been.calledWith(expectedKey, osVersion);
		});

		it('falls back to cache on network error', async () => {
			sinon.stub(ParticleApi.prototype, 'getDeviceOsVersions').rejects(new Error('ECONNREFUSED'));
			ParticleCache.prototype.get.returns({ version: 'cached' });

			const result = await apiCache.getDeviceOsVersions({ platformId: 6, version: 'latest' });

			expect(result).to.deep.equal({ version: 'cached' });
		});

		it('throws a helpful message when network is down and cache is empty', async () => {
			sinon.stub(ParticleApi.prototype, 'getDeviceOsVersions').rejects(new Error('ENOTFOUND'));
			ParticleCache.prototype.get.returns(null);

			await expect(apiCache.getDeviceOsVersions({ platformId: 6, version: 'latest' }))
				.to.be.rejectedWith(/Device OS version not found in cache/);
		});

		it('re-throws non-network errors unchanged', async () => {
			const apiError = new Error('Something else');
			sinon.stub(ParticleApi.prototype, 'getDeviceOsVersions').rejects(apiError);

			await expect(apiCache.getDeviceOsVersions({ platformId: 6, version: 'latest' }))
				.to.be.rejectedWith('Something else');
		});
	});

	describe('getDevice', () => {
		it('caches the response on success and calls super.getDevice', async () => {
			const device = { id: 'abc123', name: 'thing' };
			const superStub = sinon.stub(ParticleApi.prototype, 'getDevice').resolves(device);

			const expectedKey = apiCache.cache._generateKey('device', { deviceIdOrName: 'abc123' });
			const result = await apiCache.getDevice({ deviceId: 'abc123' });

			expect(superStub).to.have.been.calledWith({ deviceId: 'abc123' });
			expect(result).to.deep.equal(device);
			expect(ParticleCache.prototype.set).to.have.been.calledWith(expectedKey, device);
		});

		it('falls back to cache on network error', async () => {
			sinon.stub(ParticleApi.prototype, 'getDevice').rejects(new Error('ECONNREFUSED'));
			ParticleCache.prototype.get.returns({ id: 'abc123', name: 'cached-thing' });

			const result = await apiCache.getDevice({ deviceId: 'abc123' });

			expect(result).to.deep.equal({ id: 'abc123', name: 'cached-thing' });
		});
	});

	describe('logout-clear (auth boundary)', () => {
		it('clears the entire cache after deleteCurrentAccessToken resolves', async () => {
			sinon.stub(ParticleApi.prototype, 'deleteCurrentAccessToken').resolves({ ok: true });

			await apiCache.deleteCurrentAccessToken();

			expect(ParticleCache.prototype.clear).to.have.been.calledOnce;
		});

		it('clears the entire cache after revokeAccessToken resolves', async () => {
			sinon.stub(ParticleApi.prototype, 'revokeAccessToken').resolves({ ok: true });

			await apiCache.revokeAccessToken({ token: 'xyz' });

			expect(ParticleCache.prototype.clear).to.have.been.calledOnce;
		});

		it('does NOT clear the cache if deleteCurrentAccessToken rejects', async () => {
			sinon.stub(ParticleApi.prototype, 'deleteCurrentAccessToken').rejects(new Error('nope'));

			try {
				await apiCache.deleteCurrentAccessToken();
			} catch (_) { /* ignore */ }

			expect(ParticleCache.prototype.clear).to.not.have.been.called;
		});
	});
});
