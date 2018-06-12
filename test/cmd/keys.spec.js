'use strict';

var proxyquire = require('proxyquire');
require('should');
var sinon = require('sinon');

const chai = require('chai');
const sinonChai = require('sinon-chai');
chai.use(sinonChai);
const expect = chai.expect;
const fs = require('fs');
const when = require('when');

var settings = {
	username: 'test'
};

var api;
function ApiClient() {
	return api;
}

var KeysCommand = proxyquire('../../src/cmd/keys', {
	'../settings.js': settings,
	'../lib/utilities.js': utilities,
	'../lib/ApiClient.js': ApiClient
});

function utilities() { }

describe('Key Command', function() {

	var key;
	var dfu;

	var filename;
	var keyFilename;
	var transport;

	function setupDfuTransport() {
		transport = [];
		dfu.dfuId = '2b04:d00a'; // usbIDForPlatform('electron')
		dfu.readBuffer = sinon.stub().withArgs('transport', false).returns(when.resolve(transport));
		dfu.read = sinon.stub();
		dfu.write = sinon.stub();
		filename = 'abc.bin';
		keyFilename = 'abc.der';
	}

	function setupCommand(options = {}) {
		utilities.deferredChildProcess = sinon.stub().returns(when.resolve());

		options = Object.assign({ params: {} }, options);
		key = new KeysCommand(options);
		key.madeSSL = false;

		key.dfu = dfu = {};
		dfu.isDfuUtilInstalled = sinon.stub();
		dfu.findCompatibleDFU = sinon.stub();
		dfu.dfuId = "2b04:d006";

		api = {};
		api.ensureToken = sinon.stub();
		api.sendPublicKey = sinon.stub();
		api.ready = sinon.stub().returns(true);
	}

	it('Can create device key', function () {
		setupCommand();
		return key.makeNewKey('', {}).then(() => {
			utilities.deferredChildProcess.callCount.should.equal(3);
		});
	});

	it.skip('Can load device key', function () {
	});

	it.skip('Can save device key', function () {
	});

	it.skip('Can send device key', function () {
	});

	it.skip('Can switch server key', function () {
	});

	it.skip('Can read server address from key', function () {
	});

	it('key doctor deviceID is case-insensitive', function () {
		setupCommand();
		key._makeNewKey = sinon.stub();
		key._writeKeyToDevice = sinon.stub();
		key._sendPublicKeyToServer = sinon.stub();
		return key.keyDoctor('ABcd', {}).then(function () {
			expect(key._sendPublicKeyToServer).to.be.calledWith({
				deviceId: 'abcd', filename: 'abcd_rsa_new', algorithm: 'rsa'
			});
		})
	});

	describe('send key to server', function () {
		it('lowercases the device ID and removes the file argument', function () {
			var deviceID = 'deadBEEF';
			setupCommand();

			filename = key.serverKeyFilename('rsa');
			var tempfile;

			utilities.deferredChildProcess = sinon.spy(function (cmd) {
				var args = cmd.split(' ');
				tempfile = args[args.length - 1];
				fs.writeFileSync(tempfile, '');
				return when.resolve();
			});
			return when(key.sendPublicKeyToServer(deviceID, filename, {})).then(function () {
				expect(api.sendPublicKey).has.been.calledWith(deviceID.toLowerCase(), new Buffer([]), 'rsa');
			}).finally(function () {
				if (tempfile) {
					// the file should be removed
					expect(fs.existsSync(tempfile)).to.be.eql(false);
				}
			});
		});
	});

	describe('address', function () {
		beforeEach(() => {
			setupCommand();
			setupDfuTransport();
		});

		it('reads device protocol when the device supports multiple protocols and no protocol is given, alternate protocol', function() {
			transport.push(0x00);
			return key.readServerAddress({})
				.then(function (result) {
					expect(dfu.readBuffer).to.have.been.calledWith('transport', false);
					expect(dfu.readBuffer).to.have.been.calledWith('tcpServerKey', false);
				});
		});

		it('reads device protocol when the device supports multiple protocols and no protocol is given, default protocol', function() {
			transport.push(0xFF);
			return key.readServerAddress({})
				.then(function (result) {
					expect(dfu.readBuffer).to.have.been.calledWith('transport', false);
					expect(dfu.readBuffer).to.have.been.calledWith('udpServerKey', false);
				});
		});
		// todo - stub readBuffer to return a key and check the field decomposition
	});

	describe('load', function () {
		beforeEach(() => {
			setupCommand();
			setupDfuTransport();
		});

		it('calls validateDeviceProtocol to setup the default protocol', function() {
			dfu.write = sinon.stub();
			key.validateDeviceProtocol = sinon.stub().returns('tcp');
			filename = key.serverKeyFilename('rsa');
			return key.writeKeyToDevice(filename)
				.then(function () {
					expect(key.validateDeviceProtocol).to.have.been.called;
					expect(dfu.write).to.have.been.calledWith(filename, 'tcpPrivateKey', false);
				});
		});
	});

	describe('save', function () {
		beforeEach(() => {
			setupCommand();
			setupDfuTransport();
		});

		it('reads device protocol when the device supports multiple protocols and no protocol is given, alternate protocol', function() {
			transport.push(0x00);
			return key.saveKeyFromDevice(filename, {})
				.then(function () {
					expect(dfu.readBuffer).to.have.been.calledWith('transport', false);
					expect(dfu.read).to.have.been.calledWith(keyFilename, 'tcpPrivateKey', false);
				});
		});

		it('reads device protocol when the device supports multiple protocols and no protocol is given, default protocol', function() {
			transport.push(0xFF);

			return key.saveKeyFromDevice(filename, {})
				.then(function () {
					expect(dfu.readBuffer).to.have.been.calledWith('transport', false);
					expect(dfu.read).to.have.been.calledWith(keyFilename, 'udpPrivateKey', false);
				});
		});

		it('raises an error when the protocol is not recognized', function() {
			key.validateDeviceProtocol = sinon.stub().returns('zip');

			return key.saveKeyFromDevice(filename, {})
				.catch(function (err) {
					expect(err).to.equal('Error saving key from device... The device does not support the protocol zip. It has support for udp, tcp');
				});
		});

		it('does not read the device protocol the protocol is given', function() {
			key.validateDeviceProtocol = sinon.stub().returns('tcp');
			key.fetchDeviceProtocol = sinon.stub();

			return key.saveKeyFromDevice(filename, {})
				.then(function () {
					expect(key.fetchDeviceProtocol).to.not.have.been.called;
					expect(dfu.read).to.have.been.calledWith(keyFilename, 'tcpPrivateKey', false);
				});
		});
	});

	describe('protocol', function() {
		beforeEach(setupDfuTransport);

		it('updates the device protocol to tcp', function() {
			dfu.writeBuffer = sinon.stub();
			return key.changeTransportProtocol('tcp').then(function() {
				expect(dfu.writeBuffer).has.been.calledWith(new Buffer([0x00]), 'transport', false);
			});
		});

		it('updates the device protocol to udp', function() {
			dfu.writeBuffer = sinon.stub();
			return key.changeTransportProtocol('udp').then(function() {
				expect(dfu.writeBuffer).has.been.calledWith(new Buffer([0xFF]), 'transport', false);
			});
		});

		it('raises an error if the device does not support multiple protocols', function() {
			dfu.dfuId = '2b04:d006';
			return key.changeTransportProtocol('udp').then(function() {
				throw new Error('expected error');
			}).catch(function (err) {
				expect(err.message).to.be.eql('Could not change device transport protocol: Protocol cannot be changed for this device');
			});
		});
	});

	describe('keyAlgorithmForProtocol', function() {
		it('returns rsa for TCP protocol', function() {
			expect(key.keyAlgorithmForProtocol('tcp')).eql('rsa');
		});

		it('returns ec for UDP protocol', function() {
			expect(key.keyAlgorithmForProtocol('udp')).eql('ec');
		});
	});

});
