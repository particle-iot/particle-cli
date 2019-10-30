const MockSerial = require('../../test/__mocks__/serial.mock');
const { expect, sinon } = require('../../test/setup');
const SerialCommand = require('./serial');


describe('Serial Command', () => {
	let serial;
	let clock;

	beforeEach(() => {
		serial = new SerialCommand({ params: {} });
	});

	afterEach(() => {
		if (clock !== undefined) {
			clock.restore();
			clock = undefined;
		}
	});

	describe('supportsClaimCode', () => {
		it('can check if a device supports claiming', () => {
			var device = { port: 'vintage' };
			var mockSerial = new MockSerial();
			mockSerial.write = (data, cb) => {
				if (data==='c') {
					mockSerial.push('Device claimed: no');
				}
				cb();
			};
			serial.serialPort = mockSerial;
			return expect(serial.supportsClaimCode(device)).to.eventually.equal(true);
		});

		it('supports a device that does not recognise the claim command', () => {
			var device = { port: 'vintage' };
			var mockSerial = new MockSerial();
			serial.serialPort = mockSerial;
			return expect(serial.supportsClaimCode(device)).to.eventually.equal(false);
		});
	});

	describe('sendClaimCode', () => {
		it('can claim a device', () => {
			var device = { port: 'shanghai' };
			var mockSerial = new MockSerial();
			var code = '1234';
			mockSerial.write = function write(data){
				if (data==='C') {
					mockSerial.expectingClaimCode = true;
					mockSerial.push('Enter 63-digit claim code: ');
				} else if (this.expectingClaimCode) {
					mockSerial.expectingClaimCode = false;
					mockSerial.claimCodeSet = data.split('\n')[0];
					mockSerial.push('Claim code set to: '+data);
				}
			};
			serial.serialPort = mockSerial;
			return serial.sendClaimCode(device, code, false).then(() => {
				expect(mockSerial.claimCodeSet).to.be.eql(code);
			});
		});
	});

	describe('serialWifiConfig', () => {
		it('can reject with timeout after 5000ms if not getting any serial data', () => {
			clock = sinon.useFakeTimers();
			const device = { port: 'baltimore' };
			const mockSerial = new MockSerial();
			serial.serialPort = mockSerial;
			const wifiPromise = serial._serialWifiConfig(device);
			process.nextTick(() => {
				clock.tick(5010);
			});
			return expect(wifiPromise).to.be.rejected;
		});
	});
});

