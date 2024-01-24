const MockSerial = require('../../test/__mocks__/serial.mock');
const { expect, sinon } = require('../../test/setup');
const SerialCommand = require('./serial');
const usbUtils = require('./usb-util');

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
		it('identifies a cellular device with dvos over serial', async () => {
			const deviceId = '1234456789abcdef';
			const fwVer = '5.4.0';
			const imei = '1234';
			const iccid = '5678';
			const wifiDeviceFromSerialPort = {
				'specs': {
					'name': 'boron'
				},
				deviceId
			};

			const device = {
				isOpen: true,
				close: sinon.stub(),
				_fwVer: fwVer,
				getIccid: sinon.stub().resolves({ iccid, imei }),
			};
			deviceStub.resolves(device);
			sinon.stub(serial, 'whatSerialPortDidYouMean').resolves(wifiDeviceFromSerialPort);
			sinon.stub(serial, '_printIdentifyInfo').resolves();

			await serial.identifyDevice({ port: 'xyz' });

			expect(serial._printIdentifyInfo).to.have.been.calledOnce.and.calledWithExactly({
				deviceId,
				fwVer,
				isCellular: true,
				cellularImei: imei,
				cellularIccid: iccid,
			});
		});

		it('identifies a wifi device', async () => {
			const deviceId = '1234456789abcdef';
			const fwVer = '5.4.0';
			const wifiDeviceFromSerialPort = {
				'specs': {
					'name': 'p2'
				},
				deviceId
			};
			const device = {
				isOpen: true,
				close: sinon.stub(),
				_fwVer: fwVer
			};
			deviceStub.resolves(device);
			sinon.stub(serial, 'whatSerialPortDidYouMean').resolves(wifiDeviceFromSerialPort);
			sinon.stub(serial, '_printIdentifyInfo').resolves();

			await serial.identifyDevice({ port: 'xyz' });

			expect(serial._printIdentifyInfo).to.have.been.calledOnce.and.calledWithExactly({
				deviceId,
				fwVer,
				isCellular: false,
				cellularImei: '',
				cellularIccid: '',
			});
		});
	});

	describe('inspectDevice', () => {
		it('inspects a Particle device', async () => {
			const fwVer = '5.6.0';
			const wifiDeviceFromSerialPort = {
				'specs': {
					'name': 'p2'
				},
				deviceId: '1234456789abcdef'
			};

			const device = {
				isOpen: true,
				close: sinon.stub(),
				_fwVer: fwVer

			};
			deviceStub.resolves(device);
			sinon.stub(serial, 'whatSerialPortDidYouMean').resolves(wifiDeviceFromSerialPort);
			sinon.stub(serial, '_getModuleInfo').resolves(true);

			await serial.inspectDevice({ port: 'xyz' });

			expect(serial._getModuleInfo).to.have.been.called;
		});

		it('does not get module info if device id is not obtained', async () => {
			const fwVer = '5.6.0';
			const device = {
				isOpen: true,
				close: sinon.stub(),
				_fwVer: fwVer

			};
			deviceStub.resolves(device);
			sinon.stub(serial, 'whatSerialPortDidYouMean').rejects('There was an error');
			sinon.stub(serial, '_getModuleInfo').resolves(true);

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
				'specs': {
					'name': 'p2'
				},
				deviceId: '1234456789abcdef'
			};
			const device = {
				isOpen: true,
				close: sinon.stub(),
				_fwVer: fwVer,
				getNetworkInterfaceList: sinon.stub().resolves([
					{
						index: 4,
						name: 'wl3',
						type: 8
					}
				]),
				getNetworkInterface: sinon.stub().resolves({
					hwAddr: {
						address: [1,2,3,4,5,6],
						size: 6
					}
				})
			};
			deviceStub.resolves(device);
			sinon.stub(serial, 'whatSerialPortDidYouMean').resolves(wifiDeviceFromSerialPort);

			const macAddress = await serial.deviceMac({ port: 'xyz' });

			expect(macAddress).to.deep.equal([1, 2, 3, 4, 5, 6]);
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

