const { expect } = require('../../test/setup');
const sinon = require('sinon');
const fs = require('fs-extra');
const path = require('path');
const { downloadDeviceOsVersionBinaries } = require('./device-os-version-util');
const nock = require('nock');
const { PATH_TMP_DIR } = require('../../test/lib/env');
const UI = require('./ui');

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
		nock('https://api.particle.io/v1/firmware/device-os/v2.3.1', )
			.intercept('/photon-bootloader@2.3.1+lto.bin', 'GET')
			.reply(200, binary);

		nock('https://api.particle.io/v1/firmware/device-os/v2.3.1', )
			.intercept('/photon-system-part1@2.3.1.bin', 'GET')
			.reply(200, binary);

		const data = await downloadDeviceOsVersionBinaries({ api, platformId: 6, ui });
		expect(api.getDeviceOsVersions).to.have.been.calledWith(6, 'latest');
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
		nock('https://api.particle.io/v1/firmware/device-os/v2.3.1', )
			.intercept('/photon-bootloader@2.3.1+lto.bin', 'GET')
			.reply(200, binary);

		nock('https://api.particle.io/v1/firmware/device-os/v2.3.1', )
			.intercept('/photon-system-part1@2.3.1.bin', 'GET')
			.reply(200, binary);

		const data = await downloadDeviceOsVersionBinaries({ api, platformId: 6, version: '2.3.1', ui });
		expect(api.getDeviceOsVersions).to.have.been.calledWith(6, '2.3.1');
		expect(data).to.be.an('array').with.lengthOf(2);
		const files = fs.readdirSync(path.join(PATH_TMP_DIR, '.particle/device-os-flash/binaries/2.3.1/photon'));
		expect(files).to.be.an('array').with.lengthOf(2);
		expect(files).to.include('photon-bootloader@2.3.1+lto.bin');
		expect(files).to.include('photon-system-part1@2.3.1.bin');

	});

	it('should fail if the platform is not supported by the requested version', async()=> {
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
