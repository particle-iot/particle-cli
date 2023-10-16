const { expect, sinon } = require('../../test/setup');
const { HalModuleParser, firmwareTestHelper, ModuleInfo, createAssetModule } = require('binary-version-reader');
const chalk = require('chalk');
const usbUtils = require('../cmd/usb-util');
const {
	createFlashSteps,
	filterModulesToFlash,
	prepareDeviceForFlash,
	validateDFUSupport,
	getFileFlashInfo
} = require('./flash-helper');
const { PATH_TMP_DIR } = require('../../test/lib/env');
const path = require('path');
const fs = require('fs-extra');
const { ensureDir } = require('fs-extra/lib/mkdirs');

describe('flash-helper', () => {
	const createModules = async () => {
		const parser = new HalModuleParser();
		const preBootloaderBuffer = await firmwareTestHelper.createFirmwareBinary({
			moduleFunction: ModuleInfo.FunctionType.BOOTLOADER,
			platformId: 6,
			moduleIndex: 0,
			moduleVersion: 1200,
			deps: []
		});
		const preBootloader = await parser.parseBuffer({ fileBuffer: preBootloaderBuffer });
		const bootloaderBuffer = await firmwareTestHelper.createFirmwareBinary({
			moduleFunction: ModuleInfo.FunctionType.BOOTLOADER,
			moduleIndex: 2,
			platformId: 6,
			moduleVersion: 1210,
			deps: [
				{ func: ModuleInfo.FunctionType.BOOTLOADER, index: 0, version: 1200 }
			]
		});
		const bootloader = await parser.parseBuffer({ fileBuffer: bootloaderBuffer });
		const systemPart1Buffer = await firmwareTestHelper.createFirmwareBinary({
			moduleFunction: ModuleInfo.FunctionType.SYSTEM_PART,
			moduleIndex: 1,
			platformId: 6,
			moduleVersion: 4100,
			deps: [
				{ func: ModuleInfo.FunctionType.BOOTLOADER, index: 1, version: 1210 }
			]
		});
		const systemPart1 = await parser.parseBuffer({ fileBuffer: systemPart1Buffer });
		const systemPart2Buffer = await firmwareTestHelper.createFirmwareBinary({
			moduleFunction: ModuleInfo.FunctionType.SYSTEM_PART,
			moduleIndex: 2,
			platformId: 6,
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

	const createModulesWithDeviceOs3005 = async () => {
		const parser = new HalModuleParser();
		const bootloaderBuffer = await firmwareTestHelper.createFirmwareBinary({
			moduleFunction: ModuleInfo.FunctionType.BOOTLOADER,
			moduleIndex: 2,
			platformId: 13,
			moduleVersion: 1005,
			deps: [
				{ func: ModuleInfo.FunctionType.BOOTLOADER, index: 0, version: 1005 }
			]
		});
		const bootloader = await parser.parseBuffer({ fileBuffer: bootloaderBuffer });
		const systemPart1Buffer = await firmwareTestHelper.createFirmwareBinary({
			moduleFunction: ModuleInfo.FunctionType.SYSTEM_PART,
			moduleIndex: 1,
			platformId: 13,
			moduleVersion: 3005,
			deps: [
				{ func: ModuleInfo.FunctionType.BOOTLOADER, index: 1, version: 1005 }
			]
		});
		const systemPart1 = await parser.parseBuffer({ fileBuffer: systemPart1Buffer });
		const userPart1Buffer = await firmwareTestHelper.createFirmwareBinary({
			moduleFunction: ModuleInfo.FunctionType.USER_PART,
			moduleIndex: 1,
			platformId: 13,
			moduleVersion: 3005,
			deps: [
				{ func: ModuleInfo.FunctionType.SYSTEM_PART, index: 2, version: 3005 }
			]
		});
		const userPart1 = await parser.parseBuffer({ fileBuffer: userPart1Buffer });
		return [
			{ filename: 'bootloader.bin', ...bootloader },
			{ filename: 'systemPart1.bin', ...systemPart1 },
			{ filename: 'userPart1.bin', ...userPart1 }
		];
	};

	const createAssetModules = async() => {
		const parser = new HalModuleParser();
		const asset1Buffer = await createAssetModule(Buffer.from('asset1'), 'asset1.txt');
		const asset1 = await parser.parseBuffer({ fileBuffer: asset1Buffer });
		const asset2Buffer = await createAssetModule(Buffer.from('asset2'), 'asset2.txt');
		const asset2 = await parser.parseBuffer({ fileBuffer: asset2Buffer });
		return [
			{ filename: 'asset1.bin', ...asset1 },
			{ filename: 'asset2.bin', ...asset2 }
		];
	};
	const createExtraModules = async () => {
		const parser = new HalModuleParser();
		const softDeviceBuffer = await firmwareTestHelper.createFirmwareBinary({
			moduleFunction: ModuleInfo.FunctionType.RADIO_STACK,
			moduleIndex: 0,
			deps: []
		});
		const softDevice = await parser.parseBuffer({ fileBuffer: softDeviceBuffer });
		const ncpBuffer = await firmwareTestHelper.createFirmwareBinary({
			moduleFunction: ModuleInfo.FunctionType.NCP_FIRMWARE,
			moduleIndex: 0,
			deps: []
		});
		const ncp = await parser.parseBuffer({ fileBuffer: ncpBuffer });
		const encryptedModuleBuffer = await firmwareTestHelper.createFirmwareBinary({
			moduleFunction: ModuleInfo.FunctionType.BOOTLOADER,
			moduleIndex: 1,
			deps: []
		});
		const encryptedModule = await parser.parseBuffer({ fileBuffer: encryptedModuleBuffer });
		return {
			softDevice: { filename: 'softDevice.bin', ...softDevice },
			ncp: { filename: 'ncp.bin', ...ncp },
			encryptedModule: { filename: 'encryptedModule.bin', ...encryptedModule }
		};
	};

	describe('filterModulesToFlash', () => {
		let modules, assetModules, extraModules;
		beforeEach( async () => {
			modules = await createModules();
			assetModules = await createAssetModules();
			extraModules = await createExtraModules();
		});
		it('returns modules without ncp, softDevice and encrypted modules', async () => {
			const filteredModules = filterModulesToFlash({ modules: [...modules, ...assetModules, extraModules.encryptedModule, extraModules.softDevice, extraModules.ncp], platformId: 32 });
			expect(filteredModules).to.have.lengthOf(7);
		});
		it ('returns everything but encrypted modules if allowAll argument is passed', async () => {
			const filteredModules = filterModulesToFlash({ modules: [...modules, ...assetModules, extraModules.encryptedModule, extraModules.softDevice, extraModules.ncp], platformId: 32, allowAll: true });
			expect(filteredModules).to.have.lengthOf(9);
		});
	});

	describe('createFlashSteps', () => {
		let preBootloaderStep, bootloaderStep, systemPart1Step, systemPart2Step, userPart1Step, userPartInvalidationStep, modules, assetModules, asset1Step, asset2Step;
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
				data: preBootloader.fileBuffer,
				flashMode: 'normal'
			};
			bootloaderStep = {
				name: bootloader.filename,
				data: bootloader.fileBuffer,
				flashMode: 'normal'
			};
			systemPart1Step = {
				name: systemPart1.filename,
				address: 0x8000000,
				data: systemPart1.fileBuffer,
				flashMode: 'dfu'
			};
			systemPart2Step = {
				name: systemPart2.filename,
				address: 0x8000000,
				data: systemPart2.fileBuffer,
				flashMode: 'dfu'
			};
			userPart1Step = {
				name: userPart1.filename,
				address: 0x8000000,
				data: userPart1.fileBuffer,
				flashMode: 'dfu'
			};
			userPartInvalidationStep = {
				name: 'invalidate-128k-user-part',
				address: 0xd4000,
				data: Buffer.alloc(4096, 0xFF),
				flashMode: 'dfu'
			};
			asset1Step = {
				name: asset1.filename,
				data: asset1.fileBuffer,
				flashMode: 'normal'
			};
			asset2Step = {
				name: asset2.filename,
				data: asset2.fileBuffer,
				flashMode: 'normal'
			};
		});

		it('returns a list of flash steps', async () => {
			const steps = await createFlashSteps({
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

		it('returns a list of flash steps for gen3 nrf52 based platform', async () => {
			const steps = await createFlashSteps({
				modules,
				platformId: 13,
				isInDfuMode: false,
			});

			const expected = [
				preBootloaderStep,
				bootloaderStep,
				systemPart1Step,
				systemPart2Step,
				userPartInvalidationStep,
				userPart1Step
			];
			expect(steps).to.deep.equal(expected);
		});

		it('returns first dfu steps if isInDfuMode is true', async () => {
			const steps = await createFlashSteps({
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
			const steps = await createFlashSteps({
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

		it('puts the user part at the factory address when supported', async () => {
			const userPart1 = modules.find( m => m.filename === 'userPart1.bin');

			const steps = await createFlashSteps({
				modules: [userPart1],
				platformId: 6,
				isInDfuMode: false,
				factory: true
			});
			const userPart1FactoryStep = {
				...userPart1Step,
				address: 0x80e0000
			};
			const expected = [
				userPart1FactoryStep
			];
			expect(steps).to.deep.equal(expected);
		});

		it('rejects when requesting a system part at the factory location', async () => {
			const systemPart1 = modules.find( m => m.filename === 'systemPart1.bin');

			let error;
			try {
				await createFlashSteps({
					modules: [systemPart1],
					platformId: 6,
					isInDfuMode: false,
					factory: true
				});
			} catch (e) {
				error = e;
			}
			expect(error).to.have.property('message', 'Factory reset is only supported for user part');
		});

		it('rejects when the platform has no factory location', async () => {
			const userPart1 = modules.find( m => m.filename === 'userPart1.bin');

			let error;
			try {
				await createFlashSteps({
					modules: [userPart1],
					platformId: 32,
					isInDfuMode: false,
					factory: true
				});
			} catch (e) {
				error = e;
			}
			expect(error).to.have.property('message', 'Factory reset is not supported for this platform');
		});
	});

	describe('createFlashSteps for gen3 nRF based platform', () => {
		let bootloaderStep, systemPart1Step, userPart1Step, modules;
		beforeEach(async() => {
			modules = await createModulesWithDeviceOs3005();
			const bootloader = modules.find( m => m.filename === 'bootloader.bin');
			const systemPart1 = modules.find( m => m.filename === 'systemPart1.bin');
			const userPart1 = modules.find( m => m.filename === 'userPart1.bin');
			bootloaderStep = {
				name: bootloader.filename,
				data: bootloader.fileBuffer,
				flashMode: 'normal'
			};
			systemPart1Step = {
				name: systemPart1.filename,
				address: 0x8000000,
				data: systemPart1.fileBuffer,
				flashMode: 'dfu'
			};
			userPart1Step = {
				name: userPart1.filename,
				address: 0x8000000,
				data: userPart1.fileBuffer,
				flashMode: 'dfu'
			};
		});

		it('returns a list of flash steps', async () => {
			const steps = await createFlashSteps({
				modules,
				platformId: 13,
				isInDfuMode: false,
			});

			const expected = [
				bootloaderStep,
				systemPart1Step,
				userPart1Step,
			];
			expect(steps).to.deep.equal(expected);
		});
	});

	describe('prepareDeviceForFlash', () => {
		let reopenInNormalStub, reopenStub, reopenInDfuModeStub;
		beforeEach(() => {
			reopenInNormalStub = sinon.stub(usbUtils, 'reopenInNormalMode');
			reopenStub = sinon.stub(usbUtils, 'reopenDevice');
			reopenInDfuModeStub = sinon.stub(usbUtils, 'reopenInDfuMode');
		});

		afterEach(() => {
			sinon.restore();
		});
		it('prepares the device when is required for normal mode and currently is in dfu mode', async () => {
			const device = {
				isOpen: true,
				isInDfuMode: true,
				close: sinon.stub(),
				enterListeningMode: sinon.stub()
			};
			reopenInNormalStub.resolves(device);
			reopenStub.resolves(device);
			await prepareDeviceForFlash({ device, mode: 'normal' });
			expect(reopenStub).to.have.been.calledOnce;
			expect(reopenInNormalStub).to.have.been.calledOnce;
			expect(reopenInDfuModeStub).to.not.have.been.called;
			expect(device.enterListeningMode).to.have.been.calledOnce;
		});
		it('prepares the device when is required for normal mode and currently is in normal mode', async () => {
			const device = {
				isOpen: true,
				isInDfuMode: false,
				close: sinon.stub(),
				enterListeningMode: sinon.stub()
			};

			reopenStub.resolves(device);
			await prepareDeviceForFlash({ device, mode: 'normal' });
			expect(reopenStub).to.have.been.calledOnce;
			expect(reopenInNormalStub).to.not.have.been.called;
			expect(reopenInDfuModeStub).to.not.have.been.called;
			expect(device.enterListeningMode).to.have.been.calledOnce;
		});
		it('prepares the device when is required for dfu mode and currently is in normal mode', async () => {
			const device = {
				isOpen: true,
				isInDfuMode: false,
				close: sinon.stub(),
				enterListeningMode: sinon.stub()
			};

			reopenStub.resolves(device);
			await prepareDeviceForFlash({ device, mode: 'dfu' });
			expect(reopenStub).to.have.been.calledOnce;
			expect(reopenInDfuModeStub).to.have.been.calledOnce;
			expect(reopenInNormalStub).to.not.have.been.called;
			expect(device.enterListeningMode).to.not.have.been.called;
		});
		it('prepares the device when is required for dfu mode and currently is in dfu mode', async () => {
			const device = {
				isOpen: true,
				isInDfuMode: true,
				close: sinon.stub(),
				enterListeningMode: sinon.stub()
			};
			reopenStub.resolves(device);
			await prepareDeviceForFlash({ device, mode: 'dfu' });
			expect(reopenStub).to.have.been.calledOnce;
			expect(reopenInDfuModeStub).to.not.have.been.called;
			expect(reopenInNormalStub).to.not.have.been.called;
			expect(device.enterListeningMode).to.not.have.been.called;
		});
	});
	describe('validateDFUSupport', () => {
		let ui;
		beforeEach(() => {
			ui = {
				write: sinon.stub(),
				chalk,
				logDFUModeRequired: sinon.stub(),
				logNormalModeRequired: sinon.stub()
			};
		});
		it('throws an error if the device os version does not support DFU', async () => {
			let error;
			const device = {
				isInDfuMode: false,
				platformId: 32,
				firmwareVersion: '1.0.0',
			};
			try {
				await validateDFUSupport({ device, ui });
			} catch (e) {
				error = e;
			}
			expect(ui.logDFUModeRequired).to.be.called;
			expect(error.message).to.equal('Put the device in DFU mode and try again');
		});
		it('throws an error if the current device os is not defined and the device is not in DFU', async () => {
			let error;
			const device = {
				isInDfuMode: false,
				platformId: 32,
			};
			try {
				await validateDFUSupport({ device, ui });
			} catch (e) {
				error = e;
			}
			expect(ui.logDFUModeRequired).to.be.called;
			expect(error.message).to.equal('Put the device in DFU mode and try again');
		});
		it('passes if the device is in DFU mode', async () => {
			let error;
			const device = {
				isInDfuMode: true,
				platformId: 32,
			};
			try {
				await validateDFUSupport({ device, ui });
			} catch (e) {
				error = e;
			}
			expect(error).to.be.undefined;
		});
		it('passes if the current device OS is greater than - equals to 2.0.0', async () => {
			let error;
			const device = {
				isInDfuMode: false,
				platformId: 32,
				firmwareVersion: '2.0.0',
			};
			try {
				await validateDFUSupport({ device, ui });
			} catch (e) {
				error = e;
			}
			expect(error).to.be.undefined;
		});
	});

	describe('getFileFlashInfo', () => {
		const createBinary = async (moduleFunction, platformId) => {
			const tempPath = 'flash-mode/binaries';
			const fileName = 'my-binary.bin';
			const binary = firmwareTestHelper.createFirmwareBinary({
				platformId: platformId,
				moduleFunction: moduleFunction,
			});
			// save binary
			const filePath = path.join(PATH_TMP_DIR, tempPath);
			const file = path.join(filePath, fileName);
			await ensureDir(filePath);
			await fs.writeFile(file, binary);
			return file;
		};

		afterEach(async () => {
			await fs.remove(path.join(PATH_TMP_DIR, 'flash-mode/binaries'));
		});

		it('returns dfu for known apps', async() => {
			const fileName = 'tinker';
			const mode = await getFileFlashInfo(fileName);
			expect(mode).to.deep.equal({ flashMode: 'DFU' });
		});
		it('returns dfu for system parts', async () => {
			const p2PlatformId = 32;
			const file = await createBinary(ModuleInfo.FunctionType.SYSTEM_PART, p2PlatformId);
			const mode = await getFileFlashInfo(file);
			expect(mode).to.deep.equal({ flashMode: 'DFU', platformId: 32 });
		});

		it('returns normal for bootloader', async() => {
			const p2PlatformId = 32;
			const file = await createBinary(ModuleInfo.FunctionType.BOOTLOADER, p2PlatformId);
			const mode = await getFileFlashInfo(file);
			expect(mode).to.deep.equal({ flashMode: 'NORMAL', platformId: 32 });
		});

		it ('returns normal for ncp', async() => {
			const trackerPlatformId = 26;
			const file = await createBinary(ModuleInfo.FunctionType.NCP_FIRMWARE, trackerPlatformId);
			const mode = await getFileFlashInfo(file);
			expect(mode).to.deep.equal({ flashMode: 'NORMAL', platformId: 26 });
		});

	});
});
