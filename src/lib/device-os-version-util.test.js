'use strict';
const { expect, sinon } = require('../../test/setup');
const fs = require('fs-extra');
const path = require('path');
const { downloadDeviceOsVersionBinaries } = require('./device-os-version-util');
const nock = require('nock');
const { PATH_TMP_DIR } = require('../../test/lib/env');
const UI = require('./ui');
const { startProxyRecorder } = require('../../test/lib/proxy-recorder');



// stub: request, fs, api
describe('downloadDeviceOsVersionBinaries', () => {
	let ui, binary;
	const originalEnv = process.env;
	beforeEach(async () => {
		binary = await fs.readFile(path.join(__dirname, '../../test/__fixtures__/binaries/argon_stroby.bin'));
		ui = new UI({ quiet: true });
		ui.chalk.enabled = false;
		process.env = {
			...originalEnv,
			home: PATH_TMP_DIR,
		};
		await fs.ensureDir(path.join(PATH_TMP_DIR, '.particle/device-os-flash/binaries'));
	});
	afterEach(async () => {
		process.env = originalEnv;
		sinon.restore();
		await fs.remove(path.join(PATH_TMP_DIR, '.particle/device-os-flash/binaries'));
	});
	it('should download the binaries for the given platform and version by default the latest version is downloaded', async () => {
		const expectedPath = path.join(PATH_TMP_DIR, '.particle/device-os-flash/binaries/2.3.1/photon');
		const api = {
			getDeviceOsVersions: sinon.stub().resolves({
				version: '2.3.1',
				base_url: 'https://api.particle.io/v1/firmware/device-os/v2.3.1',
				modules: [
					{ filename: 'photon-bootloader@2.3.1+lto.bin', prefixInfo : { moduleFunction: 'bootloader' } },
					{ filename: 'photon-system-part1@2.3.1.bin', prefixInfo : { moduleFunction: 'system-part' } }
				]
			})
		};
		nock('https://api.particle.io/v1/firmware/device-os/v2.3.1',)
			.intercept('/photon-bootloader@2.3.1+lto.bin', 'GET')
			.reply(200, binary);

		nock('https://api.particle.io/v1/firmware/device-os/v2.3.1',)
			.intercept('/photon-system-part1@2.3.1.bin', 'GET')
			.reply(200, binary);

		const data = await downloadDeviceOsVersionBinaries({ api, platformId: 6, ui });
		expect(api.getDeviceOsVersions).to.have.been.calledWith({ platformId: 6, version: 'latest' });
		expect(data).to.be.an('array').with.lengthOf(2);
		const files = fs.readdirSync(path.join(PATH_TMP_DIR, '.particle/device-os-flash/binaries/2.3.1/photon'));
		expect(fs.existsSync(expectedPath)).to.be.true;
		expect(files).to.be.an('array').with.lengthOf(2);
		expect(files).to.include('photon-bootloader@2.3.1+lto.bin');
		expect(files).to.include('photon-system-part1@2.3.1.bin');
	});

	it('should download the binaries for the given platform and version', async() => {
		const api = {
			getDeviceOsVersions: sinon.stub().resolves({
				version: '2.3.1',
				base_url: 'https://api.particle.io/v1/firmware/device-os/v2.3.1',
				modules: [
					{ filename: 'photon-bootloader@2.3.1+lto.bin', prefixInfo : { moduleFunction: 'bootloader' } },
					{ filename: 'photon-system-part1@2.3.1.bin', prefixInfo: { moduleFunction: 'system-part' } }
				]
			})
		};
		nock('https://api.particle.io/v1/firmware/device-os/v2.3.1',)
			.intercept('/photon-bootloader@2.3.1+lto.bin', 'GET')
			.reply(200, binary);

		nock('https://api.particle.io/v1/firmware/device-os/v2.3.1',)
			.intercept('/photon-system-part1@2.3.1.bin', 'GET')
			.reply(200, binary);

		const data = await downloadDeviceOsVersionBinaries({ api, platformId: 6, version: '2.3.1', ui });
		expect(api.getDeviceOsVersions).to.have.been.calledWith({ platformId: 6, version: '2.3.1' });
		expect(data).to.be.an('array').with.lengthOf(2);
		const files = fs.readdirSync(path.join(PATH_TMP_DIR, '.particle/device-os-flash/binaries/2.3.1/photon'));
		expect(files).to.be.an('array').with.lengthOf(2);
		expect(files).to.include('photon-bootloader@2.3.1+lto.bin');
		expect(files).to.include('photon-system-part1@2.3.1.bin');

	});

	it('should not resolve until the downloaded files are fully written to disk', async() => {
		const largeBinary = Buffer.concat(new Array(200).fill(binary));
		const api = {
			getDeviceOsVersions: sinon.stub().resolves({
				version: '2.3.1',
				base_url: 'https://api.particle.io/v1/firmware/device-os/v2.3.1',
				modules: [
					{ filename: 'photon-system-part1@2.3.1.bin', prefixInfo: { moduleFunction: 'system-part' } }
				]
			})
		};
		nock('https://api.particle.io/v1/firmware/device-os/v2.3.1')
			.intercept('/photon-system-part1@2.3.1.bin', 'GET')
			.reply(200, largeBinary);

		const data = await downloadDeviceOsVersionBinaries({ api, platformId: 6, version: '2.3.1', ui });

		expect(fs.statSync(data[0]).size).to.equal(largeBinary.length);
	});

	describe('downloading a module', () => {
		const binaryDir = () => path.join(PATH_TMP_DIR, '.particle/device-os-flash/binaries/2.3.1/photon');
		const apiWithModule = () => ({
			getDeviceOsVersions: sinon.stub().resolves({
				version: '2.3.1',
				base_url: 'https://api.particle.io/v1/firmware/device-os/v2.3.1',
				modules: [
					{ filename: 'photon-system-part1@2.3.1.bin', prefixInfo: { moduleFunction: 'system-part' } }
				]
			})
		});

		it('writes the exact downloaded bytes', async () => {
			nock('https://api.particle.io/v1/firmware/device-os/v2.3.1')
				.intercept('/photon-system-part1@2.3.1.bin', 'GET')
				.reply(200, binary);

			const data = await downloadDeviceOsVersionBinaries({ api: apiWithModule(), platformId: 6, version: '2.3.1', ui });

			expect(data).to.eql([path.join(binaryDir(), 'photon-system-part1@2.3.1.bin')]);
			expect((await fs.readFile(data[0])).equals(binary)).to.be.true;
		});

		it('follows redirects', async () => {
			nock('https://api.particle.io/v1/firmware/device-os/v2.3.1')
				.intercept('/photon-system-part1@2.3.1.bin', 'GET')
				.reply(302, '', { Location: 'https://binaries.particle.io/device-os/photon-system-part1@2.3.1.bin' });
			nock('https://binaries.particle.io')
				.intercept('/device-os/photon-system-part1@2.3.1.bin', 'GET')
				.reply(200, binary);

			const data = await downloadDeviceOsVersionBinaries({ api: apiWithModule(), platformId: 6, version: '2.3.1', ui });

			expect((await fs.readFile(data[0])).equals(binary)).to.be.true;
		});

		it('fails with the status code and leaves no partial file when the server errors', async () => {
			nock('https://api.particle.io/v1/firmware/device-os/v2.3.1')
				.intercept('/photon-system-part1@2.3.1.bin', 'GET')
				.reply(500, 'internal error');

			await expect(downloadDeviceOsVersionBinaries({ api: apiWithModule(), platformId: 6, version: '2.3.1', ui }))
				.to.be.rejectedWith('Failed to download file: 500');
			expect(fs.existsSync(path.join(binaryDir(), 'photon-system-part1@2.3.1.bin'))).to.be.false;
		});

		it('reports a missing version when the server answers 404', async () => {
			nock('https://api.particle.io/v1/firmware/device-os/v2.3.1')
				.intercept('/photon-system-part1@2.3.1.bin', 'GET')
				.reply(404);

			await expect(downloadDeviceOsVersionBinaries({ api: apiWithModule(), platformId: 6, version: '2.3.1', ui }))
				.to.be.rejectedWith('Device OS version not found for platform: 6 version: 2.3.1');
			expect(fs.existsSync(path.join(binaryDir(), 'photon-system-part1@2.3.1.bin'))).to.be.false;
		});

		it('fails and leaves no partial file when the network request fails', async () => {
			nock('https://api.particle.io/v1/firmware/device-os/v2.3.1')
				.intercept('/photon-system-part1@2.3.1.bin', 'GET')
				.replyWithError('socket hang up');

			await expect(downloadDeviceOsVersionBinaries({ api: apiWithModule(), platformId: 6, version: '2.3.1', ui }))
				.to.be.rejectedWith('socket hang up');
			expect(fs.existsSync(path.join(binaryDir(), 'photon-system-part1@2.3.1.bin'))).to.be.false;
		});

		describe('proxy', () => {
			let proxy;
			beforeEach(async () => {
				proxy = await startProxyRecorder();
			});
			afterEach(async () => {
				await proxy.close();
			});

			it('routes the request through HTTPS_PROXY', async () => {
				await expect(downloadDeviceOsVersionBinaries({ api: apiWithModule(), platformId: 6, version: '2.3.1', ui }))
					.to.be.rejected;
				expect(proxy.requests).to.have.lengthOf(1);
				expect(proxy.requests[0]).to.match(/^CONNECT api\.particle\.io:443 /);
			});
		});

		describe('profile proxyUrl', () => {
			const settings = require('../../settings');
			const originalProxyUrl = settings.proxyUrl;
			let proxy;
			beforeEach(async () => {
				proxy = await startProxyRecorder({ setEnv: false });
				settings.proxyUrl = proxy.url;
			});
			afterEach(async () => {
				settings.proxyUrl = originalProxyUrl;
				await proxy.close();
			});

			it('routes the request through the profile proxyUrl', async () => {
				await expect(downloadDeviceOsVersionBinaries({ api: apiWithModule(), platformId: 6, version: '2.3.1', ui }))
					.to.be.rejected;
				expect(proxy.requests).to.have.lengthOf(1);
				expect(proxy.requests[0]).to.match(/^CONNECT api\.particle\.io:443 /);
			});
		});
	});

	it('should fail if the platform is not supported by the requested version', async() => {
		let error;
		const api = {
			getDeviceOsVersions: sinon.stub().rejects(new Error('404'))
		};
		try {
			await downloadDeviceOsVersionBinaries({ api, platformId: 6, version: '2.3.1', ui });
		} catch (e) {
			error = e;
		}
		expect(error.message).to.equal('Device OS version not found for platform: 6 version: 2.3.1');
	});

	// FIXME (julien): this test was flaky so if it keeps failing, let's remove it.
	// I looked for a missing await but I can't find one
	// it('should fail in case of an error', async() => {
	// 	let error;
	// 	const api = {
	// 		getDeviceOsVersions: sinon.stub().resolves({
	// 			version: '2.3.1',
	// 			base_url: 'http://url-that-does-not-exist.com',
	// 			modules: [
	// 				{ filename: 'photon-bootloader@2.3.1+lto.bin', prefixInfo : { moduleFunction: 'bootloader' } },
	// 				{ filename: 'photon-system-part1@2.3.1.bin', prefixInfo: { moduleFunction: 'system-part' } }
	// 			]
	// 		})
	// 	};
	// 	const spy = sinon.spy(request, 'get');
	//
	// 	try {
	// 		await downloadDeviceOsVersionBinaries({ api, platformId: 6, version: '2.3.1', ui });
	// 	} catch (e) {
	// 		error = e;
	// 	}
	// 	expect(error.message).to.equal('Error downloading binaries for platform: 6 version: 2.3.1 error: getaddrinfo ENOTFOUND url-that-does-not-exist.com');
	// 	expect(api.getDeviceOsVersions).to.have.been.calledWith(6, '2.3.1');
	// 	expect(spy).to.have.been.calledOnce;
	// });
});
