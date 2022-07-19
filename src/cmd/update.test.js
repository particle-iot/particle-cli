const { UsbPermissionsError } = require('./usb-util');
const settings = require('../../settings');
const { expect, sinon } = require('../../test/setup');

const { ModuleInfo } = require('binary-version-reader');
const proxyquire = require('proxyquire');
const _ = require('lodash');

const { randomBytes } = require('crypto');
const path = require('path');

const DEVICE_ID = '111111111111111111111111';
const PLATFORM_ID = 13;

const stubs = {
	usb: {
		getUsbDevices: sinon.stub(),
		openUsbDevice: sinon.stub(),
		openUsbDeviceById: sinon.stub(),
		openUsbDeviceByIdOrName: sinon.stub()
	},
	dfu: {
		writeModule: sinon.stub(),
		interfaceForModule: sinon.stub(),
		isDfuUtilInstalled: sinon.stub()
	},
	platform: {
		platformForId: sinon.stub(),
		isKnownPlatformId: sinon.stub()
	},
	ui: {
		spin: sinon.stub()
	},
	util: {
		delay: sinon.stub()
	},
	binaryVersionReader: {
		HalModuleParser: sinon.stub()
	},
	inquirer: {
		prompt: sinon.stub()
	},
	fs: {
		readFileSync: sinon.stub()
	}
};

const UpdateCommand = proxyquire('./update', {
	'./usb-util': { ...stubs.usb }, // proxyquire modifies stub objects
	'../lib/dfu': { ...stubs.dfu },
	'../../platform': { ...stubs.platform },
	'../app/ui': { ...stubs.ui },
	'../lib/utilities': { ...stubs.util },
	'binary-version-reader': { ...stubs.binaryVersionReader },
	'inquirer': { ...stubs.inquirer },
	'fs': { ...stubs.fs }
});

class UsbDeviceMock {
	constructor(id = DEVICE_ID, firmwareVersion = '2.0.0') {
		this._wasReset = false;
		this.id = null;
		this.firmwareVersion = null;
		this.platformId = PLATFORM_ID;
		this.vendorId = 0x1234;
		this.productId = 0x5678;
		this.isInDfuMode = false;
		this.isOpen = false;
		this.updateFirmware = sinon.stub().resolves();
		this.disconnectFromCloud = sinon.stub().resolves();
		this.enterListeningMode = sinon.stub().resolves();
		this.enterDfuMode = sinon.stub().callsFake(async () => {
			this.isInDfuMode = true;
		});
		this.reset = sinon.stub().callsFake(async () => {
			this._wasReset = true;
		});
		this.open = sinon.stub().callsFake(async () => {
			if (this._wasReset) {
				this.isInDfuMode = false;
				this._wasReset = false;
			}
			this.id = id;
			this.firmwareVersion = firmwareVersion;
			this.isOpen = true;
		});
		this.close = sinon.stub().callsFake(async () => {
			this.isOpen = false;
		});
	}
}

class HalModuleParserMock {
	constructor(file, moduleFunction = ModuleInfo.FunctionType.SYSTEM_PART, moduleIndex = 1) {
		this.parseFile = sinon.stub().rejects(new Error('File not found'));
		if (file) {
			this.parseFile.withArgs(file).resolves({
				prefixInfo: { moduleFunction, moduleIndex, platformID: PLATFORM_ID }
			});
		}
	}
}

function modulePath(file) {
	return path.resolve(__dirname, '../../assets/updates', file);
}

describe('UpdateCommand', () => {
	let device; // Last open USB device
	let devicesById;

	beforeEach(() => {
		device = null;
		devicesById = new Map();
		stubs.usb.getUsbDevices.callsFake(async () => {
			const dev = new UsbDeviceMock();
			return [dev];
		});
		stubs.usb.openUsbDevice.callsFake(async (dev) => {
			await dev.open();
			devicesById.set(dev.id, dev);
			device = dev;
		});
		stubs.usb.openUsbDeviceById.callsFake(async (id) => {
			let dev = devicesById.get(id);
			expect(dev).to.be.ok;
			await stubs.usb.openUsbDevice(dev);
			return dev;
		});
		stubs.usb.openUsbDeviceByIdOrName.callsFake(async (idOrName) => {
			return await stubs.usb.openUsbDeviceById(idOrName);
		});
		stubs.dfu.writeModule.resolves();
		stubs.dfu.interfaceForModule.returns(null); // Flash via control requests by default
		stubs.dfu.isDfuUtilInstalled.resolves(true);
		stubs.platform.platformForId.callsFake((id) => {
			expect(id).to.equal(PLATFORM_ID);
			return {
				id: PLATFORM_ID,
				name: 'test',
				displayName: 'Test',
				generation: 3
			};
		});
		stubs.platform.isKnownPlatformId.callsFake((id) => id === PLATFORM_ID);
		stubs.ui.spin.callsFake((promise) => promise);
		stubs.util.delay.resolves();
		sinon.stub(settings, 'updates').value({
			[PLATFORM_ID]: ['module.bin']
		});
		stubs.binaryVersionReader.HalModuleParser.returns(new HalModuleParserMock(modulePath('module.bin')));
		stubs.inquirer.prompt.callsFake((q) => {
			expect(q.name).to.be.string;
			expect(q.choices).to.not.be.empty;
			return { [q.name]: q.choices[0].value };
		});
		stubs.fs.readFileSync.returns(randomBytes(100));
		sinon.stub(process, 'exit').throws(new Error('process.exit() called'));
		sinon.stub(console, 'log'); // Suppress console output
	});

	afterEach(() => {
		sinon.restore();
		// Reset the stubs used through proxyquire
		_.forEach(stubs, (stubs) => _.forEach(stubs, (stub) => stub.reset()));
	});

	it('can flash a module binary using DFU', async () => {
		stubs.dfu.interfaceForModule.returns(1);
		const cmd = new UpdateCommand();
		await cmd.updateDevice();
		expect(device).to.be.ok;
		expect(stubs.dfu.writeModule).to.be.calledWith(modulePath('module.bin'), sinon.match({
			vendorId: device.vendorId,
			productId: device.productId,
			serial: device.id,
			leave: true
		}));
	});

	it('can flash a module binary using control requests', async () => {
		stubs.dfu.interfaceForModule.returns(null);
		const cmd = new UpdateCommand();
		await cmd.updateDevice();
		expect(device).to.be.ok;
		expect(stubs.fs.readFileSync).to.be.calledWith(modulePath('module.bin'));
		expect(device.updateFirmware).to.be.calledWith(stubs.fs.readFileSync.firstCall.returnValue);
	});

	it('switches the device between DFU and normal modes as necessary', async () => {
		sinon.stub(settings, 'updates').value({
			[PLATFORM_ID]: [
				'bootloader.bin', // Flashed via control requests
				'system-part1.bin', // Flashed via DFU
				'ncp-firmware.bin', // Flashed via control requests
				'system-part2.bin' // Flashed via DFU
			]
		});
		stubs.binaryVersionReader.HalModuleParser.callsFake(() => {
			const parser = new HalModuleParserMock();
			parser.parseFile.withArgs(modulePath('bootloader.bin')).resolves({
				prefixInfo: { moduleFunction: ModuleInfo.FunctionType.BOOTLOADER, moduleIndex: 0, platformID: PLATFORM_ID }
			});
			parser.parseFile.withArgs(modulePath('system-part1.bin')).resolves({
				prefixInfo: { moduleFunction: ModuleInfo.FunctionType.SYSTEM_PART, moduleIndex: 1, platformID: PLATFORM_ID }
			});
			parser.parseFile.withArgs(modulePath('system-part2.bin')).resolves({
				prefixInfo: { moduleFunction: ModuleInfo.FunctionType.SYSTEM_PART, moduleIndex: 2, platformID: PLATFORM_ID }
			});
			parser.parseFile.withArgs(modulePath('ncp-firmware.bin')).resolves({
				prefixInfo: { moduleFunction: ModuleInfo.FunctionType.NCP_FIRMWARE, moduleIndex: 0, platformID: PLATFORM_ID }
			});
			return parser;
		});
		stubs.dfu.interfaceForModule.withArgs(ModuleInfo.FunctionType.BOOTLOADER, sinon.match.number, PLATFORM_ID).returns(null);
		stubs.dfu.interfaceForModule.withArgs(ModuleInfo.FunctionType.SYSTEM_PART, sinon.match.number, PLATFORM_ID).returns(1);
		stubs.dfu.interfaceForModule.withArgs(ModuleInfo.FunctionType.NCP_FIRMWARE, sinon.match.number, PLATFORM_ID).returns(null);
		const cmd = new UpdateCommand();
		await cmd.updateDevice();
		// Validate that the necessary functions were called with expected arguments
		expect(stubs.fs.readFileSync).to.be.calledTwice;
		const readBootloader = stubs.fs.readFileSync.firstCall;
		expect(readBootloader).to.be.calledWith(modulePath('bootloader.bin'));
		const readNcpFirmware = stubs.fs.readFileSync.secondCall;
		expect(readNcpFirmware).to.be.calledWith(modulePath('ncp-firmware.bin'));
		expect(device).to.be.ok;
		expect(device.updateFirmware).to.be.calledTwice;
		const flashBootloader = device.updateFirmware.firstCall;
		expect(flashBootloader).to.be.calledWith(readBootloader.returnValue);
		const flashNcpFirmware = device.updateFirmware.secondCall;
		expect(flashNcpFirmware).to.be.calledWith(readNcpFirmware.returnValue);
		expect(stubs.dfu.writeModule).to.be.calledTwice;
		const flashSystemPart1 = stubs.dfu.writeModule.firstCall;
		expect(flashSystemPart1).to.be.calledWith(modulePath('system-part1.bin'), sinon.match({ leave: false }));
		const flashSystemPart2 = stubs.dfu.writeModule.secondCall;
		expect(flashSystemPart2).to.be.calledWith(modulePath('system-part2.bin'), sinon.match({ leave: true }));
		expect(device.enterDfuMode).to.be.calledTwice;
		const enterDfuMode1 = device.enterDfuMode.firstCall;
		const enterDfuMode2 = device.enterDfuMode.secondCall;
		expect(device.reset).to.be.calledOnce;
		const resetDevice = device.reset.firstCall;
		// Validate that the functions were called in expected order
		expect(enterDfuMode1).to.be.calledAfter(flashBootloader); // Bootloader is flashed first
		expect(flashSystemPart1).to.be.calledAfter(enterDfuMode1);
		expect(resetDevice).to.be.calledAfter(flashSystemPart1); // Reset to exit DFU mode
		expect(flashNcpFirmware).to.be.calledAfter(resetDevice);
		expect(enterDfuMode2).to.be.calledAfter(flashNcpFirmware);
		expect(flashSystemPart2).to.be.calledAfter(enterDfuMode2);
	});

	it('reopens the device before each update and closes it afterwards', async () => {
		sinon.stub(settings, 'updates').value({
			[PLATFORM_ID]: [
				'bootloader.bin', // Flashed via control requests
				'system-part1.bin' // Flashed via DFU
			]
		});
		stubs.binaryVersionReader.HalModuleParser.callsFake(() => {
			const parser = new HalModuleParserMock();
			parser.parseFile.withArgs(modulePath('bootloader.bin')).resolves({
				prefixInfo: { moduleFunction: ModuleInfo.FunctionType.BOOTLOADER, moduleIndex: 0, platformID: PLATFORM_ID }
			});
			parser.parseFile.withArgs(modulePath('system-part1.bin')).resolves({
				prefixInfo: { moduleFunction: ModuleInfo.FunctionType.SYSTEM_PART, moduleIndex: 1, platformID: PLATFORM_ID }
			});
			return parser;
		});
		stubs.dfu.interfaceForModule.withArgs(ModuleInfo.FunctionType.BOOTLOADER, sinon.match.number, PLATFORM_ID).returns(null);
		stubs.dfu.interfaceForModule.withArgs(ModuleInfo.FunctionType.SYSTEM_PART, sinon.match.number, PLATFORM_ID).returns(1);
		const cmd = new UpdateCommand();
		await cmd.updateDevice();
		expect(stubs.usb.openUsbDeviceById).to.be.calledTwice;
		expect(device).to.be.ok;
		expect(device.close).to.be.calledThrice; // Called one extra time when enumerating devices
		expect(device.updateFirmware).to.be.calledOnce;
		expect(device.enterDfuMode).to.be.calledOnce;
		expect(stubs.dfu.writeModule).to.be.calledOnce;
		expect(device.updateFirmware.firstCall).to.be.calledAfter(stubs.usb.openUsbDeviceById.firstCall);
		expect(device.close.secondCall).to.be.calledAfter(device.updateFirmware.firstCall);
		expect(stubs.usb.openUsbDeviceById.secondCall).to.be.calledAfter(device.close.secondCall);
		expect(device.enterDfuMode.firstCall).to.be.calledAfter(stubs.usb.openUsbDeviceById.secondCall);
		expect(device.close.thirdCall).to.be.calledAfter(device.enterDfuMode.firstCall);
		expect(stubs.dfu.writeModule.firstCall).to.be.calledAfter(device.close.thirdCall);
	});

	it('retries opening the device after an error', async () => {
		const dev = new UsbDeviceMock();
		stubs.usb.openUsbDeviceById.onFirstCall().rejects(new Error());
		stubs.usb.openUsbDeviceById.onSecondCall().rejects(new Error());
		stubs.usb.openUsbDeviceById.onThirdCall().callsFake(async () => {
			await stubs.usb.openUsbDevice(dev);
			return dev;
		});
		const cmd = new UpdateCommand();
		await cmd.updateDevice();
		expect(dev.updateFirmware).to.be.called;
	});

	it('does not retry opening the device on a USB permissions error', async () => {
		const dev = new UsbDeviceMock();
		stubs.usb.openUsbDeviceById.onFirstCall().rejects(new UsbPermissionsError());
		stubs.usb.openUsbDeviceById.onThirdCall().callsFake(async () => {
			await stubs.usb.openUsbDevice(dev);
			return dev;
		});
		const cmd = new UpdateCommand();
		await expect(cmd.updateDevice()).to.eventually.be.rejected;
	});

	context('disconnects the device from the cloud before flashing it', () => {
		beforeEach(() => {
			sinon.stub(settings, 'updates').value({
				[PLATFORM_ID]: [
					'bootloader.bin', // Flashed via control requests
					'system-part1.bin' // Flashed via DFU
				]
			});
			stubs.binaryVersionReader.HalModuleParser.callsFake(() => {
				const parser = new HalModuleParserMock();
				parser.parseFile.withArgs(modulePath('bootloader.bin')).resolves({
					prefixInfo: { moduleFunction: ModuleInfo.FunctionType.BOOTLOADER, moduleIndex: 0, platformID: PLATFORM_ID }
				});
				parser.parseFile.withArgs(modulePath('system-part1.bin')).resolves({
					prefixInfo: { moduleFunction: ModuleInfo.FunctionType.SYSTEM_PART, moduleIndex: 1, platformID: PLATFORM_ID }
				});
				return parser;
			});
			stubs.dfu.interfaceForModule.withArgs(ModuleInfo.FunctionType.BOOTLOADER, sinon.match.number, PLATFORM_ID).returns(null);
			stubs.dfu.interfaceForModule.withArgs(ModuleInfo.FunctionType.SYSTEM_PART, sinon.match.number, PLATFORM_ID).returns(1);
		});

		it('Device OS < 2.0.0', async () => {
			const dev = new UsbDeviceMock(DEVICE_ID, '1.4.2');
			dev.isInDfuMode = true;
			stubs.usb.getUsbDevices.resolves([dev]);
			const cmd = new UpdateCommand();
			await cmd.updateDevice();
			expect(dev.enterListeningMode).to.be.calledOnce;
			expect(dev.updateFirmware).to.be.calledOnce;
			expect(dev.updateFirmware.firstCall).to.be.calledAfter(dev.enterListeningMode.firstCall);
		});

		it('Device OS >= 2.0.0', async () => {
			const dev = new UsbDeviceMock(DEVICE_ID, '3.2.0');
			stubs.usb.getUsbDevices.resolves([dev]);
			const cmd = new UpdateCommand();
			await cmd.updateDevice();
			expect(dev.disconnectFromCloud).to.be.calledTwice;
			expect(dev.disconnectFromCloud.firstCall).to.be.calledWith({ force: true });
			expect(dev.disconnectFromCloud.secondCall).to.be.calledWith({ force: true });
			expect(dev.updateFirmware).to.be.calledOnce;
			expect(dev.enterDfuMode).to.be.calledOnce;
			expect(dev.updateFirmware.firstCall).to.be.calledAfter(dev.disconnectFromCloud.firstCall);
			expect(dev.enterDfuMode.firstCall).to.be.calledAfter(dev.disconnectFromCloud.secondCall);
		});
	});

	it('proceeds to flash the device immediately if it\'s the only device available', async () => {
		const dev = new UsbDeviceMock();
		stubs.usb.getUsbDevices.resolves([dev]);
		const cmd = new UpdateCommand();
		await cmd.updateDevice();
		expect(dev.updateFirmware).to.be.called;
	});

	it('prompts the user to select a device if there are multiple devices available', async () => {
		const devs = [
			new UsbDeviceMock('111111111111111111111111'),
			new UsbDeviceMock('222222222222222222222222')
		];
		stubs.usb.getUsbDevices.resolves(devs);
		stubs.inquirer.prompt.callsFake(async (q) => {
			expect(q.name).to.be.string;
			expect(q.choices).to.have.lengthOf.at.least(2);
			return { [q.name]: q.choices[1].value }; // Select the second device
		});
		const cmd = new UpdateCommand();
		await cmd.updateDevice();
		expect(stubs.inquirer.prompt).to.be.calledWith(sinon.match({
			choices: [
				sinon.match({
					value: { id: '111111111111111111111111', platformId: PLATFORM_ID },
				}),
				sinon.match({
					value: { id: '222222222222222222222222', platformId: PLATFORM_ID },
				})
			]
		}));
		expect(devs[1].updateFirmware).to.be.called;
	});

	it('allows specifying the target device via arguments', async () => {
		const devId = '222222222222222222222222';
		const dev = new UsbDeviceMock(devId);
		devicesById.set(devId, dev);
		const cmd = new UpdateCommand();
		await cmd.updateDevice({
			params: {
				device: '222222222222222222222222'
			}
		});
		expect(stubs.inquirer.prompt).to.not.be.called;
		expect(dev.updateFirmware).to.be.called;
	});

	it('fails if dfu-util is not installed', async () => {
		stubs.dfu.isDfuUtilInstalled.resolves(false);
		const cmd = new UpdateCommand();
		expect(() => cmd.updateDevice()).to.throw;
	});
});
