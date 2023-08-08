const { expect } = require('../../test/setup');
const sinon = require('sinon');
const fs = require('fs-extra');
const request = require('request');
const path = require('path');
const { downloadDeviceOsVersionBinaries } = require('./device-os-version-util');
const PATH_TMP_DIR = './tmp';

// stub: request, fs, api
describe('downloadDeviceOsVersionBinaries', () => {
	const originalEnv = process.env;
	beforeEach(() => {
		process.env = {
			...originalEnv,
			home: PATH_TMP_DIR,
		};
		fs.ensureDirSync(PATH_TMP_DIR);
	});
	afterEach(() => {
		process.env = originalEnv;
		sinon.restore();
	});
	it('should download the binaries for the given platform and version by default the latest version is downloaded', async () => {
		const expectedPath = path.join(PATH_TMP_DIR, '.particle/device-os-flash/binaries/2.3.1/photon');
		const api = {
			getDeviceOsVersions: sinon.stub().resolves({
				version: '2.3.1',
				base_url: 'https://api.particle.io/v1/firmware/device-os/v2.3.1',
				modules: [
					{ filename: 'photon-bootloader@2.3.1+lto.bin' },
					{ filename: 'photon-system-part1@2.3.1.bin' }
				]
			})
		};
		expect(fs.existsSync(expectedPath)).to.be.false;
		const sinonRequest = sinon.stub(request, 'get').returns({
			pipe: (res) => {
				res.emit('finish');
				return {
					on: (event, cb) => sinon.stub().callsFake(cb)
				};
			}
		});

		const data = await downloadDeviceOsVersionBinaries({ api, platformId: 6 });
		expect(api.getDeviceOsVersions).to.have.been.calledWith(6, 'latest');
		expect(data).to.be.an('array').with.lengthOf(2);
		expect(sinonRequest.firstCall).to.have.been.calledWith('https://api.particle.io/v1/firmware/device-os/v2.3.1/photon-bootloader@2.3.1+lto.bin');
		expect(sinonRequest.secondCall).to.have.been.calledWith('https://api.particle.io/v1/firmware/device-os/v2.3.1/photon-system-part1@2.3.1.bin');
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
					{ filename: 'photon-bootloader@2.3.1+lto.bin' },
					{ filename: 'photon-system-part1@2.3.1.bin' }
				]
			})
		};
		sinon.stub(request, 'get').returns({
			pipe: (res) => {
				res.emit('finish');
				return {
					on: (event, cb) => sinon.stub().callsFake(cb)
				};
			}
		});

		const data = await downloadDeviceOsVersionBinaries({ api, platformId: 6, version: '2.3.1' });
		expect(api.getDeviceOsVersions).to.have.been.calledWith(6, '2.3.1');
		expect(data).to.be.an('array').with.lengthOf(2);
		const files = fs.readdirSync(path.join(PATH_TMP_DIR, '.particle/device-os-flash/binaries/2.3.1/photon'));
		expect(files).to.be.an('array').with.lengthOf(2);
		expect(files).to.include('photon-bootloader@2.3.1+lto.bin');
		expect(files).to.include('photon-system-part1@2.3.1.bin');

	});

	it('should fail if the platform is not supported by the requested version', async()  => {
		let error;
		const api = {
			getDeviceOsVersions: sinon.stub().rejects(new Error('404'))
		};
		try {
			await downloadDeviceOsVersionBinaries({ api, platformId: 6, version: '2.3.1' });
		} catch (e) {
			error = e;
		}
		expect(error.message).to.equal('Device OS version not found for platform: 6 version: 2.3.1');
	});

	it('should fail in case of an error', async() => {
		let error;
		const api = {
			getDeviceOsVersions: sinon.stub().resolves({
				version: '2.3.1',
				base_url: 'http://url-that-does-not-exist.com',
				modules: [
					{ filename: 'photon-bootloader@2.3.1+lto.bin' },
					{ filename: 'photon-system-part1@2.3.1.bin' }
				]
			})
		};
		sinon.stub(request, 'get').returns({
			pipe: (res) => {
				res.emit('finish');
				return {
					on: (event, cb) => {
						if (event === 'error') {
							cb(new Error('getaddrinfo ENOTFOUND url-that-does-not-exist.com'));
						}
						return sinon.stub().callsFake(cb);
					}
				};
			}
		});

		try {
			await downloadDeviceOsVersionBinaries({ api, platformId: 6, version: '2.3.1' });
		} catch (e) {
			error = e;
		}
		expect(error.message).to.equal('Error downloading binaries for platform: 6 version: 2.3.1 error: getaddrinfo ENOTFOUND url-that-does-not-exist.com');
		expect(api.getDeviceOsVersions).to.have.been.calledWith(6, '2.3.1');
		expect(request.get).to.have.been.calledOnce;
	});
});
