const { expect, sinon } = require('../../test/setup');
const fs = require('fs-extra'); // Use fs-extra instead of fs
const nock = require('nock');
const temp = require('temp').track();
const path = require('path');
const FlashCommand = require('./flash');
const BundleCommand = require('./bundle');
const { PATH_TMP_DIR } = require('../../test/lib/env');
const deviceOsUtils = require('../lib/device-os-version-util');
const { firmwareTestHelper, ModuleInfo, HalModuleParser } = require('binary-version-reader');

describe('FlashCommand', () => {
	let flash;
	const originalEnv = process.env;

	// returns a list of HalModule objects
	const createModules = async () => {
		const parser = new HalModuleParser();
		const preBootloaderBuffer = await firmwareTestHelper.createFirmwareBinary({
			moduleFunction: ModuleInfo.FunctionType.BOOTLOADER,
			moduleIndex: 0,
			moduleVersion: 1200,
			deps: []
		});
		const preBootloader = await parser.parseBuffer({ fileBuffer: preBootloaderBuffer });
		const bootloaderBuffer = await firmwareTestHelper.createFirmwareBinary({
			moduleFunction: ModuleInfo.FunctionType.BOOTLOADER,
			moduleIndex: 1,
			moduleVersion: 1210,
			deps: [
				{ func: ModuleInfo.FunctionType.BOOTLOADER, index: 0, version: 1200 }
			]
		});
		const bootloader = await parser.parseBuffer({ fileBuffer: bootloaderBuffer });
		const systemPart1Buffer = await firmwareTestHelper.createFirmwareBinary({
			moduleFunction: ModuleInfo.FunctionType.SYSTEM_PART,
			moduleIndex: 1,
			moduleVersion: 4100,
			deps: [
				{ func: ModuleInfo.FunctionType.BOOTLOADER, index: 1, version: 1210 }
			]
		});
		const systemPart1 = await parser.parseBuffer({ fileBuffer: systemPart1Buffer });
		const systemPart2Buffer = await firmwareTestHelper.createFirmwareBinary({
			moduleFunction: ModuleInfo.FunctionType.SYSTEM_PART,
			moduleIndex: 2,
			moduleVersion: 4100,
			deps: [
				{ func: ModuleInfo.FunctionType.SYSTEM_PART, index: 1, version: 4100 }
			]
		});
		const systemPart2 = await parser.parseBuffer({ fileBuffer: systemPart2Buffer });
		const userPart1Buffer = await firmwareTestHelper.createFirmwareBinary({
			moduleFunction: ModuleInfo.FunctionType.USER_PART,
			moduleIndex: 1,
			platformId: 6,
			moduleVersion: 4100,
			deps: [
				{ func: ModuleInfo.FunctionType.SYSTEM_PART, index: 2, version: 4100 }
			]
		});
		const userPart1 = await parser.parseBuffer({ fileBuffer: userPart1Buffer });
		return [
			{ filename: 'preBootloader.bin', ...preBootloader },
			{ filename: 'bootloader.bin', ...bootloader },
			{ filename: 'systemPart1.bin', ...systemPart1 },
			{ filename: 'systemPart2.bin', ...systemPart2 },
			{ filename: 'userPart1.bin', ...userPart1 }
		];
	};

	const createAssetModules = async() => {
		const parser = new HalModuleParser();
		const asset1Buffer = await firmwareTestHelper.createFirmwareBinary({
			moduleFunction: ModuleInfo.FunctionType.ASSET,
			moduleIndex: 0,
			deps: []
		});
		const asset1 = await parser.parseBuffer({ fileBuffer: asset1Buffer });
		const asset2Buffer = await firmwareTestHelper.createFirmwareBinary({
			moduleFunction: ModuleInfo.FunctionType.ASSET,
			moduleIndex: 1,
			deps: []
		});
		const asset2 = await parser.parseBuffer({ fileBuffer: asset2Buffer });
		return [
			{ filename: 'asset1.bin', ...asset1 },
			{ filename: 'asset2.bin', ...asset2 }
		];
	};

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
			//const file = path.join(__dirname, '../../test/__fixtures__/binaries/argon-system-part1@4.1.0.bin');
			const modules = await createModules();
			const userPart = modules.find(m => m.filename === 'userPart1.bin');
			const deviceOsBinaries = await flash._getDeviceOsBinaries({ files: [userPart] });
			expect(deviceOsBinaries).to.eql([]);
		});
		it('returns empty list if applicationOnly is true', async () => {
			nock('https://api.particle.io')
				.intercept('/v1/device-os/versions/4100?platform_id=6', 'GET')
				.reply(200, {
					version: '2.3.1'
				});
			const modules = await createModules();
			const userPart = modules.find(m => m.filename === 'userPart1.bin');
			const binaries = await flash._getDeviceOsBinaries({
				applicationOnly: true,
				files: [userPart]
			});
			expect(binaries).to.eql([]);
		});

		it('returns empty if there is no target and skipDeviceOSFlash is true', async () => {
			nock('https://api.particle.io')
				.intercept('/v1/device-os/versions/1213?platform_id=12', 'GET')
				.reply(200, {
					version: '2.3.1'
				});
			const modules = await createModules();
			const userPart = modules.find(m => m.filename === 'userPart1.bin');
			const binaries = await flash._getDeviceOsBinaries({
				skipDeviceOSFlash: true,
				currentDeviceOsVersion: '0.7.0',
				files: [userPart]
			});
			expect(binaries).to.eql([]);
		});

		it('returns a list of files if there is a target', async () => {
			const modules = await createModules();
			const userPart = modules.find(m => m.filename === 'userPart1.bin');
			nock('https://api.particle.io')
				.intercept('/v1/device-os/versions/4100?platform_id=6', 'GET')
				.reply(200, {
					version: '4.1.0'
				});
			const stub = sinon.stub(deviceOsUtils, 'downloadDeviceOsVersionBinaries').returns([
				'photon-bootloader@4.1.0+lto.bin',
				'photon-system-part1@4.1.0.bin'
			]);
			const binaries = await flash._getDeviceOsBinaries({
				target: '4.1.0',
				files: [userPart],
				platformId: 6
			});
			expect(binaries.some(file => file.includes('photon-bootloader@4.1.0+lto.bin'))).to.be.true;
			expect(binaries.some(file => file.includes('photon-system-part1@4.1.0.bin'))).to.be.true;
			expect(binaries).to.have.lengthOf(2);
			expect(stub).to.have.been.calledOnce;
		});

		it('returns a list of files depending on user-part dependency binary', async () => {
			const modules = await createModules();
			const userPart = modules.find(m => m.filename === 'userPart1.bin');
			nock('https://api.particle.io')
				.intercept('/v1/device-os/versions/4100?platform_id=6', 'GET')
				.reply(200, {
					version: '4.1.0'
				});
			const stub = sinon.stub(deviceOsUtils, 'downloadDeviceOsVersionBinaries').returns([
				'photon-bootloader@4.1.0+lto.bin',
				'photon-system-part1@4.1.0.bin'
			]);
			const binaries = await flash._getDeviceOsBinaries({
				platformId: 6,
				files: [userPart],
			});
			expect(binaries.some(file => file.includes('photon-bootloader@4.1.0+lto.bin'))).to.be.true;
			expect(binaries.some(file => file.includes('photon-system-part1@4.1.0.bin'))).to.be.true;
			expect(binaries).to.have.lengthOf(2);
			expect(stub).to.have.been.calledOnce;
		});
	});

	describe('_createFlashSteps', () => {
		let preBootloaderStep, bootloaderStep, systemPart1Step, systemPart2Step, userPart1Step, modules, assetModules, asset1Step, asset2Step;
		beforeEach(async() => {
			modules = await createModules();
			assetModules = await createAssetModules();
			const preBootloader = modules.find( m => m.filename === 'preBootloader.bin');
			const bootloader = modules.find( m => m.filename === 'bootloader.bin');
			const systemPart1 = modules.find( m => m.filename === 'systemPart1.bin');
			const systemPart2 = modules.find( m => m.filename === 'systemPart2.bin');
			const userPart1 = modules.find( m => m.filename === 'userPart1.bin');
			const asset1 = assetModules.find( m => m.filename === 'asset1.bin');
			const asset2 = assetModules.find( m => m.filename === 'asset2.bin');
			preBootloaderStep = {
				name: preBootloader.filename,
				moduleInfo: {
					crc: preBootloader.crc,
					prefixInfo: preBootloader.prefixInfo,
					suffixInfo: preBootloader.suffixInfo
				},
				data: preBootloader.fileBuffer,
				flashMode: 'normal'
			};
			bootloaderStep = {
				name: bootloader.filename,
				moduleInfo: {
					crc: bootloader.crc,
					prefixInfo: bootloader.prefixInfo,
					suffixInfo: bootloader.suffixInfo
				},
				data: bootloader.fileBuffer,
				flashMode: 'normal'
			};
			systemPart1Step = {
				name: systemPart1.filename,
				moduleInfo: {
					crc: systemPart1.crc,
					prefixInfo: systemPart1.prefixInfo,
					suffixInfo: systemPart1.suffixInfo
				},
				data: systemPart1.fileBuffer,
				flashMode: 'dfu'
			};
			systemPart2Step = {
				name: systemPart2.filename,
				moduleInfo: {
					crc: systemPart2.crc,
					prefixInfo: systemPart2.prefixInfo,
					suffixInfo: systemPart2.suffixInfo
				},
				data: systemPart2.fileBuffer,
				flashMode: 'dfu'
			};
			userPart1Step = {
				name: userPart1.filename,
				moduleInfo: {
					crc: userPart1.crc,
					prefixInfo: userPart1.prefixInfo,
					suffixInfo: userPart1.suffixInfo
				},
				data: userPart1.fileBuffer,
				flashMode: 'dfu'
			};
			asset1Step = {
				name: asset1.filename,
				moduleInfo: {
					crc: asset1.crc,
					prefixInfo: asset1.prefixInfo,
					suffixInfo: asset1.suffixInfo
				},
				data: asset1.fileBuffer,
				flashMode: 'normal'
			};
			asset2Step = {
				name: asset2.filename,
				moduleInfo: {
					crc: asset2.crc,
					prefixInfo: asset2.prefixInfo,
					suffixInfo: asset2.suffixInfo
				},
				data: asset2.fileBuffer,
				flashMode: 'normal'
			};
		});

		it('returns a list of flash steps', async () => {
			const steps = await flash._createFlashSteps({
				modules,
				platformId: 6,
				isInDfuMode: false,
			});

			const expected = [
				preBootloaderStep,
				bootloaderStep,
				systemPart1Step,
				systemPart2Step,
				userPart1Step,
			];
			expect(steps).to.deep.equal(expected);
		});

		it('returns first dfu steps if isInDfuMode is true', async () => {
			const steps = await flash._createFlashSteps({
				modules,
				platformId: 6,
				isInDfuMode: true,
			});

			const expected = [
				systemPart1Step,
				systemPart2Step,
				userPart1Step,
				preBootloaderStep,
				bootloaderStep,
			];
			expect(steps).to.deep.equal(expected);
		});

		it('returns assets at the end of the list', async () => {
			const steps = await flash._createFlashSteps({
				modules: [...assetModules, ...modules],
				platformId: 6,
				isInDfuMode: false,
			});
			const expected = [
				preBootloaderStep,
				bootloaderStep,
				systemPart1Step,
				systemPart2Step,
				userPart1Step,
				asset2Step,
				asset1Step,
			];
			expect(steps).to.deep.equal(expected);
		});
	});
});
