'use strict';
const { expect, sinon } = require('../../test/setup');
const { withConsoleStubs } = require('../../test/lib/mocha-utils');
const settings = require('../../settings');
const ParticleApi = require('./api');
const WhoAmICommands = require('./whoami');
const { MissingTokenError, InvalidTokenError } = require('../lib/auth-errors');
const { default: stripAnsi } = require('strip-ansi');


describe('Whoami Commands', () => {
	const sandbox = sinon.createSandbox();

	function whoAmICommands() {
		const whoAmI = new WhoAmICommands();
		sandbox.stub(whoAmI, 'newSpin').returns({ start: sandbox.stub() });
		sandbox.stub(whoAmI, 'stopSpin');
		return whoAmI;
	}

	beforeEach(() => {
		sandbox.stub(settings, 'access_token').value('valid-access-token');
	});

	afterEach(() => {
		sandbox.restore();
	});

	it('throws MissingTokenError when no token is configured', async () => {
		settings.access_token = null;
		const whoAmI = whoAmICommands();

		let caught;
		try {
			await whoAmI.getUsername();
		} catch (err) {
			caught = err;
		}
		expect(caught).to.be.instanceof(MissingTokenError);
	});

	it('propagates InvalidTokenError when the API rejects with 401 (no VError rewrap)', async () => {
		sandbox.stub(ParticleApi.prototype, 'getUserInfo').rejects(new InvalidTokenError('expired'));
		const whoAmI = whoAmICommands();

		let caught;
		try {
			await whoAmI.getUsername();
		} catch (err) {
			caught = err;
		}
		expect(caught).to.be.instanceof(InvalidTokenError);
		expect(stripAnsi(caught.message)).to.equal('expired');
	});

	it('returns username from the local settings when user is signed-in', withConsoleStubs(sandbox, () => {
		sandbox.stub(settings, 'username').value('from-settings@example.com');
		sandbox.stub(ParticleApi.prototype, 'getUserInfo').resolves({ username: 'from-api@example.com' });
		const whoAmI = whoAmICommands();

		return whoAmI.getUsername()
			.then((username) => {
				expect(username).to.equal('from-settings@example.com');
				validateStdoutContainsUsername('from-settings@example.com');
			});
	}));

	it('returns username from the API when user is signed-in and username isn\'t saved locally', withConsoleStubs(sandbox, () => {
		const apiUsername = 'from-api@example.com';
		sandbox.stub(settings, 'username').value(null);
		sandbox.stub(ParticleApi.prototype, 'getUserInfo').resolves({ username: apiUsername });
		const whoAmI = whoAmICommands();

		return whoAmI.getUsername()
			.then(username => {
				expect(username).to.equal(apiUsername);
				validateStdoutContainsUsername(apiUsername);
			});
	}));

	it('returns fallback when user is signed-in but username is not saved locally or available in the API', withConsoleStubs(sandbox, () => {
		sandbox.stub(settings, 'username').value(null);
		sandbox.stub(ParticleApi.prototype, 'getUserInfo').resolves({ username: '' });
		const whoAmI = whoAmICommands();

		return whoAmI.getUsername()
			.then(username => {
				expect(username).to.equal('unknown');
				validateStdoutContainsUsername('unknown');
			});
	}));

	function validateStdoutContainsUsername(username) {
		expect(process.stdout.write).to.have.property('callCount', 1);
		expect(process.stdout.write.firstCall.args[0])
			.to.match(new RegExp(`${username}\\n$`));
	}
});
