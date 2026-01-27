'use strict';

const { expect, sinon } = require('../../test/setup');
const proxyquire = require('proxyquire');
const VError = require('verror');
const nock = require('nock');

describe('AuthHandler', () => {
	let authHandler;
	let sandbox;
	let settingsStub;
	let ApiClientStub;
	let CloudCommandStub;
	let chalkStub;

	beforeEach(() => {
		sandbox = sinon.createSandbox();

		// Stub settings
		settingsStub = {
			access_token: null
		};

		// Stub ApiClient
		ApiClientStub = sandbox.stub();
		ApiClientStub.prototype.getCurrentToken = sandbox.stub();

		// Stub CloudCommand
		CloudCommandStub = sandbox.stub();
		CloudCommandStub.prototype.login = sandbox.stub();

		// Stub chalk
		chalkStub = {
			yellow: sandbox.stub().returnsArg(0),
			bold: {
				cyan: sandbox.stub().returnsArg(0)
			}
		};

		// Load AuthHandler with stubs using proxyquire
		// This will reload the module with our stubs
		authHandler = proxyquire('./auth-handler', {
			'../../settings': settingsStub,
			'./api-client': ApiClientStub,
			'../cmd/cloud': CloudCommandStub,
			'chalk': chalkStub
		});
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('isAuthError', () => {
		it('returns false for null/undefined error', () => {
			expect(authHandler.isAuthError(null)).to.equal(false);
			expect(authHandler.isAuthError(undefined)).to.equal(false);
		});

		it('detects 401 status code', () => {
			const error = { statusCode: 401 };
			expect(authHandler.isAuthError(error)).to.equal(true);
		});

		it('detects 403 status code', () => {
			const error = { statusCode: 403 };
			expect(authHandler.isAuthError(error)).to.equal(true);
		});

		it('does not detect 400 status code as auth error', () => {
			const error = { statusCode: 400 };
			expect(authHandler.isAuthError(error)).to.equal(false);
		});

		it('does not detect 404 status code as auth error', () => {
			const error = { statusCode: 404 };
			expect(authHandler.isAuthError(error)).to.equal(false);
		});

		it('detects invalid_token in error.error', () => {
			const error = { error: 'invalid_token' };
			expect(authHandler.isAuthError(error)).to.equal(true);
		});

		it('detects invalid_token in error.body.error', () => {
			const error = { body: { error: 'invalid_token' } };
			expect(authHandler.isAuthError(error)).to.equal(true);
		});

		it('detects UnauthorizedError by name', () => {
			const error = { name: 'UnauthorizedError', message: 'Unauthorized' };
			expect(authHandler.isAuthError(error)).to.equal(true);
		});

		it('detects "not logged in" message', () => {
			const error = { message: 'You are not logged in' };
			expect(authHandler.isAuthError(error)).to.equal(true);
		});

		it('detects "invalid token" message variations', () => {
			expect(authHandler.isAuthError({ message: 'Invalid token' })).to.equal(true);
			expect(authHandler.isAuthError({ message: 'Invalid access token' })).to.equal(true);
			expect(authHandler.isAuthError({ message: 'Token invalid' })).to.equal(true);
			expect(authHandler.isAuthError({ message: 'The token is invalid' })).to.equal(true);
		});

		it('detects "token expired" message variations', () => {
			expect(authHandler.isAuthError({ message: 'Token expired' })).to.equal(true);
			expect(authHandler.isAuthError({ message: 'Token has expired' })).to.equal(true);
			expect(authHandler.isAuthError({ message: 'Expired token' })).to.equal(true);
			expect(authHandler.isAuthError({ message: 'Your access token has expired' })).to.equal(true);
		});

		it('detects "unauthorized" message', () => {
			expect(authHandler.isAuthError({ message: 'Unauthorized' })).to.equal(true);
			expect(authHandler.isAuthError({ message: 'unauthorized request' })).to.equal(true);
		});

		it('detects "authentication failed" message', () => {
			expect(authHandler.isAuthError({ message: 'Authentication failed' })).to.equal(true);
			expect(authHandler.isAuthError({ message: 'Authentication has failed' })).to.equal(true);
		});

		it('detects "authentication required" message', () => {
			expect(authHandler.isAuthError({ message: 'Authentication required' })).to.equal(true);
			expect(authHandler.isAuthError({ message: 'Authentication is required' })).to.equal(true);
		});

		it('is case-insensitive for message patterns', () => {
			expect(authHandler.isAuthError({ message: 'INVALID TOKEN' })).to.equal(true);
			expect(authHandler.isAuthError({ message: 'Not Logged In' })).to.equal(true);
		});

		it('returns false for non-auth errors', () => {
			expect(authHandler.isAuthError({ statusCode: 500 })).to.equal(false);
			expect(authHandler.isAuthError({ message: 'Network error' })).to.equal(false);
			expect(authHandler.isAuthError({ message: 'Device not found' })).to.equal(false);
		});
	});

	describe('hasToken', () => {
		it('returns true when token exists', () => {
			settingsStub.access_token = 'fake-token';
			expect(authHandler.hasToken()).to.equal(true);
		});

		it('returns false when token is null', () => {
			settingsStub.access_token = null;
			expect(authHandler.hasToken()).to.equal(false);
		});

		it('returns false when token is undefined', () => {
			settingsStub.access_token = undefined;
			expect(authHandler.hasToken()).to.equal(false);
		});

		it('returns false when token is empty string', () => {
			settingsStub.access_token = '';
			expect(authHandler.hasToken()).to.equal(false);
		});
	});

	describe('validateToken', () => {
		it('returns false when no token exists', async () => {
			settingsStub.access_token = null;
			const result = await authHandler.validateToken();
			expect(result).to.equal(false);
			expect(ApiClientStub.prototype.getCurrentToken).to.not.have.been.called;
		});

		it('returns true when API call succeeds', async () => {
			settingsStub.access_token = 'fake-token';
			ApiClientStub.prototype.getCurrentToken.resolves({ token: 'fake-token' });

			const result = await authHandler.validateToken();
			expect(result).to.equal(true);
			expect(ApiClientStub.prototype.getCurrentToken).to.have.been.calledOnce;
		});

		it('returns false when API call fails', async () => {
			settingsStub.access_token = 'fake-token';
			ApiClientStub.prototype.getCurrentToken.rejects(new Error('API error'));

			const result = await authHandler.validateToken();
			expect(result).to.equal(false);
		});

		it('returns false when API returns 401', async () => {
			settingsStub.access_token = 'fake-token';
			const error = new Error('Unauthorized');
			error.statusCode = 401;
			ApiClientStub.prototype.getCurrentToken.rejects(error);

			const result = await authHandler.validateToken();
			expect(result).to.equal(false);
		});
	});

	describe('promptLogin', () => {
		let uiStub;

		beforeEach(() => {
			uiStub = {
				stdin: process.stdin,
				stdout: process.stdout,
				stderr: process.stderr,
				write: sandbox.stub()
			};
		});

		it('throws error when ui is not provided', async () => {
			try {
				await authHandler.promptLogin();
				expect.fail('should have thrown');
			} catch (error) {
				expect(error.message).to.include('UI instance is required');
			}
		});

		it('calls CloudCommand.login and returns token', async () => {
			CloudCommandStub.prototype.login.resolves('new-token');

			const result = await authHandler.promptLogin(uiStub);

			expect(result).to.equal('new-token');
			expect(CloudCommandStub).to.have.been.calledOnce;
			expect(CloudCommandStub.prototype.login).to.have.been.calledOnce;
			expect(uiStub.write).to.have.been.calledWith(
				sinon.match(/Authentication required/)
			);
		});
	});

	describe('handleAuthError', () => {
		it('re-throws non-auth errors', async () => {
			const error = new Error('Network error');

			try {
				await authHandler.handleAuthError(error);
				expect.fail('should have thrown');
			} catch (err) {
				expect(err.message).to.equal('Network error');
			}
		});

		it('returns fallback for optional auth', async () => {
			const error = { statusCode: 401 };
			const result = await authHandler.handleAuthError(error, {
				optional: true,
				fallback: 'default-value'
			});

			expect(result).to.equal('default-value');
		});

		it('throws VError when no token and auth is required', async () => {
			settingsStub.access_token = null;
			const error = { statusCode: 401 };

			try {
				await authHandler.handleAuthError(error);
				expect.fail('should have thrown');
			} catch (err) {
				expect(err).to.be.instanceOf(VError);
				expect(err.message).to.include('not logged in');
				expect(err.message).to.include('particle login');
			}
		});

		it('throws VError when token exists but is invalid', async () => {
			settingsStub.access_token = 'fake-token';
			const error = { statusCode: 401 };

			try {
				await authHandler.handleAuthError(error);
				expect.fail('should have thrown');
			} catch (err) {
				expect(err).to.be.instanceOf(VError);
				expect(err.message).to.include('expired or is invalid');
				expect(err.message).to.include('particle login');
			}
		});
	});

	describe('ensureToken', () => {
		it('throws when no token exists', async () => {
			settingsStub.access_token = null;

			try {
				await authHandler.ensureToken();
				expect.fail('should have thrown');
			} catch (error) {
				expect(error).to.be.instanceOf(VError);
				expect(error.message).to.include('not logged in');
			}
		});

		it('succeeds when token exists and no validation requested', async () => {
			settingsStub.access_token = 'fake-token';
			await authHandler.ensureToken();
			// Should not throw
			expect(ApiClientStub.prototype.getCurrentToken).to.not.have.been.called;
		});

		it('validates token via API when validateToken is true', async () => {
			settingsStub.access_token = 'fake-token';
			ApiClientStub.prototype.getCurrentToken.resolves({});

			await authHandler.ensureToken({ validateToken: true });

			expect(ApiClientStub.prototype.getCurrentToken).to.have.been.calledOnce;
		});

		it('throws when token validation fails', async () => {
			settingsStub.access_token = 'fake-token';
			ApiClientStub.prototype.getCurrentToken.rejects(new Error('Invalid'));

			try {
				await authHandler.ensureToken({ validateToken: true });
				expect.fail('should have thrown');
			} catch (error) {
				expect(error).to.be.instanceOf(VError);
				expect(error.message).to.include('expired or is invalid');
			}
		});
	});

	describe('ensureTokenWithLogin', () => {
		let uiStub;
		let originalIsInteractive;

		beforeEach(() => {
			originalIsInteractive = global.isInteractive;
			uiStub = {
				stdin: process.stdin,
				stdout: process.stdout,
				stderr: process.stderr,
				write: sandbox.stub()
			};
		});

		afterEach(() => {
			global.isInteractive = originalIsInteractive;
		});

		it('throws when ui is not provided', async () => {
			try {
				await authHandler.ensureTokenWithLogin();
				expect.fail('should have thrown');
			} catch (error) {
				expect(error.message).to.include('UI instance is required');
			}
		});

		it('prompts login when no token and interactive', async () => {
			global.isInteractive = true;
			settingsStub.access_token = null;
			CloudCommandStub.prototype.login.resolves('new-token');

			await authHandler.ensureTokenWithLogin(uiStub);

			expect(CloudCommandStub.prototype.login).to.have.been.calledOnce;
		});

		it('throws when no token and non-interactive', async () => {
			global.isInteractive = false;
			settingsStub.access_token = null;

			try {
				await authHandler.ensureTokenWithLogin(uiStub);
				expect.fail('should have thrown');
			} catch (error) {
				expect(error).to.be.instanceOf(VError);
				expect(error.message).to.include('not logged in');
			}
		});

		it('succeeds when token exists and no validation', async () => {
			settingsStub.access_token = 'fake-token';

			await authHandler.ensureTokenWithLogin(uiStub);

			expect(CloudCommandStub.prototype.login).to.not.have.been.called;
			expect(ApiClientStub.prototype.getCurrentToken).to.not.have.been.called;
		});

		it('validates token when validateToken is true', async () => {
			settingsStub.access_token = 'fake-token';
			ApiClientStub.prototype.getCurrentToken.resolves({});

			await authHandler.ensureTokenWithLogin(uiStub, { validateToken: true });

			expect(ApiClientStub.prototype.getCurrentToken).to.have.been.calledOnce;
			expect(CloudCommandStub.prototype.login).to.not.have.been.called;
		});

		it('prompts login when token invalid and interactive', async () => {
			global.isInteractive = true;
			settingsStub.access_token = 'fake-token';
			ApiClientStub.prototype.getCurrentToken.rejects(new Error('Invalid'));
			CloudCommandStub.prototype.login.resolves('new-token');

			await authHandler.ensureTokenWithLogin(uiStub, { validateToken: true });

			expect(ApiClientStub.prototype.getCurrentToken).to.have.been.calledOnce;
			expect(CloudCommandStub.prototype.login).to.have.been.calledOnce;
		});

		it('throws when token invalid and non-interactive', async () => {
			global.isInteractive = false;
			settingsStub.access_token = 'fake-token';
			ApiClientStub.prototype.getCurrentToken.rejects(new Error('Invalid'));

			try {
				await authHandler.ensureTokenWithLogin(uiStub, { validateToken: true });
				expect.fail('should have thrown');
			} catch (error) {
				expect(error).to.be.instanceOf(VError);
				expect(error.message).to.include('expired or is invalid');
			}
		});
	});

	describe('withRequiredAuth', () => {
		it('executes function successfully with valid token', async () => {
			settingsStub.access_token = 'fake-token';
			const fn = sandbox.stub().resolves('success');

			const result = await authHandler.withRequiredAuth(fn);

			expect(result).to.equal('success');
			expect(fn).to.have.been.calledOnce;
		});

		it('throws when no token', async () => {
			settingsStub.access_token = null;
			const fn = sandbox.stub().resolves('success');

			try {
				await authHandler.withRequiredAuth(fn);
				expect.fail('should have thrown');
			} catch (error) {
				expect(error).to.be.instanceOf(VError);
				expect(error.message).to.include('not logged in');
				expect(fn).to.not.have.been.called;
			}
		});

		it('validates token when validateToken is true', async () => {
			settingsStub.access_token = 'fake-token';
			ApiClientStub.prototype.getCurrentToken.resolves({});
			const fn = sandbox.stub().resolves('success');

			const result = await authHandler.withRequiredAuth(fn, { validateToken: true });

			expect(result).to.equal('success');
			expect(ApiClientStub.prototype.getCurrentToken).to.have.been.calledOnce;
			expect(fn).to.have.been.calledOnce;
		});

		it('handles auth error during execution', async () => {
			settingsStub.access_token = 'fake-token';
			const authError = { statusCode: 401 };
			const fn = sandbox.stub().rejects(authError);

			try {
				await authHandler.withRequiredAuth(fn);
				expect.fail('should have thrown');
			} catch (error) {
				expect(error).to.be.instanceOf(VError);
				expect(error.message).to.include('access token is invalid');
			}
		});

		it('re-throws non-auth errors', async () => {
			settingsStub.access_token = 'fake-token';
			const networkError = new Error('Network error');
			const fn = sandbox.stub().rejects(networkError);

			try {
				await authHandler.withRequiredAuth(fn);
				expect.fail('should have thrown');
			} catch (error) {
				expect(error.message).to.equal('Network error');
			}
		});
	});

	describe('withOptionalAuth', () => {
		it('executes function successfully', async () => {
			const fn = sandbox.stub().resolves('success');

			const result = await authHandler.withOptionalAuth(fn);

			expect(result).to.equal('success');
			expect(fn).to.have.been.calledOnce;
		});

		it('returns fallback on auth error', async () => {
			const authError = { statusCode: 401 };
			const fn = sandbox.stub().rejects(authError);

			const result = await authHandler.withOptionalAuth(fn, {
				fallback: 'fallback-value'
			});

			expect(result).to.equal('fallback-value');
		});

		it('returns null fallback by default', async () => {
			const authError = { statusCode: 401 };
			const fn = sandbox.stub().rejects(authError);

			const result = await authHandler.withOptionalAuth(fn);

			expect(result).to.equal(null);
		});

		it('re-throws non-auth errors', async () => {
			const networkError = new Error('Network error');
			const fn = sandbox.stub().rejects(networkError);

			try {
				await authHandler.withOptionalAuth(fn, { fallback: 'fallback' });
				expect.fail('should have thrown');
			} catch (error) {
				expect(error.message).to.equal('Network error');
			}
		});
	});

	describe('withInteractiveAuth', () => {
		let uiStub;
		let originalIsInteractive;

		beforeEach(() => {
			originalIsInteractive = global.isInteractive;
			global.isInteractive = true;
			uiStub = {
				stdin: process.stdin,
				stdout: process.stdout,
				stderr: process.stderr,
				write: sandbox.stub()
			};
		});

		afterEach(() => {
			global.isInteractive = originalIsInteractive;
		});

		it('throws when ui is not provided', async () => {
			const fn = sandbox.stub().resolves('success');

			try {
				await authHandler.withInteractiveAuth(fn);
				expect.fail('should have thrown');
			} catch (error) {
				expect(error.message).to.include('UI instance is required');
			}
		});

		it('prompts login and executes function when no token', async () => {
			settingsStub.access_token = null;
			CloudCommandStub.prototype.login.resolves('new-token');
			const fn = sandbox.stub().resolves('success');

			const result = await authHandler.withInteractiveAuth(fn, { ui: uiStub });

			expect(result).to.equal('success');
			expect(CloudCommandStub.prototype.login).to.have.been.calledOnce;
			expect(fn).to.have.been.calledOnce;
		});

		it('executes function without login when token exists', async () => {
			settingsStub.access_token = 'fake-token';
			const fn = sandbox.stub().resolves('success');

			const result = await authHandler.withInteractiveAuth(fn, { ui: uiStub });

			expect(result).to.equal('success');
			expect(CloudCommandStub.prototype.login).to.not.have.been.called;
			expect(fn).to.have.been.calledOnce;
		});

		it('validates token when validateToken is true', async () => {
			settingsStub.access_token = 'fake-token';
			ApiClientStub.prototype.getCurrentToken.resolves({});
			const fn = sandbox.stub().resolves('success');

			const result = await authHandler.withInteractiveAuth(fn, {
				ui: uiStub,
				validateToken: true
			});

			expect(result).to.equal('success');
			expect(ApiClientStub.prototype.getCurrentToken).to.have.been.calledOnce;
			expect(fn).to.have.been.calledOnce;
		});

		it('handles auth error during execution', async () => {
			settingsStub.access_token = 'fake-token';
			const authError = { statusCode: 401 };
			const fn = sandbox.stub().rejects(authError);

			try {
				await authHandler.withInteractiveAuth(fn, { ui: uiStub });
				expect.fail('should have thrown');
			} catch (error) {
				expect(error).to.be.instanceOf(VError);
				expect(error.message).to.include('Authentication failed');
			}
		});

		it('re-throws non-auth errors', async () => {
			settingsStub.access_token = 'fake-token';
			const networkError = new Error('Network error');
			const fn = sandbox.stub().rejects(networkError);

			try {
				await authHandler.withInteractiveAuth(fn, { ui: uiStub });
				expect.fail('should have thrown');
			} catch (error) {
				expect(error.message).to.equal('Network error');
			}
		});
	});
});

describe('AuthHandler - API Integration Tests (with nock)', () => {
	let authHandler;
	let settings;

	beforeEach(() => {
		// Use real settings and ApiClient, but intercept HTTP with nock
		settings = require('../../settings');
		settings.access_token = 'test-token-12345';
		settings.apiUrl = 'https://api.particle.io';

		// Clear module cache to get fresh instance
		delete require.cache[require.resolve('./auth-handler')];
		authHandler = require('./auth-handler');
	});

	afterEach(() => {
		nock.cleanAll();
		settings.access_token = null;
	});

	describe('validateToken with real API client', () => {
		it('calls GET /v1/access_tokens/current with correct headers', async () => {
			const apiMock = nock('https://api.particle.io')
				.get('/v1/access_tokens/current')
				.matchHeader('authorization', 'Bearer test-token-12345')
				.reply(200, {
					token: 'test-token-12345',
					expires_at: '2026-12-31T23:59:59.000Z'
				});

			const result = await authHandler.validateToken();

			expect(result).to.equal(true);
			expect(apiMock.isDone()).to.equal(true);
		});

		it('returns false when API returns 401', async () => {
			const apiMock = nock('https://api.particle.io')
				.get('/v1/access_tokens/current')
				.matchHeader('authorization', 'Bearer test-token-12345')
				.reply(401, {
					error: 'invalid_token',
					error_description: 'The access token provided is invalid'
				});

			const result = await authHandler.validateToken();

			expect(result).to.equal(false);
			expect(apiMock.isDone()).to.equal(true);
		});


		it('returns false when network error occurs', async () => {
			const apiMock = nock('https://api.particle.io')
				.get('/v1/access_tokens/current')
				.replyWithError('Network connection failed');

			const result = await authHandler.validateToken();

			expect(result).to.equal(false);
			expect(apiMock.isDone()).to.equal(true);
		});
	});

	describe('ensureToken with validateToken flag', () => {
		it('validates token via real API endpoint', async () => {
			const apiMock = nock('https://api.particle.io')
				.get('/v1/access_tokens/current')
				.matchHeader('authorization', 'Bearer test-token-12345')
				.reply(200, {
					token: 'test-token-12345',
					expires_at: '2026-12-31T23:59:59.000Z'
				});

			await authHandler.ensureToken({ validateToken: true });

			expect(apiMock.isDone()).to.equal(true);
		});

		it('throws when API returns invalid token', async () => {
			const apiMock = nock('https://api.particle.io')
				.get('/v1/access_tokens/current')
				.reply(401, { error: 'invalid_token' });

			try {
				await authHandler.ensureToken({ validateToken: true });
				expect.fail('should have thrown');
			} catch (error) {
				expect(error).to.be.instanceOf(VError);
				expect(error.message).to.include('expired or is invalid');
			}

			expect(apiMock.isDone()).to.equal(true);
		});
	});
});

