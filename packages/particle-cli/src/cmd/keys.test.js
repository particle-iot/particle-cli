const fs = require('fs');
const proxyquire = require('proxyquire');
const { expect, sinon } = require('../../test/setup');

let api;
function ApiClient() {
	return api;
}
const settings = { username: 'test' };
const utilities = () => {};

const KeysCommand = proxyquire('./keys', {
	'../../settings': settings,
	'../lib/utilities': utilities,
	'../lib/api-client': ApiClient
});


describe('Key Command', () => {
	var key;
	var dfu;
	var filename;
	var keyFilename;
	var transport;

	function setupDfuTransport() {
		transport = [];
		dfu.dfuId = '2b04:d00a'; // usbIDForPlatform('electron')
		dfu.readBuffer = sinon.stub().withArgs('transport', false).returns(Promise.resolve(transport));
		dfu.read = sinon.stub();
		dfu.write = sinon.stub();
		filename = 'abc.bin';
		keyFilename = 'abc.der';
	}

	function setupCommand(options = {}) {
		utilities.deferredChildProcess = sinon.stub().returns(Promise.resolve());

		options = Object.assign({ params: {} }, options);
		key = new KeysCommand(options);
		key.madeSSL = false;

		key.dfu = dfu = {};
		dfu.isDfuUtilInstalled = sinon.stub();
		dfu.findCompatibleDFU = sinon.stub();
		dfu.dfuId = '2b04:d006';

		api = {};
		api.ensureToken = sinon.stub();
		api.sendPublicKey = sinon.stub();
		api.ready = sinon.stub().returns(true);
	}

	it('Can create device key', () => {
		setupCommand();
		return key.makeNewKey('', {}).then(() => {
			expect(utilities.deferredChildProcess).to.have.property('callCount', 3);
		});
	});

	it.skip('Can load device key', () => {
	});

	it.skip('Can save device key', () => {
	});

	it.skip('Can send device key', () => {
	});

	it.skip('Can switch server key', () => {
	});

	it.skip('Can read server address from key', () => {
	});

	it('key doctor deviceID is case-insensitive', () => {
		setupCommand();
		key._makeNewKey = sinon.stub();
		key._writeKeyToDevice = sinon.stub();
		key._sendPublicKeyToServer = sinon.stub();
		return key.keyDoctor('ABcd', {}).then(() => {
			expect(key._sendPublicKeyToServer).to.be.calledWith({
				deviceId: 'abcd', filename: 'abcd_rsa_new', algorithm: 'rsa'
			});
		});
	});

	describe('send key to server', () => {
		// This test fails because of mock-fs used in another part of the tests
		// Just skip it for now
		it.skip('lowercases the device ID and removes the file argument', () => {
			var deviceID = 'deadBEEF';
			setupCommand();

			filename = key.serverKeyFilename({ alg: 'rsa' });
			var tempfile;

			utilities.deferredChildProcess = sinon.spy((cmd) => {
				var args = cmd.split(' ');
				tempfile = args[args.length - 1];
				fs.writeFileSync(tempfile, '');
				return Promise.resolve();
			});
			return Promise.resolve(key.sendPublicKeyToServer(deviceID, filename, {}))
				.then(() => {
					expect(api.sendPublicKey).has.been.calledWith(deviceID.toLowerCase(), new Buffer([]), 'rsa');
				})
				.finally(() => {
					if (tempfile) {
						// the file should be removed
						expect(fs.existsSync(tempfile)).to.be.eql(false);
					}
				});
		});
	});

	describe('address', () => {
		beforeEach(() => {
			setupCommand();
			setupDfuTransport();
		});

		it('reads device protocol when the device supports multiple protocols and no protocol is given, alternate protocol', () => {
			transport.push(0x00);
			return key.readServerAddress({})
				.then(() => {
					expect(dfu.readBuffer).to.have.been.calledWith('transport', false);
					expect(dfu.readBuffer).to.have.been.calledWith('tcpServerKey', false);
				});
		});

		it('reads device protocol when the device supports multiple protocols and no protocol is given, default protocol', () => {
			transport.push(0xFF);
			return key.readServerAddress({})
				.then(() => {
					expect(dfu.readBuffer).to.have.been.calledWith('transport', false);
					expect(dfu.readBuffer).to.have.been.calledWith('udpServerKey', false);
				});
		});
		// todo - stub readBuffer to return a key and check the field decomposition
	});

	describe('load', () => {
		beforeEach(() => {
			setupCommand();
			setupDfuTransport();
		});

		it('calls validateDeviceProtocol to setup the default protocol', () => {
			dfu.write = sinon.stub();
			key.validateDeviceProtocol = sinon.stub().returns('tcp');
			filename = key.serverKeyFilename({ alg: 'rsa' });
			return key.writeKeyToDevice(filename)
				.then(() => {
					expect(key.validateDeviceProtocol).to.have.been.called;
					expect(dfu.write).to.have.been.calledWith(filename, 'tcpPrivateKey', false);
				});
		});
	});

	describe('save', () => {
		beforeEach(() => {
			setupCommand();
			setupDfuTransport();
		});

		it('reads device protocol when the device supports multiple protocols and no protocol is given, alternate protocol', () => {
			transport.push(0x00);
			return key.saveKeyFromDevice(filename, {})
				.then(() => {
					expect(dfu.readBuffer).to.have.been.calledWith('transport', false);
					expect(dfu.read).to.have.been.calledWith(keyFilename, 'tcpPrivateKey', false);
				});
		});

		it('reads device protocol when the device supports multiple protocols and no protocol is given, default protocol', () => {
			transport.push(0xFF);

			return key.saveKeyFromDevice(filename, {})
				.then(() => {
					expect(dfu.readBuffer).to.have.been.calledWith('transport', false);
					expect(dfu.read).to.have.been.calledWith(keyFilename, 'udpPrivateKey', false);
				});
		});

		it('raises an error when the protocol is not recognized', () => {
			key.validateDeviceProtocol = sinon.stub().returns('zip');

			return key.saveKeyFromDevice(filename, {})
				.catch((err) => {
					expect(err).to.equal('Error saving key from device... The device does not support the protocol zip. It has support for udp, tcp');
				});
		});

		it('does not read the device protocol the protocol is given', () => {
			key.validateDeviceProtocol = sinon.stub().returns('tcp');
			key.fetchDeviceProtocol = sinon.stub();

			return key.saveKeyFromDevice(filename, {})
				.then(() => {
					expect(key.fetchDeviceProtocol).to.not.have.been.called;
					expect(dfu.read).to.have.been.calledWith(keyFilename, 'tcpPrivateKey', false);
				});
		});
	});

	describe('protocol', () => {
		beforeEach(setupDfuTransport);

		it('updates the device protocol to tcp', () => {
			dfu.writeBuffer = sinon.stub();
			return key.changeTransportProtocol('tcp').then(() => {
				expect(dfu.writeBuffer).has.been.calledWith(new Buffer([0x00]), 'transport', false);
			});
		});

		it('updates the device protocol to udp', () => {
			dfu.writeBuffer = sinon.stub();
			return key.changeTransportProtocol('udp').then(() => {
				expect(dfu.writeBuffer).has.been.calledWith(new Buffer([0xFF]), 'transport', false);
			});
		});

		it('raises an error if the device does not support multiple protocols', () => {
			dfu.dfuId = '2b04:d006';
			return key.changeTransportProtocol('udp').then(() => {
				throw new Error('expected error');
			}).catch((err) => {
				expect(err.message).to.be.eql('Could not change device transport protocol: Protocol cannot be changed for this device');
			});
		});
	});

	describe('keyAlgorithmForProtocol', () => {
		before(setupCommand);

		it('returns rsa for TCP protocol', () => {
			expect(key.keyAlgorithmForProtocol('tcp')).eql('rsa');
		});

		it('returns ec for UDP protocol', () => {
			expect(key.keyAlgorithmForProtocol('udp')).eql('ec');
		});
	});

	describe('serverKeyFilename', () => {
		before(setupCommand);

		it('returns name with algorithm only when no variant is provided', () => {
			expect(key.serverKeyFilename({ alg: 'ec' })).to.match(/ec.pub.der$/);
		});
		it('returns name with algorithm and variant when variant is provided', () => {
			expect(key.serverKeyFilename({ alg: 'ec', variant: 'gen3' })).to.match(/ec-gen3.pub.der$/);
		});
	});
});

