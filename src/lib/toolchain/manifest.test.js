'use strict';
const path = require('path');
const fs = require('fs-extra');
const nock = require('nock');
const { expect } = require('../../../test/setup');
const { PATH_TMP_DIR, PATH_FIXTURES_DIR } = require('../../../test/lib/env');
const ParticleCache = require('../particle-cache');
const {
	ToolchainManifest,
	fetchManifest,
	hostFor,
	displayName,
	MANIFEST_URL,
	MANIFEST_CACHE_KEY
} = require('./manifest');

const FIXTURE = path.join(PATH_FIXTURES_DIR, 'toolchain', 'manifest.json');

describe('Toolchain manifest', () => {
	let json;

	before(async () => {
		json = await fs.readJson(FIXTURE);
	});

	describe('hostFor', () => {
		it('maps the three desktop OSes on x64', () => {
			expect(hostFor({ platform: 'darwin', arch: 'x64' })).to.eql({ os: 'darwin', arch: 'x64' });
			expect(hostFor({ platform: 'linux', arch: 'x64' })).to.eql({ os: 'linux', arch: 'x64' });
			expect(hostFor({ platform: 'win32', arch: 'x64' })).to.eql({ os: 'windows', arch: 'x64' });
		});

		it('runs the x64 toolchain on Apple Silicon', () => {
			expect(hostFor({ platform: 'darwin', arch: 'arm64' })).to.eql({ os: 'darwin', arch: 'x64' });
		});

		it('refuses hosts without a toolchain', () => {
			expect(() => hostFor({ platform: 'linux', arch: 'arm64' }))
				.to.throw('Local compile is not available for linux/arm64; use --compiler cloud');
			expect(() => hostFor({ platform: 'freebsd', arch: 'x64' })).to.throw('freebsd/x64');
		});
	});

	describe('ToolchainManifest', () => {
		let manifest;

		beforeEach(() => {
			manifest = new ToolchainManifest(json);
		});

		it('rejects a manifest without toolchains', () => {
			expect(() => new ToolchainManifest({})).to.throw('Invalid toolchain manifest');
		});

		it('finds platforms by name or id', () => {
			expect(manifest.platform('argon')).to.have.property('id', 12);
			expect(manifest.platform(12)).to.have.property('name', 'argon');
			expect(manifest.platform('nope')).to.equal(undefined);
		});

		it('picks the default toolchain per platform', () => {
			expect(manifest.defaultToolchain(12)).to.have.property('version', '6.4.1');
			expect(manifest.defaultToolchain(6)).to.have.property('version', '2.3.1');
			// boron is in no default_platforms list: falls back to the global default
			expect(manifest.defaultToolchain(13)).to.have.property('version', '6.4.1');
		});

		it('resolves the default when no version or latest is given', () => {
			expect(manifest.resolveToolchain({ platformId: 12, platformName: 'argon' })).to.have.property('version', '6.4.1');
			expect(manifest.resolveToolchain({ version: 'latest', platformId: 6, platformName: 'photon' })).to.have.property('version', '2.3.1');
		});

		it('resolves an explicit version the platform supports', () => {
			expect(manifest.resolveToolchain({ version: '6.5.0', platformId: 12, platformName: 'argon' })).to.have.property('version', '6.5.0');
		});

		it('lists the valid versions when the requested one does not fit the platform', () => {
			expect(() => manifest.resolveToolchain({ version: '6.4.1', platformId: 6, platformName: 'photon' }))
				.to.throw('Invalid build target version.\nValid targets for photon:\n2.3.1');
			expect(() => manifest.resolveToolchain({ version: '9.9.9', platformId: 12, platformName: 'argon' }))
				.to.throw('Valid targets for argon:\n6.5.0 (preview)\n6.4.1\n2.3.1');
		});

		it('returns the four dependencies for a host, without openocd', () => {
			const toolchain = manifest.toolchainForVersion('6.4.1');
			const deps = manifest.dependenciesFor(toolchain, { os: 'linux', arch: 'x64' });
			expect(deps.map(d => `${d.name}@${d.version}`)).to.eql([
				'deviceOS@6.4.1', 'gcc-arm@10.2.1', 'buildtools@1.1.1', 'buildscripts@1.17.2'
			]);
			expect(deps[1].url).to.include('/linux/x64/');
		});

		it('keeps the manifest paths for platform-specific binaries', () => {
			const toolchain = manifest.toolchainForVersion('6.4.1');
			const [,, tools] = manifest.dependenciesFor(toolchain, { os: 'windows', arch: 'x64' });
			expect(tools.paths.make.path).to.equal('./bin/make.exe');
		});

		it('fails when the host bucket is missing a dependency', () => {
			const toolchain = manifest.toolchainForVersion('6.4.1');
			expect(() => manifest.dependenciesFor(toolchain, { os: 'linux', arch: 'x86' }))
				.to.throw('The toolchain manifest has no gcc-arm@10.2.1 for linux/x86');
		});
	});

	describe('displayName', () => {
		it('spells Device OS out and leaves the rest alone', () => {
			expect(displayName({ name: 'deviceOS', version: '6.4.1' })).to.equal('Device OS 6.4.1');
			expect(displayName({ name: 'gcc-arm', version: '10.2.1' })).to.equal('gcc-arm 10.2.1');
		});
	});

	describe('fetchManifest', () => {
		const originalEnv = process.env;
		let cache;

		beforeEach(() => {
			process.env = { ...originalEnv, home: PATH_TMP_DIR };
			cache = new ParticleCache();
		});

		afterEach(async () => {
			nock.cleanAll();
			process.env = originalEnv;
			await fs.remove(path.join(PATH_TMP_DIR, '.particle'));
		});

		it('downloads and caches the manifest with its etag', async () => {
			nock('https://binaries.particle.io').get('/toolchain-manager/manifest.json')
				.reply(200, json, { etag: '"abc"' });
			const manifest = await fetchManifest({ cache });
			expect(manifest.toolchainForVersion('6.4.1')).to.be.an('object');
			const cached = cache.get(MANIFEST_CACHE_KEY);
			expect(cached.etag).to.equal('"abc"');
			expect(cached.data.toolchains).to.have.lengthOf(3);
		});

		it('sends the cached etag and reuses the cache on 304', async () => {
			cache.set(MANIFEST_CACHE_KEY, { etag: '"abc"', data: json });
			nock('https://binaries.particle.io', { reqheaders: { 'if-none-match': '"abc"' } })
				.get('/toolchain-manager/manifest.json').reply(304);
			const manifest = await fetchManifest({ cache });
			expect(manifest.toolchainForVersion('2.3.1')).to.be.an('object');
		});

		it('falls back to the cache when offline', async () => {
			cache.set(MANIFEST_CACHE_KEY, { etag: '"abc"', data: json });
			nock('https://binaries.particle.io').get('/toolchain-manager/manifest.json').replyWithError('ENOTFOUND');
			const manifest = await fetchManifest({ cache });
			expect(manifest.defaultToolchain(12)).to.have.property('version', '6.4.1');
		});

		it('fails when offline with no cache', async () => {
			nock('https://binaries.particle.io').get('/toolchain-manager/manifest.json').replyWithError('ENOTFOUND');
			await expect(fetchManifest({ cache })).to.be.rejectedWith(
				'Could not download the toolchain manifest: request to https://binaries.particle.io/toolchain-manager/manifest.json failed, reason: ENOTFOUND. Check your connection and retry'
			);
		});

		it('treats an HTTP error like being offline', async () => {
			nock('https://binaries.particle.io').get('/toolchain-manager/manifest.json').reply(500);
			await expect(fetchManifest({ cache })).to.be.rejectedWith('Could not download the toolchain manifest: HTTP 500');
		});

		it('points at the public manifest by default', () => {
			expect(MANIFEST_URL).to.equal('https://binaries.particle.io/toolchain-manager/manifest.json');
		});
	});
});
