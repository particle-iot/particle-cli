const { expect, sinon } = require('../../test/setup');
const fs = require('fs-extra'); // Use fs-extra instead of fs
const nock = require('nock');
const temp = require('temp').track();
const path = require('path');
const FlashCommand = require('./flash');
const BundleCommand = require('./bundle');
const { PATH_TMP_DIR } = require('../../test/lib/env');

describe('FlashCommand', () => {
	let flash;
	const originalEnv = process.env;

	beforeEach(() => {
		process.env = {
			...originalEnv,
			home: PATH_TMP_DIR,
		};
		flash = new FlashCommand();
	});

	afterEach(() => {
		sinon.restore();
	});

	describe('_analyzeFiles', () => {
		it('returns the current directory if no arguments are passed', async () => {
			const files = [];

			const result = await flash._analyzeFiles(files);

			expect(result).to.eql({ files: ['.'], deviceIdOrName: null, knownApp: null });
		});

		it('returns the known app if it is the first argument', async () => {
			const files = ['tinker'];

			const result = await flash._analyzeFiles(files);

			expect(result).to.eql({ files: [], deviceIdOrName: null, knownApp: 'tinker' });
		});

		it('returns the device name and known app if they are the first 2 arguments', async () => {
			const files = ['my-device', 'tinker'];

			const result = await flash._analyzeFiles(files);

			expect(result).to.eql({ files: [], deviceIdOrName: 'my-device', knownApp: 'tinker' });
		});

		it('returns the first argument as part of files if it exists in the filesystem', async () => {
			const files = ['firmware.bin'];
			sinon.stub(fs, 'stat');

			const result = await flash._analyzeFiles(files);

			expect(result).to.eql({ files: ['firmware.bin'], deviceIdOrName: null, knownApp: null });
		});

		it('returns the first argument as device if it does not exist in the filesystem', async () => {
			const files = ['my-device', 'firmware.bin'];
			const error = new Error('File not found');
			sinon.stub(fs, 'stat').rejects(error);

			const result = await flash._analyzeFiles(files);

			expect(result).to.eql({ files: ['firmware.bin'], deviceIdOrName: 'my-device', knownApp: null });
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


	describe('_processBundle', () => {
		it('returns a flat list of filenames after extracting bundles', async () => {
			const filesToFlash = ['system-part1.bin', 'bundle.zip', 'system-part2.bin'];
			sinon.stub(BundleCommand.prototype, 'extractModulesFromBundle').resolves(['application.bin', 'asset.txt']);

			const result = await flash._processBundle({ filesToFlash });

			expect(result).to.eql(['system-part1.bin', 'application.bin', 'asset.txt', 'system-part2.bin']);
		});
	});
	describe('_getDeviceOsBinaries', () => {
		it('returns empty if there is no application binary', async () => {
			const file = path.join(__dirname, '../../test/__fixtures__/binaries/argon-system-part1@4.1.0.bin');
			const deviceOsBinaries = await flash._getDeviceOsBinaries({ files: [file] });
			expect(deviceOsBinaries).to.eql([]);
		});
		it ('fails if a file does not exist', async () => {
			let error;
			try {
				await flash._getDeviceOsBinaries({
					applicationOnly: true,
					files: ['not-found-app-other-app.bin']
				});
			} catch (e) {
				error = e;
			}
			expect(error).to.equal('not-found-app-other-app.bin doesn\'t exist');
		});
		it('returns empty list if applicationOnly is true', async () => {
			nock('https://api.particle.io')
				.intercept('/v1/device-os/versions/1213?platform_id=12', 'GET')
				.reply(200, {
					version: '2.3.1'
				});
			const file = path.join(__dirname, '../../test/__fixtures__/binaries/argon_stroby.bin');
			const binaries = await flash._getDeviceOsBinaries({
				applicationOnly: true,
				files: [file]
			});
			expect(binaries).to.eql([]);
		});

		it('returns empty if there is no target and skipDeviceOSFlash is true', async () => {
			nock('https://api.particle.io')
				.intercept('/v1/device-os/versions/1213?platform_id=12', 'GET')
				.reply(200, {
					version: '2.3.1'
				});
			const file = path.join(__dirname, '../../test/__fixtures__/binaries/argon_stroby.bin');
			const binaries = await flash._getDeviceOsBinaries({
				skipDeviceOSFlash: true,
				currentDeviceOsVersion: '0.7.0',
				files: [file]
			});
			expect(binaries).to.eql([]);
		});

		it('returns a list of files if there is a target', async () => {
			const binary = await fs.readFile(path.join(__dirname, '../../test/__fixtures__/binaries/argon_stroby.bin'));
			const file = path.join(__dirname, '../../test/__fixtures__/binaries/argon_stroby.bin');
			nock('https://api.particle.io')
				.intercept('/v1/device-os/versions/1213?platform_id=12', 'GET')
				.reply(200, {
					version: '2.3.1'
				});
			nock('https://api.particle.io')
				.intercept('/v1/device-os/versions/2.3.1?platform_id=6', 'GET')
				.reply(200, {
					version: '2.3.1',
					internal_version: 2302,
					base_url: 'https://api.particle.io/v1/firmware/device-os/v2.3.1',
					modules: [
						{ filename: 'photon-bootloader@2.3.1+lto.bin', prefixInfo: { moduleFunction: 'bootloader' } },
						{ filename: 'photon-system-part1@2.3.1.bin', prefixInfo: { moduleFunction: 'system-part1' } }
					]
				});
			nock('https://api.particle.io')
				.intercept('/v1/firmware/device-os/v2.3.1/photon-bootloader@2.3.1+lto.bin', 'GET')
				.reply(200, binary);
			nock('https://api.particle.io')
				.intercept('/v1/firmware/device-os/v2.3.1/photon-system-part1@2.3.1.bin', 'GET')
				.reply(200, binary);
			const binaries = await flash._getDeviceOsBinaries({
				target: '2.3.1',
				files: [file],
				platformId: 6
			});
			expect(binaries.some(file => file.includes('photon-bootloader@2.3.1+lto.bin'))).to.be.true;
			expect(binaries.some(file => file.includes('photon-system-part1@2.3.1.bin'))).to.be.true;
			expect(binaries).to.have.lengthOf(2);
		});

		it('returns a list of files depending on user-part dependency binary', async () => {
			const userPartPath = path.join(__dirname, '../../test/__fixtures__/binaries/argon_stroby.bin');
			const binary = await fs.readFile(path.join(__dirname, '../../test/__fixtures__/binaries/argon_stroby.bin'));
			nock('https://api.particle.io')
				.intercept('/v1/device-os/versions/1213?platform_id=12', 'GET')
				.reply(200, {
					version: '1.2.3'
				});
			nock('https://api.particle.io')
				.intercept('/v1/device-os/versions/1.2.3?platform_id=6', 'GET')
				.reply(200, {
					version: '1.2.3',
					internal_version: 1213,
					base_url: 'https://api.particle.io/v1/firmware/device-os/v1.2.3',
					modules: [
						{ filename: 'photon-bootloader@1.2.3+lto.bin', prefixInfo: { moduleFunction: 'bootloader' } },
						{ filename: 'photon-system-part1@1.2.3.bin', prefixInfo: { moduleFunction: 'system-part1' } }
					]
				});

			nock('https://api.particle.io')
				.intercept('/v1/firmware/device-os/v1.2.3/photon-bootloader@1.2.3+lto.bin', 'GET')
				.reply(200, binary);
			nock('https://api.particle.io')
				.intercept('/v1/firmware/device-os/v1.2.3/photon-system-part1@1.2.3.bin', 'GET')
				.reply(200, binary);
			const binaries = await flash._getDeviceOsBinaries({
				platformId: 6,
				files: [userPartPath],
			});
			expect(binaries.some(file => file.includes('photon-bootloader@1.2.3+lto.bin'))).to.be.true;
			expect(binaries.some(file => file.includes('photon-system-part1@1.2.3.bin'))).to.be.true;
			expect(binaries).to.have.lengthOf(2);
		});
	});
});
