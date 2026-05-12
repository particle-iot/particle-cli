'use strict';
const { expect, sinon } = require('../../test/setup');
const settings = require('../../settings');
const ParticleApi = require('./api');
const AccessTokenCommands = require('./token');
const CloudCommand = require('./cloud');

describe('AccessTokenCommands', () => {
	const sandbox = sinon.createSandbox();
	let logStub;
	let errorStub;

	beforeEach(() => {
		sandbox.stub(settings, 'access_token').value('current-token');
		sandbox.stub(settings, 'username').value('me@example.com');
		logStub = sandbox.stub(console, 'log');
		errorStub = sandbox.stub(console, 'error');
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('revokeAccessToken', () => {
		it('returns -1 with no tokens', async () => {
			const cmd = new AccessTokenCommands();
			const result = await cmd.revokeAccessToken([], { force: false });
			expect(result).to.equal(-1);
			expect(errorStub).to.have.been.calledWithMatch(/must provide at least one access token/);
		});

		it('refuses to revoke the current CLI token unless --force', async () => {
			const cmd = new AccessTokenCommands();
			const result = await cmd.revokeAccessToken(['current-token'], { force: false });
			expect(result).to.equal(-1);
			expect(logStub).to.have.been.calledWithMatch(/use --force to delete it/);
		});

		it('revokes each provided token via ParticleApi', async () => {
			const stub = sandbox.stub(ParticleApi.prototype, 'revokeAccessToken').resolves();
			const cmd = new AccessTokenCommands();
			await cmd.revokeAccessToken(['t1', 't2'], { force: false });
			expect(stub).to.have.been.calledTwice;
			expect(stub.firstCall).to.have.been.calledWith({ token: 't1' });
			expect(stub.secondCall).to.have.been.calledWith({ token: 't2' });
			expect(logStub).to.have.been.calledWithMatch(/Successfully revoked/);
		});

		it('returns -1 and reports each failure when revocations reject', async () => {
			sandbox.stub(ParticleApi.prototype, 'revokeAccessToken')
				.onFirstCall().resolves()
				.onSecondCall().rejects(new Error('boom'));
			const cmd = new AccessTokenCommands();
			const result = await cmd.revokeAccessToken(['ok-token', 'bad-token'], { force: false });
			expect(result).to.equal(-1);
			expect(errorStub).to.have.been.calledWithMatch(/Failed to revoke/);
		});
	});

	describe('createAccessToken', () => {
		it('detects MFA via typed error and routes to enterOtp', async () => {
			const cmd = new AccessTokenCommands();
			sandbox.stub(cmd, 'getCredentials').resolves({ username: 'u', password: 'p' });
			const mfaErr = { error: 'mfa_required', mfa_token: 'mfa-xyz' };
			sandbox.stub(ParticleApi.prototype, 'createAccessToken').rejects(mfaErr);
			const enterOtpStub = sandbox.stub(CloudCommand.prototype, 'enterOtp').resolves();

			await cmd.createAccessToken({ expiresIn: 3600 });

			expect(enterOtpStub).to.have.been.calledWith(sinon.match({ mfaToken: 'mfa-xyz' }));
		});

		it('prints the access token + expiry on success', async () => {
			const cmd = new AccessTokenCommands();
			sandbox.stub(cmd, 'getCredentials').resolves({ username: 'u', password: 'p' });
			sandbox.stub(ParticleApi.prototype, 'createAccessToken').resolves({
				access_token: 'new-token',
				expires_in: 3600
			});

			await cmd.createAccessToken({ expiresIn: 3600 });

			expect(logStub).to.have.been.calledWithMatch(/expires on/);
			expect(logStub).to.have.been.calledWithMatch(/new-token/);
		});

		it('prints "never expires" when expires_in is missing', async () => {
			const cmd = new AccessTokenCommands();
			sandbox.stub(cmd, 'getCredentials').resolves({ username: 'u', password: 'p' });
			sandbox.stub(ParticleApi.prototype, 'createAccessToken').resolves({
				access_token: 'forever-token'
			});

			await cmd.createAccessToken({ neverExpires: true });

			expect(logStub).to.have.been.calledWithMatch(/never expires/);
			expect(logStub).to.have.been.calledWithMatch(/forever-token/);
		});
	});
});
