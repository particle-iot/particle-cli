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
	var filename;
	var transport;
	var device;

	function setupDfuTransport() {
		transport = [];
		key.dfuId = '2b04:d00a'; // usbIDForPlatform('electron')
		filename = 'abc.bin';
	}

	function setupCommand(options = {}) {
		utilities.deferredChildProcess = sinon.stub().returns(Promise.resolve());

		options = Object.assign({ params: {} }, options);
		key = new KeysCommand(options);
		key.madeSSL = false;

		key.dfuId = '2b04:d006';

		api = {};
		api.ensureToken = sinon.stub();
		api.sendPublicKey = sinon.stub();
		api.ready = sinon.stub().returns(true);

		device = {
			writeOverDfu: sinon.stub(),
			close: sinon.stub()
		};
	}

	it('Can create device key', () => {
		setupCommand();
		key.getDfuDevice = sinon.stub().returns(device);
		return key.makeNewKey({ params: {} }).then(() => {
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

	it('key doctor deviceID is case-insensitive', () => { // FIX FOR ALGO
		setupCommand();
		key.getDfuDevice = sinon.stub().returns(device);
		key._makeNewKey = sinon.stub();
		key._writeKeyToDevice = sinon.stub();
		key._sendPublicKeyToServer = sinon.stub();
		return key.keyDoctor({ params: { deviceID: 'ABcd' } }).then(() => {
			expect(key._sendPublicKeyToServer).to.be.calledWith({
				deviceID: 'abcd', filename: 'abcd_rsa_new', algorithm: 'rsa'
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
			key.getDfuDevice = sinon.stub().returns(device);
			device.readOverDfu = sinon.stub().returns(Promise.resolve(Buffer.from([1,2,3,4,5])));
			transport.push(0x00);
			return key.readServerAddress({})
				.then(() => {
					expect(device.readOverDfu).to.have.property('callCount', 2);
				});
		});

		it('reads device protocol when the device supports multiple protocols and no protocol is given, default protocol', () => {
			key.getDfuDevice = sinon.stub().returns(device);
			key.fetchDeviceProtocol = sinon.stub().returns('tcp');
			device.readOverDfu = sinon.stub().returns(Promise.resolve(Buffer.from([1,2,3,4,5])));
			transport.push(0xFF);
			return key.readServerAddress({})
				.then(() => {
					expect(device.readOverDfu).to.have.property('callCount', 1);
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
			key.validateDeviceProtocol = sinon.stub().returns('tcp');
			key.getDfuDevice = sinon.stub().returns(device);
			filename = key.serverKeyFilename({ alg: 'rsa' });
			return key.writeKeyToDevice({ params: { filename } })
				.then(() => {
					expect(key.validateDeviceProtocol).to.have.been.called;
					expect(device.writeOverDfu).to.have.property('callCount', 1);
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
			key.getDfuDevice = sinon.stub().returns(device);
			device.readOverDfu = sinon.stub().returns(Promise.resolve(0xFF));
			return key.saveKeyFromDevice({ params: { filename } })
				.then(() => {
					expect(device.readOverDfu).to.have.property('callCount', 2);
				});
		});

		it('reads device protocol when the device supports multiple protocols and no protocol is given, default protocol', () => {
			transport.push(0xFF);
			key.getDfuDevice = sinon.stub().returns(device);
			device.readOverDfu = sinon.stub().returns(Promise.resolve(0xFF));
			return key.saveKeyFromDevice({ params: { filename } })
				.then(() => {
					expect(device.readOverDfu).to.have.property('callCount', 2);
				});
		});

		it('raises an error when the protocol is not recognized', () => {
			key.validateDeviceProtocol = sinon.stub().returns('zip');
			key.getDfuDevice = sinon.stub().returns(device);
			device.readOverDfu = sinon.stub().returns(Promise.resolve(0xFF));
			return key.saveKeyFromDevice({ params: { filename } })
				.catch((err) => {
					expect(err).to.equal('Error saving key from device... The device does not support the protocol zip. It has support for udp, tcp');
				});
		});

		it('does not read the device protocol the protocol is given', () => {
			key.validateDeviceProtocol = sinon.stub().returns('tcp');
			key.fetchDeviceProtocol = sinon.stub();
			device.readOverDfu = sinon.stub().returns(Promise.resolve(0xFF));
			return key.saveKeyFromDevice({ params: { filename } })
				.then(() => {
					expect(key.fetchDeviceProtocol).to.not.have.been.called;
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

