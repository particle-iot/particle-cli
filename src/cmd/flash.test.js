const { expect } = require('../../test/setup');
const sinon = require('sinon');
const fs = require('fs-extra'); // Use fs-extra instead of fs
const Flash = require('./flash');
const usbUtils = require('./usb-util');
const particleUsb = require('particle-usb');
const platforms = require('@particle/device-constants');



describe('flash', () => {
	describe('_parseLocalFlashArguments', () => {
		let flash;

		beforeEach(() => {
			flash = new Flash();
		});

		afterEach(() => {
			sinon.restore();
		});

		it('should parse local flash arguments with valid binary', async () => {
			const binary = 'path/to/binary';
			const files = ['file1', 'file2'];
			sinon.stub(fs, 'stat').resolves({ isFile: () => true, isDirectory: () => false });

			const result = await flash._parseLocalFlashArguments({ binary, files });

			expect(result.device).to.be.undefined;
			expect(result.files).to.deep.equal([binary,...files]);
		});

		it('should parse local flash arguments with nonexistent binary', async () => {

			const binary = 'e00fce68f15867a3c4762226';
			const files = ['file1', 'file2'];
			const error = new Error('File not found');
			sinon.stub(fs, 'stat').rejects(error);

			const result = await flash._parseLocalFlashArguments({ binary, files });

			expect(result.device).to.equal(binary);
			expect(result.files).to.deep.equal(files);
		});

		it('should parse local flash arguments with missing binary and files', async () => {
			const binary = undefined;
			const files = [];
			const result = await flash._parseLocalFlashArguments({ binary, files });

			expect(result.device).to.be.undefined;
			expect(result.files).to.deep.equal(['.']);
		});

		it('should parse local flash arguments without files', async () => {
			const binary = './';
			const files = [];
			const result = await flash._parseLocalFlashArguments({ binary, files });

			expect(result.device).to.be.undefined;
			expect(result.files).to.deep.equal([binary]);
		});

		it('should parse local flash with deviceId and nothing else', async () => {
			const binary = '00fce68f15867a3c4762226';
			const files = [];
			const result = await flash._parseLocalFlashArguments({ binary, files });
			expect(result.device).to.equal(binary);
			expect(result.files).to.deep.equal(['.']);
		});

		it('should push just files if binary is a deviceId and files are specified', async () => {
			const binary = '00fce68f15867a3c4762226';
			const files = ['file1', 'file2'];
			const result = await flash._parseLocalFlashArguments({ binary, files });
			expect(result.device).to.equal(binary);
			expect(result.files).to.deep.equal(files);
		});
	});

	describe('_getDevice', async () => {
		let flash;
		beforeEach(() => {
			flash = new Flash();
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
			flash = new Flash();
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
