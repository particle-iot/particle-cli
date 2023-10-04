const { expect } = require('../../test/setup');
const sinon = require('sinon');
const fs = require('fs-extra');
const path = require('path');
const { downloadDeviceOsVersionBinaries } = require('./device-os-version-util');
const DeviceOsVersionCache = require('./device-os-version-cache');
const nock = require('nock');
const { PATH_TMP_DIR } = require('../../test/lib/env');
const UI = require('./ui');
const { firmwareTestHelper, ModuleInfo, HalModuleParser } = require('binary-version-reader');
const ParticleApi = require('../cmd/api');
const settings = require('../../settings');

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

	it('throws an error if we cannot find the device os version in cache and there is an Internet connection error', async() => {
		let error;
		const api = {
			getDeviceOsVersions: sinon.stub().rejects(new Error('getaddrinfo ENOTFOUND api.particle.io'))
		};
		try {
			await downloadDeviceOsVersionBinaries({ api, platformId: 6, version: '2.3.1', ui });
		} catch (e) {
			error = e;
		}

		expect(error.message).to.equal('Device OS version not found in cache for platform: 6 version: 2.3.1 and there was an internet connection error');
	});

	it('should download the binaries for the given platform and version from cache', async() => {
		// create cache file
		const particleDir = path.join(PATH_TMP_DIR, '.particle/device-os-flash/binaries');
		const deviceOsVersionCache = new DeviceOsVersionCache();
		await deviceOsVersionCache.init();

		const bootloaderPath = path.join(particleDir, '/2.3.1/photon');
		const bootloaderFilePath = path.join(bootloaderPath, 'photon-bootloader@2.3.1+lto.bin');
		const bootloaderBuffer = await firmwareTestHelper.createFirmwareBinary({
			moduleFunction: ModuleInfo.FunctionType.BOOTLOADER,
			platformId: 6,
			moduleIndex: 0,
			moduleVersion: 1200,
			deps: []
		});
		const parser = new HalModuleParser();
		const bootloader = await parser.parseBuffer({ fileBuffer: bootloaderBuffer });
		// create file
		await fs.ensureDir(particleDir);
		await fs.ensureDir(bootloaderPath);
		await fs.writeFile(bootloaderFilePath, bootloaderBuffer);
		const cachedData = {
			platformId: 6,
			version: '2.3.1',
			internal_version: 2301,
			base_url: 'https://api.particle.io/v1/firmware/device-os/v2.3.1',
			modules: [
				{ filename: 'photon-bootloader@2.3.1+lto.bin', ...bootloader }
			]
		};
		await deviceOsVersionCache.set(deviceOsVersionCache.generateKey(6, '2.3.1'), cachedData);

		nock('https://api.particle.io/v1/device-os/versions/')
			.intercept('2.3.1?platform_id=${platformId}', 'GET')
			.replyWithError('ECONNREFUSED');

		const api = new ParticleApi(settings.apiUrl, {} );
		const data = await downloadDeviceOsVersionBinaries({ api, platformId: 6, version: '2.3.1', ui });
		expect(data).to.be.an('array').with.lengthOf(1);
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
