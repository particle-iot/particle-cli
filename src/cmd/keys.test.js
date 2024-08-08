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
	var device;

	function setupCommand(options = {}) {
		utilities.deferredChildProcess = sinon.stub().returns(Promise.resolve());

		options = Object.assign({ params: {} }, options);
		key = new KeysCommand(options);
		key.madeSSL = false;

		key.platform = 'photon';

		api = {};
		api.ensureToken = sinon.stub();
		api.sendPublicKey = sinon.stub();
		api.ready = sinon.stub().returns(true);

		device = {
			writeOverDfu: sinon.stub(),
			close: sinon.stub()
			// readOverDfu is stubbed with in each test for specific return values
		};
	}

	// TODO: fill these in 
	it.skip('Can create device key', () => {
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

	describe('serverKeyFilename', () => {
		before(setupCommand);

		it('returns name with algorithm', () => {
			expect(key.serverKeyFilename({ alg: 'ec' })).to.match(/ec.pub.der$/);
		});
	});
});

