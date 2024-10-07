const { expect, sinon } = require('../../test/setup');
const { withConsoleStubs } = require('../../test/lib/mocha-utils');
const settings = require('../../settings');
const ApiClient = require('../lib/api-client');
const WhoAmICommands = require('./whoami');


describe('Whoami Commands', () => {
	const sandbox = sinon.createSandbox();

	// We cannot mock the prototype since the spinner is from a mixin :cat-scream:
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

	it('fails when user is signed-out', () => {
		sandbox.stub(ApiClient.prototype, '_access_token').get(() => null);
		const whoAmI = whoAmICommands();

		return whoAmI.getUsername()
			.then(() => {
				throw new Error('expected promise to be rejected');
			})
			.catch(error => {
				expect(error).to.have.property('message', 'You\'re not logged in. Please login using [1m[36mparticle cloud login[39m[22m before using this command');
			});
	});

	it('fails when token is invalid', () => {
		sandbox.stub(ApiClient.prototype, 'getUser').throws();
		const whoAmI = whoAmICommands();

		return whoAmI.getUsername()
			.then(() => {
				throw new Error('expected promise to be rejected');
			})
			.catch(error => {
				expect(error).to.have.property('message', 'Failed to find username! Try: `particle login`');
			});
	});

	it('returns username from the local settings when user is signed-in', withConsoleStubs(sandbox, () => {
		sandbox.stub(settings, 'username').value('from-settings@example.com');
		sandbox.spy(ApiClient.prototype, 'ensureToken');
		sandbox.stub(ApiClient.prototype, 'getUser').resolves({ username: 'from-api@example.com' });
		const whoAmI = whoAmICommands();

		return whoAmI.getUsername()
			.then((username) => {
				expect(username).to.equal(settings.username);
				expect(ApiClient.prototype.ensureToken).to.have.property('callCount', 1);
				expect(ApiClient.prototype.getUser).to.have.property('callCount', 1);
				validateStdoutContainsUsername(settings.username);
			});
	}));

	it('returns username from the API when user is signed-in and username isn\'t saved locally', withConsoleStubs(sandbox, () => {
		const apiUsername = 'from-api@example.com';
		sandbox.stub(settings, 'username').value(null);
		sandbox.spy(ApiClient.prototype, 'ensureToken');
		sandbox.stub(ApiClient.prototype, 'getUser').resolves({ username: apiUsername });
		const whoAmI = whoAmICommands();

		return whoAmI.getUsername()
			.then(username => {
				expect(username).to.equal(apiUsername);
				expect(ApiClient.prototype.ensureToken).to.have.property('callCount', 1);
				expect(ApiClient.prototype.getUser).to.have.property('callCount', 1);
				validateStdoutContainsUsername(apiUsername);
			});
	}));

	it('returns fallback when user is signed-in but username is not saved locally or available in the API', withConsoleStubs(sandbox, () => {
		sandbox.stub(settings, 'username').value(null);
		sandbox.spy(ApiClient.prototype, 'ensureToken');
		sandbox.stub(ApiClient.prototype, 'getUser').resolves({ username: '' });
		const whoAmI = whoAmICommands();

		return whoAmI.getUsername()
			.then(username => {
				const fallback = 'unknown username';
				expect(username).to.equal(fallback);
				expect(ApiClient.prototype.ensureToken).to.have.property('callCount', 1);
				expect(ApiClient.prototype.getUser).to.have.property('callCount', 1);
				validateStdoutContainsUsername(fallback);
			});
	}));

	function validateStdoutContainsUsername(username){
		expect(process.stdout.write).to.have.property('callCount', 1);
		expect(process.stdout.write.firstCall.args[0])
			.to.match(new RegExp(`${username}\\n$`));
	}
});

