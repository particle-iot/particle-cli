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
				getSystemVersion: sinon.stub().resolves(fwVer),
				getImei: sinon.stub().resolves(imei),
				getIccid: sinon.stub().resolves(iccid),
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
				getSystemVersion: sinon.stub().resolves(fwVer)
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
		it('inspects a device with device-os 5.6.0', async () => {
			const wifiDeviceFromSerialPort = {
				'specs': {
					'name': 'p2'
				},
				deviceId: '1234456789abcdef'
			};

			const device = {
				isOpen: true,
				close: sinon.stub(),
				getSystemVersion: sinon.stub().resolves('5.6.0'),

			};
			deviceStub.resolves(device);
			sinon.stub(serial, 'whatSerialPortDidYouMean').resolves(wifiDeviceFromSerialPort);
			sinon.stub(serial, '_getModuleInfoOlderFormat').resolves({});
			sinon.stub(serial, '_getModuleInfo').resolves({});

			await serial.inspectDevice({ port: 'xyz' });

			expect(serial._getModuleInfoOlderFormat).to.not.have.been.called;
			expect(serial._getModuleInfo).to.have.been.called;
		});

		it('inspects a device with device-os which has the older module format', async () => {
			const wifiDeviceFromSerialPort = {
				'specs': {
					'name': 'p2'
				},
				deviceId: '1234456789abcdef'
			};

			const device = {
				isOpen: true,
				close: sinon.stub(),
				getSystemVersion: sinon.stub().resolves('5.4.0')

			};
			deviceStub.resolves(device);
			sinon.stub(serial, 'whatSerialPortDidYouMean').resolves(wifiDeviceFromSerialPort);
			sinon.stub(serial, '_getModuleInfoOlderFormat').resolves({});
			sinon.stub(serial, '_getModuleInfo').resolves(false);

			await serial.inspectDevice({ port: 'xyz' });

			expect(serial._getModuleInfoOlderFormat).to.have.been.calledOnce;
			expect(serial._getModuleInfo).to.have.been.calledOnce;
		});
	});

	describe('supportsClaimCode', () => {
		it ('checks if device is claimed', async () => {
			const wifiDeviceFromSerialPort = {
				'specs': {
					'name': 'p2'
				},
				deviceId: '1234456789abcdef'
			};

			const device = {
				isOpen: true,
				close: sinon.stub(),
				getSystemVersion: sinon.stub().resolves('5.4.0'),
				isClaimed: sinon.stub().resolves(true)

			};
			let error;
			deviceStub.resolves(device);
			sinon.stub(serial, 'whatSerialPortDidYouMean').resolves(wifiDeviceFromSerialPort);

			try {
				await serial.supportsClaimCode(wifiDeviceFromSerialPort);
			} catch (_e) {
				error = _e;
			}

			expect(error).to.eql(undefined);
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

