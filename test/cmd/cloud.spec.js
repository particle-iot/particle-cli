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
	let cloud, fakeToken, fakeCredentials;

	beforeEach(() => {
		cloud = new CloudCommands();
		fakeToken = 'FAKE-ACCESS-TOKEN';
		fakeCredentials = { username: 'test@example.com', password: 'fake-pw' };
	});

	afterEach(() => {
		sandbox.restore();
		api = {};
	});

	it('accepts username and password args', withConsoleStubs(() => {
		api = { login: sandbox.stub() };
		api.login.returns(fakeToken);

		return cloud.login('username', 'password')
			.then(t => {
				expect(api.login).to.have.property('callCount', 1);
				expect(api.login.firstCall).to.have.property('args').lengthOf(3);
				expect(api.login.firstCall.args[0]).to.equal(settings.clientId);
				expect(api.login.firstCall.args[1]).to.equal('username');
				expect(api.login.firstCall.args[2]).to.equal('password');
				expect(t).to.equal(fakeToken);
			});
	}));

	it('prompts for username and password when they are not provided', withConsoleStubs(() => {
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

	it('does not retry after 3 attemps', withConsoleStubs(() => {
		sandbox.spy(cloud, 'login');
		cloud.newSpin = sandbox.stub();
		cloud.stopSpin = sandbox.stub();
		cloud.newSpin.returns({ start: sandbox.stub() });
		prompts.getCredentials = sandbox.stub();
		prompts.getCredentials.returns(fakeCredentials);
		api = { login: sandbox.stub() };
		api.login.throws();

		return cloud.login()
			.then(() => {
				throw new Error('expected promise to be rejected');
			})
			.catch(error => {
				const stdoutArgs = process.stdout.write.args;
				const lastLog = stdoutArgs[stdoutArgs.length - 1];

				expect(cloud.login).to.have.property('callCount', 3);
				expect(lastLog[0]).to.match(/There was an error logging you in! Let's try again.\n$/);
				expect(process.stderr.write).to.have.property('callCount', 3);
				expect(error).to.have.property('message', 'It seems we\'re having trouble with logging in.');
			});
	}));

	it('does not retry when username & password args are provided', withConsoleStubs(() => {
		sandbox.spy(cloud, 'login');
		api = { login: sandbox.stub() };
		api.login.throws();

		return cloud.login('username', 'password')
			.then(() => {
				throw new Error('expected promise to be rejected');
			})
			.catch(error => {
				const stdoutArgs = process.stdout.write.args;
				const lastLog = stdoutArgs[stdoutArgs.length - 1];

				expect(cloud.login).to.have.property('callCount', 1);
				expect(lastLog[0]).to.match(/There was an error logging you in! \n$/);
				expect(process.stderr.write).to.have.property('callCount', 1);
				expect(error).to.have.property('message', 'It seems we\'re having trouble with logging in.');
			});
	}));

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

