'use strict';

var Spinner = require('./../mocks/Spinner.mock.js');
var Interpreter = require('../../dist/lib/interpreter');
var proxyquire = require('proxyquire');
require('should');
var sinon = require('sinon');

const chai = require('chai');
const sinonChai = require('sinon-chai');
chai.use(sinonChai);
const expect = chai.expect;
const fs = require('fs');

var settings = {
	username: 'test'
};

var api;
function ApiClient() {
	return api;
}

/* eslint new-cap: 0 */
function when() {
	if (!(this instanceof when)) {
		return new when();
	}
	return this;
}
when.prototype.then = function() {
	return true;
};



var KeyCommand = proxyquire('../../src/cmd/keys', {
	'cli-spinner': Spinner,
	'../settings.js': settings,
	'when': when,
	'../dist/lib/utilities.js': utilities,
	'../dist/lib/ApiClient.js': ApiClient
});

function utilities() { }

describe('Key Command', function() {

	var cli;
	var key;
	var dfu;

	var filename;
	var keyFilename;
	var transport;

	function setupDfuTransport() {
		transport = [];
		key.options.protocol = undefined;
		dfu.dfuId = '2b04:d00a'; // usbIDForPlatform('electron')
		dfu.readBuffer = sinon.stub().withArgs('transport', false).returns(when.resolve(transport));
		dfu.read = sinon.stub();
		dfu.write = sinon.stub();
		filename = 'abc.bin';
		keyFilename = 'abc.der';
	}

	beforeEach(function () {
		utilities.deferredChildProcess = sinon.stub().returns(when.resolve());


		cli = new Interpreter();
		cli.startup();

		key = new KeyCommand(cli);
		key.madeSSL = false;

		key.dfu = dfu = {};
		dfu.isDfuUtilInstalled = sinon.stub();
		dfu.findCompatibleDFU = sinon.stub();
		dfu.dfuId = "2b04:d006";

		api = {};
		api.sendPublicKey = sinon.stub();
		api.ready = sinon.stub().returns(true);

	});

	it('Can create device key', function () {
		key.optionsByName['new'].should.be.instanceOf(Function);
		key.makeNewKey();
		process.nextTick(function () {
			utilities.deferredChildProcess.callCount.should.equal(3);
		});
	});

	it('Can load device key', function () {
		key.optionsByName['load'].should.be.instanceOf(Function);
	});

	it('Can save device key', function () {
		key.optionsByName['save'].should.be.instanceOf(Function);
	});

	it('Can send device key', function () {
		key.optionsByName['send'].should.be.instanceOf(Function);
	});

	it('Can switch server key', function () {
		key.optionsByName['new'].should.be.instanceOf(Function);
	});

	it('Can read server address from key', function () {
		key.optionsByName['address'].should.be.instanceOf(Function);
	});

	it('Can check arguments', function () {
		key.checkArguments(['--force']);
		key.options.force.should.equal(true);
		key.checkArguments(['--protocol', 'tcp']);
		key.options.protocol.should.equal('tcp');
	});

	it('key doctor deviceID is case-insensitive', function () {
		key._sendPublicKeyToServer = sinon.stub();
		key.writeKeyToDevice = sinon.stub();
		return key.keyDoctor("ABcd").then(function () {
			expect(key._sendPublicKeyToServer).to.be.calledWith('abcd', 'abcd_rsa_new', 'rsa')
		})
	});

	describe('send key to server', function () {
		it('lowercases the device ID and removes the file argument', function () {
			// todo - this is a gnarly test because the SUT needs refactoring into smaller pieces.
			filename = key.serverKeyFilename('rsa');
			var deviceID = 'deadBEEF';
			var tempfile;

			utilities.deferredChildProcess = sinon.spy(function (cmd) {
				var args = cmd.split(' ');
				tempfile = args[args.length - 1];
				fs.writeFileSync(tempfile, '');
				return when.resolve();
			});
			return key.sendPublicKeyToServer(deviceID, filename).then(function () {
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
		beforeEach(setupDfuTransport);

		it('reads device protocol when the device supports multiple protocols and no protocol is given, alternate protocol', function() {
			transport.push(0x00);
			return key.readServerAddress()
				.then(function (result) {
					expect(dfu.readBuffer).to.have.been.calledWith('transport', false);
					expect(dfu.readBuffer).to.have.been.calledWith('tcpServerKey', false);
				});
		});

		it('reads device protocol when the device supports multiple protocols and no protocol is given, default protocol', function() {
			transport.push(0xFF);
			return key.readServerAddress()
				.then(function (result) {
					expect(dfu.readBuffer).to.have.been.calledWith('transport', false);
					expect(dfu.readBuffer).to.have.been.calledWith('udpServerKey', false);
				});
		});
		// todo - stub readBuffer to return a key and check the field decomposition
	});

	describe('load', function () {
		beforeEach(setupDfuTransport);

		it('calls validateDeviceProtocol to setup the default protocol', function() {
			dfu.write = sinon.stub();
			key.options.protocol = 'tcp';
			key.validateDeviceProtocol = sinon.stub();
			filename = key.serverKeyFilename('rsa');
			return key.writeKeyToDevice(filename, true)
				.then(function () {
					expect(key.validateDeviceProtocol).to.have.been.called;
					expect(dfu.write).to.have.been.calledWith(filename, 'tcpPrivateKey', true);
				});
		});
	});

	describe('save', function () {
		beforeEach(setupDfuTransport);

		it('reads device protocol when the device supports multiple protocols and no protocol is given, alternate protocol', function() {
			transport.push(0x00);
			return key.saveKeyFromDevice(filename)
				.then(function () {
					expect(dfu.readBuffer).to.have.been.calledWith('transport', false);
					expect(dfu.read).to.have.been.calledWith(keyFilename, 'tcpPrivateKey', false);
				});
		});

		it('reads device protocol when the device supports multiple protocols and no protocol is given, default protocol', function() {
			transport.push(0xFF);
			return key.saveKeyFromDevice(filename)
				.then(function () {
					expect(dfu.readBuffer).to.have.been.calledWith('transport', false);
					expect(dfu.read).to.have.been.calledWith(keyFilename, 'udpPrivateKey', false);
				});
		});

		it('raises an error when the protocol is not recognized', function() {
			key.options.protocol = 'zip';
			return key.saveKeyFromDevice(filename)
				.catch(function (err) {
					expect(err.message).to.equal('The device does not support the protocol zip. It has support for udp, tcp');
				});
		});

		it('does not read the device protocol the protocol is given', function() {
			key.options.protocol = 'tcp';
			key.fetchDeviceProtocol = sinon.stub();
			return key.saveKeyFromDevice(filename)
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
				throw Error('expected error');
			}).catch(function (err) {
				expect(err).to.be.eql('No transport flag available');
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
