const { expect, sinon } = require('../../test/setup');
const fs = require('fs-extra'); // Use fs-extra instead of fs
const temp = require('temp').track();
const path = require('path');
const FlashCommand = require('./flash');
const usbUtils = require('./usb-util');
const { PlatformId } = require('../lib/platform');

describe('FlashCommand', () => {
	let flash;

	beforeEach(() => {
		flash = new FlashCommand();
	});

	afterEach(() => {
		sinon.restore();
	});

	describe('_getDeviceInfo', () => {
		let device;
		beforeEach(() => {
			device = {
				id: '3c0021000947343432313031',
				platformId: PlatformId.PHOTON,
				firmwareVersion: '3.3.1',
				isInDfuMode: false,
				close: sinon.stub()
			};
			sinon.stub(usbUtils, 'getOneUsbDevice').resolves(device);
		});

		it('returns information about the device', async () => {
			const deviceInfo = await flash._getDeviceInfo();

			expect(deviceInfo).to.eql({
				id: '3c0021000947343432313031',
				platformId: PlatformId.PHOTON,
				platformName: 'photon',
				version: '3.3.1',
				isInDfuMode: false
			});
		});
	});

	describe('_analyzeFiles', () => {
		it('returns the current directory if no arguments are passed', async () => {
			const files = [];

			const result = await flash._analyzeFiles(files);

			expect(result).to.eql({ files: ['.'], device: null, knownApp: null });
		});

		it('returns the known app if it is the first argument', async () => {
			const files = ['tinker'];

			const result = await flash._analyzeFiles(files);

			expect(result).to.eql({ files: [], device: null, knownApp: 'tinker' });
		});

		it('returns the device name and known app if they are the first 2 arguments', async () => {
			const files = ['my-device', 'tinker'];

			const result = await flash._analyzeFiles(files);

			expect(result).to.eql({ files: [], device: 'my-device', knownApp: 'tinker' });
		});

		it('returns the first argument as part of files if it exists in the filesystem', async () => {
			const files = ['firmware.bin'];
			sinon.stub(fs, 'stat');

			const result = await flash._analyzeFiles(files);

			expect(result).to.eql({ files: ['firmware.bin'], device: null, knownApp: null });
		});

		it('returns the first argument as device if it does not exist in the filesystem', async () => {
			const files = ['my-device', 'firmware.bin'];
			const error = new Error('File not found');
			sinon.stub(fs, 'stat').rejects(error);

			const result = await flash._analyzeFiles(files);

			expect(result).to.eql({ files: ['firmware.bin'], device: 'my-device', knownApp: null });
		});
	});

	describe('_prepareFilesToFlash', () => {
		it('returns the known app binary if it exists', async () => {
			const knownApp = 'tinker';
			const platformName = 'photon';

			const result = await flash._prepareFilesToFlash({ knownApp, platformName });

			expect(result).to.have.property('skipDeviceOSFlash', true);
			expect(result).to.have.property('files').with.lengthOf(1);
			expect(result.files[0]).to.match(/tinker.*-photon.bin$/);
		});

		it('throws an error if there is no known app binary for the platform', async () => {
			const knownApp = 'doctor';
			const platformName = 'p2';

			let error;
			try {
				await flash._prepareFilesToFlash({ knownApp, platformName });
			} catch (e) {
				error = e;
			}

			expect(error).to.have.property('message', 'Known app doctor is not available for p2');
		});

		it('returns a list of binaries in the directory if there are no source files', async () => {
			const dir = await temp.mkdir();
			await fs.writeFile(path.join(dir, 'firmware.bin'), 'binary data');
			await fs.writeFile(path.join(dir, 'system-part1.bin'), 'binary data');

			const result = await flash._prepareFilesToFlash({ parsedFiles: [dir] });

			expect(result).to.eql({
				skipDeviceOSFlash: false,
				files: [
					path.join(dir, 'firmware.bin'),
					path.join(dir, 'system-part1.bin')
				]
			});
		});

		it('compiles and returns the binary if there are source files in the directory', async () => {
			const dir = await temp.mkdir();
			await fs.writeFile(path.join(dir, 'firmware.bin'), 'binary data');
			await fs.writeFile(path.join(dir, 'project.properties'), 'project');
			const stub = sinon.stub(flash, '_compileCode').resolves(['compiled.bin']);

			const result = await flash._prepareFilesToFlash({ parsedFiles: [dir] });

			expect(result).to.eql({
				skipDeviceOSFlash: false,
				files: [
					'compiled.bin'
				]
			});
			expect(stub).to.have.been.called;
		});

		it('throws an error if the directory is empty', async () => {
			const dir = await temp.mkdir();

			let error;
			try {
				await flash._prepareFilesToFlash({ parsedFiles: [dir] });
			} catch (e) {
				error = e;
			}

			expect(error).to.have.property('message', 'No files found to flash');
		});

		it('returns a list of binaries if binaries are passed', async () => {
			const bin = await temp.path({ suffix: '.bin' });
			await fs.writeFile(bin, 'binary data');
			const dir = await temp.mkdir();
			await fs.writeFile(path.join(dir, 'system-part1.bin'), 'binary data');

			const result = await flash._prepareFilesToFlash({ parsedFiles: [bin, dir] });

			expect(result).to.eql({
				skipDeviceOSFlash: false,
				files: [
					bin,
					path.join(dir, 'system-part1.bin')
				]
			});
		});

		it('compiles and returns the binary if passed a source file', async () => {
			const source = await temp.path({ suffix: '.cpp' });
			await fs.writeFile(source, 'source code');
			const dir = await temp.mkdir();
			await fs.writeFile(path.join(dir, 'project.properties'), 'project');
			const stub = sinon.stub(flash, '_compileCode').resolves(['compiled.bin']);

			const result = await flash._prepareFilesToFlash({ parsedFiles: [source, dir] });

			expect(result).to.eql({
				skipDeviceOSFlash: false,
				files: [
					'compiled.bin'
				]
			});
			expect(stub).to.have.been.called;
		});
	});
});
