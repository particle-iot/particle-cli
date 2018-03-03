'use strict';

var proxyquire = require('proxyquire');
var MockSerial = require('../mocks/Serial.mock')

require('should');
var sinon = require('sinon');
var chai = require('chai');
var sinonChai = require('sinon-chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
chai.use(sinonChai);
var expect = chai.expect;


var SerialCommand = proxyquire('../../commands/SerialCommand.js', {

});

describe('Serial Command', function() {
	let serial;

	beforeEach(function () {
		serial = new SerialCommand({ params: {} });
	});

	describe('supportsClaimCode', function () {
		it('can check if a device supports claiming', function () {
			var device = { port: 'vintage' };
			var mockSerial = new MockSerial();
			mockSerial.write = function (data, cb) {
				if (data==='c') {
					mockSerial.push('Device claimed: no');
				}
				cb();
			};
			serial.serialPort = mockSerial;
			return expect(serial.supportsClaimCode(device)).to.eventually.equal(true);
		});

		it('supports a device that does not recognise the claim command', function () {
			var device = { port: 'vintage' };
			var mockSerial = new MockSerial();
			serial.serialPort = mockSerial;
			return expect(serial.supportsClaimCode(device)).to.eventually.equal(false);
		});
	});

	describe('sendClaimCode', function() {
		it('can claim a device', function() {
			var device = { port: 'shanghai' };
			var mockSerial = new MockSerial();
			var code = '1234';
			mockSerial.write = function (data, cb) {
				if (data==='C') {
					mockSerial.expectingClaimCode = true;
					mockSerial.push('Enter 63-digit claim code: ');
				}
				else if (this.expectingClaimCode) {
					mockSerial.expectingClaimCode = false;
					mockSerial.claimCodeSet = data.split('\n')[0];
					mockSerial.push('Claim code set to: '+data);
				}
			};
			serial.serialPort = mockSerial;
			return serial.sendClaimCode(device, code, false).then(function () {
				expect(mockSerial.claimCodeSet).to.be.eql(code);
			});
		});
	});
});
