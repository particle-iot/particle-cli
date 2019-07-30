const MockSerial = require('../../test/__mocks__/serial.mock');
const { expect } = require('../../test/setup');
const SerialCommand = require('./serial');


describe('Serial Command', () => {
	let serial;

	beforeEach(() => {
		serial = new SerialCommand({ params: {} });
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
});

