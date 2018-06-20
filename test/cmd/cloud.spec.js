const proxyquire = require('proxyquire');
const expect = require('chai').expect;
const sandbox = require('sinon').createSandbox();

let settings = {
	clientId: 'CLITESTS',
	username: 'test@example.com',
	override: () => {}
};

function utilities() {}

let api;
function ApiClient() {
	return api || {};
}

let prompts = {};

const CloudCommands = proxyquire('../../src/cmd/cloud', {
	'../../settings.js': settings,
	'../lib/utilities.js': utilities,
	'../lib/ApiClient.js': ApiClient,
	'../lib/prompts': prompts
});


describe('Cloud Commands', () => {
	afterEach(() => {
		sandbox.restore();
		api = {};
	});

	it('prompts for username and password when they are not provided', withConsoleStubs(() => {
		const cloud = new CloudCommands();
		const fakeToken = 'FAKE-ACCESS-TOKEN';
		const fakeCredentials = { username: 'test@example.com', password: 'fake-pw' };

		cloud.newSpin = sandbox.stub();
		cloud.stopSpin = sandbox.stub();
		cloud.newSpin.returns({ start: sandbox.stub() });
		prompts.getCredentials = sandbox.stub();
		prompts.getCredentials.returns(fakeCredentials);
		api = { login: sandbox.stub() };
		api.login.returns(fakeToken);

		return cloud.login()
			.then(t => {
				expect(prompts.getCredentials).to.have.property('callCount', 1);
				expect(cloud.newSpin).to.have.property('callCount', 1);
				expect(cloud.stopSpin).to.have.property('callCount', 1);
				expect(t).to.equal(fakeToken);
			});
	}));

	it('does not retry after 3 attemps', () => {
		const message = "It seems we're having trouble with logging in.";
		let error = simulateLoginAttempt(3);

		expect(error).to.have.property('message', message);
	});

	it('does not retry after 1 attemp when password is provided', () => {
		const message = "It seems we're having trouble with logging in.";
		let error = simulateLoginAttempt(1, { password: 'fake-password' });

		expect(error).to.have.property('message', message);
	});

	function simulateLoginAttempt(tries, { username, password } = {}){
		const cloud = new CloudCommands();
		let error;

		try {
			cloud.tries = tries;
			cloud.login(username, password);
		} catch (e) {
			error = e;
		}

		return error;
	}

	// TODO (mirande): figure out a better approach. this allows us to verify
	// log output without supressing mocha's success / error messages but is a
	// bit awkward
	function withConsoleStubs(fn){

		return () => {
			let result;

			sandbox.stub(process.stdout, 'write');
			sandbox.stub(process.stderr, 'write');

			try {
				result = fn();
			} catch (error) {
				sandbox.restore();
				throw error;
			}

			if (result && typeof result.finally === 'function'){
				return result.finally(() => sandbox.restore());
			}
			sandbox.restore();
			return result;
		};
	}
});

