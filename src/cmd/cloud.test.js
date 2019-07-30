const proxyquire = require('proxyquire');
const { expect } = require('../../test/setup');
const sandbox = require('sinon').createSandbox();

const stubs = {
	api: {
		login: () => {},
		sendOtp: () => {},
		getUser: () => {}
	},
	utils: {},
	prompts: {
		getCredentials: () => {},
		getOtp: () => {}
	},
	settings: {
		clientId: 'CLITESTS',
		username: 'test@example.com',
		override: () => {}
	},
	ApiClient: function ApiClient(){
		return stubs.api;
	}
};

const CloudCommands = proxyquire('./cloud', {
	'../../settings': stubs.settings,
	'../lib/utilities': stubs.utils,
	'../lib/api-client': stubs.ApiClient,
	'../lib/prompts': stubs.prompts
});


describe('Cloud Commands', () => {
	let fakeToken, fakeTokenResponse, fakeCredentials, fakeUser;
	let fakeMfaToken, fakeOtp, fakeOtpError;

	beforeEach(() => {
		fakeToken = 'FAKE-ACCESS-TOKEN';
		fakeTokenResponse = { access_token: fakeToken };
		fakeCredentials = { username: 'test@example.com', password: 'fake-pw' };
		fakeUser = { username: 'test@example.com' };
		fakeMfaToken = 'abc1234';
		fakeOtp = '123456';
		fakeOtpError = { error: 'mfa_required', mfa_token: fakeMfaToken };
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('login', () => {
		it('accepts token arg', withConsoleStubs(() => {
			const { cloud, api, settings } = stubForLogin(new CloudCommands(), stubs);
			const { username } = fakeCredentials;
			api.getUser.resolves(fakeUser);

			return cloud.login({ token: fakeToken })
				.then(t => {
					expect(t).to.equal(fakeToken);
					expect(api.login).to.have.property('callCount', 0);
					expect(api.getUser).to.have.property('callCount', 1);
					expect(api.getUser.firstCall.args).to.eql([fakeToken]);
					expect(settings.override).to.have.property('callCount', 2);
					expect(settings.override.firstCall.args).to.eql([null, 'access_token', fakeToken]);
					expect(settings.override.secondCall.args).to.eql([null, 'username', username]);
				});
		}));

		it('accepts username and password args', withConsoleStubs(() => {
			const { cloud, api, settings } = stubForLogin(new CloudCommands(), stubs);
			const { username, password } = fakeCredentials;
			api.login.resolves(fakeTokenResponse);

			return cloud.login({ username, password })
				.then(t => {
					expect(t).to.equal(fakeToken);
					expect(api.login).to.have.property('callCount', 1);
					expect(api.login.firstCall).to.have.property('args').lengthOf(3);
					expect(api.login.firstCall.args[0]).to.equal(stubs.settings.clientId);
					expect(api.login.firstCall.args[1]).to.equal(username);
					expect(api.login.firstCall.args[2]).to.equal(password);
					expect(settings.override).to.have.property('callCount', 2);
					expect(settings.override.firstCall.args).to.eql([null, 'access_token', fakeToken]);
					expect(settings.override.secondCall.args).to.eql([null, 'username', username]);
				});
		}));

		it('prompts for username and password when they are not provided', withConsoleStubs(() => {
			const { cloud, api, prompts, settings } = stubForLogin(new CloudCommands(), stubs);
			const { username, password } = fakeCredentials;
			prompts.getCredentials.returns(fakeCredentials);
			api.login.resolves(fakeTokenResponse);

			return cloud.login()
				.then(t => {
					expect(t).to.equal(fakeToken);
					expect(prompts.getCredentials).to.have.property('callCount', 1);
					expect(cloud.newSpin).to.have.property('callCount', 1);
					expect(cloud.stopSpin).to.have.property('callCount', 1);
					expect(api.login).to.have.property('callCount', 1);
					expect(api.login.firstCall).to.have.property('args').lengthOf(3);
					expect(api.login.firstCall.args[0]).to.equal(stubs.settings.clientId);
					expect(api.login.firstCall.args[1]).to.equal(username);
					expect(api.login.firstCall.args[2]).to.equal(password);
					expect(settings.override).to.have.property('callCount', 2);
					expect(settings.override.firstCall.args).to.eql([null, 'access_token', fakeToken]);
					expect(settings.override.secondCall.args).to.eql([null, 'username', username]);
				});
		}));

		it('does not retry after 3 attemps', withConsoleStubs(() => {
			const { cloud, api, prompts, settings } = stubForLogin(new CloudCommands(), stubs);
			prompts.getCredentials.returns(fakeCredentials);
			api.login.throws();

			return cloud.login()
				.then(() => {
					throw new Error('expected promise to be rejected');
				})
				.catch(error => {
					const stdoutArgs = process.stdout.write.args;
					const lastLog = stdoutArgs[stdoutArgs.length - 1];

					expect(cloud.login).to.have.property('callCount', 3);
					expect(settings.override).to.have.property('callCount', 0);
					expect(lastLog[0]).to.match(/There was an error logging you in! Let's try again.\n$/);
					expect(process.stderr.write).to.have.property('callCount', 3);
					expect(error).to.have.property('message', 'It seems we\'re having trouble with logging in.');
				});
		}));

		it('does not retry when username & password args are provided', withConsoleStubs(() => {
			const { cloud, api, settings } = stubForLogin(new CloudCommands(), stubs);
			api.login.throws();

			return cloud.login({ username: 'username', password: 'password' })
				.then(() => {
					throw new Error('expected promise to be rejected');
				})
				.catch(error => {
					const stdoutArgs = process.stdout.write.args;
					const lastLog = stdoutArgs[stdoutArgs.length - 1];

					expect(cloud.login).to.have.property('callCount', 1);
					expect(settings.override).to.have.property('callCount', 0);
					expect(lastLog[0]).to.match(/There was an error logging you in! \n$/);
					expect(process.stderr.write).to.have.property('callCount', 1);
					expect(error).to.have.property('message', 'It seems we\'re having trouble with logging in.');
				});
		}));
	});

	describe('login with mfa', () => {
		it('accepts username, password and otp args', withConsoleStubs(() => {
			const { cloud, api, settings } = stubForLogin(new CloudCommands(), stubs);
			const { username, password } = fakeCredentials;
			api.login.rejects(fakeOtpError);
			api.sendOtp.resolves(fakeTokenResponse);

			return cloud.login({ username, password, otp: fakeOtp })
				.then(t => {
					expect(t).to.equal(fakeToken);
					expect(api.login).to.have.property('callCount', 1);
					expect(api.login.firstCall).to.have.property('args').lengthOf(3);
					expect(api.login.firstCall.args[0]).to.equal(stubs.settings.clientId);
					expect(api.login.firstCall.args[1]).to.equal(username);
					expect(api.login.firstCall.args[2]).to.equal(password);
					expect(api.sendOtp).to.have.property('callCount', 1);
					expect(api.sendOtp.firstCall).to.have.property('args').lengthOf(3);
					expect(api.sendOtp.firstCall.args[0]).to.equal(stubs.settings.clientId);
					expect(api.sendOtp.firstCall.args[1]).to.equal(fakeMfaToken);
					expect(api.sendOtp.firstCall.args[2]).to.equal(fakeOtp);
					expect(settings.override).to.have.property('callCount', 2);
					expect(settings.override.firstCall.args).to.eql([null, 'access_token', fakeToken]);
					expect(settings.override.secondCall.args).to.eql([null, 'username', username]);
				});
		}));

		it('prompts for username, password and otp when they are not provided', withConsoleStubs(() => {
			const { cloud, api, prompts, settings } = stubForLogin(new CloudCommands(), stubs);
			const { username, password } = fakeCredentials;
			prompts.getCredentials.returns(fakeCredentials);
			prompts.getOtp.returns(fakeOtp);
			api.login.rejects(fakeOtpError);
			api.sendOtp.resolves(fakeTokenResponse);

			return cloud.login()
				.then(t => {
					expect(t).to.equal(fakeToken);
					expect(prompts.getCredentials).to.have.property('callCount', 1);
					expect(prompts.getOtp).to.have.property('callCount', 1);
					expect(cloud.newSpin).to.have.property('callCount', 2);
					expect(cloud.stopSpin).to.have.property('callCount', 2);
					expect(api.login).to.have.property('callCount', 1);
					expect(api.login.firstCall).to.have.property('args').lengthOf(3);
					expect(api.login.firstCall.args[0]).to.equal(stubs.settings.clientId);
					expect(api.login.firstCall.args[1]).to.equal(username);
					expect(api.login.firstCall.args[2]).to.equal(password);
					expect(api.sendOtp).to.have.property('callCount', 1);
					expect(api.sendOtp.firstCall).to.have.property('args').lengthOf(3);
					expect(api.sendOtp.firstCall.args[0]).to.equal(stubs.settings.clientId);
					expect(api.sendOtp.firstCall.args[1]).to.equal(fakeMfaToken);
					expect(api.sendOtp.firstCall.args[2]).to.equal(fakeOtp);
					expect(settings.override).to.have.property('callCount', 2);
					expect(settings.override.firstCall.args).to.eql([null, 'access_token', fakeToken]);
					expect(settings.override.secondCall.args).to.eql([null, 'username', username]);
				});
		}));

		it('does not retry after 3 attemps', withConsoleStubs(() => {
			const { cloud, api, prompts, settings } = stubForLogin(new CloudCommands(), stubs);
			prompts.getCredentials.returns(fakeCredentials);
			prompts.getOtp.returns(fakeOtp);
			api.login.rejects(fakeOtpError);
			api.sendOtp.throws();

			return cloud.login()
				.then(() => {
					throw new Error('expected promise to be rejected');
				})
				.catch(error => {
					const stdoutArgs = process.stdout.write.args;
					const lastLog = stdoutArgs[stdoutArgs.length - 1];

					expect(cloud.login).to.have.property('callCount', 1);
					expect(cloud.enterOtp).to.have.property('callCount', 3);
					expect(settings.override).to.have.property('callCount', 0);
					expect(lastLog[0]).to.match(/There was an error logging you in! Let's try again.\n$/);
					expect(process.stderr.write).to.have.property('callCount', 4);
					expect(error).to.have.property('message', 'It seems we\'re having trouble with logging in.');
				});
		}));
	});


	function stubForLogin(cloud, stubs){
		const { api, prompts, settings } = stubs;
		sandbox.spy(cloud, 'login');
		sandbox.spy(cloud, 'enterOtp');
		sandbox.stub(cloud, 'newSpin');
		sandbox.stub(cloud, 'stopSpin');
		cloud.newSpin.returns({ start: sandbox.stub() });
		sandbox.stub(api, 'login');
		sandbox.stub(api, 'sendOtp');
		sandbox.stub(api, 'getUser');
		sandbox.stub(prompts, 'getCredentials');
		sandbox.stub(prompts, 'getOtp');
		sandbox.stub(settings, 'override');
		return { cloud, api, prompts, settings };
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

