const MockSerial = require('../../test/__mocks__/serial.mock');
const { expect, sinon } = require('../../test/setup');
const SerialCommand = require('./serial');
const usbUtils = require('./usb-util');
const { PlatformId } = require('../lib/platform');

describe('Serial Command', () => {
	let serial;
	let clock;
	let deviceStub;

	beforeEach(() => {
		serial = new SerialCommand({ params: {} });
		deviceStub = sinon.stub(usbUtils, 'getOneUsbDevice');
	});

	afterEach(() => {
		sinon.restore();
		if (clock !== undefined) {
			clock.restore();
			clock = undefined;
		}
	});

	describe('identifyDevice', () => {
		it('identifies a cellular device', async () => {
			const deviceId = '1234456789abcdef';
			const fwVer = '6.1.0';
			const imei = '1234';
			const iccid = '5678';
			const cellularDeviceFromSerialPort = {
				deviceId
			};

			const device = {
				isOpen: true,
				close: sinon.stub(),
				firmwareVersion: fwVer,
				platformId: PlatformId.BORON,
				getCellularInfo: sinon.stub().resolves({ iccid, imei }),
			};
			deviceStub.resolves(device);
			sinon.stub(serial, 'whatSerialPortDidYouMean').resolves(cellularDeviceFromSerialPort);
			sinon.stub(usbUtils, 'executeWithUsbDevice').resolves({ fwVer, cellularImei: imei, cellularIccid: iccid });

			await serial.identifyDevice({ port: 'xyz' });

			expect(usbUtils.executeWithUsbDevice).to.have.been.calledOnce;
		});

		it('identifies a wifi device', async () => {
			const deviceId = '1234456789abcdef';
			const fwVer = '5.4.0';
			const wifiDeviceFromSerialPort = {
				deviceId
			};
			const device = {
				isOpen: true,
				close: sinon.stub(),
				platformId: PlatformId.P2,
				firmwareVersion: fwVer
			};
			deviceStub.resolves(device);
			sinon.stub(serial, 'whatSerialPortDidYouMean').resolves(wifiDeviceFromSerialPort);
			sinon.stub(usbUtils, 'executeWithUsbDevice').resolves({ fwVer, cellularImei: '', cellularIccid: '' });

			await serial.identifyDevice({ port: 'xyz' });

			expect(usbUtils.executeWithUsbDevice).to.have.been.calledOnce;
		});
	});

	describe('inspectDevice', () => {
		it('inspects a Particle device', async () => {
			const fwVer = '5.6.0';
			const wifiDeviceFromSerialPort = {
				deviceId: '1234456789abcdef'
			};

			const device = {
				isOpen: true,
				close: sinon.stub(),
				platformId: PlatformId.P2,
				firmwareVersion: fwVer,
				getFirmwareModuleInfo: sinon.stub()
			};
			deviceStub.resolves(device);
			sinon.stub(serial, 'whatSerialPortDidYouMean').resolves(wifiDeviceFromSerialPort);
			sinon.stub(usbUtils, 'executeWithUsbDevice').resolves({ platform: PlatformId.P2, modules: {} });

			await serial.inspectDevice({ port: 'xyz' });

			expect(usbUtils.executeWithUsbDevice).to.have.been.called;
		});

		it('does not get module info if device id is not obtained', async () => {
			const fwVer = '5.6.0';
			const device = {
				isOpen: true,
				close: sinon.stub(),
				firmwareVersion: fwVer
			};
			deviceStub.resolves(device);
			sinon.stub(serial, 'whatSerialPortDidYouMean').rejects('There was an error');

			let error;
			try {
				await serial.inspectDevice({ port: 'xyz' });
			} catch (_e) {
				error = _e;
			}

			expect(error).to.be.an.instanceOf(Error);
			expect(error).to.have.property('message', 'Could not inspect device: ');
		});
	});

	describe('deviceMac', async () => {
		it ('returns mac address of a device', async () => {
			const fwVer = '5.6.0';
			const wifiDeviceFromSerialPort = {
				deviceId: '1234456789abcdef'
			};
			const device = {
				isOpen: true,
				close: sinon.stub(),
				firmwareVersion: fwVer,
				getNetworkInterfaceList: sinon.stub().resolves([
					{
						index: 4,
						name: 'wl3',
						type: 'WIFI'
					}
				]),
				getNetworkInterface: sinon.stub().resolves({ hwAddress: '01:02:03:04:05:06' })
			};
			deviceStub.resolves(device);
			sinon.stub(serial, 'whatSerialPortDidYouMean').resolves(wifiDeviceFromSerialPort);
			sinon.stub(usbUtils, 'executeWithUsbDevice').resolves({ macAddress: '01:02:03:04:05:06', currIfaceName: 'WiFi' });

			await serial.deviceMac({ port: 'xyz' });

			expect(usbUtils.executeWithUsbDevice).to.have.been.calledOnce;
		});
	});

	describe('serialWifiConfig', async () => {
		it('can reject with timeout after 5000ms if not getting any serial data', async () => {
			clock = sinon.useFakeTimers();
			const device = { port: 'baltimore' };
			const mockSerial = new MockSerial();

			mockSerial.write = function write(data) {
				if (data === 'w') {
					// This next tick allows _serialWifiConfig to set the timeout before we move the clock foward.
					process.nextTick(() => {
						clock.tick(5010);
					});
				}
			};

			serial.serialPort = mockSerial;

			let error;

			try {
				await serial._serialWifiConfig(device);
			} catch (e) {
				error = e;
			}

			expect(error).to.be.an.instanceOf(Error);
			expect(error).to.have.property('name', 'InitialTimeoutError');
		});
	});
});

