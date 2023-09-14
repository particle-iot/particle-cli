const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const temp = require('temp').track();
const { HalModuleParser, ModuleInfo, updateModulePrefix } = require('binary-version-reader');
const utilities = require('./utilities');
const { expect, sinon } = require('../../test/setup');
const dfu = require('./dfu');

describe('DFU', () => {
	const sandbox = sinon.createSandbox();
	const FIXTURES_DIR = path.join(__dirname, '../../test/__fixtures__');

	afterEach(() => {
		sandbox.restore();
	});

	it('finds Particle devices in dfu-util -l output', () => {
		const filename = path.join(FIXTURES_DIR, 'dfu/only_particle.txt');
		const output = fs.readFileSync(filename).toString();
		const devices = dfu._dfuIdsFromDfuOutput(output);

		expect(devices).to.be.an('array');
		expect(devices).to.have.lengthOf(1);
		expect(devices[0]).to.equal('2b04:d006');
	});

	it('filters out non-Particle devices in dfu-util -l output', () => {
		const filename = path.join(FIXTURES_DIR, 'dfu/mixed.txt');
		const output = fs.readFileSync(filename).toString();
		const devices = dfu._dfuIdsFromDfuOutput(output);

		expect(devices).to.be.an('array');
		expect(devices).to.have.lengthOf(1);
		expect(devices[0]).to.equal('2b04:d00a');
	});

	it('handles no devices output', () => {
		const filename = path.join(FIXTURES_DIR, 'dfu/none.txt');
		const output = fs.readFileSync(filename).toString();
		const devices = dfu._dfuIdsFromDfuOutput(output);

		expect(devices).to.be.an('array');
		expect(devices).to.have.lengthOf(0);
	});

	it('pads to 2 on the core', () => {
		sandbox.stub(dfu, 'appendToEvenBytes');
		const specs = dfu.specsForPlatform(0);
		const file = 'abcd';

		dfu.checkBinaryAlignment(file, specs);

		expect(dfu.appendToEvenBytes).to.have.property('callCount', 1);
		expect(dfu.appendToEvenBytes.firstCall.args).to.eql([file]);
	});

	it('does not pad on other platforms', () => {
		sandbox.stub(dfu, 'appendToEvenBytes');
		const specs = dfu.specsForPlatform(6);
		const file = 'abcd';

		dfu.checkBinaryAlignment(file, specs);

		expect(dfu.appendToEvenBytes).to.have.property('callCount', 0);
	});

	it('times out when unable to list dfu devices', () => {
		sandbox.useFakeTimers();
		sandbox.stub(childProcess, 'exec');
		const promise = dfu.listDFUDevices();

		sandbox.clock.tick(6001);

		return promise
			.then(() => {
				throw new Error('Promise should have been rejected');
			})
			.catch((error) => {
				expect(error).to.be.instanceof(Error);
				expect(error.message).to.equal('Timed out attempting to list DFU devices');
			});
	});

	describe('writeDfu', () => {
		it('uses the last selected device by default', async () => {
			sandbox.stub(dfu, 'dfuId').value('1234:5678');
			sandbox.stub(utilities, 'deferredSpawnProcess').resolves({ stdout: [] });
			const file = path.join(FIXTURES_DIR, 'binaries/boron_blank.bin');
			await dfu.writeDfu(1, file, '0xd4000', false);
			expect(utilities.deferredSpawnProcess).to.be.calledWith('dfu-util', ['-d', '1234:5678', '-a', 1, '-i', '0', '-s',
				'0xd4000', '-D', file]);
		});

		it('allows specifying vendor/product IDs and serial number of the target device explicitly', async () => {
			sandbox.stub(utilities, 'deferredSpawnProcess').resolves({ stdout: [] });
			const file = path.join(FIXTURES_DIR, 'binaries/boron_blank.bin');
			await dfu.writeDfu(1, file, '0xd4000', false, { vendorId: 0x1234, productId: 0x5678, serial: 'abc' });
			expect(utilities.deferredSpawnProcess).to.be.calledWith('dfu-util', ['-d', '1234:5678', '-a', 1, '-i', '0', '-s',
				'0xd4000', '-D', file, '-S', 'abc']);
		});
	});

	describe('writeModule', () => {
		let mockDevice;
		let file;
		let parsedInfo;
		let startAddr;
		let fileBuffer;
		beforeEach(async () => {
			mockDevice = {
				writeOverDfu: sinon.stub(),
			};
			file = path.join(FIXTURES_DIR, 'binaries/boron_blank.bin');
			const parser = new HalModuleParser();
			parsedInfo = await parser.parseFile(file);
			fileBuffer = parsedInfo.fileBuffer;
			startAddr = parseInt(parsedInfo.prefixInfo.moduleStartAddy, 16);
		});

		it('writes the module binary using the interface number defined for the module', async() => {
			sandbox.stub(dfu, '_platformForId').withArgs(13).returns({
				firmwareModules: [
					{ type: 'userPart', storage: 'internalFlash' }
				],
				dfu: {
					storage: [
						{ type: 'internalFlash', alt: 123 }
					]
				}
			});
			const file = path.join(FIXTURES_DIR, 'binaries/boron_blank.bin');
			await dfu.writeModule(mockDevice, file);
			expect(mockDevice.writeOverDfu).to.have.been.calledOnce;
			expect(mockDevice.writeOverDfu).to.be.calledWith(fileBuffer, {altSetting: 123, startAddr: startAddr, leave: undefined });
		});

		it('allows specifying vendor/product IDs and serial number of the target device explicitly', async () => {
			const file = path.join(FIXTURES_DIR, 'binaries/boron_blank.bin');
			await dfu.writeModule(mockDevice, file, { vendorId: 0x1234, productId: 0x5678, serial: 'abc' });

			expect(mockDevice.writeOverDfu).to.have.been.calledOnce;
			expect(mockDevice.writeOverDfu).to.be.calledWith(fileBuffer, { altSetting: sinon.match.number, startAddr: startAddr, leave: undefined})
		});

		it('can optionally write to the address and interface defined by a segment name', async () => {
			sandbox.stub(dfu, 'dfuId').value('2b04:d00d');
			sandbox.stub(dfu, '_deviceSpecForDfuId').withArgs('2b04:d00d').returns({
				abc: {
					address: '0x1234',
					alt: 123
				}
			});
			const file = path.join(FIXTURES_DIR, 'binaries/boron_blank.bin');
			await dfu.writeModule(mockDevice, file, { segmentName: 'abc' });

			expect(mockDevice.writeOverDfu).to.have.been.calledOnce;
			expect(mockDevice.writeOverDfu).to.be.calledWith(fileBuffer, { altSetting: 123, startAddr: 4660 /* 0x1234 */, leave: undefined });
		});

		// it('drops the module header if the corresponding flag is set in the module header', async () => {
		// 	let file = path.join(FIXTURES_DIR, 'binaries/boron_blank.bin');
		// 	const binary = fs.readFileSync(file);
		// 	const parser = new HalModuleParser();
		// 	const prefix = await parser.parsePrefix({ fileBuffer: binary });
		// 	updateModulePrefix(binary, { ...prefix, moduleFlags: prefix.moduleFlags | ModuleInfo.Flags.DROP_MODULE_INFO });
		// 	file = temp.openSync();
		// 	fs.writeSync(file.fd, binary);
		// 	fs.closeSync(file.fd);
		// 	await dfu.writeModule(file.path);
		// 	expect(dfu.writeDfu).to.be.called;
		// 	const flashedBinary = fs.readFileSync(dfu.writeDfu.firstCall.args[1]);
		// 	expect(flashedBinary.equals(binary.slice(ModuleInfo.MODULE_PREFIX_SIZE))).to.be.true;
		// });
	});

	describe('interfaceForModule', () => {
		const platform = {
			firmwareModules: [
				{ type: 'bootloader', storage: 'internalFlash' },
				{ type: 'systemPart', storage: 'internalFlash' },
				{ type: 'userPart', storage: 'internalFlash' },
				{ type: 'radioStack', storage: 'internalFlash' },
				{ type: 'ncpFirmware', storage: 'externalMcu' }
			],
			dfu: {
				storage: [
					{ type: 'internalFlash', alt: 1 },
					{ type: 'externalFlash', alt: 2 },
					{ type: 'externalMcu', alt: 3 }
				]
			}
		};

		it('returns the interface number defined for the specified module type', () => {
			// System part
			sandbox.stub(dfu, '_platformForId').withArgs(12).returns({
				...platform,
				firmwareModules: [
					{ type: 'systemPart', storage: 'externalFlash' }
				]
			});
			let alt = dfu.interfaceForModule(ModuleInfo.FunctionType.SYSTEM_PART, 1, 12);
			expect(alt).to.equal(2);
			// User part
			dfu._platformForId.withArgs(12).returns({
				...platform,
				firmwareModules: [
					{ type: 'userPart', storage: 'externalFlash' }
				]
			});
			alt = dfu.interfaceForModule(ModuleInfo.FunctionType.USER_PART, 0, 12);
			expect(alt).to.equal(2);
			// Radio stack
			dfu._platformForId.withArgs(12).returns({
				...platform,
				firmwareModules: [
					{ type: 'radioStack', storage: 'externalFlash' }
				]
			});
			alt = dfu.interfaceForModule(ModuleInfo.FunctionType.RADIO_STACK, 0, 12);
			expect(alt).to.equal(2);
			// NCP firmware
			dfu._platformForId.withArgs(12).returns({
				...platform,
				firmwareModules: [
					{ type: 'ncpFirmware', storage: 'externalFlash' }
				]
			});
			alt = dfu.interfaceForModule(ModuleInfo.FunctionType.NCP_FIRMWARE, 0, 12);
			expect(alt).to.equal(2);
		});

		it('requires the module indices to match if the platform has multiple modules of the specified type', () => {
			sandbox.stub(dfu, '_platformForId').withArgs(12).returns({
				...platform,
				firmwareModules: [
					{ type: 'systemPart', index: 1, storage: 'internalFlash' },
					{ type: 'systemPart', index: 2, storage: 'externalFlash' }
				]
			});
			let alt = dfu.interfaceForModule(ModuleInfo.FunctionType.SYSTEM_PART, 1, 12);
			expect(alt).to.equal(1);
			alt = dfu.interfaceForModule(ModuleInfo.FunctionType.SYSTEM_PART, 2, 12);
			expect(alt).to.equal(2);
			alt = dfu.interfaceForModule(ModuleInfo.FunctionType.SYSTEM_PART, 3, 12);
			expect(alt).to.be.null;
		});

		it('ignores the module index if the platform has only one module of the specified type', () => {
			sandbox.stub(dfu, '_platformForId').withArgs(12).returns({
				...platform,
				firmwareModules: [
					{ type: 'systemPart',storage: 'internalFlash' }
				]
			});
			const alt = dfu.interfaceForModule(ModuleInfo.FunctionType.SYSTEM_PART, 3, 12);
			expect(alt).to.equal(1);
		});

		it('returns null when called with the bootloader module type', () => {
			sandbox.stub(dfu, '_platformForId').withArgs(12).returns({
				...platform,
				firmwareModules: [
					{ type: 'bootloader', storage: 'internalFlash' }
				]
			});
			const alt = dfu.interfaceForModule(ModuleInfo.FunctionType.BOOTLOADER, 0, 12);
			expect(alt).to.be.null;
		});

		it('returns null if the platform does not have a module of the specified type', () => {
			sandbox.stub(dfu, '_platformForId').withArgs(12).returns({
				...platform,
				firmwareModules: [
					{ type: 'systemPart', storage: 'internalFlash' },
					{ type: 'userPart', storage: 'internalFlash' }
				]
			});
			const alt = dfu.interfaceForModule(ModuleInfo.FunctionType.RADIO_STACK, 0, 12);
			expect(alt).to.be.null;
		});

		it('returns null if the module\'s storage has no interface number defined', () => {
			sandbox.stub(dfu, '_platformForId').withArgs(12).returns({
				...platform,
				firmwareModules: [
					{ type: 'systemPart', storage: 'internalFlash' },
					{ type: 'ncpFirmware', storage: 'externalMcu' }
				],
				dfu: {
					storage: [
						{ type: 'internalFlash', alt: 1 }
					]
				}
			});
			const alt = dfu.interfaceForModule(ModuleInfo.FunctionType.NCP_FIRMWARE, 0, 12);
			expect(alt).to.be.null;
		});

		it('returns the interface number defined for the system part modules when called with the monolithic module type', () => {
			sandbox.stub(dfu, '_platformForId').withArgs(12).returns({
				...platform,
				firmwareModules: [
					{ type: 'systemPart', index: 1, storage: 'internalFlash' },
					{ type: 'systemPart', index: 2, storage: 'internalFlash' }
				]
			});
			const alt = dfu.interfaceForModule(ModuleInfo.FunctionType.MONO_FIRMWARE, 0, 12);
			expect(alt).to.equal(1);
		});
	});
});

