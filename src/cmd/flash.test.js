const { expect, sinon } = require('../../test/setup');
const fs = require('fs-extra'); // Use fs-extra instead of fs
const FlashCommand = require('./flash');
const usbUtils = require('./usb-util');
const particleUsb = require('particle-usb');
const platforms = require('@particle/device-constants');
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
				version: '3.3.1',
				isInDfuMode: false
			};
			// sinon.stub(usbUtil, 'getOneUsbDevice').resolves(device);
		});

		it('returns information about the device', async () => {
			const deviceInfo = await flash._getDeviceInfo();

			expect(deviceInfo).to.eql({
				id: '3c0021000947343432313031',
				platformId: PlatformId.PHOTON,
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

	describe('_getDevice', async () => {
		let flash;
		beforeEach(() => {
			flash = new FlashCommand();
		});

		afterEach(() => {
			sinon.restore();
		});

		it('should get a device by deviceIdentifier', async () => {
			const mockDevice = { id: 'device123' };
			const openUsbDeviceStub = sinon.stub(usbUtils, 'openUsbDeviceByIdOrName').resolves(mockDevice);

			const result = await flash._getDevice('device123');

			expect(openUsbDeviceStub).to.be.calledOnceWithExactly('device123', sinon.match.any, sinon.match.any, { dfuMode: true });
			expect(result).to.deep.equal(mockDevice);
		});

		// TODO (hmontero) : should change once getOneDevice is ready
		it('should get the first available device', async () => {
			const mockDevices = [{ id: 'device123' }];
			const getUsbDevicesStub = sinon.stub(usbUtils, 'getUsbDevices').resolves(mockDevices);
			const openDeviceByIdStub = sinon.stub(particleUsb, 'openDeviceById').resolves(mockDevices[0]);

			const result = await flash._getDevice();

			expect(getUsbDevicesStub.calledOnceWithExactly({ dfuMode: true })).to.be.true;
			expect(openDeviceByIdStub.calledOnceWithExactly('device123')).to.be.true;
			expect(result).to.deep.equal(mockDevices[0]);
		});

		it('should throw an error if no devices are found', async () => {
			sinon.stub(usbUtils, 'getUsbDevices').resolves([]);

			try {
				await flash._getDevice();
			} catch (error) {
				expect(error.message).to.equal('No devices found.');
			}
		});

	});

	describe('_extractDeviceInfo', () => {
		let flash;
		beforeEach(() => {
			flash = new FlashCommand();
		});

		afterEach(() => {
			sinon.restore();
		});

		it('should extract device info from a device', async () => {
			const mockDevice = {
				_id: 'device123',
				serialNumber: 'serial123',
				_fwVer: '4.1.0',
				_info: {
					type: 'boron',
					id: 12,
					dfu: false,
				},
				getDeviceMode: sinon.stub().resolves('LISTENING'),
			};

			const result = await flash._extractDeviceInfo(mockDevice);

			expect(result).to.deep.equal({
				deviceId: mockDevice._id,
				platform: platforms['boron'],
				deviceOsVersion: '4.1.0',
				deviceMode: 'LISTENING'
			});
			expect(mockDevice.getDeviceMode).to.be.calledOnce;
		});

		it('should extract device info from a device with dfu mode', async () => {
			const mockDevice = {
				_id: 'device123',
				serialNumber: 'serial123',
				_fwVer: null,
				_info: {
					type: 'boron',
					id: 12,
					dfu: true,
				},
				getDeviceMode: sinon.stub().rejects('DFU'),
			};

			const result = await flash._extractDeviceInfo(mockDevice);

			expect(result).to.deep.equal({
				deviceId: mockDevice._id,
				platform: platforms['boron'],
				deviceOsVersion: null,
				deviceMode: 'DFU'
			});
			expect(mockDevice.getDeviceMode).to.not.be.called;
		});
	});
});
