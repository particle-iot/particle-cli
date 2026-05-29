'use strict';
const fs = require('fs');
const proxyquire = require('proxyquire');
const { expect, sinon } = require('../../test/setup');

const settings = { username: 'test' };
const utilities = () => {};

const KeysCommand = proxyquire('./keys', {
	'../../settings': settings,
	'../lib/utilities': utilities
});

describe('Key Command', () => {
	let key;
	let filename;

	function setupCommand(options = {}) {
		utilities.deferredChildProcess = sinon.stub().returns(Promise.resolve());

		options = Object.assign({ params: {} }, options);
		key = new KeysCommand(options);
		key.madeSSL = false;

		key.platform = 'photon';
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
			const deviceID = 'deadBEEF';
			setupCommand();

			filename = key.serverKeyFilename({ alg: 'rsa' });
			let tempfile;

			utilities.deferredChildProcess = sinon.spy((cmd) => {
				const args = cmd.split(' ');
				tempfile = args[args.length - 1];
				fs.writeFileSync(tempfile, '');
				return Promise.resolve();
			});
			return Promise.resolve(key.sendPublicKeyToServer(deviceID, filename, {}))
				.then(() => {
					// `key.api.sendPublicKey` would need to be stubbed by re-instantiating
					// `KeysCommand` against a stubbed `ParticleApi.prototype.sendPublicKey`.
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
